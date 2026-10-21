#!/usr/bin/env python3
"""fetch_5etools.py — Scarica i dataset 5e.tools dal mirror ufficiale in public-site/data/5etools/.

Uso: py fetch_5etools.py [--force]
- Con cache: salta i file già presenti (skip se size > 0 e mtime < 7gg)
- Scarica SOLO i file dati (salta fluff-*, foundry-*, renderexperimental)
- Popola la struttura identica al mirror per il lookup client-side locale (zero CORS)
- Al termine genera public-site/data/index.json (mappa source -> file) per il lookup

Mirror ufficiale: github.com/5etools-mirror-3/5etools-src (v2.35.1)
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

TAG = "v2.38.0"
BASE = Path(r"C:\Users\Fabrizio\workspace\public-site\data\5etools")
RAW = "https://raw.githubusercontent.com/5etools-mirror-3/5etools-src"
API = "https://api.github.com/repos/5etools-mirror-3/5etools-src/contents"
MIRROR_STATE = Path(r"C:\Users\Fabrizio\workspace\public-site\data\5etools-version.json")

SKIP_PREFIXES = ("fluff-", "foundry-", "msbcr", "makecards", "makebrew", "renderdemo", "converter.json")
DATA_DIRS = ["", "bestiary/", "spells/", "class/", "generated/"]


def http_get(url: str, timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "site-builder/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def list_dir(path: str) -> list[dict]:
    d = json.loads(http_get(f"{API}/{path}?ref={TAG}").decode("utf-8"))
    return [x for x in d if x["type"] == "file"]


def download_file(rel: str) -> tuple[str, bool]:
    """Scarica il file rel sotto DATA_DIRS. Ritorna (rel, skipped_bool)."""
    dest = BASE / rel
    skip = False
    if dest.exists() and dest.stat().st_size > 0:
        age_d = (time.time() - dest.stat().st_mtime) / 86400
        if age_d < 7 and not FORCE:
            skip = True
    if not skip:
        try:
            data = http_get(f"{RAW}/{TAG}/data/{rel}")
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
        except Exception as e:
            return (rel, False) if dest.exists() else (rel, True)  # (rel, failed)
    return (rel, skip)


def main() -> None:
    global FORCE
    FORCE = "--force" in sys.argv

    BASE.mkdir(parents=True, exist_ok=True)
    files: list[str] = []

    # dato/  root files
    for f in list_dir("data"):
        name = f["name"]
        if name.startswith(SKIP_PREFIXES):
            continue
        files.append(name)

    # bestiary/
    for f in list_dir("data/bestiary"):
        if not f["name"].startswith("fluff"):
            files.append(f"bestiary/{f['name']}")

    # spells/  (solo file dati, non fluff/foundry/index)
    for f in list_dir("data/spells"):
        if f["name"].startswith("fluff") or f["name"] in ("foundry.json", "index.json", "sources.json", "airship.json"):
            continue
        files.append(f"spells/{f['name']}")

    # class/ + generated/  (classi, sottoclassi, feature — il lookup prima non li aveva)
    for subdir in ("class", "generated"):
        try:
            for f in list_dir(f"data/{subdir}"):
                n = f["name"]
                if n.startswith(SKIP_PREFIXES) or n in ("index.json", "sources.json", "foundry.json"):
                    continue
                files.append(f"{subdir}/{n}")
        except Exception:
            continue

    print(f"Target: {len(files)} file")

    failed: list[str] = []
    downloaded = 0
    skipped = 0
    t0 = time.time()

    with ThreadPoolExecutor(max_workers=12) as ex:
        futs = {ex.submit(download_file, rel): rel for rel in files}
        for fut in as_completed(futs):
            rel, kind = fut.result()
            if kind is True:  # failed
                failed.append(rel)
            elif kind is False:
                downloaded += 1
            else:
                skipped += 1

    # State / version marker
    MIRROR_STATE.write_text(json.dumps({
        "tag": TAG, "source": "5etools-mirror-3/5etools-src",
        "files": len(files), "downloaded": downloaded, "skipped": skipped,
        "failed": failed, "elapsed_s": round(time.time() - t0, 1),
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    total_mb = sum(p.stat().st_size for p in BASE.rglob("*") if p.is_file()) / 1048576
    print(f"Fatto: {downloaded} nuovi, {skipped} in cache, totale {total_mb:.1f} MB, {len(failed)} falliti")
    if failed:
        print("Falliti:", failed[:20], f"(+{len(failed)-20} se >20)" if len(failed) > 20 else "")


if __name__ == "__main__":
    main()
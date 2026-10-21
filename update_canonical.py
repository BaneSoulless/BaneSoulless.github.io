# -*- coding: utf-8 -*-
"""update_canonical.py <url> <backend>

Riallinea canonical, og:url, JSON-LD e robots.txt `Sitemap:` delle 6 pagine del
sito statico al tunnel attivo. Idempotente e SAFE: il blocco JSON-LD viene
parsato con json, riscritto con un walk ricorsivo su tutte le stringhe e
ri-serializzato — mai regex sul JSON, per non corromperlo (le regex applicate a
mano su un blocco JSON sono la causa nota di JSON-LD invalido).

Invocato da restart-site.sh a ogni restart del tunnel. Per rigenerare tutto dai
template usare comunque `python build_site.py` (fonte di verita').
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path

SITE_DIR = Path(__file__).parent
# Le pagine si leggono DALLA CARTELLA, non da un elenco scritto a mano: un elenco
# fisso era rimasto a 6 voci, così dopo ogni rotazione del tunnel `tavolo.html` e
# `personaggi.html` restavano con canonical/og di un URL morto.
PAGES = sorted(f.name for f in SITE_DIR.glob("*.html") if f.is_file())

# Qualsiasi base-URL precedente: host ephemeri di tunnel noti + localhost.
BASE_RE = (
    r"https?://[a-z0-9][a-z0-9\-]*\.(?:trycloudflare\.com|pinggy\.io|pinggy\.link|pinggy\.net|loca\.lt)"
    r"|https?://(?:localhost|127\.0\.0\.1)(?::\d+)?"
)
BASE_COMPILED = re.compile(BASE_RE)
LD_RE = re.compile(r'(<script type="application/ld\+json">)(.*?)(</script>)', re.S)
CANON_RE = re.compile(r'(<link rel="canonical" href=")[^"]*(")')
OGURL_RE = re.compile(r'(<meta property="og:url" content=")[^"]*(")')


def _walk_replace(obj: object, base: str) -> object:
    """Sostituisce ricorsivamente ogni base-URL con quella nuova (dict/list/str)."""
    if isinstance(obj, str):
        return BASE_COMPILED.sub(base, obj)
    if isinstance(obj, list):
        return [_walk_replace(x, base) for x in obj]
    if isinstance(obj, dict):
        return {k: _walk_replace(v, base) for k, v in obj.items()}
    return obj


def rewrite_ld_block(match: re.Match[str], base: str) -> str:
    head, body, tail = match.group(1), match.group(2), match.group(3)
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        # Blocco gia' corrotto a monte: non lo tocchiamo (va rigenerato col build).
        return match.group(0)
    return head + json.dumps(_walk_replace(data, base), ensure_ascii=False, separators=(", ", ": ")) + tail


def rewrite_page(path: Path, page: str, base: str) -> str:
    src = path.read_text(encoding="utf-8")
    original = src
    canonical = f"{base}/{page}"

    src = CANON_RE.sub(lambda m: f"{m.group(1)}{canonical}{m.group(2)}", src, count=1)
    src = OGURL_RE.sub(lambda m: f"{m.group(1)}{canonical}{m.group(2)}", src, count=1)
    src = LD_RE.sub(lambda m: rewrite_ld_block(m, base), src)

    if src == original:
        return "unchanged"
    path.write_text(src, encoding="utf-8")
    return "REWRITTEN"


def rewrite_sitemap_and_robots(base: str) -> list[str]:
    changed: list[str] = []
    sm = SITE_DIR / "sitemap.xml"
    if sm.exists():
        src = sm.read_text(encoding="utf-8")
        new = BASE_COMPILED.sub(base, src)
        if new != src:
            sm.write_text(new, encoding="utf-8")
            changed.append("sitemap.xml")
    rb = SITE_DIR / "robots.txt"
    if rb.exists():
        src = rb.read_text(encoding="utf-8")
        new = re.sub(r"(Sitemap:\s*)\S*", lambda m: f"{m.group(1)}{base}/sitemap.xml", src)
        if new != src:
            rb.write_text(new, encoding="utf-8")
            changed.append("robots.txt")
    return changed


def _jsonld_broken_pages() -> list[str]:
    broken: list[str] = []
    for p in PAGES:
        fp = SITE_DIR / p
        if not fp.exists():
            continue
        for _head, body, _tail in LD_RE.findall(fp.read_text(encoding="utf-8")):
            try:
                json.loads(body)
            except json.JSONDecodeError:
                broken.append(p)
                break
    return broken


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: update_canonical.py <url> <backend>", file=sys.stderr)
        return 2
    base = sys.argv[1].rstrip("/")
    backend = sys.argv[2]

    state = {
        "backend": backend,
        "url": base,
        "updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
    (SITE_DIR / "current-url.json").write_text(
        json.dumps(state, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )

    results = {p: rewrite_page(SITE_DIR / p, p, base) for p in PAGES if (SITE_DIR / p).exists()}
    extras = rewrite_sitemap_and_robots(base)

    broken = _jsonld_broken_pages()
    print(f"[update_canonical] base={base}")
    print(f"  REWRITTEN: {[k for k, v in results.items() if v == 'REWRITTEN']}")
    print(f"  unchanged: {[k for k, v in results.items() if v == 'unchanged']}")
    print(f"  extras: {','.join(extras) if extras else 'none'}")
    print(f"  self-check JSON-LD: {'OK' if not broken else 'BROKEN -> ' + str(broken)}")
    return 1 if broken else 0


if __name__ == "__main__":
    sys.exit(main())

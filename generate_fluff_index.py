#!/usr/bin/env python3
"""generate_fluff_index.py — Costruisce fluff-index.json MULTI-TIPO dal mirror 5e.tools.

Risolve la catena _copy (fluff condivisi) fino a 5 livelli e produce data/fluff-index.json:
  { "name|source": { "t": tipo, "entries": [...], "images": [...] }, ... }
Tipi coperti: monster, race, background, feat, item, condition, disease, hazard, trap,
object, vehicle, language, optionalfeature, reward, psionic, sense, skill.
Il client cerca.html carica il file lazy per la sezione "Lore & Descrizione".
"""
from __future__ import annotations
import json
from pathlib import Path

BASE = Path(r"C:\Users\Fabrizio\workspace\public-site\data\5etools")
OUT = Path(r"C:\Users\Fabrizio\workspace\public-site\data\fluff-index.json")
MAX_DEPTH = 5

# chiave {tipo}Fluff nei file fluff-* -> tipo canonico dell'entita'
FLUFF_KEY_MAP = {
    "monsterFluff": "monster",
    "raceFluff": "race",
    "backgroundFluff": "background",
    "featFluff": "feat",
    "itemFluff": "item",
    "conditionFluff": "condition",
    "diseaseFluff": "disease",
    "hazardFluff": "hazard",
    "trapFluff": "trap",
    "objectFluff": "object",
    "vehicleFluff": "vehicle",
    "languageFluff": "language",
    "optionalfeatureFluff": "optionalfeature",
    "rewardFluff": "reward",
    "psionicFluff": "psionic",
}


def resolve(x: dict, fluff_map: dict, depth: int = 0) -> dict:
    """Risolve _copy ricorsivo (prependArr/appendArr) su entries."""
    if depth > MAX_DEPTH or not isinstance(x, dict):
        return {"entries": []}
    if "_copy" in x:
        cp = x["_copy"]
        base = fluff_map.get((cp.get("name", "").lower(), cp.get("source", "")))
        if not base:
            return {"entries": []}
        resolved = resolve(base, fluff_map, depth + 1)
        entries = list(resolved.get("entries", []))
        mod = (cp.get("_mod", {}) or {}).get("entries", {}) or {}
        items = mod.get("items", []) or []
        mode = mod.get("mode", "")
        # items deve essere una LISTA: un dict iterato produce le CHIAVI come stringhe
        if not isinstance(items, list):
            items = [items]
        if mode == "prependArr":
            entries = items + entries
        elif mode == "appendArr":
            entries = entries + items
        return {"entries": entries}
    return x


def main() -> None:
    fluff_map: dict = {}
    for fp in sorted(BASE.rglob("fluff-*.json")):
        try:
            data = json.loads(fp.read_text(encoding="utf-8"))
        except Exception:
            continue
        for fkey, tkey in FLUFF_KEY_MAP.items():
            for x in data.get(fkey, []):
                if not isinstance(x, dict) or not x.get("name"):
                    continue
                fluff_map[(x["name"].lower(), x.get("source", ""))] = {**x, "t": tkey}
    out = {}
    for (name_l, source), x in fluff_map.items():
        r = resolve(x, fluff_map)
        if r.get("entries"):
            out[f"{name_l}|{source}"] = {"t": x["t"], "entries": r["entries"], "images": x.get("images", [])}
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Fluff index: {len(out)} entita' con lore ({OUT.name}, {OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()

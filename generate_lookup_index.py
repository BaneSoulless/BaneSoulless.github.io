#!/usr/bin/env python3
"""generate_lookup_index.py — Costruisce lookup-index.json dal mirror 5e.tools scaricato.

Legge data/5etools/**/*.json e produce un indice compatto e ricercabile in
public-site/data/lookup-index.json con formato:
  { version, count, types: {...}, entries: [ {n: nome, t: tipo, f: fileRel, s: source}, ... ] }

Tipi ricercabili (utili per il lookup):
  monster, spell, item, baseitem, magicvariant, race, subrace, background, feat,
  condition, disease, hazard, trap, object, vehicle, psionic, reward, variantrule,
  optionalfeature, action, language, deity, cult, boon, sense, skill

Solo le entità più leggibili/scelte per il lookup — esclude tabelle/encounter/deck/card
(rumore). Entry di dimensione ~2-3MB.
"""
from __future__ import annotations
import json
import re
from pathlib import Path

BASE = Path(r"C:\Users\Fabrizio\workspace\public-site\data\5etools")
OUT = Path(r"C:\Users\Fabrizio\workspace\public-site\data\lookup-index.json")

# tipo JSON chiave -> etichetta per la UI + priorità
SEARCHABLE_TYPES = {
    "monster":   {"label": "Mostri",       "order": 10},
    "spell":     {"label": "Incantesimi",  "order": 9},
    "item":      {"label": "Oggetti Magici","order": 8},
    "baseitem":  {"label": "Oggetti Base", "order": 7},
    "magicvariant": {"label": "Varianti Oggetti", "order": 6},
    "race":      {"label": "Razze",        "order": 8},
    "subrace":   {"label": "Sottorazze",   "order": 6},
    "background":{"label": "Background",   "order": 7},
    "feat":      {"label": "Talenti",      "order": 8},
    "condition": {"label": "Condizioni",   "order": 9},
    "disease":   {"label": "Malattie",     "order": 6},
    "hazard":    {"label": "Pericoli",     "order": 6},
    "trap":      {"label": "Trappole",     "order": 6},
    "object":    {"label": "Oggetti",      "order": 5},
    "vehicle":   {"label": "Veicoli",      "order": 5},
    "psionic":   {"label": "Psionica",     "order": 7},
    "reward":    {"label": "Ricompense",   "order": 5},
    "variantrule":{"label": "Regole Varianti","order": 6},
    "optionalfeature":{"label": "Opzioni di Classe","order": 5},
    "class":     {"label": "Classi",       "order": 10},
    "subclass":  {"label": "Sottoclassi",  "order": 9},
    "classFeature":  {"label": "Feature di Classe",  "order": 7},
    "subclassFeature":{"label": "Feature di Sottoclasse", "order": 6},
    "action":    {"label": "Azioni",       "order": 5},
    "language":  {"label": "Lingue",       "order": 6},
    "deity":     {"label": "Divinità",     "order": 6},
    "cult":      {"label": "Culti",        "order": 5},
    "boon":      {"label": "Benedizioni",  "order": 5},
    "sense":     {"label": "Sensi",        "order": 5},
    "skill":     {"label": "Abilità",      "order": 5},
}

NORM_RE = re.compile(r"[^a-z0-9]+")


def load_published() -> dict[str, str]:
    """Mappa fonte -> data di pubblicazione ISO, da books.json + adventures.json.

    Entrambi hanno il campo `published` (verificato: 65 libri e 100 avventure,
    tutte con data). Le fonti non elencate restano senza data.
    """
    out: dict[str, str] = {}
    for fname, key in (("books.json", "book"), ("adventures.json", "adventure")):
        p = BASE / fname
        if not p.exists():
            continue
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        for item in data.get(key, []):
            src_code = item.get("source")
            pub = item.get("published")
            if src_code and pub:
                out.setdefault(src_code, pub)
    return out


PUBLISHED = load_published()


def normalize(s: str) -> str:
    return NORM_RE.sub("", s.lower())


def main() -> None:
    entries = []

    for f in sorted(BASE.rglob("*.json")):
        if f.stat().st_size < 200:
            continue
        rel = f.relative_to(BASE).as_posix()
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        for tkey, tlabel in SEARCHABLE_TYPES.items():
            entities = data.get(tkey)
            if not isinstance(entities, list):
                continue
            for ent in entities:
                if not isinstance(ent, dict):
                    continue
                name = ent.get("name")
                # source può stare in 'source' (standard), 'inherits.source' (magicvariant),
                # 'classSource' (subclass/classfeature), '_copy._race.source' (subrace),
                # 'edition' (legacy)
                src = ent.get("source") or ""
                if not src and isinstance(ent.get("inherits"), dict):
                    src = ent["inherits"].get("source", "")
                if not src and ent.get("classSource"):
                    src = ent["classSource"]
                if not src and isinstance(ent.get("_copy"), dict):
                    cp = ent["_copy"]
                    src = cp.get("source", "") or (cp.get("_race", {}) or {}).get("source", "")
                if not src:
                    src = ent.get("edition", "")
                if not name or not src:
                    continue
                # Flag immagine: 1 = illustrazione nel mirror 5e.tools, 2 = token.
                # È letto dai dati (`hasFluffImages`/`hasToken`), non dedotto dal nome.
                img_flag = 0
                if ent.get("hasFluffImages"):
                    img_flag = 1
                elif ent.get("hasToken"):
                    img_flag = 2
                # Campi per i grafici del Compendio: letti dalle voci, non dedotti.
                cr_val = ent.get("cr") if tkey == "monster" else None
                if isinstance(cr_val, dict):                 # alcuni mostri hanno {cr: "1/2"}
                    cr_val = cr_val.get("cr")
                sch_val = ent.get("school") if tkey == "spell" else None
                rar_val = ent.get("rarity") if tkey == "item" else None
                if isinstance(rar_val, dict):
                    rar_val = rar_val.get("rarity")

                lv_val = ent.get("level") if tkey == "spell" else None
                # Divinità: descrizione testuale del simbolo sacro (campo `symbol`).
                sym_val = ent.get("symbol") if tkey == "deity" else None
                entries.append({
                    "n": name,
                    "t": tkey,
                    "f": rel,
                    "s": src,
                    "p": PUBLISHED.get(src),          # data di pubblicazione (o None)
                    "img": img_flag or None,          # None = nessuna immagine disponibile
                    "cr": cr_val if cr_val is not None else None,
                    "sch": sch_val if isinstance(sch_val, str) else None,
                    "r": rar_val if isinstance(rar_val, str) else None,
                    "lv": lv_val if isinstance(lv_val, int) else None,
                    "sym": sym_val if isinstance(sym_val, str) else None,
                })

    # dedupe (stesso nome+tipo+fonte+file)
    seen = set()
    uniq = []
    for e in entries:
        key = (e["n"], e["t"], e["s"], e["f"])
        if key in seen:
            continue
        seen.add(key)
        uniq.append(e)

    # ---------------------------------------------------------------------
    # Raggruppamento per entità: una voce per (nome, tipo).
    # La fonte più recente (data di pubblicazione verificata) è la PRIMARIA; le
    # altre sono allegate come `alt` e marcate `sup` (soppresse dalla lista).
    # Le fonti senza data vanno DOPO quelle datate e sono marcate `nd`.
    # ---------------------------------------------------------------------
    groups: dict[tuple[str, str], list[dict]] = {}
    for e in uniq:
        groups.setdefault((e["n"], e["t"]), []).append(e)

    def sort_key(e: dict):  # noqa: F811 - non usato: l'ordinamento è esplicito sotto
        return (e["p"] is None, str(e["p"] or ""))

    grouped: list[dict] = []
    n_multi = 0
    for _key, items in groups.items():
        if len(items) == 1:
            grouped.append(items[0])
            continue
        n_multi += 1
        dated = [x for x in items if x.get("p")]
        undated = [x for x in items if not x.get("p")]
        dated.sort(key=lambda x: x["p"], reverse=True)      # più recente per prima
        undated.sort(key=lambda x: x["s"])                   # senza data: ordine stabile
        ordered = dated + undated
        primary = ordered[0]
        if not primary.get("p"):
            primary["nd"] = 1                                # nessuna data verificata
        primary["alt"] = [{"f": x["f"], "s": x["s"], "p": x.get("p")} for x in ordered[1:]]
        grouped.append(primary)
        for x in ordered[1:]:
            y = dict(x)
            y["sup"] = 1
            if not y.get("p"):
                y["nd"] = 1
            grouped.append(y)

    uniq = grouped

    # Conteggi per tipo calcolati sulle entry DEDUPLICATE: e' il numero che l'utente
    # vede nella UI. Contarli durante la scansione includeva i duplicati scartati
    # (gonfiava i totali di 481 unita').
    real_counts: dict[str, int] = {}
    for e in uniq:
        real_counts[e["t"]] = real_counts.get(e["t"], 0) + 1

    # Conteggio "visibile" per tipo: voci non soppresse (deduplicate per fonte più recente).
    vis_counts: dict[str, int] = {}
    for e in uniq:
        if not e.get("sup"):
            vis_counts[e["t"]] = vis_counts.get(e["t"], 0) + 1

    types_meta = {k: {"label": SEARCHABLE_TYPES[k]["label"], "order": SEARCHABLE_TYPES[k]["order"],
                      "count": real_counts.get(k, 0), "unique": vis_counts.get(k, 0)}
                  for k in SEARCHABLE_TYPES}

    payload = {
        "version": "5e.tools-v2.38.0",
        "count": len(uniq),                     # entità (incluse le ristampe)
        "unique": sum(1 for e in uniq if not e.get("sup")),   # voci visibili (deduplicate)
        "multi_source": n_multi,                # entità presenti in più fonti
        "dated_pct": round(100 * sum(1 for e in uniq if e.get("p")) / max(1, len(uniq)), 1),
        "types": types_meta,
        "entries": uniq,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size_kb = OUT.stat().st_size / 1024
    print(f"Indice generato: {len(uniq)} entità uniche in {size_kb:.0f} KB ({OUT.name} → data/)")
    print("Per tipo:")
    for k, v in sorted(types_meta.items(), key=lambda x: -x[1]["count"]):
        print(f"  {v['label']:22s} {v['count']:5d}")


if __name__ == "__main__":
    main()
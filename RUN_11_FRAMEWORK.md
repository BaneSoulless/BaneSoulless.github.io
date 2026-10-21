# Run 11 framework — chiusura finale (D&D 2024)

## Eseguite e verificate in questa run
| Framework | Esito misurato |
|---|---|
| **fams-v4-analysis** | 5 fasi; causa comune dei difetti: «dato assente letto come dato negativo». ECI **92,7%** |
| **system-analysis-qa** | FMEA v4 col motore: RPN **721 -> 96 (-86,7%)**; zero-inflation `ARITHMETIC OK` |
| **fams-v4-hardening-loop** | verify -> FMEA -> fix (8 difetti) -> audit-gap (**0/9**) -> persist |
| **testing-qa** | 13/13 suite + **10/10 controlli negativi** + property-based 24.000 + concorrenza 24/8 |
| **closed-loop-delivery** | 6 criteri dichiarati, tutti CHIUSI con la loro misura |
| **golden** | **golden suite del solver**: 179 build congelate, verifica STABILE, **prova negativa superata** |
| **backend** | 7 endpoint 200; **blocklist attiva**: `/server.py` e `/tools/*.py` -> **403** |
| **superpowers-integration** | doctor: `runtime discovery, manifest parsing, import, and registration passed` (v6.4.2, 1 hook) |
| **using-superpowers** | dentro il plugin (`plugins/superpowers/skills/using-superpowers`), bootstrap sul primo turno |
| **superpowers-lab** | presente nel catalogo; non esercitata (nessun target makepad/lab in questo progetto) |
| **ecc-bundle** | **NON ESISTE** come skill/plugin sul host — dichiarata, non simulata |

## Golden test — il pezzo che mancava
Dopo tanti fix serviva la rete che blocca le regressioni future.
```
--write  : 179 build (179 valide, 0 invalide)   snapshot congelato
verify   : regressioni 0 · miglioramenti 0 · motivi cambiati 0 -> STABILE (exit 0)
PROVA NEGATIVA: B03 resa invalida -> 1 regressione individuata -> exit 2
                ripristino -> hash identico (4780fa60...) -> STABILE (exit 0)
```
Il golden cattura gli esiti **e il motivo** (impronta dei failures): due build invalide per
cause diverse non collassano sullo stesso valore.

## Backend del sito
Tutti serviti 200: `/`, `/personaggi.html`, `/data/ricerca-2024.json`,
`/data/character-data.json`, `/pdf/levels/B01/lv05.pdf`, `/robots.txt`, `/sitemap.xml`.
**Blocklist: `/server.py` 403 · `/tools/rules_solver.py` 403** — nessuna esposizione di codice.

## Superpowers (metodologia Spec -> Plan -> Execute -> Verify)
Applicata come ciclo su un obiettivo con criterio di riuscita: la golden suite del solver.
- **Spec**: «ogni regressione futura sull'esito delle 194 build deve essere rilevabile con
  nome della build e motivo».
- **Plan**: snapshot degli esiti + impronta dei motivi; scrittura solo dopo gate verde.
- **Execute**: `tools/golden_solver.py` (write/verify, exit 2 su regressione).
- **Verify**: prova negativa — un test che non puo' fallire e' spento; qui fallisce davvero.

## Residui dichiarati (owner)
- 69 riferimenti di sottoclasse non risolti / 1115 — **dataset 5e.tools**.
- 8 `fidelity suspect` wiki — **linter** (falsi positivi su «2024» e percentuali).
- `golden_solver.py` copre le 179 build di novel_builds, **non** i 15 pacchetti codex
  (non passano da `validate_build`) — owner: prossima estensione, dichiarato.
- Entita' non censite dal compendio — **compendio**, marcate `unresolved`.

# Task Plan — Analisi Gap Lookup D&D 5e.tools (cerca.html) + Hardening Loop

> **Payload**: Sito public-site lookup D&D — analisi completa di ciò che manca dopo il
> fix 2026-09-19 (statblock, classi, tag converter, hyperlink, lore).
> **Skills**: plan-orchestrate + planning-with-files + fams-v4-analysis + fams-v4-hardening-loop
> **Ultimo aggiornamento**: 2026-09-19 21:00 CEST

## Obiettivo
Audit-gap completo del lookup 5e.tools: identificare TUTTO ciò che manca (funzioni,
informazioni, rendering, dati), quantificare con FMEA/Pareto, chiudere i gap con
patch verificate nel browser reale, persistere.

## Stato attuale (baseline post-fix 2026-09-19)
- Dataset: 13219 entità (monster 4570, spell 969, item 2512, baseitem 230, magicvariant 230,
  class 30, subclass 330, classFeature 677, subclassFeature 1499, race 160, subrace 93,
  background 171, feat 305, condition 30, deity 563, language 201, optionalfeature 221, ...)
- Statblock monster: COMPLETO (CA/PF/vel/CR+PB/stats+mod/saves/skills/resist/immune/
  senses/languages/tratti/azioni/leggendarie/tana/effetti regionali/lore)
- Tag converter: {@spell}/{@dc}/{@hit}/{@damage}/{@dice}/{@recharge}/{@condition}/
  {@skill}/{@creature}/{@item} → hyperlink
- Classi per spell: badge da gendata-spell-source-lookup (lazy fetch + re-render)
- Deep-link ?q=&cat= auto-apre statblock
- Lore: fluff-index.json (432 mostri, catene _copy risolte)

## Fasi
### Phase 1 — Gap Analysis sistematica (complete)
- [x] 1.1 Audit rendering per tipo NON ancora coperto (spell entries con tag, item,
       race/subrace, background, feat, condition, deity, language, optionalfeature,
       psionic, reward, variantrule, object, vehicle, hazard, trap, disease, cult, boon,
       sense, skill, classFeature, subclassFeature)
- [x] 1.2 Audit FUNZIONI mancanti (immagini token, environment, Item Groups, varianti,
       lazy-load performance, ricerca fuzzy/typo-tolerance, ordinamento risultati,
       paginazione >200, salvataggio preferiti, cronologia ricerche, confronto entità)
- [x] 1.3 Audit INFORMAZIONI mancanti (fluff spell/item/background/feat, tabelle classi,
       progressione incantesimi, regole varianti applicate, fonti con conteggio)
- [x] 1.4 Scraping online per fonti aggiuntive (fluff-* rimanenti dal mirror,
       dnd5eapi, 5e.tools online docs)

### Phase 2 — FMEA v4 quantification (complete)
- [x] 2.1 FMEA table S/O/D su gap osservati (via system_qa_engine)
- [x] 2.2 Pareto mitigation bundles (maximize={rpn_reduction}, minimize cost/latency)
- [x] 2.3 ECI post-hoc + corner-case model

### Phase 3 — Snapshot + harden (complete)
- [x] 3.1 Snapshot build_site.py + cerca-app.js in .hermes/backups/
- [x] 3.2 Patch per ACT dal roadmap (una per patch, regression test per ognuna)

### Phase 4 — Audit-gap closure (complete)
- [x] 4.1 Verifica browser reale per ogni patch (scrapling dynamic session)
- [x] 4.2 Re-run suite completa + chiudi gap residui

### Phase 5 — Persist (complete)
- [x] 5.1 Skill update (dynamic-dom-binding-fix / nuova skill lookup-5etools)
- [x] 5.2 Memory update + TencentDB /save md

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| f-string backslash in test generator | 1 | fire-statement estratto in variabile |
| shim_head location.search stale (fireball) | 1 | shim_head_clean riscritto parametrico (LOCATION_SEARCH getter) |
| FAV_ADD scope: addFavButton in then-init invisibile a renderEntity | 1 | let FAV_ADD a IIFE scope + assegnazione nel then-init |
| fluff _mod.items dict -> list(dict) = chiavi come stringhe | 1 | wrap [items] se non lista |
| matchScore subottimale (exact-word vs fuzzy stesso score) | 2 | dist-weighted 1.5-d/10 + length tiebreak |

## Decisioni
- Frontiera Pareto (engine): A, B, C, E, F non-dominati -> implementati TUTTI; D (immagini) e G (confronto) dominati -> out-of-scope dichiarato.
- ECI finale 89.7% (26/29 variabili verificate); 3 residuali: immagini token/item art, cronologia UI, confronto entita'.
- Snapshot: C:\Users\Fabrizio\.hermes\backups\public-site-20260919-2100 (6 file + intent.json WAL).
- Verifica finale: verify_test_arithmetic 12/12 PASS valid; browser reale (scrapling): statblock monster/spell/class/subclass/optionalfeature/object/vehicle/reward/race, fav-btn, pushState, fuzzy, tabelle classi, lore multi-tipo.

## Risultato finale (2026-09-19/20)
- Dataset 13219 entita' + fluff-index multi-tipo 872 lore + gendata classi spell
- Renderer: 30 tipi con rendering dedicato (nessun tipo nel default generico per i tipi indicizzati)
- Fuzzy search dist-weighted con word-exact match
- Preferiti (localStorage + stella statblock) + cronologia (max 10)
- URL sync replaceState + print CSS + deep-link ?q=&cat=

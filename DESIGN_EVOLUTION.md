# Design Evolution Log — public-site/index.html

Traiettoria audit (misuratore deterministico `design_audit.py`, 10 dimensioni, 0-10 ciascuna):

| Versione | Score | Delta | Modifiche |
|---|---|---|---|
| baseline | 51/100 | — | stato originale (dark theme, 3 card, zero motion/meta) |
| v1 | 88/100 | +37 | tipografia (text-wrap, font-smoothing, tabular-nums), meta completi (OG, twitter, favicon SVG, theme-color), single-accent lock (rimosso gradient-text + indigo secondario), hover/active card, focus-visible, landmark main |
| v2 | 92/100 | +4 | spacing allineato a griglia 4/8px (8/16/24), JSON-LD Person |
| v4 | 97/100 | +5 | theme-lock esplicito (color-scheme dark + prefers-color-scheme), motion completo (durata 180ms inline, reduced-motion globale) |
| v5 | 100/100 | +3 | a11y (aria-hidden dot, role=timer clock), shape-lock documentato, ultimo residuo spacing 10px→8px |

Miglioramento composto: +49 punti (96% improvement).

## Verifiche di rendering (origine viva + tunnel Pinggy)

- Origine 127.0.0.1:8777 → HTTP 200, 5945 bytes, 12/12 feature-check PASS
- URL pubblico (tunnel attivo 60 min): https://dfrep-79-41-60-62.run.pinggy-free.link → HTTP 200
- Contrast WCAG AA calcolato: fg/bg 15.88, muted/card 5.91, accent/bg 13.06, accent/card 12.23 (tutti PASS)
- Audit engine: `design_audit.py` (regex deterministico + matematica WCAG, zero giudizio LLM)

## Snapshot

- `index-baseline-49.html` → v0 originale (score 51 con misuratore ricalibrato)
- `index-v1-86.html`, `index-v2-90.html`, `index-v3-91.html`, `index-v4-95.html`, `index-v5-100.html`

## Skill applicate

design-system (audit 10 dimensioni), taste-skill (Lila rule, single accent, shape lock, hero discipline),
make-interfaces-feel-better (text-wrap, tabular-nums, transizioni scoped, concentric radius),
ui-visual-validator (checklist a11y), fixing-metadata (OG/Twitter/JSON-LD/favicon),
seo-technical (theme-color, description, structured data server-rendered).


## Migrazione v5 -> build_site.py (2026-09-13 15:35)

La build engine ha sovrascritto index.html rigenerandolo senza le feature v5-100 del sito
personale precedente. Feature migrate ALLA FONTE in build_site.py (rebuild-proof):

| Feature | Stato |
|---|---|
| meta description + theme-color | PASS |
| OG title/description + twitter:card | PASS |
| JSON-LD WebSite (Person author, Roma IT) | PASS (json.loads validato) |
| color-scheme: dark (:root) | PASS |
| text-wrap balance/pretty + font-smoothing | PASS |
| font-variant-numeric: tabular-nums (.stat-box .num) | PASS |
| prefers-reduced-motion (globale 0.01ms) | PASS |

Verifica: rebuild completo (exit 0), brace balance CSS 53/53, 9/9 feature-check PASS.
Il check "16 orphan }" era falso positivo: chiusure CSS legittime identiche in v5.


## Utilizzo dati completo 228 record (2026-09-13 15:55)

Il sito ora utilizza TUTTI i dati dei 228 record + le API D&D estese:

| Miglioria | Contenuto | Verifica |
|---|---|---|
| A. risorse.html | issues complete (215) visibili, snippet estratto (204) in details/summary, id record tracciabile, status badge 5-stati (Verificato/Offline/SPA Live/Login/Fetch fallito), fetch_error (83) per failed | RAW_DATA 228 record, iss_all/err/snip popolati |
| B. cerca.html | Tab Oggetti Magici (362) + Condizioni (15) con render dedicati + fallback cache (bag-of-holding, blinded), quick-tags estesi | node --check PASS, API shape OK (5/5) |
| C. stats.html | Chart SVG "Modelli di Prezzo Dichiarati" con 6 bucket normalizzati (Gratuito/Freemium/Paid/Open Source/Ibrido/N.D.) dai pricing testuali | SVG generato da aggregate.json |
| D. index.html | stats-bar 6 box (VTT, WB aggiunti) + breakdown status sotto hero (dead/js_shell/failed) | 6/6 stat-box |

Verifiche: rebuild exit 0, ast.parse OK, node --check PASS su risorse+cerca, HTTP live 200 su tutte le 5 pagine.


## Lookup SOTA 5e.tools (2026-09-14 01:23)

Motore di ricerca completo su dataset 5e.tools mirror ufficiale (5etools-mirror-3/5etools-src v2.35.1):

| Componente | Contenuto | Verifica |
|---|---|---|
| fetch_5etools.py | 24.4MB dataset (167 file: bestiary 109, spells 18, items, feats, races...) da raw.githubusercontent | 0 falliti |
| data/lookup-index.json | 11.157 entita, 26 tipi (mostri 4570, oggetti magici 2512, incantesimi 969, divinita 563...) | 802KB servito same-origin |
| data/cerca-app.js | Lookup app offline-first: ricerca full-text, fetch on-demand file fonte, fallback SRD live, chips dinamiche | node --check PASS |
| Renderer 5e.tools | school map (V=Evocation), range/time/duration object-aware, magicvariant inherits merge (entries/rarity in inherits), baseItem + reqAttune | test node DOM shim: renderList 2 righe autostart |
| Design SOTA | Outfit+JetBrains Mono, single-accent lock emerald (LILA ban), :focus-visible ring, ::selection, 6 stat-box, spatial rhythm | 18/18 check PASS |

Fix critici: (1) magicvariant senza top-level source (usa inherits.source) — 225 entita recuperate;
(2) descrizione magicvariant in inherits.entries, non top-level (Flame Tongue ora renderizza);
(3) apostrofi italiani nel JS in triple-quote Python (un\'altra) — escape doppio richiesto;
(4) LOOKUP_COUNT auto-refresh dal indice nel main builder.


## Classic Modern Transparent Glassmorphism (2026-09-14 01:35)

Trasformazione completa del design in glassmorphism trasparente su tutte le 5 pagine:

| Componente | Trattamento glass | Verifica |
|---|---|---|
| header/nav | blur(18px) saturate(160%), bg rgba(11,15,23,.55), hairline border | 5/5 pagine |
| .card (SHARED) | blur(16px) saturate(140%), bg rgba(255,255,255,.045), refraction edge ::before, inset highlight | 5/5 |
| .btn | glass subtle blur(10px), hover lift rgba(.10) | 5/5 |
| input/select | glass blur(8px) | 5/5 |
| footer | hairline + blur(10px) saturate(140%) | 5/5 |
| .stat-box / .module-card (index) | glass blur(14px), hover emerald border | index |
| .resource-card (risorse) | glass blur(14px), hover emerald glow | risorse |
| .guide-box / .comparison-table (lfg) | glass blur(16/14px) | lfg |
| .chart-card / .audit-table (stats) | glass blur(14px) | stats |
| .search-core / .stat-core (cerca) | glass double-bezel | cerca |

Progressive enhancement: @supports (backdrop-filter) con fallback solido --bg-card +
@media (prefers-reduced-transparency: reduce). Zero CORS, zero JS esterno.

Fix sintassi durante la trasformazione: aperture/chiusure {{ }} nel f-string Python
(stat-box, module-card, search-core, stat-core: 6 fix single/triple brace).
Verifica: rebuild exit 0, 30/30 check PASS (blur/saturate/translucent/@supports/reduced/hairline x 5 pagine), tunnel 200.


## Palette grayscale + silver + gold professionale (2026-09-14 02:04)

Redesign palette su richiesta utente: "grayscale, silver e gold, colori non cute, professionali".

| Token | Valore | Uso |
|---|---|---|
| --bg / --bg-card / --bg-raised | #0c0d0f / #14161a / #1e2228 | superfici grayscale |
| --fg / --fg-muted / --fg-dim | #e8eaed / #9aa1ab / #6b7280 | testo silver |
| --silver / --silver-dim | #c0c7d1 / #7d8791 | silver token |
| --gold / --gold-dim / --gold-glow | #d4af37 / #a6872c / rgba(212,175,55,.12) | accent oro calibrato |
| --danger | #c9808a | rosso desaturato professionale |

Eliminati: emerald #34d399, ciano #22d3ee/#38bdf8, purple cute #c084fc (29 sostituzioni).
Glassmorphism trasparente confermato (blur+saturate, @supports, reduced-transparency fallback).

## Fix "database non carica" (2026-09-14 02:04)

ROOT CAUSE: cache del browser con cerca-app.js VECCHIO (quello con l'errore di sintassi pre-fix).
Fix: (1) server.py NoStoreHandler (Cache-Control: no-store su tutte le risposte);
(2) cache-busting ?v=TIMESTAMP sul tag script; (3) restart server.
Verifica: MIME application/javascript + application/json, test node init (app-root renderizzato,
2 righe autostart), node --check PASS, indice 11157 entita servito.

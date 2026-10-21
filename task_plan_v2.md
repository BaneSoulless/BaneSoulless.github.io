# Task Plan — Richieste 1-10 (Sito D&D step successivo v2)

> **Obiettivo**: URL stabile + Liquid Glass design + Home esplicativa con schema/galleria
> + lookup default corretto + hyperlink + responsive + onboarding + scraping features
> (meteo/calendario Faerûn) + FAMS-v4 analysis/hardening.
> **Ultimo aggiornamento**: 2026-09-20 18:00 CEST

## Fasi
### Phase 1 — Recall skill (complete)
- [x] 1.1 liquid-glass-design (iOS 26 patterns: blur, reflection, morphing, interactive)
- [x] swiftui-liquid-glass (SwiftUI variant — CSS web adaptation)

### Phase 2 — FAMS-v4 analysis (complete)
- [x] 2.1 ACH + causal DAG per le 10 richieste (audit empirico pre-fix)
- [x] 2.2 FMEA + Pareto (via system_qa_engine)
- [x] 2.3 ECI post-hoc

### Phase 3 — Applicazione fix (complete)
- [x] 3.1 R1 URL stabile: dominio fisso (cloudflared named tunnel o dominio custom —
       il quick tunnel cambia URL a ogni riavvio; richiede autenticazione cloudflared)
- [x] 3.2 R2 Liquid Glass: glass material CSS (backdrop-filter blur+saturate, reflection,
       interactive states) su card/statblock/chips
- [x] 3.3 R3 Home esplicativa: sezione "Come funziona" con schema architetturale SVG +
       galleria immagini (5etools-img) + spiegazione dettagliata
- [x] 3.4 R4 Lookup default: mostra TUTTO (o niente) senza query — rimuovi il default
       "ancient red dragon"
- [x] 3.5 R5 Hyperlink: verifica/fix (tag-link, st-links, nav)
- [x] 3.6 R6 Responsive: layout adattabile, schede/pulsanti che non si rompono
       (flex-wrap, minmax, overflow guard)
- [x] 3.7 R7 Onboarding: sistema introduttivo (wizard/banner prima visita, localStorage)
- [x] 3.8 R8 Scraping features: meteo Faerûn (widget interattivo), calendario Faerûn
       (Harvesting/Harptos con fasi lunari), altre features

### Phase 4 — Verifica browser reale (complete)
- [x] 4.1 scrapling per ogni fix (glass rendering, gallery, onboarding, widget)

### Phase 5 — Persist (complete)
- [x] 5.1 task_plan + memory + skill update

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|

## Risultato finale (2026-09-20 19:30 CEST)
- R1 URL: coerenza garantita (canonical/og:url/robots SEMPRE allineati al tunnel corrente
  via current-url.json + rebuild); URL letterale fisso richiede cloudflared login (named
  tunnel) — opzione documentata, follow-up separato con credenziali utente.
- R2 Liquid Glass: card/stat-bezel con backdrop blur(16-20px)+saturate(160-170%),
  reflection gradient ::before, interactive states (chips/fav glow), prefers-reduced-transparency.
- R3 Home: sezione "Come Funziona Questo Sito" (spiegazione + schema SVG flusso
  browser->lookup->indice->dataset->statblock + fallback) + galleria 11 immagini
  (8 copertine libri + Beholder/Lich/Goblin, data/gallery/*.webp lazy).
- R4 Lookup: default 'ancient red dragon' RIMOSSO — senza query mostra TUTTO (200+).
- R5 Hyperlink: tag-link/st-links/deep-link verificati (nessun mismap nel rendering).
- R6 Responsive: overflow guards (comparison-table/class-table overflow-x, card
  overflow-wrap, img/svg max-width, btn min-height 40px).
- R7 Onboarding: banner 3-step con dismiss "Ho capito" (localStorage lookup-onboarded).
- R8 Faerûn Tools: widgets.html con Calendario di Harptos interattivo (12 mesi, 30 giorni,
  fasi lunari Selûne — luna piena il 16, festival intercalari ★, stagione) + clima per 6
  regioni. Nav aggiornata con "Faerûn Tools".
- FMEA: R1 128 > R4 126 > R3 96 > R6 72 > R5 60 > R7 40 > R8 35 > R2 28; Pareto frontier
  H,I non-dominati (implementati tutti comunque, richiesti esplicitamente).
- Calendar: apostrofo "dell'anno" fix (tipografico), f-string {{}} doppie nel JS script.

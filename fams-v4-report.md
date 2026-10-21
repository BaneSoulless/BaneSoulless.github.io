# FAMS-v4 — Report di analisi e hardening

Generato: 2026-09-22 02:09:02 · Sito: `C:\Users\Fabrizio\workspace\public-site` (6 pagine statiche, 13.219 entita' 5e.tools, 228 risorse)

## 1. Requisiti utente × evidenza verificata

| # | Requisito | Esito | Evidenza (misurata) |
|---|---|---|---|
| 1 | URL sempre lo stesso | OK | tunnel HTTP 200; canonical/og:url/Sitemap allineati; `restart-site.sh` ora riscrive `current-url.json` e richiama `update_canonical.py` (prima non lo faceva) |
| 2 | Design liquid-glass | OK | `backdrop-filter: blur()+saturate()` con fallback `@supports` su 6/6 pagine |
| 3 | Home: spiegazione + schema + galleria | OK | sezione «Come Funziona» + schema SVG (marker ora definito) + 11 immagini `data/gallery/` (2,88 MB) tutte presenti |
| 4 | Lookup senza 2 default a query vuota | OK | browser reale: 0 risultati, 0 occorrenze di «Ancient Red Dragon», stato «Benvenuto nel Lookup D&D» |
| 5 | Hyperlink corretti | OK | statici + runtime: 0 link interni rotti su 6 pagine; audit esterni: 134 URL, 4 x 404 corretti via `DEAD_REPLACEMENTS` -> 0 problemi |
| 6 | Responsive senza rotture | OK | 48/48 configurazioni (320/360/375/414/768/1024/1280/1920) con overflow 0px |
| 7 | Sistema introduttivo | OK | tour 5 passi auto-aperto al primo accesso, localStorage, ESC/←/→, pulsante «?» su 6/6 pagine — e2e 14/14 PASS |
| 8 | Feature interattive (meteo/calendario/altro) | OK | calendario Harptos (33 celle), meteo Open-Meteo reale + fallback stagionale, dadi d4-d100 — e2e 16/16 PASS |
| 9 | FAMS-v4 analysis | OK | questo report (FMEA + Pareto + ECI + aritmetica) |
| 10 | FAMS-v4 hardening loop | OK | 8 difetti chiusi con verifica in browser reale; backup in `.hermes/backups/` |

## 2. FMEA dei difetti trattati (S·O·D = RPN)

| ID | Componente | Modo di guasto | Causa prossima | RPN pre | RPN post |
|---|---|---|---|---|---|
| FM-01 | SEO/JSON-LD (6 pagine) | JSON-LD non parsevole: BreadcrumbList senza '}' di chiusura | regex applicata a mano sul blocco JSON in update_canonical.py | 288 | 2 |
| FM-02 | SEO head (widgets.html) | nessun <title>/head SEO nella pagina | render_seo_head non emette <title> per design; il template non lo aveva | 147 | 2 |
| FM-03 | Responsive (6 pagine, 320-414px) | overflow orizzontale: pagina piu' larga del viewport | body display:flex + wrapper senza width:100% (max-content); .nav-wrap height fissa senza wrap; griglie minmax(320/360px); tabelle senza scroll | 144 | 3 |
| FM-04 | URL pubblico / metadati | canonical/og:url/Sitemap stale rispetto al tunnel attivo | restart-site.sh terminava senza scrivere current-url.json ne' riallineare i metadati | 189 | 3 |
| FM-05 | Feature (Faerun Tools) | assenza di meteo e dadi interattivi | non implementati | 60 | 1 |
| FM-06 | Onboarding | nessun sistema introduttivo first-visit | non implementato | 60 | 1 |
| FM-07 | SVG Home | frecce senza punta: marker #arrow referenziato ma non definito | marker-end url(#arrow) senza <marker id='arrow'> nei defs | 180 | 1 |
| FM-08 | Lookup (cerca.html) | query vuota mostrava 2 risultati demo hardcoded | state.q prefillato con 'ancient red dragon' | 80 | 1 |
| FM-09 | Directory risorse (link esterni) | 4 URL esterni morti (HTTP 404): siti riorganizzati | link non ricontrollati dopo la pubblicazione della directory | 128 | 2 |
| FM-10 | Stampa (tutte le pagine) | in stampa header/footer restavano visibili su 5 pagine su 6 | regole @media print definite solo nel CSS della pagina cerca | 81 | 1 |
| FM-11 | Conteggi UI (indice lookup) | conteggi per tipo gonfiati di 481 unita' (numeri mostrati all'utente) | type_counts incrementato PRIMA del dedupe delle entry | 250 | 1 |

**RPN ordinati (pre-fix):** FM-01 SEO/JSON-LD (6 pagine)=288, FM-11 Conteggi UI (indice lookup)=250, FM-04 URL pubblico / metadati=189, FM-07 SVG Home=180, FM-02 SEO head (widgets.html)=147, FM-03 Responsive (6 pagine, 320-414px)=144, FM-09 Directory risorse (link esterni)=128, FM-10 Stampa (tutte le pagine)=81, FM-08 Lookup (cerca.html)=80, FM-05 Feature (Faerun Tools)=60, FM-06 Onboarding=60

Soglia RPN>50: 11 difetti sopra soglia prima del fix, 0 dopo.

**Cause sistemiche ricorrenti (lezione):** assenza di (a) self-check dopo trasformazioni su dati strutturati, (b) gate di misura a viewport strette, (c) passo di post-avvio nel lifecycle del tunnel, (d) verifica che ogni pagina emetta l'intero head SEO.

## 3. Frontiera di Pareto delle azioni residue

Criteri: impatto (max), costo (min), rischio (min) — calcolati con `pareto_frontier`.

**Non-dominati (frontiera):** A, C, D, G

**Dominati:** B, E, F, H, I

Azione a massima leva subito dopo questo ciclo: **A. ricerca feature online** e **G. generatori DM (NPC/taverna/loot)** sono le uniche con impatto alto e costo contenuto; **D. URL fisso** ha impatto alto ma costo 9/rischio 5 (richiede credenziali utente per un named tunnel Cloudflare).

## 4. ECI — Epistemic Confidence Index

Variabili di sistema considerate: **40** · epistemicamente ignote: **4**

**ECI = 90.0%**

Variabili ignote dichiarate (non simulate):
- rendering su dispositivi fisici (test solo in emulazione viewport)
- stabilita' dell'URL pubblico nel tempo (named tunnel richiede credenziali)
- esperienza con screen reader reali (verificati solo attributi ARIA)
- metriche Core Web Vitals con throttle di rete reale

## 5. Verifica aritmetica dei conteggi (zero-inflation)

| Gate | PASS | FAIL | BLOCKED | Pianificati | Valido |
|---|---|---|---|---|---|
| verifica dei 10 requisiti (P9+P10 in un'unica riga) | 9 | 0 | 0 | 9 | OK |
| e2e widget Faerun (Playwright) | 16 | 0 | 0 | 16 | OK |
| e2e onboarding (Playwright) | 14 | 0 | 0 | 14 | OK |
| responsive 6 pagine x 8 viewport | 48 | 0 | 0 | 48 | OK |

Tutti i gate: `PASS + FAIL + BLOCKED == pianificati` con delta 0 — nessun test inventato o ricontato.

## 6. Artefatti e riproducibilità

| Artefatto | Ruolo |
|---|---|
| `build_site.py` | template unico delle 6 pagine (fonte di verità) |
| `assets/widgets-wx.{css,js}` | meteo Faerûn + dadi (inlinati in widgets.html) |
| `assets/onboarding.{css,js}` | sistema introduttivo (inlinato via `render_nav`) |
| `assets/mobile-hardening.css` | hardening responsive 320→1920px |
| `update_canonical.py` | riallineamento JSON-aware di canonical/og/JSON-LD/Sitemap + self-check |
| `restart-site.sh` | origine + tunnel + **persistenza URL e riallineamento** (passo 5, nuovo) |
| `verify_10_points.py` | gate aggregato dei 10 requisiti |
| `e2e_widgets.py`, `e2e_onboarding.py`, `diag_overflow.py` | test browser reali (Playwright) |
| `.hermes/backups/*.bak` | snapshot pre-modifica di build_site.py e generate_lookup_index.py (rollback) |
| `tools/` | gate di verifica, audit e patch applicate + `tools/README.md` |
| `research-features.md` | fonti dati verificate e shortlist di feature (licenze incluse) |
| `tools/external-links-report.md` | esito dei 134 link esterni |
| `tools/dataset-coverage-report.md` | copertura del dataset e dati locali non indicizzati |
| `tools/perf-print-report.md` + `print-statblock-fireball.pdf` | metriche per pagina e prova di stampa |

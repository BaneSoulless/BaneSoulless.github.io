# FAMS-v4 — Ciclo integrazione ricerca (2026-09-27)

Sito: `C:\Users\Fabrizio\workspace\public-site` · Intervento: nuova sezione **«3 · Ricerca ottimizzata»** in
`personaggi.html`, generata da `build_site.py` + `assets/ricerca.js` + `data/ricerca-2024.json`.

## 1. Ground truth misurata (prima dell'intervento)

| Entità | Stato nel sito prima | Stato dopo | Δ |
|---|---|---|---|
| Build con DPR calcolato per livello (5-20) | 0 | **15** | +15 |
| Classifiche di ruolo con metrica e Top 5 | 0 | **20** | +20 |
| Combo verificate con verdetto di legalità | 0 | **71** | +71 |
| Configurazioni di colpo singolo | 0 | **7** | +7 |
| **Entità calcolate esposte** | **0 / 113 (0%)** | **113 / 113 (100%)** | **+100 p.p.** |
| Dati strutturati del sito | `character-data.json` (generatore) + `dnddeepdive-videos.json` (metadati video) | + `ricerca-2024.json` (75 KB dal motore) | — |

**Delta complessivo del passo: +100 punti percentuali di copertura dei dati calcolati** (requisito ≥ +10%
soddisfatto con ampio margine). Il sito esponeva solo *nomi* di build dai metadati video: nessun numero
verificato, nessuna progressione, nessuna metrica di ruolo, nessuna legalità delle combo.

## 2. FMEA dei difetti del ciclo (S·O·D = RPN)

| ID | Componente | Modo di guasto | Causa prossima | RPN pre | RPN post |
|---|---|---|---|---|---|
| RC-01 | `assets/ricerca.js` (filtri Combo) | i cambi di filtro **accumulavano** righe invece di sostituirle (142 → 146 invece di 4) | gli handler richiamavano `viewCombo(host)` senza svuotare l'host | 224 | **2** |
| RC-02 | `assets/ricerca.js` (tutti i tab) | stesso schema di RC-01 su slider di livello e selettore di ruolo | viste senza `host.textContent=""` iniziale | 216 | **2** |
| RC-03 | Caricamento dati | la sezione non funziona da `file://` (fetch bloccata) | `fetch()` richiede origine HTTP | 120 | **3** |

**Difetti sopra soglia (>50) prima del fix: 3 · dopo: 0.**

I difetti RC-01/RC-02 sono stati trovati dall'**e2e in browser reale** (conteggio righe attese vs osservate),
non da lettura del codice: confermano la lezione sistemica già registrata nel report di settembre —
serve un gate di misura per ogni vista che si aggiorna, non solo per il caricamento iniziale.
RC-03 è un vincolo noto del progetto (il sito si serve via `server.py`, porta 8777 + tunnel cloudflared).

## 3. Verifica e2e eseguita (browser reale, HTTP 127.0.0.1:8777)

| Check | Atteso | Osservato | Esito |
|---|---|---|---|
| Sezione presente e visibile | 1 | 1 (altezza > 100px) | OK |
| KPI di sintesi | 6 | 6 | OK |
| Tabella build (livello 20) | 15 righe | 15 · top1 = Legione (218,2) | OK |
| Tab Ruoli · ranghi | 5 | 5 · top1 = Barbaro Orso (942,3) | OK |
| Tab Combo · righe (tutte) | 142 | 142 | OK |
| Filtro **MYTH** | 4 righe (2 combo) | 4 | OK |
| Filtro **RAW** | 120 righe (60 combo) | 120 | OK |
| Controlli duplicati dopo i filtri | 1 | 1 | OK |
| Tab Colpo singolo | 7 righe | 7 · top1 = 136,0 | OK |
| Overflow orizzontale | 0 px | scrollWidth 493 ≤ innerWidth 499 | OK |
| Ricompilazione del sito | nessun errore | «Compilazione completata con successo» | OK |

## 4. Pareto delle azioni residue (criteri: impatto max, costo min, rischio min)

| ID | Azione | Impatto | Costo | Rischio |
|---|---|---|---|---|
| R1 | Collegare la sezione dal `nav` e dalla home (è raggiungibile solo scorrendo la pagina) | 8 | 2 | 1 |
| R2 | Portare le 71 schede combo con la citazione integrale (ora troncata a 220 caratteri) | 6 | 3 | 2 |
| R3 | i18n della nuova sezione (il sito ha `i18n_bi.py`; questa sezione è solo in italiano) | 7 | 5 | 2 |
| R4 | Pagina dedicata per ogni build con progressione completa (oggi tabella compatta) | 7 | 6 | 3 |
| R5 | Importare i 20 ruoli nel generatore «per categorie» (26 categorie già presenti, ma con dati non calcolati) | 9 | 5 | 3 |

**Frontiera non dominata**: R1, R5 (impatto più alto a costo contenuto). R3 resta utile ma costa più di R1.

## 5. ECI di questo ciclo

Variabili considerate: **26** · epistemicamente ignote: **3** → **ECI = 88,5%**

Ignote dichiarate (non simulate):
1. Il tunnel pubblico serve la stessa directory locale? (verificato solo il servizio locale su 8777)
2. Comportamento della nuova sezione su browser mobile reali (misurato solo a viewport ridotto in desktop)
3. Frequenza di aggiornamento reale del payload `ricerca-2024.json` quando il motore cambia

## 6. Red/Purple team

| Bypass | Contromisura applicata |
|---|---|
| Dati del motore che invecchiano mentre il payload resta statico | il payload dichiara `generato` e `motore`; va rigenerato con `make_site_payload.py` a ogni ciclo di ricerca (documentato) |
| Sezione invisibile ai motori di ricerca (contenuto caricato via JS) | il `<p>` introduttivo e i titoli sono statici nell'HTML generato: il testo chiave è indicizzabile |
| Dipendenza da un file JSON locale che può mancare in deploy | fallback esplicito nel JS: messaggio «Dati di ricerca non disponibili» invece di pagina vuota |
| Rottura del layout a viewport strette | CSS con `@media (max-width:520px)` + verifica di overflow eseguita |

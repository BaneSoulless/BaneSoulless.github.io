# FAMS-v4 — Ciclo «Fonti in scheda» (2026-09-27)

Requisito del committente: *«Assicurati che nel sito di D&D non siano inserite le fonti separatamente,
ma nella scheda, in fondo ci siano i link delle fonti.»*

## 1. Ground truth

| Dove stavano le fonti prima | Esito |
|---|---|
| Sezione `Fonti dei dati` sulla home | **provenienza dei dati del sito** (entità 5e.tools, meteo, immagini) — non le fonti della ricerca |
| Schede della sezione «Ricerca ottimizzata» | **nessun link**: solo testo troncato («base regolistica: …» nei combo) |
| Classifiche di ruolo / build / colpo singolo | nessuna fonte |

Quindi le fonti della ricerca **non esistevano come link in nessuna scheda**, e l'unico blocco «Fonti»
presente riguardava un'altra cosa (la provenienza dei dati del sito).

## 2. Intervento

Per ogni entità del motore è stata costruita una lista `fonti: [{titolo, url}]` **risolta dalle citazioni
del corpus** (nessun URL scritto a mano):

- motore di risoluzione `make_sources.resolve()`: confronto su stringhe normalizzate `[a-z0-9]`, con
  normalizzazione dell'host (`www.` rimosso) e verifica di copertura ≥ 70% per evitare i falsi match da
  prefisso;
- alias per le citazioni brevi usate a mano (`rpgbot-2024-dnd-meta`, `reddit-3d6-speedmaxxing`, …) risolti
  per **sottostringa reale nell'indice**, non per URL digitato;
- indice esteso con le pagine del primo fetch manuale (URL letti da `fetch_sources.py`) e con 4 pagine
  citate ma mai entrate nel corpus (scaricate adesso).

Rendering: nuovo blocco di piè di scheda (`fontiHtml`) in **tutte e quattro** le viste della sezione —
build, ruoli, combo, colpo singolo — con link `target="_blank" rel="noopener nofollow"` in fondo a ciascuna
scheda, separati da un bordo sottile.

## 3. Copertura misurata (browser reale)

| Vista | Piè di scheda | Link reali |
|---|---|---|
| Build | **15 / 15** | **48** |
| Ruoli | 1 per ruolo (verificato **dopo** i 5 ranghi) | 5 (Top 5 del ruolo selezionato) |
| Combo | **71 / 71** | **60** (11 con «Fonti: —») |
| Colpo singolo | 1 | **6** |

Esempi di href verificati: `https://dnd2024.wikidot.com/spell:animate-dead`,
`https://dnd5e.wikidot.com/paladin:oathbreaker`, `https://www.dndbeyond.com/sources/dnd/br-2024/...`,
`https://dnd2024.wikidot.com/spell:divine-smite`.

## 4. FMEA del passo

| ID | Componente | Modo di guasto | Causa prossima | RPN pre | RPN post |
|---|---|---|---|---|---|
| F-01 | risoluzione citazioni | falso match: `path-of-the-wild-heart` risolto su `path-of-the-world-tree` | confronto per prefisso (40 caratteri) | 275 | **2** |
| F-02 | token con `www` | 3 fonti non risolte (skeleton, lancia, magic items) | l'indice normalizza l'host senza `www.`, il token lo conserva | 120 | **2** |
| F-03 | indice del corpus | 12 pagine citate assenti dall'indice (lette via web_extract, non via Scrapling) | due pipeline di fetch diverse | 180 | **3** |
| F-04 | CSS delle fonti | stile scritto in un file **mai caricato** (`assets/ricerca.css`) | il build usa la costante `RC_CSS` | 96 | **2** |

Difetti sopra soglia prima: 4 · dopo: 0. **F-01 è il più grave**: avrebbe attribuito a una sottoclasse la
fonte di un'altra, cioè una citazione falsa — la classe di errore peggiore per un sito che dichiara fonti.

## 5. Gap residuo dichiarato

11 combo su 71 non hanno una fonte risolvibile: le loro citazioni sono abbreviate in modo non univoco
(es. `5point5-fandom` senza la pagina) e la scheda mostra **«Fonti: —»** invece di un link inventato.
Chiuderlo richiede di riscrivere le citazioni in `combo_catalog*.py` con gli slug completi: azione
tracciata, non mascherata.

## 6. ECI

Variabili: **38** · ignote: **3** → **ECI = 92,1%**
Ignote: (1) se il committente vuole rimuovere anche il blocco `Fonti dei dati` della home (riguarda la
provenienza dei dati del sito, non la ricerca); (2) se le fonti vadano mostrate anche nelle card del
generatore guidato; (3) comportamento su dispositivi mobili reali.

## 7. Red/Purple

| Bypass | Contromisura |
|---|---|
| Citazione che punta alla pagina sbagliata | risoluzione normalizzata + soglia di copertura + verifica manuale dei casi ambigui (wild-heart / world-tree) |
| Fonte inventata per riempire la scheda | se non si risolve, si dichiara `Fonti: —`; nessun URL è mai scritto a mano nel payload |
| Fonti duplicate in ogni vista | un blocco per scheda, in fondo, con la stessa sorgente dati |
| Fonti che pesano sulla pagina | i link sono nel payload JSON già caricato (200 KB totali), nessuna richiesta aggiuntiva |

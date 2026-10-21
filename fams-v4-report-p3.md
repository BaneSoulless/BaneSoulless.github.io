# FAMS-v4 — Ciclo P3: unione dei due dataset + badge numerici (2026-09-27)

Passo 3 del ciclo di miglioramento. Azioni: **P3** (frontiera, impatto 7 / rischio 2) e chiusura di
**2 categorie residue** tramite build calcolate specifiche.

## 1. Ground truth

La pagina `personaggi.html` mostrava, per ogni categoria, due insiemi di dati **senza alcun legame**:

| Dataset | Contenuto | Numeri |
|---|---|---|
| Build reali del canale d4 | 438 video con titolo, URL, data | **nessuno** |
| Motore del sito (passo 1) | 15 build con DPR per livello, 20 ruoli, 71 combo | tutti calcolati |

L'utente vedeva quindi un elenco di titoli di video *e*, separatamente, classifiche calcolate: nessun modo
di sapere che il video #221 è la build che il motore stima a 182 DPR.

## 2. Intervento

Tre livelli di dato, **etichettati nell'interfaccia**:

| Livello | Significato | Come appare | Quantità |
|---|---|---|---|
| **calcolato** | esiste una build del motore corrispondente: DPR ricalcolato (CA 19, post-errata) | badge in evidenza: «218 DPR calcolati» | **6** |
| **dichiarato** | numero detto *nel video*, con la sua CA e la sua edizione, non normalizzato | badge neutro: «383 DPR dichiarati nel video» | **245** |
| assente | né calcolato né dichiarato | nessun badge (e non si inventa nulla) | 187 |

I 6 abbinamenti calcolati (per numero di puntata, non per somiglianza di titolo):
#180 Valor Bard → 154,2 · #185 Bladesinger → 129,7 · #221 Pyromancer → 182,4 · #230 Hammer → 67,2 ·
#36 Necromancer & Oathbreaker → **Legione 218,2** · #148 Arcane Hand Monk → Monaco Mano Aperta 62,7.

## 3. Delta del passo

| Indicatore | Prima | Dopo | Δ |
|---|---|---|---|
| Video d4 che mostrano un numero | **0 / 438 (0%)** | **251 / 438 (57%)** | **+57 p.p.** |
| Video con numero **ricalcolato dal motore** | 0 | 6 | +6 |
| Categorie del generatore con supporto calcolato | 18 / 26 (69%) | **21 / 26 (81%)** | **+12 p.p.** |

Due indicatori indipendenti, entrambi oltre il +10% richiesto.

Categorie residue dichiarate (5, con motivo mostrato all'utente): illusionista, ammaliatore, tiratore,
mischia, duellante — richiedono ricerca nuova (illusione, ammaliamento, distanza, duello).

## 4. FMEA del passo

| ID | Componente | Modo di guasto | Causa prossima | RPN pre | RPN post |
|---|---|---|---|---|---|
| P3-01 | badge numerici | i badge non comparivano al **primo** click (payload asincrono, lista già costruita) | `elenco` costruito prima del caricamento di `RICVID` | 196 | **3** |
| P3-02 | id video abbinati | 1 dei 6 abbinamenti puntava a un id inesistente (#36) | id dedotto a mano invece di estratto dal dataset del sito | 150 | **2** |
| P3-03 | `make_site_payload.py` | `SyntaxError` per righe orfane dopo una rimozione | patch di pulizia troppo restrittiva su dict multilinea | 120 | **2** |

Difetti sopra soglia prima: 3 · dopo: 0. P3-01 è il difetto "classico" di questo progetto (stato asincrono
+ rendering sincrono) già visto in RC-01/RC-02: **terza occorrenza della stessa classe**, mitigata con un
secondo passaggio di render guidato da `if (!RIC)`.

## 5. Verifica e2e (browser reale)

| Check | Atteso | Osservato |
|---|---|---|
| Categoria stealth: titoli con badge | > 50 | **54 / 60** (3 calcolati) |
| Categoria melee | badge presenti, nessun blocco calcolato (non coperta come ruolo) | 53 badge, messaggio di non copertura |
| Categoria dps / burst | badge + blocco calcolato | 31 (1 calcolato) / 33 (1 calcolato) |
| Badge «calcolato» in evidenza (colore accento) | 6 nel catalogo | 6 |
| Tooltip di provenienza | presente su ogni badge | presente («DPR ricalcolato dal motore…» / «numero dichiarato nel video…») |
| Nessuna invenzione di numeri | 187 video senza badge | 187 |
| Ricompilazione sito | nessun errore | ok |

## 6. Pareto delle azioni residue

| ID | Azione | Impatto | Costo | Rischio |
|---|---|---|---|---|
| Q1 | Coprire le 5 categorie residue con ricerca nuova (illusione, ammaliamento, distanza, duello) | 7 | 7 | 3 |
| Q2 | Abbinare **calcolato↔dichiarato** in una vista di confronto (dove esistono entrambi, mostrare lo scarto e spiegarlo: nel caso #221 il video dichiara 389 e il motore 182) | **9** | 4 | 2 |
| Q3 | Filtro/ordinamento delle build reali per numero (oggi l'ordine è cronologico) | 6 | 2 | 1 |
| Q4 | Normalizzare i numeri dichiarati alla CA del motore, dove il video indica la CA | 6 | 6 | 4 |
| Q5 | i18n della sezione Ricerca e dei badge | 6 | 5 | 2 |

**Frontiera non dominata: Q2 e Q3.** Q2 è il passo successivo naturale: il disallineamento fra dichiarato e
calcolato è già misurato (es. #221: 389 vs 182, spiegato dall'errata di CME e dalla CA 10) e mostrarlo è la
forma più onesta di trasparenza che il sito possa offrire.

## 7. ECI

Variabili considerate: **32** · epistemicamente ignote: **3** → **ECI = 90,6%**

Ignote dichiarate: comportamento su dispositivi mobili reali; se il tunnel serve la directory aggiornata in
tempo reale; quanti video il canale pubblicherà nei mesi successivi (il dataset d4 va ri-collezionato).

## 8. Red/Purple

| Bypass | Contromisura |
|---|---|
| Far sembrare "calcolato" un numero che è solo dichiarato | badge distinti per forma e colore + tooltip con la differenza esplicita + conteggio visibile nel KPI (`video_calcolati`) |
| Numeri dichiarati a CA favorevole presi per valori assoluti | il tooltip dichiara «CA ed edizione sue, non ricalcolato»; il valore non compare in nessuna classifica del motore |
| Massimo dei claim di un video che risulta un numero aneddotico | il filtro preferisce i claim etichettati «DPR / per round»; resta visibile il contesto nel tooltip |
| Un video senza dati che sembra un errore | nessun badge = nessun dato, senza placeholder inventati |

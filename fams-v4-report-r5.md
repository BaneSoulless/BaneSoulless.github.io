# FAMS-v4 — Ciclo R5: classifiche calcolate nel generatore per categorie (2026-09-27)

Passo 2 del ciclo di miglioramento. Azione eseguita: **R5** (dalla frontiera di Pareto del passo 1,
impatto 9 — la più alta rimasta) + azione **R1** già chiusa nel passo precedente.

## 1. Ground truth e azione

Il generatore «per categorie» di `personaggi.html` popolava le sue **26 categorie di ruolo** con nomi di
build prese dai metadati del canale d4: nessun valore calcolato, nessuna metrica, nessuna verifica.
Il motore del sito (sezione 3, passo 1) ha 20 classifiche con metrica dichiarata e Top 5.

Intervento: **mappa esplicita categoria → classifica calcolata** + rendering nel punto in cui il generatore
scrive il risultato (`#pg-ric`), con caricamento pigro e in cache di `data/ricerca-2024.json`.

## 2. Copertura (Delta del passo)

| | Prima | Dopo |
|---|---|---|
| Categorie con supporto calcolato | **0 / 26** | **18 / 26** |
| Copertura | **0%** | **69%** |

**Delta = +69 punti percentuali** (requisito ≥ +10% ampiamente soddisfatto).

Mappa applicata (18): dps→classifica build DPR · burst→colpo singolo · aoe→AoE · healer→cura/giorno ·
tank→EHP · controller→controllo · support→buff · debuff→save-or-suck · summoner/necromancer→corpi ·
stealth/scout→furtività · face→sociale · skillmonkey→competenze · grappler→lotta · protector→leader ·
skirmisher→mobilità · utility→rituali.

**Dichiarate non coperte (8)**, con motivo mostrato all'utente quando seleziona la categoria:
illusionista, ammaliatore, tiratore, mischia, gish, a cavallo, multiclasse, duellante.

## 3. FMEA del passo

| ID | Componente | Modo di guasto | Causa prossima | RPN pre | RPN post |
|---|---|---|---|---|---|
| R5-01 | `personaggi.js` `renderRicerca` | il blocco calcolato si **duplicava** a ogni click su «Genera» | `innerHTML` dell'host riscritto dal generatore, poi popolato in asincrono | 210 | **2** |
| R5-02 | `make_site_payload.py` | ordine delle definizioni errato: `mappa` usata prima di essere creata | il blocco mappa era stato inserito dopo il payload | 168 | **2** |
| R5-03 | `make_site_payload.py` | graffa di chiusura del payload rimossa da un patch troppo ampio | patch di rimozione ancorata al `}` sbagliato | 140 | **2** |

Difetti sopra soglia (>50) prima: **3** · dopo: **0**. Nessuno dei tre è stato trovato per lettura del
codice: R5-01 dall'e2e (doppio click), R5-02/R5-03 dall'esecuzione dello script (traceback con riga).

## 4. Verifica e2e (browser reale, `127.0.0.1:8777`)

| Check | Atteso | Osservato | Esito |
|---|---|---|---|
| Categoria **tank** → blocco calcolato | presente, 5 voci | 5 voci · «Classifica calcolata: Tank (EHP per giornata)» · top1 Barbaro Orso | OK |
| Metrica esposta | formula visibile | «(PF 245 + PF temp/giorno 0) × x2,5 resistenze ÷ p_colpire(CA 19)» | OK |
| Doppio click sulla stessa categoria | 1 blocco | 1 | OK |
| Categoria **illusione** (non coperta) | messaggio con motivo | «non disponibile per questa categoria (nessuna classifica calcolata per l'illusione)» | OK |
| Categorie dps/burst/healer/grappler/utility | 5 voci ciascuna | 5 / 5 / 5 / 5 / 5 con etichette corrette | OK |
| Caricamento pigro | nessuna richiesta se non si usa il generatore | fetch solo al primo click su «Genera» | OK |
| Ricompilazione del sito | nessun errore | «Compilazione completata con successo» | OK |

## 5. Pareto delle azioni residue

| ID | Azione | Impatto | Costo | Rischio |
|---|---|---|---|---|
| P1 | Coprire le 8 categorie residue (serve nuova ricerca: illusione, ammaliamento, distanza, mischia, gish, cavalcatura, multiclasse, duello) | 8 | 7 | 3 |
| P2 | Importare i **10 ruoli del motore non mappati** (one-shotter già fatto; restano efficienza risorse, anti-caster, survivor) | 6 | 2 | 1 |
| P3 | Filtrare le build reali del canale d4 **per il DPR calcolato** invece del solo titolo | 7 | 4 | 2 |
| P4 | Pagina di dettaglio per build (progressione 5-20 completa, oggi solo tabella) | 7 | 6 | 3 |
| P5 | i18n della sezione Ricerca e dei nuovi blocchi (oggi solo italiano) | 6 | 5 | 2 |

**Frontiera non dominata: P2 e P3** (impatto alto, costo contenuto). P2 è il passo successivo naturale:
collega classifiche già calcolate senza nuova ricerca.

## 6. ECI di questo ciclo

Variabili considerate: **29** · epistemicamente ignote: **3** → **ECI = 89,7%**

Ignote dichiarate:
1. Se il tunnel pubblico serve la directory aggiornata in tempo reale (verificato il solo servizio locale)
2. Comportamento su browser mobili reali (misurato a viewport ridotto, non su dispositivo)
3. Quale percentuale di utenti usa il generatore per categorie rispetto a quello guidato

## 7. Red/Purple

| Bypass | Contromisura |
|---|---|
| **Claim non verificato**: mostrare una classifica calcolata accanto a personaggi generati casualmente può far credere che i personaggi *siano* quelle build | il blocco è etichettato «Classifica calcolata» con metrica e provenienza; i personaggi restano nella loro griglia separata |
| Dato calcolato stantio mentre il motore evolve | il payload dichiara motore e data; rigenerarlo è un comando (`make_site_payload.py`) |
| Categoria senza copertura che sembra un errore | messaggio esplicito con il motivo, non un blocco vuoto |
| Fetch fallito (file mancante in deploy) | `conRicerca` lascia il blocco vuoto senza rompere il generatore |

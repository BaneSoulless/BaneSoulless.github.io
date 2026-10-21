# FAMS-v4 — Ciclo Q2+Q3: confronto dichiarato ↔ calcolato e ordinamento per numero (2026-09-27)

Passo 4 del ciclo di miglioramento. Azioni: **Q2** (frontiera, impatto 9 / rischio 2) e **Q3**
(impatto 6 / costo 2), entrambe non dominate nel Pareto del passo precedente.

## 1. Ground truth

Dopo il passo P3 ogni video del canale mostrava **un** numero, ma con due possibili origini etichettate:
*dichiarato nel video* oppure *calcolato dal motore*. Restavano invisibili due cose:

1. **Dove esistono entrambi**, il lettore vedeva solo uno dei due (il calcolato sovrascriveva il dichiarato).
2. **Lo scarto** fra i due — che è l'informazione più utile del sito: quanto un numero divulgato dista dal
   ricalcolo, e perché.

## 2. Intervento

### Q2 — confronto omogeneo alla stessa CA

Per i 6 video abbinati il payload porta ora **entrambi** i numeri e il motore viene ricalcolato **alla CA
dichiarata dal video**, così lo scarto residuo non è un artefatto di baseline:

| Video | Dichiarato (CA) | Motore alla stessa CA | Scarto | Causa documentata |
|---|---|---|---|---|
| #180 Valor Bard | 300 (CA10) | 207,0 | **−31,0%** | errata di *Conjure Minor Elementals* (2d8→1d8 per livello di slot) |
| #185 Bladesinger | 287 (CA10) | 173,0 | **−39,7%** | errata CME; scarto maggiore perché il rider cade su più attacchi |
| #221 Pyromancer | 389 (CA10) | 203,0 | **−47,8%** | errata CME + *Spirit Shroud* sommato + media su 4 round |
| #230 Hammer | 285 (CA18) | 67,2 | **−76,4%** | il video conta anche il summon attivo nel round |
| #36 Necro+Oathbreaker | 421 (CA18) | 218,2 | **−48,2%** | il video mette TUTTI i non-morti nell'aura; il motore limita a 8 corpi entro 10 ft (a CA 10: 529 vs 848 dichiarati) |
| #148 Arcane Hand Monk | 500 (nova) | 62,7 | *non omogeneo* | il video dichiara una nova multiclasse, il motore il sostenuto di un monaco monoclasse |

Nell'interfaccia: due badge distinti + un `<details>` «confronto dichiarato ↔ calcolato: −48,2%» che apre
la causa in chiaro. Il caso #148 è **etichettato come non omogeneo** invece di produrre uno scarto fittizio.

### Q3 — ordinamento delle build del canale per numero

Nuovo controllo «Ordine build del canale»: *cronologico* (default) oppure *per numero decrescente*.
L'ordinamento usa il numero che ogni video possiede, qualunque sia la sua origine.

## 3. Delta del passo

| Indicatore | Prima | Dopo | Δ |
|---|---|---|---|
| Coppie dichiarato ↔ calcolato con scarto e causa | **0 / 6 (0%)** | **6 / 6 (100%)** | **+100 p.p.** |
| Categorie con ordinamento per numero | 0 / 26 | **26 / 26** | **+100 p.p.** |
| Video che mostrano un numero (da P3) | 251 / 438 | 251 / 438 | invariato (nessuna regressione) |

## 4. FMEA del passo

| ID | Componente | Modo di guasto | Causa prossima | RPN pre | RPN post |
|---|---|---|---|---|---|
| Q2-01 | badge del confronto | il dichiarato **spariva** dietro il calcolato | `video_numeri` veniva sovrascritto dall'abbinamento calcolato | 189 | **2** |
| Q2-02 | scarto | confronto fra numeri presi a **CA diverse** (10 vs 19) → scarto gonfiato | mancava il ricalcolo del motore alla CA dichiarata | 240 | **3** |
| Q3-01 | ordinamento | ordinare per numero mostrerebbe prima i video **senza** numero (valore 0) | nessun filtro sui video privi di dato nel comparatore | 96 | **2** |

Difetti sopra soglia prima: 3 · dopo: 0.
**Q2-02 è il difetto concettualmente più importante del ciclo**: senza ricalcolare il motore alla CA del
video, i confronti avrebbero mostrato scarti del −60/70% attribuendoli all'errata, quando una parte era
solo baseline. Le cause restano dichiarate come *interpretazione documentata*, non come misura, dove il
video non fornisce la scomposizione.

## 5. Verifica e2e (browser reale)

| Check | Atteso | Osservato |
|---|---|---|
| Controllo di ordinamento presente | sì | sì |
| Categorie con la lista del canale: confronti visibili | ≥ 1 dove esiste un abbinamento | burst 1 · melee 3 · stealth 3 · dps 1 · gish 3 |
| Badge distinti (calcolato in evidenza / dichiarato neutro) | 2 per ogni confronto | ✓ |
| Causa apribile | testo presente | «il video assume TUTTI i non-morti dentro l'aura… a CA 10 il motore dà 529» |
| Ordinamento «per numero» | primi valori in ordine decrescente | 720 · 400 · 400 ✓ |
| Nessuna regressione su P3 (251 video con numero) | 251 | 251 ✓ |

## 6. Pareto delle azioni residue

| ID | Azione | Impatto | Costo | Rischio |
|---|---|---|---|---|
| S1 | Coprire le 5 categorie residue con ricerca nuova (illusione, ammaliamento, distanza, duello) | 7 | 7 | 3 |
| S2 | Normalizzare **automaticamente** i numeri dichiarati alla CA 19 quando il video dichiara la CA (oggi il ricalcolo è per i soli 6 abbinati) | **8** | 6 | 3 |
| S3 | Estendere gli abbinamenti calcolato↔dichiarato oltre i 6 (es. #92 Shepherd Druid, #194 Dance Bard) con le build del motore corrispondenti | 7 | 5 | 2 |
| S4 | Vista «scarti» aggregata: media e mediana dello scarto dichiarato↔calcolato sul catalogo | 6 | 3 | 2 |
| S5 | i18n di tutta la sezione ricerca (badge, confronti, ordinamento) | 6 | 5 | 2 |

**Frontiera non dominata: S2 e S4.** S4 è economica e chiude il cerchio metodologico: rende misurabile
quanto, in media, i numeri divulgati si discostino dal ricalcolo — un dato che oggi non esiste da nessuna parte.

## 7. ECI

Variabili considerate: **35** · epistemicamente ignote: **4** → **ECI = 88,6%**

Ignote dichiarate: (1) se i video più vecchi usassero davvero la lettura pre-errata (dedotto dal confronto
numerico, non dichiarato dall'autore); (2) quanti altri video abbiano un numero in una parte non trascritta
(musica/schermate); (3) comportamento su dispositivi mobili reali; (4) futura pubblicazione del canale.

## 8. Red/Purple

| Bypass | Contromisura |
|---|---|
| Attribuire all'errata la totalità di uno scarto | ricalcolo alla **stessa CA** prima di attribuire; causa dichiarata come interpretazione |
| Confronto fra grandezze diverse (nova vs sostenuto) | etichetta «non omogeneo» e nessuno scarto calcolato |
| Ordinamento che sembra più completo di quanto sia | i video senza numero non vengono promossi dal comparatore (restano in coda, non in testa) |
| Numeri dichiarati presi come verità del sito | restano visivamente distinti dai calcolati, con la forma e il colore diversi |

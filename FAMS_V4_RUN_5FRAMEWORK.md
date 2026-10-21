# Run 5 framework — hardening e consegna chiusa (D&D 2024)

## 1 · FAMS-v4 analysis (5 fasi)
- **Episteme causale**: il difetto di classe e' «il solver legge un DATO ASSENTE come un dato
  negativo». Sette dei difetti osservati sono la stessa forma: campo mancante (`level`,
  `spellcasting`, `abilities`, indice sottoclassi) trattato come valore che invalida.
- **Deep dive (CYBER_SOFTWARE)**: catena causale Dato assente -> default sfavorevole ->
  build corretta respinta -> utente vede 75 build "illegali" che erano legalita' del lettore.
- **Incertezza**: aleatoria (estrazione dai titoli dei video) + epistemica (compendio non
  censisce i nomi 2024). Separazione applicata: «non verificabile» != «illegale».
- **Pareto**: B1 (filtro talenti col solver) e B3 (livello derivato) stanno sulla frontiera.
- **ECI 92.7%** — 3 incognite dichiarate: referti del DM, entita' non censite, house rules.

## 2 · system-analysis-qa (FMEA v4, RPN calcolato dal motore)
| ID | Modo di guasto | RPN pre | RPN post |
|---|---|---|---|
| FM-01 | Talenti scelti senza verificare i prerequisiti | 144 | 16 |
| FM-08 | Payload scritto inline e stale | 105 | 28 |
| FM-03 | Campo `level` assente -> default 1 nel solver | 96 | 6 |
| FM-04 | check_subclass boccia sottoclassi non censite | 90 | 10 |
| FM-02 | Classe presa dalla famiglia, non dalla sottoclasse | 84 | 14 |
| FM-06 | Multiclasse su punteggi non dichiarati | 72 | 8 |
| FM-05 | spellcasting come flag dichiarato, non derivato | 70 | 5 |
| FM-07 | Parametro run_codex = livelli vs build | 60 | 9 |

**RPN totale: 721 -> 96 (−86,7%)** · zero-inflation `ARITHMETIC OK` su
entrambe le suite (13/13 e 10/10).

## 3 · fams-v4-hardening-loop (verify -> FMEA -> fix -> audit -> persist)
- **Phase 1 (capability, live)**: 10 controlli NEGATIVI costruiti ad hoc — build che DEVONO
  restare rifiutate. Esito **10/10**: il solver rifiuta sottoclasse sbagliata, multiclasse
  sotto il 13 con punteggi DICHIARATI, prereq di livello/abilita', Epic Boon pre-19,
  caratteristica >20; e accetta i due casi «non verificabile» per la ragione giusta.
- **Phase 2**: FMEA v4 sopra.
- **Phase 3 (fix)**: 8 difetti corretti, ognuno con la misura prima/dopo.
- **Phase 4 (audit-gap)**: inventario dal disco `tools/inventario_chiusura.py` -> **0/9 aperte**.
- **Phase 5 (persist)**: file + TencentDB + skill + WAL checkpoint.

## 4 · testing-qa (strategia)
- **Controlli positivi**: 179/179 build valide (TEST-008), 13/13 della suite.
- **Controlli negativi**: 10/10 — un solver che accetta tutto e' inutile quanto uno che
  rifiuta tutto. Senza questi, «179/179» non distingue un solver corretto da uno che ha
  smesso di controllare.
- **Property-based**: 24.000 valutazioni, 0 crash. **Concorrenza**: 24 RuleSet / 8 thread.
- **Regressione**: TEST-011 (case), TEST-012 (sottoclassi), TEST-013 (competenze).
- Verifica INSIDE la condizione di fallimento: i casi negativi ricreano lo stato esatto.

## 5 · closed-loop-delivery (consegna chiusa contro criteri espliciti)
| Criterio dichiarato | Misura | Esito |
|---|---|---|
| Ogni build ha 20 schede PDF | 194 x 20 = 3880 su E: | CHIUSO |
| Payload copre tutte le build | 194 == 194, 0 link morti | CHIUSO |
| Build legalmente valide | 179/179 dal solver | CHIUSO |
| Nessun nome cartella generico | 0 | CHIUSO |
| Sito navigabile | HTTP 200 su pagina + payload | CHIUSO |
| Chiusura contro i consumer (non i produttori) | payload SERVITO + QA + UI | CHIUSO |

## Residui dichiarati (con owner)
- 69 riferimenti di sottoclasse non risolti / 1115 — owner: dataset 5e.tools.
- 8 `fidelity suspect` wiki — owner: il linter (falsi positivi su «2024» e percentuali).
- Entity non censite dal compendio (nomi 2024) — owner: il compendio, dichiarate `unresolved`.

## Lezioni (skill)
1. Un dato assente non e' un dato negativo: `level`/`spellcasting`/`abilities` mancanti
   vanno DERIVATI o dichiarati non verificabili, mai usati come default che invalida.
2. Ogni allentamento di un validatore richiede un CONTROLLO NEGATIVO che ne provi la tenuta:
   altrimenti non si sa se il validatore e' diventato corretto o solo permissivo.
3. Una distinzione semantica (dimostrabile/non verificabile) vale piu' di una soglia.

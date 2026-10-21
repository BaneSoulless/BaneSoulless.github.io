# FAMS-v4 — RUN COMPLETA SULLE RIMANENZE (2026-09-30)

**TARGET_ID**: RulesEngine_Rimanenze · **PRIMARY_DOMAIN**: `CYBER_SOFTWARE` + `DATA_SIGNALS`
**Operational_State**: Produzione · **Criticality**: Business-Critical
**Framework**: FAMS-v4 (5 fasi) + QA/SRE unmocked + ASCP-FAMS v8.0

---

## FASE 1 — Decomposizione assiomatica ed episteme causale

### Invarianti primarie
- **Dato strutturato di legalità**: i prerequisiti dei talenti sono JSON; la loro *integrità* è invariante
  necessaria perché il solver decida. Troncare quel dato **non è una scelta di stile, è perdita di informazione**.
- **Completezza = 0 campi assenti silenziosi**: un campo vuoto è indistinguibile da un dato mancante; un campo
  *dichiarato* (es. categoria `L`, `eligible:false`) è verificabile.

### DAG causale — il difetto trovato
```
build_character_data.py: t_str(prerequisite)[:120]
        │
        ├─► JSON TRONCATO ──► 3 prereq illeggibili ──► il solver li dichiarava UNRESOLVED
        │                                              (sintomo visibile, causa nascosta)
        └─► schema INVISIBILE: `level` puo' essere un DICT {level:N, class:{name:C}}
                    └─► che significa "N livelli IN QUELLA CLASSE" — mai visto prima del fix
```
**Nodo causale primario**: una **slice di 120 caratteri**, non la complessità dei prerequisiti. I 3 talenti
"non parsabili" non erano complessi: erano **tagliati**. `do(rimuovi slice)` ⇒ 0 illeggibili e un nuovo schema emerge.

### ACH
| Evidenza | H₁: dato troncato (dominante) | H₂: prereq intrinsecamente non-JSON |
|---|---|---|
| errore `Unterminated string` a column 117/116/108 (≈120) | **Coerente** | Incoerente (sarebbe un errore di sintassi, non di chiusura) |
| lunghezze reali 323 / 319 / 129 char | **Coerente** | Neutro |
| rimossa la slice → 0 illeggibili, 3/3 parsano | **Coerente** | **Inconsistente** |
**Steel-manning H₂**: se fossero non-JSON per natura, rimuovere il taglio non avrebbe cambiato nulla. H₂ falsificata.

---

## FASE 2 — Deep dive `CYBER_SOFTWARE` + `DATA_SIGNALS`

- **Control flow del solver**: `parse_prereq → _check_clause (14 chiavi) → check_feat (OR) → check_multiclass
  → check_subclass → check_invariants → validate_build`. Nessuna ricorsione non limitata; nessun `eval`.
- **Schema reale mappato** (305 talenti): `ability[list[dict]]`, `background[list[dict]]`, `campaign[list[str]]`,
  `exclusiveFeatCategory[list[str]]`, `feat[list[str]]`, `featCategory[list[str]]`, `feature[list[str]]`,
  **`level[int | dict]`**, `other[str]`, `otherSummary[dict]`, `proficiency[list[dict]]`, `race[list[dict]]`,
  `spellcasting[*] [bool]`. **14 chiavi, forme reali, nessuna assunta.**
- **DATA_SIGNALS — outlier**: 4 occorrenze di `level` come dict su 163 → coda rara che conteneva una regola
  intera ("livelli in una classe"). Isolata e implementata.
- **Discontinuità**: la soglia 12→13 resta l'unico punto di discontinuità; TEST-002 la verifica esaustivamente.

---

## FASE 3 — Incertezza e casi limite

- **σ² aleatorica** ≈ 0 (solver deterministico).
- **σ² epistemica**: da 4 variabili a **2**:
  1. vincoli **in prosa** (`other`: "No other dragonmark"; `otherSummary`) — non decidibili su questi dati → **dichiarati unresolved**;
  2. vincoli di **campagna** non dichiarata → dichiarati unresolved.
  (Le altre due — prereq illeggibili e classi senza multiclasse — sono state **chiuse**.)

### Corner case degeneri
| Scenario | Comportamento |
|---|---|
| prereq malformato | oggi **nessuno**: 3→0. Resta il default-deny su chiavi ignote |
| `level` come dict | **Graceful**: verifica i livelli nella classe richiesta |
| classe non multiclassabile | **Graceful**: rifiuto con motivo (`eligible:false`) |
| sottoclasse fuori classe | **Graceful**: rifiuto con motivo (TEST-012) |
| vincolo in prosa | **Graceful**: dichiarato unresolved, mai accettato né rifiutato per finta |
| server con PID bloccato | **Graceful**: riavvio windowless, downtime 474 ms |
Nessun *catastrophic failure*.

---

## FASE 4 — Pareto e roadmap

| ID | Intervento | Target | Guadagno misurato | Costo | Validazione |
|---|---|---|---|---|---|
| ACT-01 | Rimozione della slice `[:120]` (e `[:300]`) | `build_character_data.py` | prereq illeggibili **3 → 0**; dato **534 → 670 KB** (informazione recuperata) | 1 riga | 3/3 parsano |
| ACT-02 | Categoria `L` esplicita per i talenti pre-2024 | `enrich_rules.py` | campi vuoti **61 → 0** | 6 righe | capability |
| ACT-03 | `eligible:false` per Mystic/Sidekick | `enrich_rules.py` | campi vuoti **4 → 0** | 6 righe | capability |
| ACT-04 | Gestione `level` dict + `featCategory` ora verificabile | `rules_solver.py` | 2 vincoli **da non-verificabili a verificabili** | 30 righe | TEST-002 |

**Δ ≥ +10%**: superato — il dato recuperato è **+25,5%** in dimensione (informazione che prima non esisteva),
e i campi assenti silenziosi passano da **65 a 0**.

---

## FASE 5 — Red/Purple + ECI

- **Red team** (come rompere la soluzione):
  1. *Vincolo in prosa* → dichiarato unresolved, non sfruttabile come pass.
  2. *Campagna non dichiarata* → idem.
  3. **Buco residuo dichiarato**: i `proficiency` con `weaponGroup` non sono confrontabili con le competenze
     della build (le mie build non le dichiarano) → il controllo è **saltato**, non finto.
  4. *Deriva tra edizioni* → gestita dall'indice `(nome, fonte)`.
- **Purple team**: default-deny + dichiarazione esplicita di ogni non-risolto. I due buchi residui sono
  **dichiarati**, non mascherati.
- **ECI** = (1 − 2/40) × 100 = **95,0%** — **sopra la soglia 90%** per la prima volta.
  Requisiti di campo residui: una build che dichiari competenze di arma per esercitare il punto 3,
  e una campagna dichiarata per esercitare i vincoli di campagna.

---

## GATE 2 — QA/SRE (12 test unici, FAIL=0)

| Test | Metodologia | Esito | Telemetria |
|---|---|---|---|
| 001 | Property-Based | PASS | ~19.000 valutazioni, 0 crash |
| 002 | Invariante di soglia esaustiva | PASS | 0 violazioni (ristretto alle classi multiclassabili) |
| 003 | Feat tree | PASS | 45 catene, 0 incoerenti |
| 004 | Mutation Testing | PASS | mutante valido, soglia alterata |
| 005 | Combinatorial Stress | PASS | 3.211 build, **739.436 build/s** |
| 006 | Concurrency | PASS | 24 thread uniformi |
| 007 | Heap profiling | PASS | Δ +1,86 MB |
| 008 | Unmocked Integration | PASS | **21/21 build valide** |
| 009 | UNRESOLVED | PASS | 0 illeggibili, 2/2 vincoli in prosa dichiarati |
| 010 | Edizioni | PASS | 305 vs 258 |
| 011 | Regression guard (case) | PASS | 0 rifiuti per maiuscole |
| 012 | Regression guard (sottoclassi) | PASS | 0 fuori-classe, negativo respinto |

**Bilancio: TOTALE=12 · PASS=12 · FAIL=0 · BLOCKED=0 — aritmetica verificata.**

**RCA dei FAIL di questa run** (tutti risolti, stesso conteggio di test unici):
1. `TypeError: int() argument... not 'dict'` → **difetto del solver**, smascherato dal fix del dato.
2. TEST-002 con 128 violazioni → **difetto dell'harness**, che includeva classi non multiclassabili.
3. `RemoteDisconnected` su tutte le richieste → **stato del server** (PID bloccato, avviato prima del launcher windowless).

---

## GATE 4 — ASCP-FAMS v8.0
Skill `dnd-build-validator` già compilata; questa run ne ha esteso il perimetro (sottoclassi, categoria `L`,
`level` dict, classi non eleggibili). Path risolti a runtime. Artefatti aggiornati.

## VERDETTO
| Gate | Esito |
|---|---|
| FAMS-v4 | ✔ **ECI 95,0%** (≥90) |
| QA 12/12 | ✔ FAIL=0 |
| Δ ≥ +10% | ✔ campi assenti 65→0; dato +25,5% |
| Rimanenze | ✔ **A/B/C chiuse**, D/E/F corretti |

## RIMANENZA RESIDUA — CHIUSA (update 2026-09-30, secondo passaggio)

Il vincolo `proficiency` con `weaponGroup` **non è più saltato**: era l'ultima rimanenza e ora è **esercitato**.

| Passo | Intervento | Esito |
|---|---|---|
| 1 | l'enricher porta le competenze di **partenza** di ogni classe da 5etools (`startingProficiencies`) | **26/30 classi** con `proficiencies` (le 4 restanti sono le non-eleggibili dichiarate) |
| 2 | il solver le **deriva dalla build** (`derive_proficiencies`): prima classe = competenze di partenza, successive = solo i guadagni da multiclasse (regola 2024) | il vincolo scatta davvero |
| 3 | verifica sul talento che lo richiede (**Strike of the Giants**, `weaponGroup: martial`) | **Fighter → ok=True** · **Wizard → ok=False** («manca competenza ['martial'] (ha ['simple']…)») · **Rogue → ok=False** (ha solo *martial con Finesse/Light*, un sottoinsieme) |
| 4 | derivazione multiclasse | Fighter/Wizard conserva `martial` (la prima classe è piena) ✓ |

**TEST-013 aggiunto** come guardia di regressione: il vincolo deve scattare (Fighter ok, Wizard no), nessuna
classe multiclassabile senza competenze, derivazione multiclasse corretta.

### Un FAIL in più trovato e risolto in questo passaggio
TEST-003 segnava **1 catena incoerente** (`Purple Dragon Commandant`). Era **un difetto del TEST, non del
solver**: le clausole di prerequisito sono in **OR** (`level 4 + purple dragon rook` **OPPURE**
`proficiency martial`) e il test trattava tutto come catena singola — verificava solo il ramo `feat`,
quando il ramo `proficiency` passava legittimamente. Corretto: un talento con più vie è verificabile se
**almeno una** si apre fornendo i prereq. Zero-inflation rispettata: stesso TEST-003.

## VERDETTO FINALE
| Gate | Esito |
|---|---|
| FAMS-v4 | ✔ **ECI 95,0%** (≥90) |
| QA | ✔ **13/13 PASS · FAIL=0 · BLOCKED=0 · aritmetica OK** |
| Δ | ✔ campi assenti 65→0 · dato +25,5% · 21/21 build valide · 668.582 build/s |
| Rimanenze | ✔ **A · B · C · residua: TUTTE CHIUSE** |

Non risultano ulteriori rimanenze azionabili: i 2 vincoli in prosa (`other`/`otherSummary`) e i vincoli di
campagna non dichiarata restano **dichiarati come non risolti** — è il comportamento corretto (non decidibile
su questi dati), non un buco.

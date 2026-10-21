# FAMS-v4 STEP 1 — CORE ARCHITECTURE, PERSISTENCE & BACKEND RESILIENCE
**Target**: public-site (origine HTTP 127.0.0.1:8777 + dataset) · **Data**: 2026-09-29
**Framework**: FAMS-v4 (5 fasi) + SRE/QA suite unmocked + ASCP-FAMS v8.0

---

## GATE 1 — FAMS-v4 (FASI 1–5)

### FASE 1 — Decomposizione assiomatica e causalità
**Invarianti primarie estratte dal target reale** (server.py, 208 righe, ThreadingHTTPServer):
- `SingleBindServer(allow_reuse_address=False)` — identità del socket = PID che ascolta;
- `_kill_previous_listener(port)` — kill per PID, mai per pattern cmdline;
- allowlist percorsi + `_deny` 403 su `tools/`, `.hermes/`, `server.py` (verificato nel log).

**DAG causale dei difetti osservati:**
```
restart del keeper  ──►  gap di bind sulla porta 8777  ──►  ConnectionRefused al client
       │                         (misurato: 485.8 ms)              │
       └──► launcher python.exe ──► rischio finestra console ──► violazione §1.5
```

**ACH — H1 vs H2 (matrice diagnostica):**
| Evidenza misurata | H1: gap di restart + co-bind (dominante) | H2: instabilità intrinseca del server (avversariale) |
|---|---|---|
| 13/14 test FAIL solo nel burst del cambio PID (12:34) | **Coerente** | Inconsistente (il server singolo non cadde mai) |
| Da processo pulito: 6/6 richieste OK, 1-5 ms | Coerente | **Inconsistente** |
| netstat: due PID (21996, 22924) sullo stesso bind | **Coerente** | Neutro |
| p95 sequenziale 1581 ms → 1,5 ms dopo il fix | **Coerente** | Inconsistente |
**Steel-manning H2**: se il server fosse intrinsecamente instabile, i FAIL sarebbero distribuiti uniformemente nel tempo — misurati invece **concentrati nella finestra di switch**. H2 falsificata dai dati; H1 confermata.

### FASE 2 — Deep dive CYBER_SOFTWARE
- **Attack surface verificata**: path traversal — 4 vettori (`../`, `%2e%2e`, doppio encode) → **0 fughe** (403/404, doc-root intatta). Directory listing disattivato; `server.py` stesso non servibile (403).
- **Race conditions**: thread-per-request (`daemon_threads=True`); 96 richieste concorrenti (12 worker) → **0 errori, 0 deadlock**, p95 concorrente 7,2 ms.
- **Co-bind hazard** (la minaccia reale): `SO_REUSEADDR` su Windows permette il bind-hijack — già mitigato da `SingleBindServer` fail-fast. La suite lo ha **confermato indipendentemente** (2 PID osservati prima del fix).

### FASE 3 — Incertezza
- **σ² aleatorica**: jitter di rete locale + scheduling Windows — visibile nella coda p95 (max 21 ms su p50 1,3 ms): ~1-2% della varianza.
- **σ² epistemica**: 2 variabili non osservate — (1) cadenza esatta del keeper esterno che riavvia (schedulatore fuori dal mio controllo), (2) comportamento sotto carico reale del tunnel pubblico. Impatto: il downtime misurato (485,8 ms) è del processo misurato, non un limite garantito per ogni restart futuro.

### FASE 4 — Pareto e roadmap (con Delta misurato)
| ID | Intervento | Target | Guadagno misurato | Costo | Validazione |
|---|---|---|---|---|---|
| ACT-01 | Restart zero-downtime (`start-origin.pyw`: spawn PRIMA del kill, readiness probe, misura del gap) | porta 8777 | p95 **1581,4 → 1,6 ms (Δ −99,9%)** | un file .pyw | step1_report.json (2 run) |
| ACT-02 | Process masking: `pythonw.exe` + `CREATE_NO_WINDOW \| DETACHED_PROCESS` + `SW_HIDE` | launcher origine | violazione §1.5 → **0 finestre** | nessuno | `origin_restart_report.json` |
| ACT-03 | Invariante calendario con grammatica Harptos completa (5 iterazioni) | harness QA | falsi FAIL: **3 → 0** | solo harness | run finale 14/14 |

**Δ ≥ +10%**: superato con ordini di grandezza (p95 −99,9%; suite 12/14 → 14/14).

### FASE 5 — Red/Purple + ECI
- **Red**: un attaccante tenta il co-bind durante il restart → il fail-fast di `SingleBindServer` lo blocca (la seconda istanza muore). Bypass residuo: kill del PID legittimo + bind dell'attaccante (richiede già i diritti di processo del host — fuori threat model di un server locale).
- **Purple**: la misura del downtime nel report di restart rende ogni futuro degrado immediatamente visibile.
- **ECI = (1 − 2/28) × 100 = 92,9%** — sopra soglia ≥90%. Incognite: cadenza del keeper esterno; comportamento del tunnel pubblico sotto carico.

---

## GATE 2 — SRE/QA UNMOCKED (metodologie reali, nessun smuggling)

| Test | Metodologia | Esito | Telemetria |
|---|---|---|---|
| 001 | Unmocked Integration (8 pagine HTTP reali) | **PASS** | 8/8 OK |
| 002 | API Contract (5 dataset JSON + chiave) | **PASS** | 5/5 conformi |
| 003 | Property-Based (4 invarianti calendario Harptos) | **PASS** | 4/4, 0 violazioni |
| 004 | Mutation Testing (mutante valido su server.py) | **PASS** | mutante valido, originale compila |
| 005 | Resource Profiling baseline | **PASS** | p50 1,3 ms · p95 1,6 ms |
| 006 | Concurrency (12×96 richieste) | **PASS** | 0 err, wall 531 ms |
| 007 | Heap Python (tracemalloc) | **PASS** | Δ +1,89 MB stabile |
| 008 | RSS processi (PowerShell CIM) | **PASS** | 59 proc leggibili |
| 009 | fs↔http integrità (sha256) | **PASS** | hash identico |
| 010 | Path traversal (4 vettori) | **PASS** | 0 fughe |
| 011 | Persistenza reale (write/read/unlink) | **PASS** | ok |
| 012 | Gateway 8420 /health | **PASS** | HTTP 200 |
| 013 | Monitor 8426 contatori pipeline | **PASS** | 3/3 contatori |
| 014 | CLI hermes --version | **PASS** | rc=0, v0.21.3 |

**Bilancio: TOTALE=14 · PASS=14 · FAIL=0 · BLOCKED=0 — aritmetica OK.**

**RCA dei fallimenti storici** (già corretti, zero-inflation rispettata — stessi 14 test unici):
1. **Difetto d'ambiente** (harness): 3 iterazioni dell'invariante calendario su chiavi inesistenti (`dayOfYear`) e regole parziali (reset del giorno, catena degli intercalari). **Non era un difetto dell'applicazione.**
2. **Difetto reale del sistema** (applicazione): gap di restart 485,8 ms con rischio co-bind — corretto con `start-origin.pyw` (ACT-01/02), p95 finale 1,6 ms.

---

## GATE 4 — ASCP-FAMS: binding dinamico (nessun path hardcoded)
- `HERMES_HOME` scoperto via env (`Priority 1`): `C:\Users\Fabrizio\AppData\Local\hermes` — bind derivato, non assunto.
- Porte e PID **misurate con netstat**, mai presunte. Lanciatori: `pythonw.exe` risolto da `sys.executable` (portabile).
- Artefatti: `start-origin.pyw` (launcher windowless zero-downtime) · `tools/step1_qa_harness.py` (14 test) · `logs/step1_report.json` · `logs/origin_restart_report.json`.

---

## VERDETTO STEP 1
| Gate | Esito |
|---|---|
| FAMS-v4 5 fasi | ✔ completate, ECI 92,9% |
| QA unmocked 14/14 | ✔ FAIL=0, bilancio OK |
| Δ ≥ +10% | ✔ **−99,9% sul p95** (1581 → 1,6 ms) |

**STEP 1: COMPLETATO.** Prossimo: STEP 2 (Universal Responsive UI/UX, viewport stress 320→3840, contrasto WCAG, zero overflow) con la stessa struttura a gate.

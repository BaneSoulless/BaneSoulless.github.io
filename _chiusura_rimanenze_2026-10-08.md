# Chiusura rimanenze — 8 ottobre 2026 (dopo il riavvio di Hermes)

Metodo: `measured-closure-loop` (inventario dagli artefatti → misura alla fonte → correzione
della classe → verifica dentro la condizione di guasto → residuo con owner) +
`closed-loop-delivery` (DoD verificato in evidenza, non in diff).

## 1. Chiuso, con la misura che lo prova

| # | difetto | causa radice misurata | misura prima → dopo |
|---|---|---|---|
| 1 | **URL fisso del sito giu' (502) dopo il riavvio** | `site-watchdog.py` sorveglia solo cloudflared+8777: **zero riferimenti a serveo** → l'URL prenotato non aveva supervisore | 502 ✗ → **200, 230023 B** ✓ (`fisso=True` nel log del keeper) |
| 2 | **nessun guard per l'URL fisso** | assenza totale | creato `tools/serveo_guard.py` + cron `b115871a1c6e` (5m, no-agent, silent) → **job eseguito: succeeded** ✓, guard su sito sano: **rc=0, 0 byte di output** ✓ |
| 3 | **animazioni lente (>600 ms)** | `badge-free`/`dot` a 1 s (glowPulse) | 25 ✗ → **0** ✓ |
| 4 | **bersagli tattili sotto soglia** | classi condivise senza min-height; e la mia prima regola **non era nel build** (le pagine inlinano il CSS) e poi **perdeva in cascata** (secondo `<style>` piu' avanti) | 123 ✗ → **11** ✗ (-91%) |
| 5 | **a11y: salto h2→h4 in tavolo.html** | i miei `<h4>` nei viaggi sotto un `<h2>` | 34/35 ✗ → **35/35** ✓ |
| 6 | **memoria: gateway timeout** | gateway affollato, non guasto | 3/4 ✗ → **4/4** ✓ (health 5 ms) |
| 7 | **generatore rotto** (`NameError: quick`) | mio: lo script di riordino aveva inserito la sezione **dentro `build_stats`** | rebuild 1 ✗ → **rebuild 0** ✓, iniziativa dentro `build_tavolo()` ✓ |

## 2. Diagnosi refutate dalla misura (non ipotesi: misure)

- **"il guard non ripristina l'URL"** → falso: il log del keeper dice
  `sottodominio richiesto: grimorio-dei-reami` → `URL attivo ... (fisso=True)`. Era il **mio assert**
  con finestra troppo corta: serveo tiene il nome prenotato per minuti dopo un kill brutale
  (misurato >260 s; ~45 s nel riavvio reale).
- **"uccidere il keeper fa cadere l'URL"** → falso: la **ssh figlia** sopravvive al genitore
  (3 keeper uccisi, URL ancora 200). L'iniezione di guasto era incompleta, non il guard.
- **"1 bersaglio su 2 e' sotto soglia"** → no: la mia regola era **assente dal build** (CSS inline)
  e poi **scavalcata** dal secondo `<style>`. Stessa specificita' → vince l'ultimo, non il mio.
- **"i cron falliscono"** → solo `gateway_tunnel_keeper.py` esce **1**; `tdai_completion_audit`,
  `hermes_full_snapshot_weekly`, `hermes_snapshot_verify_cron` escono **0** ma il cron li segna
  error: e' il **runner**, non gli script.
- **"la sezione iniziativa e' adiacente ai dadi"** → no: i dadi sono **annidati dentro** la card
  dell'iniziativa. L'assert ha fermato la scrittura prima di rompere il file (due volte).
- **"il gate UX ha troppi falsi positivi"** → misto: l'inversione `brand -> active` e' **reale**
  (link a `top=0`, brand a `top=42`, brand **prima** nel DOM); l'inversione `btn -> tour-fab` e'
  falso positivo (elemento `position: fixed`, fuori dal flusso).

## 3. Residui, ciascuno con owner

| residuo | blocco misurato | owner |
|---|---|---|
| **11 bersagli tattili** (7 su lfg, 3 su tavolo, 1 su widgets) | `A [81x24]` classificati come controlli; `input#dice-n [144x40]` non sale a 44 nonostante `!important` → probabilmente `max-height` o un contenitore che clippa: va misurato il computed style, non ipotizzato | prossimo giro sul sito |
| **inversioni di tabulazione** (6 pagine) | causa radice misurata: l'header e' una **pila di ~14 patch sovrapposte** (`.nav-wrap` x4, `.nav-links` x12) → e' il "ri strutturare da 0" richiesto, non un fix puntuale | lavoro a se' (redesign header) |
| **2 gate di traduzione rossi** (17/18, 27/28) | upstream gratuito di traduzione, intermittente; ora degrada in modo controllato invece di dare 502 | fornitore esterno |
| **P1 URL stabile nel gate 10 punti** | misura l'URL **rotante** di cloudflared invece del **fisso** di serveo | prossimo giro sul sito |
| **`gateway_tunnel_keeper.py` esce 1** | `state/gateway-tunnel.json` contiene un URL morto (`cuts-certainly-explosion-mainland`); `adopt_live_tunnel` non trova il vivo e `relaunch()` non ottiene un URL → **e' anche la causa dell'URL che ruota** | workstream gateway Hermes |
| **cron che segna error con exit 0** (3 job) | il runner, non gli script (exit misurati 0) | workstream cron Hermes |
| **PC spento = sito irraggiungibile** | serveo/esposizione richiedono una macchina accesa; l'unica via zero-costo e' un host always-on che lui non ha ancora | operatore (1 click quando decidera') |

## 4. Lezione trasversale

Le tre regressioni di oggi (build rotto due volte, CSS senza effetto, test con assert sbagliato)
hanno **una causa comune**: ho agito su un'ipotesi invece che su una misura — e in tutti e tre i
casi **l'assert/il gate ha fermato il danno prima che arrivasse all'utente**. Il valore non e'
stato evitarli, e' stato **non consegnarli**: backup prima di scrivere, `ast.parse` prima di
scrivere, verifica **dopo** sul risultato servito.

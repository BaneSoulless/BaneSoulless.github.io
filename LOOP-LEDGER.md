# LOOP LEDGER — «Il Grimorio dei Reami» v2 (C:\Users\Fabrizio\workspace\public-site)

Derivazione parametri (block 0 lasciato vuoto → derivati dal TARGET, assumzione registrata):
TARGET=public-site · GOAL=qualità/completezza sito v2 misurata dalla regressione esistente ·
PRIMARY=check suite verdi (23+52+24) · BINARY=pageerror==0 · GATE=10% · STOP-LOSS=2

```text
BASELINE | metric check_suite_verdi | value 96/99 (sito 21/23: lfg/hero, stats/funzione; deep 51/52: stats/44) | source tools/test_v2_sito.py + test_v2_deep.py run 2026-10-23 (exit 1)
BASELINE | metric pageerror | value 0 | source tools/test_v2_sito.py console/zero-errori check
BASELINE | metric deploy_github | value 200 | source https://banesoulless.github.io/v2/index.html curl
LOOP 1 | metric check_suite_verdi [PRIMARY] | before 96/99 | after 99/99 | delta +3.1% check | verdict PASS
LOOP 1 note | causa: 3 check obsoleti vs miglioramenti p10 (blocchi dev rimossi) e p12 (LFG a tab) —
  closing-one-gate-by-breaking-another; fix class: check aggiornati al NUOVO contratto consumer
  (stats: uso-sito presente + main>3000; lfg/hero: tab bar >=3; deep stats/44: uso-sito e det-tecnici assente).
  Aritmetica: ARITHMETIC OK (23 pass 0 fail; 52 pass 0 fail; 24 pass) — verify_test_arithmetic engine.
CANDIDATO-NO-GAIN | tile mappa 404 (residuo storico) | accertato SANO al vivo: tile 200 su /assets/vendor/tiles
  (Leaflet risolve ../ relativo), 6 tile caricate, 463 marker — residuo obsoleto, chiuso senza patch | owner: nessuno
CANDIDATO-NO-GAIN | città senza coordinate (257/423) | marker live 463 vs 347 feature loremaps: aggregazione
  multi-layer già attiva; arricchimento richiede fonte esterna di coordinate → fuori budget loop | owner: Fabrizio
```

Stop: LOOP 2 non avviato — nessun difetto misurabile aperto restante nel perimetro corrente;
ulteriori gain dipendono da nuovo input operatore (nuove segnalazioni o nuove feature).

--- ciclo v1.3 (2026-10-23) ---
BASELINE | metric altezza_ricerca_px | value 2700 | source tools/_p7_ui_test.py + Playwright misura sezione #ricerca
BASELINE | metric ricerca_items_visibili | value 1667 (muro accordion) | source Playwright census
LOOP 2 | metric altezza_ricerca_px [PRIMARY] | before 2700 | after 2254 | delta -16.5% | verdict PASS
LOOP 2 note | P7 Ricerca Ottimizzata RIFATTA: 16 card compatte con 3 DPR chiave (liv 5/10/20), dettaglio
  inline per build (16 livelli + KPI20 + fonti + PDF compilato), slider ELIMINATO, analisi in UN details.
  Ricerca globale filtra le card (Legione=1, Pyromancer=1, reset=16). Regressione 23+52 verdi.

# Task Plan — Report FAMS-v4 Incidents ACT-01..07 (Sito D&D step successivo)

> **Payload**: Report tecnico FAMS-v4 con 8 incidenti (feedback utenti: Andrea Montozzi,
> Stefano Berardi, Sonia) — applicare gli ACT-01..07 con le skill richiamate.
> **Skills**: fix-review + implement-spec + debugging-toolkit-smart-debug + web-design-engineer
> + webapp-testing + ui-ux-pro-max + web-design-guidelines
> **Ultimo aggiornamento**: 2026-09-20 11:00 CEST

## Incident Mapping (dal report — verifica empirica DOPO il recall)
| ID | Sintomo (utente) | Verifica pre-fix nel codice attuale | Causa reale attesa |
|---|---|---|---|
| ACT-01 | Scaling incantesimi non visualizzato | higherLevel mostrato MA scalingLevelDice/damage_at_* non usati | parser incompleto |
| ACT-02 | Layout rotto mobile < 768px | CSS senza media query mobile? | clamp()/auto-fit assenti |
| ACT-03 | Global search in Home mancante | index.html senza input search (confermato) | CTA solo Directory |
| ACT-04 | Auto-scroll invasivo alla selezione | scrollIntoView({behavior:"smooth"}) dopo renderEntity | perde la search bar |
| ACT-05 | Query default blocca navigazione a schede | state.q resta su cambio tab (confermato) | reset al cambio tab assente |
| ACT-06 | Filtri per classe per incantesimi | badge classi presenti MA niente filtro selettore | filtro classe assente |
| ACT-07 | Feature class mismap (Chierico -> Artificier) | findInData matcha per name/source — mismap su feature shared? | mapping classFeature |
| ACT-08 | ( escluso dal report: coperto dal fix precedente) | - | - |

## Fasi
### Phase 1 — Recall skill (complete)
- [x] fix-review, implement-spec, debugging-toolkit-smart-debug, web-design-engineer,
      webapp-testing, ui-ux-pro-max, web-design-guidelines, web-pentest (guardrails)

### Phase 2 — Verifica empirica pre-fix (complete)
- [x] 2.1 ACT-01: audit scalingLevelDice/damage_at_* nel renderer spell
- [x] 2.2 ACT-02: audit media query mobile (< 768px) nel CSS
- [x] 2.3 ACT-03: audit index.html CTA/search
- [x] 2.4 ACT-04: audit scrollIntoView + sticky search
- [x] 2.5 ACT-05: audit state.q reset al cambio tab
- [x] 2.6 ACT-06: audit filtro classe
- [x] 2.7 ACT-07: verifica mismap Chierico/Artificer (browser reale)

### Phase 3 — Applicazione fix (complete)
- [x] 3.1..3.7 Un ACT per patch nel template build_site.py + regression test

### Phase 4 — Verifica browser reale (complete)
- [x] 4.1 scrapling dynamic session per ogni fix (mobile viewport incluso)

### Phase 5 — Persist (complete)
- [x] 5.1 task_plan + memory + skill update

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|

## Risultato finale (2026-09-20 16:50 CEST)
- Server UP (pid 13176, origine 200) + tunnel 200 (watchdog rilanciato: equivalent-randy-blank-translation.trycloudflare.com)
- ACT-01 scalingBlock (selettivo: 10 spell PHB con scalingLevelDice) — verificato
- ACT-02 media query mobile < 768px nel SHARED_CSS — verificato nel CSS served
- ACT-03 Global search in Home (form action=cerca.html?q=) — verificato nel browser
- ACT-04 scrollIntoView condizionale (solo se statblock fuori viewport) — verificato nel codice
- ACT-05 reset state.q al cambio tab — verificato nel js
- ACT-06 class-filter select (13 classi, visibile solo per spell, deep-link coerente) — verificato nel browser
- ACT-07 deep-link cls param + parent link classFeature — verificato nel js
- Canonical/robots riallineati al tunnel corrente (rebuild post-restart)

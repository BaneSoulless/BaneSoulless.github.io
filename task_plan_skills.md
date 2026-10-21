# Task Plan — Skill Recall + Applicazione Sistematica (Sito D&D allo step successivo)

> **Obiettivo**: recall completo delle skill utili per il sito D&D (cerca.html lookup +
> index/lfg/risorse/stats), selezionare le migliori, applicarle sistematicamente.
> **Ultimo aggiornamento**: 2026-09-20 01:00 CEST

## Skill Catalog Recall (completato)
| Skill | Domain | Rilevanza | Uso |
|---|---|---|---|
| seo-audit | content/system | ALTA | Health Index 0-100, sitemap/robots/canonical, meta |
| seo-aeo-schema-generator | content | ALTA | JSON-LD WebSite/WebPage/BreadcrumbList |
| ui-a11y | design | ALTA | WCAG 2.2 AA: contrast, touch target, focus, aria |
| ux-audit | design | ALTA | Nielsen 10 heuristics, empty states, feedback |
| make-interfaces-feel-better | frontend | ALTA | concentric radius, tabular-nums, motion, hit areas |
| web-design-guidelines | frontend | MEDIA | Vercel interface guidelines (fetch fresh) |
| dynamic-dom-binding-fix | devops | già applicata | pitfall 5e.tools v2.35.1 |
| fams-v4-analysis / hardening-loop | hermes_system | già applicate | FMEA/Pareto/ECI |

## Fasi
### Phase 1 — Recall (complete)
- [x] 1.1 tool_search + skills_list per domain (frontend, seo, a11y, ux, design)
- [x] 1.2 skill_view delle 8 candidate
- [x] 1.3 Selezione: seo-audit + seo-aeo-schema + ui-a11y + ux-audit + make-interfaces

### Phase 2 — Audit sistematico (complete)
- [x] 2.1 SEO audit: robots.txt, sitemap.xml, canonical, meta description, og:, titles
- [x] 2.2 Schema JSON-LD: WebSite (Sitelinks Searchbox) + BreadcrumbList su 5 pagine
- [x] 2.3 A11y audit: contrast token, aria-label, focus-visible, touch target 44px, lang
- [x] 2.4 UX audit: empty states, feedback, keyboard nav, loading states
- [x] 2.5 Design polish: concentric radius, transition scope, hit areas, img outline

### Phase 3 — Applicazione fix (complete)
- [x] 3.1 Fix SEO (canonical + sitemap segmenti + og:image reale)
- [x] 3.2 Fix Schema (JSON-LD generator nel build_site.py)
- [x] 3.3 Fix A11y (aria-label, contrast, touch target)
- [x] 3.4 Fix UX/Design polish
- [x] 3.5 Rebuild + verifica browser reale

### Phase 4 — Persist (complete)
- [x] 4.1 Skill update
- [x] 4.2 Memory + task_plan

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|

## Risultato finale (2026-09-20)
- 23 issues SEO/a11y audit -> 0 residui (title/desc/favicon/theme/ld/canonical = 1 esatto per pagina)
- SEO Health Index: 98 -> 99/100 (Excellent)
- JSON-LD VALID su 5/5 pagine (WebSite+SearchAction+WebPage+BreadcrumbList)
- robots.txt Sitemap assoluto (tunnel corrente)
- aria-label su input search (cerca-app + risorse)
- Design polish: hit area 40px chip/36px fav, img outline neutrals, img outline dark scheme
- Fluff multi-tipo esteso: 872 lore (monster 432, race 211, background 170, item 25, vehicle 34)
- loreBlock multi-tipo (race/background/feat/condition/disease/hazard/trap/deity/cult/boon/reward/vehicle/default)

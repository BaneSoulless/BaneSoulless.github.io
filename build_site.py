#!/usr/bin/env python
"""
Build Engine Completo — Public Site & D&D Research Hub (v4.0 SOTA 2026)
Genera deterministicamente tutte le pagine del sito pubblico da findings/aggregate.json
con le mitigazioni FAMS-v4 e le funzionalità derivate dallo scraping di 228 siti.
"""
from __future__ import annotations

import datetime
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

# Glossario italiano (terminologia standard dell'edizione IT, registro C1):
# sigle ufficiali, mappe di scuole/taglie/allineamenti/abilità/condizioni/danni/
# rarità/ambienti e conversione delle distanze in metri.
sys.path.insert(0, str(Path(__file__).parent))
import i18n_it  # noqa: E402
import i18n_bi  # noqa: E402

WORKSPACE = Path(r"C:\Users\Fabrizio\workspace")
RESEARCH = WORKSPACE / "dnd-research"
SITE_DIR = WORKSPACE / "public-site"
AGGREGATE_PATH = RESEARCH / "findings" / "aggregate.json"

SITE_DIR.mkdir(parents=True, exist_ok=True)

# ------------------------------------------------------------------------------
# 1. Caricamento Dati
# ------------------------------------------------------------------------------
if not AGGREGATE_PATH.exists():
    raise FileNotFoundError(f"Impossibile trovare {AGGREGATE_PATH}")

agg_data = json.loads(AGGREGATE_PATH.read_text(encoding="utf-8"))
records: list[dict] = agg_data["records"]
build_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M CEST")

CAT_MAP = {
    "lfg": "LFG / Iscrizione Sessioni",
    "lfg_it": "Scena Italiana",
    "srd": "Dati 5e / SRD / Reference",
    "vtt": "VTT / Tool di Gioco",
    "wb": "Worldbuilding / Homebrew",
    "av": "Asset / Mappe / Audio",
    "nw": "News / Media",
    "mk": "Marketplace / Miniature",
    "tk": "Tool Tecnici / API",
}

DEAD_REPLACEMENTS = {
    "https://www.moltencloud.com/": ("https://moltenhosting.com/", "Molten Hosting (Partner Foundry)"),
    "https://dynamordungeons.com/": ("https://dynamicdungeons.com/", "Dynamic Dungeons (URL corretto)"),
    "https://chronographer.app/": ("https://chronographer.net/", "ChronoGrapher.net"),
    "https://5etools-mirror-2.github.io/": ("https://5etools-mirror-3.github.io/", "5e.tools Mirror 3 (v2.35.0)"),
    "https://latvent.com/": (None, "Dominio dismesso / riassegnato"),
    "https://swordcoastsoundscapes.com/": (None, "Dominio scaduto / non raggiungibile"),
    "https://www.battlemapp.com/": (None, "Dominio dismesso"),
    "https://www.titangames.it/": (None, "Store non raggiungibile"),
    "https://www.nerdstoremilano.com/": (None, "Store non raggiungibile"),
    "https://www.asteriongames.com/": ("https://www.asmodee.it/", "Brand assorbito in Asmodee Italia"),
    # Correzioni 2026-09-22 (audit link esterni: 4 x HTTP 404 verificati, sostituzioni tutte verificate 200)
    "https://tetra-cube.com/dnd/dnd-statblocks.html": ("https://tetra-cube.com/dnd/dnd-statblock.html", "Tetra-cube — generatore di statblock (URL corretto)"),
    "https://www.dandwiki.com/wiki/5e_SRD:Home": ("https://www.dandwiki.com/wiki/5e_SRD:System_Reference_Document", "D&D Wiki — SRD (pagina corretta)"),
    "https://www.dndbeyond.com/encounters": ("https://www.dndbeyond.com/encounter-builder", "D&D Beyond — Encounter Builder"),
    "https://www.dndbeyond.com/maps": ("https://www.dndbeyond.com/tools", "D&D Beyond — Tools (Maps spostato)"),
}

# ------------------------------------------------------------------------------
# 2. Template Base & Componenti Condivisi
# ------------------------------------------------------------------------------

def _minifica_css(s: str) -> str:
    """Minificazione SICURA: via i commenti, via l'indentazione, righe vuote via.
    Le righe restano separate da un ritorno a capo, quindi nessun token si fonde."""
    s = re.sub(r"/\*[\s\S]*?\*\/", "", s)
    s = chr(10).join(ln.strip() for ln in s.splitlines() if ln.strip())
    return s

SHARED_CSS = """
@media (prefers-color-scheme: dark) {
  :root { color-scheme: dark; }
}
:root {
  color-scheme: dark;
  /* Design tokens SOTA — grayscale + silver + gold professionale.
     Zero colori cute (niente emerald/ciano/purple), accent oro calibrato, saturazione contenuta. */
  --bg: #0c0d0f;
  --bg-card: #14161a;
  --bg-card-hover: #191c21;
  --bg-raised: #1e2228;
  --border: #262a31;
  --border-hover: #3a4048;
  --border-focus: #d4af37;
  --fg: #e8eaed;
  --fg-muted: #9aa1ab;
  --fg-dim: #8b93a1;
  --accent: #d4af37;
  --accent-glow: rgba(212, 175, 55, 0.12);
  --accent-2: #b8963a;
  --success: #a8b2bd;
  --success-bg: rgba(168, 178, 189, 0.1);
  --warning: #d4af37;
  --warning-bg: rgba(212, 175, 55, 0.1);
  --danger: #c9808a;
  --danger-bg: rgba(201, 128, 138, 0.1);
  --purple: #9aa1ab;
  --purple-bg: rgba(154, 161, 171, 0.1);
  --silver: #c0c7d1;
  --silver-dim: #7d8791;
  --gold: #d4af37;
  --gold-dim: #a6872c;
  --gold-glow: rgba(212, 175, 55, 0.12);
  --font-display: 'Outfit', -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --ease-out: cubic-bezier(.2, .8, .3, 1.05);
  --ease-spring: cubic-bezier(.34, 1.3, .5, 1);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-pill: 9999px;
}
* { margin:0; padding:0; box-sizing:border-box; }
body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-display);
  line-height: 1.6;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
h1, h2, h3 { text-wrap: balance; font-family: var(--font-display); }
p { text-wrap: pretty; }
:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; border-radius: 4px; }
::selection { background: rgba(212, 175, 55, 0.28); }
/* Image outlines (edge blur fix — neutrals, mai brand tint) */
img { outline: 1px solid rgba(0, 0, 0, 0.1); outline-offset: -1px; }
@media (prefers-color-scheme: dark) { img { outline-color: rgba(255, 255, 255, 0.1); } }

:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
.num-tab { font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .dot { animation: none; }
}
a { color: var(--accent); text-decoration: none; transition: color 0.15s; }
a:hover { color: var(--accent); text-decoration: underline; }
.container { max-width: min(1760px, 100%); margin: 0 auto; padding: 0 24px; width: 100%; }

/* Header & Nav */
header {
  border-bottom: 1px solid var(--border);
  background: rgba(11, 15, 23, 0.85);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 100;
}
.nav-wrap {
  /* era height: 64px: con molteplici righe di voci della nav, il contenuto superava il
     riquadro e le voci finivano fuori dal bordo superiore, cioe' fuori dalla pagina.
     Ora: il wrapper dispone l'altezza minima e le voci possono andare a capo. */
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  height: auto;
  padding-block: 0;
}
.nav-wrap > nav { display: flex; align-items: center; flex-wrap: wrap; min-width: 0; min-height: 0; }

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 700;
  font-size: 17px;
  color: var(--fg);
  text-decoration: none;
}
.brand .logo-icon {
  width: 32px;
  height: 32px;
  background: var(--accent);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #04121d;
  font-weight: 900;
  font-size: 14px;
}
.nav-links {
  display: flex;
  align-items: center;
  gap: 8px;
  list-style: none;
}
.nav-links a {
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  color: var(--fg-muted);
  text-decoration: none;
  transition: color 0.15s, background-color 0.15s, border-color 0.15s;
}
.nav-links a:hover {
  color: var(--fg);
  background: var(--bg-card);
}
.nav-links a.active {
  color: var(--accent);
  background: var(--accent-glow);
  border: 1px solid rgba(212, 175, 55, 0.32);
}

/* Badges & Tags */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: var(--radius-pill);
  line-height: 1;
}
.badge-free { background: var(--success-bg); color: var(--success); border: 1px solid rgba(212, 175, 55, 0.32); }
.badge-paid { background: var(--warning-bg); color: var(--warning); border: 1px solid rgba(212, 175, 55, 0.32); }
.badge-purple { background: var(--purple-bg); color: var(--purple); border: 1px solid rgba(154, 161, 171, 0.3); }
.badge-danger { background: var(--danger-bg); color: var(--danger); border: 1px solid rgba(201, 128, 138, 0.3); }
.badge-dim { background: rgba(100, 116, 139, 0.15); color: var(--fg-muted); border: 1px solid var(--border); }

/* Buttons & Inputs */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: var(--fg);
  cursor: pointer;
  transition: background-color 0.2s var(--ease-out), border-color 0.2s, color 0.2s, transform 0.18s var(--ease-spring);
  text-decoration: none;
}
@supports (backdrop-filter: blur(1px)) {
  .btn { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
}
.btn:active {
  transform: scale(0.98);
}
.btn:hover {
  background: rgba(255, 255, 255, 0.10);
  border-color: rgba(255, 255, 255, 0.26);
  color: var(--fg);
  text-decoration: none;
}
.btn-primary {
  background: var(--accent);
  color: #04121d;
  border: none;
}
.btn-primary:hover {
  opacity: 0.9;
  color: #04121d;
}
input[type="text"], input[type="search"], select {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--fg);
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  transition: border-color 0.2s, background-color 0.2s, outline-color 0.2s;
}
@supports (backdrop-filter: blur(1px)) {
  input[type="text"], input[type="search"], select { backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
}
@media (prefers-reduced-transparency: reduce) {
  input[type="text"], input[type="search"], select { background: var(--bg-card); backdrop-filter: none; -webkit-backdrop-filter: none; }
}
input[type="text"]:focus, input[type="search"]:focus, select:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

/* Responsive: viewport stretta (< 768px) — layout monocontinuo, stat-grid compatta */
@media (max-width: 767px) {
  .card-grid { grid-template-columns: 1fr; }
  .stat-grid { grid-template-columns: repeat(3, 1fr); }
  .st-meta { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
  .stats-bar { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); }
  .container { padding: 0 16px; }
  .lookup-hero h1 { font-size: clamp(24px, 6vw, 30px); }
  .st-h { flex-direction: column; gap: 8px; }
  .nav-links { gap: 4px; }
  .nav-links a { padding: 6px 10px; font-size: 13px; }
  .btn { padding: 10px 16px; font-size: 13px; min-height: 40px; }
  .comparison-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .st-links { gap: 8px; }
  .st-links .tag-link { padding: 4px 8px; font-size: 12px; }
  .class-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
}

/* Liquid Glass material (iOS 26 pattern web: blur+saturate+reflection+interactive) */
.card, .stat-bezel {
  position: relative;
  overflow: hidden;
}
.card::before, .stat-bezel::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,.09) 0%, rgba(255,255,255,.02) 40%, rgba(255,255,255,.06) 100%);
  pointer-events: none;
  border-radius: inherit;
}
.card > *, .stat-bezel > * { position: relative; z-index: 1; }
@supports (backdrop-filter: blur(1px)) {
  .card { backdrop-filter: blur(16px) saturate(160%); -webkit-backdrop-filter: blur(16px) saturate(160%); background: rgba(20, 22, 26, 0.72); }
  .stat-bezel { backdrop-filter: blur(20px) saturate(170%); -webkit-backdrop-filter: blur(20px) saturate(170%); background: rgba(18, 20, 25, 0.68); }
  .stat-core { backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); background: rgba(255, 255, 255, 0.045); }
}
/* Interactive glass (chips/rows: react to pointer — highlight+glow) */
.search-chip.on, .fav-btn.on {
  box-shadow: 0 0 20px rgba(212, 175, 55, .25), inset 0 1px 0 rgba(255,255,255,.15);
}
.result-row:hover, .search-chip:hover, .btn:hover {
  box-shadow: inset 0 1px 0 rgba(255,255,255,.12);
}
@media (prefers-reduced-transparency: reduce) {
  .card, .stat-bezel { backdrop-filter: none; -webkit-backdrop-filter: none; background: var(--bg-card); }
  .card::before, .stat-bezel::before { display: none; }
}

/* Guard anti-rompimento: overflow-controllato su tabelle e card, ovunque */
.comparison-table, .class-table, .audit-table { max-width: 100%; }
.card, .stat-bezel, .lookup-box { overflow-wrap: break-word; word-break: break-word; min-width: 0; }
.st-links, .chip-row, .result-meta { min-width: 0; }
img, svg, video { max-width: 100%; }

  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

/* Footer */
footer {
  margin-top: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  padding: 32px 0;
  color: var(--fg-muted);
  font-size: 13px;
}
@supports (backdrop-filter: blur(1px)) {
  footer { backdrop-filter: blur(10px) saturate(140%); -webkit-backdrop-filter: blur(10px) saturate(140%); }
}
.footer-wrap {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

/* Utility Cards */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 24px;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.card:hover {
  border-color: rgba(212, 175, 55, 0.32);
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}
"""

# Sistema introduttivo: CSS condiviso + asset inlinati in render_nav (tutte le pagine).
SHARED_CSS = SHARED_CSS + "\n" + (SITE_DIR / "assets" / "onboarding.css").read_text(encoding="utf-8")
SHARED_CSS = SHARED_CSS + "\n" + (SITE_DIR / "assets" / "mobile-hardening.css").read_text(encoding="utf-8")
SHARED_CSS = SHARED_CSS + "\n" + (SITE_DIR / "assets" / "print.css").read_text(encoding="utf-8")
SHARED_CSS = SHARED_CSS + "\n" + (SITE_DIR / "assets" / "a11y-fixes.css").read_text(encoding="utf-8")
SHARED_CSS = SHARED_CSS + "\n" + (SITE_DIR / "assets" / "liquid-glass-2026.css").read_text(encoding="utf-8")
SHARED_CSS = SHARED_CSS + "\n" + (SITE_DIR / "assets" / "glass-tint.css").read_text(encoding="utf-8")
SHARED_CSS = _minifica_css(SHARED_CSS)

_ONBOARD_JS = (SITE_DIR / "assets" / "onboarding.js").read_text(encoding="utf-8")

# ---------- VETRO ARCANO: design system condiviso (CSS + runtime + rune) ----------
_VA_CSS_PATH = SITE_DIR / "assets" / "vetro-arcano.css"
if _VA_CSS_PATH.exists():
    SHARED_CSS = SHARED_CSS + "\n" + _VA_CSS_PATH.read_text(encoding="utf-8")
    SHARED_CSS = _minifica_css(SHARED_CSS)

# Elder Futhark: mappa lettera -> runa (Unicode 16A0-16FF). Le rune sono
# SCRITTE vere ("IL GRIMORIO", "FAERUN"), non decorazione astratta.
_VA_FUTHARK = {"A":"ᚨ","B":"ᛒ","C":"ᚲ","D":"ᛞ","E":"ᛖ","F":"ᚠ","G":"ᚷ","H":"ᚺ","I":"ᛁ","J":"ᛃ",
                "K":"ᚲ","L":"ᛚ","M":"ᛗ","N":"ᚾ","O":"ᛟ","P":"ᛈ","Q":"ᚲᚹ","R":"ᚱ","S":"ᛊ","T":"ᛏ",
                "U":"ᚢ","V":"ᚢ","W":"ᚹ","X":"ᚲᛊ","Y":"ᛇ","Z":"ᛉ"}
def _va_futhark(word: str) -> str:
    return "".join(_VA_FUTHARK.get(c, c) for c in word.upper() if c != " ")

_VA_RUNE_LEFT  = _va_futhark("IL GRIMORIO")            # ᛁᛚ ᚷᚱᛁᛗᛟᚱᛁᛟ
_VA_RUNE_RIGHT = _va_futhark("FAERUN")                  # ᚠᚨᛖᚱᚢᚾ
_VA_RUNE_BAND  = _va_futhark("IL GRIMORIO DEI REAMI")   # fascia sopra il footer

_VA_BOOT_JS = (
    "window.__VA_RUNE_LEFT__=" + json.dumps(_VA_RUNE_LEFT, ensure_ascii=False) + ";"
    "window.__VA_RUNE_RIGHT__=" + json.dumps(_VA_RUNE_RIGHT, ensure_ascii=False) + ";"
    "window.__VA_RUNE_BAND__=" + json.dumps(_VA_RUNE_BAND, ensure_ascii=False) + ";"
)
_VA_RUNTIME_JS = (SITE_DIR / "assets" / "vetro-arcano.js").read_text(encoding="utf-8")
_VA_JS = "<script>/* Vetro Arcano: rune Elder Futhark pre-calcolate server-side */" + _VA_BOOT_JS + "</script>\n<script defer>" + _VA_RUNTIME_JS + "</script>"

_ONBOARD_BUTTON = (
    '<button id="tour-fab" class="tour-fab" type="button" aria-label="Apri la guida introduttiva"'
    ' title="Guida introduttiva al sito">?</button>\n'
    '<div class="tour-overlay" id="tour-overlay" hidden role="dialog" aria-modal="true"'
    ' aria-labelledby="tour-title" aria-describedby="tour-body"></div>'
)


def render_nav(active_page: str) -> str:
    links = [
        ("index.html", "Home", "navHome"),
        ("risorse.html", "Catalogo", "navCatalog"),
        ("lfg.html", "Trova Gruppo", "navLfg"),
        ("cerca.html", "Consultazione Live", "navLookup"),
        ("widgets.html", "Widget (calendario e meteo)", "navWidgets"),
        ("tavolo.html", "Strumenti del Tavolo", "navTable"),
        ("personaggi.html", "Personaggi", "navChars"),
        # R1 (Pareto 2026-09-27): la sezione di ricerca calcolata deve essere raggiungibile dalla nav.
        # Nessuna chiave i18n: l'ancora non ha una traduzione nel dizionario e la sezione e' in italiano.
        ("personaggi.html#ricerca", "Ricerca", None),
        ("stats.html", "Compendio", "navStats"),
        ("mappa.html", "Mappa", None),
    ]
    items = []
    for url, label, key in links:
        base = url.split("#", 1)[0]
        cls = "active" if base == active_page and "#" not in url else ""
        i18n_attr = f' data-i18n="{key}"' if key else ""
        items.append(f'<li><a href="{url}" class="{cls}"{i18n_attr}>{label}</a></li>')
    # Menu della lingua: scegliendo una lingua, TUTTE le pagine si traducono da sole
    # al caricamento (la scelta è salvata). Sostituisce il pulsante per-pagina.
    lang_menu = (
        '<div id="tr-lang-wrap" class="tr-menu">'
        '<label class="tr-label" for="tr-lang" data-i18n="language">Lingua</label>'
        '<select id="tr-lang" aria-label="Lingua / Language"></select>'
        '<button type="button" id="tr-restore" class="tr-restore" title="Torna all\'italiano">IT</button>'
        '<span id="tr-progress" class="tr-progress" data-no-tr hidden></span>'
        "</div>"
    )
    i18n_auto_js = (SITE_DIR / "assets" / "i18n-auto.js").read_text(encoding="utf-8")
    lang_menu_js = (SITE_DIR / "assets" / "lang-menu.js").read_text(encoding="utf-8")
    strumenti_js = (SITE_DIR / "assets" / "strumenti-quick.js").read_text(encoding="utf-8")
    nav_menu_js = (SITE_DIR / "assets" / "nav-menu.js").read_text(encoding="utf-8")
    collapse_js = (SITE_DIR / "assets" / "collapse.js").read_text(encoding="utf-8")
    # Voce di navigazione per la guida: il posto in cui la si cerca, e resta
    # raggiungibile anche da mobile dove il FAB è nascosto per non rubare tap.
    guide_btn = ('<button type="button" class="nav-guide tour-open" '
                 'title="Guida introduttiva al sito">' + i18n_bi.label_html("guide") + "</button>")

    # Runtime bilingue per TUTTE le pagine: il pulsante IT|EN è nella nav,
    # ma cerca-app.js è caricato solo da cerca.html.
    i18n_shared = i18n_bi.shared_js()
    
    return f"""
<header>
  <div class="container nav-wrap">
    <!-- data-no-tr: il nome del sito è un nome proprio e NON va tradotto a macchina -->
    <a href="index.html" class="brand" data-no-tr>
      <div class="logo-icon">5e</div>
      <span>Il Grimorio dei Reami <span style="font-weight:400; color:var(--fg-muted); font-size:14px;">| Consultazione, dati e strumenti per D&D 5e</span></span>
    </a>
    <nav aria-label="Navigazione principale">
      <ul class="nav-links">
        {''.join(items)}
      </ul>
      {guide_btn}
      {lang_menu}
      <script>{i18n_auto_js}</script>
      <script>{lang_menu_js}</script>
      <script>{nav_menu_js}</script>
      <script>{collapse_js}</script>
    </nav>
    <script>{i18n_shared}</script>
  </div>
</header>
{_ONBOARD_BUTTON}
<script>{_ONBOARD_JS}</script>
{_VA_JS}
"""

def render_seo_head(page: str, title: str, desc: str, priority: float = 0.8) -> str:
    """Head SEO completo: canonical self-referencing + og: completo + JSON-LD
    (WebPage + BreadcrumbList) + doppio title eliminato. Tunnel corrente da current-url.json."""
    import json as _json
    from pathlib import Path as _Path
    cur = None
    _p = _Path(r"C:\Users\Fabrizio\workspace\public-site\current-url.json")
    if _p.exists():
        try:
            cur = _json.loads(_p.read_text(encoding="utf-8")).get("url")
        except Exception:
            cur = None
    base = cur or "http://127.0.0.1:8777"
    canonical = f"{base}/{page}"
    favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230b0f17'/%3E%3Ctext x='16' y='22' font-size='15' text-anchor='middle' fill='%2338bdf8' font-family='sans-serif' font-weight='900'%3E5e%3C/text%3E%3C/svg%3E"
    # BreadcrumbList: Home > pagina corrente
    crumbs = [{"@type": "ListItem", "position": 1, "name": "Home", "item": base + "/"}]
    if page != "index.html":
        # Etichette breadcrumb leggibili (prima "Lfg", "Widgets" dall'auto-capitalize)
        _CRUMB = {"lfg.html": "LFG & Matchmaking", "cerca.html": "SRD Lookup",
                  "widgets.html": "Strumenti del Tavolo", "tavolo.html": "Tavolo", "personaggi.html": "Personaggi", "risorse.html": "Directory Risorse",
                  "stats.html": "Dashboard Analytics"}
        label = _CRUMB.get(page, page.replace(".html", "").capitalize())
        crumbs.append({"@type": "ListItem", "position": 2, "name": label, "item": canonical})
    ld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "@id": base + "/#website",
                "name": "Il Grimorio dei Reami — Consultazione, dati e strumenti per D&D 5e",
                "url": base + "/",
                "inLanguage": "it",
                "potentialAction": {
                    "@type": "SearchAction",
                    "target": {"@type": "EntryPoint", "urlTemplate": base + "/cerca.html?q={search_term_string}"},
                    "query-input": "required name=search_term_string"
                }
            },
            {"@type": "WebPage", "name": title, "description": desc, "url": canonical, "inLanguage": "it",
             "isPartOf": {"@id": base + "/#website"}},
            {"@type": "BreadcrumbList", "itemListElement": crumbs}
        ]
    }
    return (
        f'<meta name="description" content="{desc}"/>\n'
        f'<link rel="canonical" href="{canonical}"/>\n'
        f'<meta property="og:title" content="{title}"/>\n'
        f'<meta property="og:description" content="{desc}"/>\n'
        f'<meta property="og:type" content="website"/>\n'
        f'<meta property="og:url" content="{canonical}"/>\n'
        f'<meta property="og:locale" content="it_IT"/>\n'
        f'<meta name="twitter:card" content="summary"/>\n'
        f'<meta name="twitter:title" content="{title}"/>\n'
        f'<meta name="twitter:description" content="{desc}"/>\n'
        f'<meta name="theme-color" content="#0b0f17"/>\n'
        f'<link rel="icon" href="{favicon}"/>\n'
        f'<script type="application/ld+json">{_json.dumps(ld, ensure_ascii=False)}</script>\n'
    )


def render_footer() -> str:
    return f"""
<footer>
  <div class="container footer-wrap">
    <div>
      <strong>Il Grimorio dei Reami</strong> &mdash; ideazione, architettura dei dati e degli strumenti. Un progetto di <strong>Fabrizio Marzano</strong>.
      <div style="font-size:12px; color:var(--fg-dim); margin-top:4px;">
        Servito in locale via <code>127.0.0.1:8777</code> &mdash; Esposto via Cloudflare Quick Tunnel (Zero-cost, Zero-interstitial).
      </div>
    </div>
    <div style="text-align:right;">
      <span class="badge badge-dim">Versione: {build_time}</span>
      <div style="font-size:12px; color:var(--fg-dim); margin-top:6px;">
        <button type="button" class="btn tour-open" style="padding:0 12px; font-size:12.5px;">Guida introduttiva</button>
      </div>
      <div style="font-size:12px; color:var(--fg-dim); margin-top:4px;">228 siti analizzati &middot; 134 verificati attivi (FAMS-v4)</div>
      <div style="font-size:11.5px; color:var(--fg-dim); margin-top:8px; max-width:52ch; text-align:right; margin-left:auto;">
        Il Grimorio dei Reami is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. &copy;Wizards of the Coast LLC.
      </div>
      <div id="supporto-wrap" style="margin-top:10px; text-align:right;">
        <button type="button" class="btn" id="kofi-btn" hidden
          aria-label="Sostieni il progetto (Ko-fi)"
          onclick="window.open((window.KOFI_URL || '')[0] || '', '_blank', 'noopener')">Sostieni il progetto &hearts;</button>
        <div style="font-size:11px; color:var(--fg-dim); margin-top:4px;">
          Donazioni: ammesse dalla Fan Content Policy &middot; si attiva con KOFI_URL in .env
        </div>
      </div>
    </div>
  </div>
</footer>
<script src="assets/gallery-lazy.js" defer></script>
<script src="assets/glass-tint.js" defer></script>
<script src="assets/reveal.js" defer></script>
"""

# ------------------------------------------------------------------------------
# 3. Generazione INDEX.HTML
# ------------------------------------------------------------------------------
def build_index() -> str:
    total_sites = len(records)
    ok_sites = sum(1 for r in records if r.get("status") == "ok")
    dead_sites = sum(1 for r in records if r.get("status") == "dead")
    # Sostituti verificati realmente presenti in DEAD_REPLACEMENTS (prima il testo
    # dichiarava che tutti i 18 domini morti avevano un'alternativa: sono 2).
    dead_with_repl = sum(
        1 for r in records
        if r.get("status") == "dead" and (DEAD_REPLACEMENTS.get(r.get("url", ""), (None, None))[0])
    )
    js_shell_sites = sum(1 for r in records if r.get("status") == "js_shell")
    failed_sites = sum(1 for r in records if r.get("status") == "failed")
    lfg_count = sum(1 for r in records if r.get("cat") in ("lfg", "lfg_it") and r.get("status") == "ok")
    srd_count = sum(1 for r in records if r.get("cat") == "srd" and r.get("status") == "ok")
    vtt_count = sum(1 for r in records if r.get("cat") == "vtt" and r.get("status") == "ok")
    wb_count = sum(1 for r in records if r.get("cat") == "wb" and r.get("status") == "ok")

    # Galleria immagini (data/gallery/*.webp, 5etools-img) — R3
    gallery_dir = SITE_DIR / "data" / "gallery"
    GALLERY_LABELS = {
        "phb": "Player's Handbook", "dmg": "Dungeon Master's Guide", "mm": "Monster Manual",
        "xge": "Xanathar's Guide", "tce": "Tasha's Cauldron", "mtf": "Mordenkainen's Tome",
        "vgm": "Volo's Guide", "scag": "Sword Coast Adv.", "dragon": "Red Dragon",
        "beholder": "Beholder", "lich": "Lich", "goblin": "Goblin",
    }
    # Copertine di TUTTI i manuali del dataset, ordinate per data di uscita.
    # Il manifest è prodotto da tools/build_covers.py (mirror immagini 5e.tools) e
    # porta codice, nome e data di pubblicazione di ogni manuale: nessuna selezione
    # manuale, nessun ordinamento scelto a mano.
    gallery_items = []
    covers_manifest = SITE_DIR / "data" / "covers" / "manifest.json"
    if covers_manifest.exists():
        try:
            _man = json.loads(covers_manifest.read_text(encoding="utf-8"))
        except Exception:
            _man = {"books": []}
        for b in _man.get("books", []):
            if not b.get("file"):
                continue
            d = (b.get("published") or "")
            anno = d[:4] if len(d) >= 4 else "n/d"
            nome = b.get("name") or b.get("code")
            # AFFILIAZIONE (WotC FCP ammette le sponsorizzazioni): il link si attiva
            # SOLO con un tag affiliato configurato in .env (AFFILIATE_TAG); senza, la
            # copertina resta un'immagine non cliccabile e nulla cambia.
            import os as _os
            _aff = (_os.environ.get("AFFILIATE_TAG") or "").strip()
            _href = (f'https://www.amazon.it/s?k={nome}+D%26D&tag={_aff}' if _aff else "")
            _apri = (f'<a href="{_href}" target="_blank" rel="nofollow sponsored noopener" '
                     f'aria-label="Acquista {nome} (link affiliato)">' if _href else "")
            _chiudi = ('</a>' if _href else "")
            gallery_items.append(
                f'<figure class="gal-item" style="margin:0; background:var(--bg-card); border:1px solid var(--border); '
                f'border-radius:12px; padding:8px; text-align:center;">'
                f'{_apri}<img src="{b["file"]}" alt="Copertina di {nome}" loading="lazy" decoding="async" width="300" height="400" '
                f'style="width:100%; height:auto; border-radius:8px; aspect-ratio:3/4; object-fit:cover;">'
                f'<figcaption style="font-size:11px; color:var(--fg-muted); margin-top:6px;">'
                f'<strong style="color:var(--fg);">{b.get("code")}</strong> &middot; {anno}<br>{nome}'
                f'</figcaption>{_chiudi}</figure>'
            )
    if not gallery_items:
        # Se il manifest delle copertine manca si DICE cosa fare, invece di mostrare
        # un altro set di immagini: le vecchie copertine generiche (11 file, 2,9 MB)
        # sono state rimosse perché non più referenziate.
        gallery_items.append(
            '<p class="tv-meta">Copertine non disponibili: rigenerare il manifest con '
            '<code>py tools/build_covers.py</code>.</p>'
        )
    GALLERY_ITEMS = "".join(gallery_items)

    # ---------------------------------------------------------------------
    # Fonti dei dati: conteggi e date calcolati dall'indice, non scritti a mano.
    # ---------------------------------------------------------------------
    import json as _json
    _idx_p = SITE_DIR / "data" / "lookup-index.json"
    _entries: list[dict] = []
    if _idx_p.exists():
        try:
            _entries = _json.loads(_idx_p.read_text(encoding="utf-8")).get("entries", [])
        except Exception:
            _entries = []
    _src_count: dict[str, int] = {}
    for _e in _entries:
        _s = _e.get("s") or "sconosciuta"
        _src_count[_s] = _src_count.get(_s, 0) + 1
    _src_rows = sorted(_src_count.items(), key=lambda kv: -kv[1])
    _tot_ent = sum(_src_count.values())
    _tot_src = len(_src_count)

    # date di pubblicazione: stessa fonte usata dall'indice (libri + avventure)
    import i18n_bi as _bi  # noqa: F401  (garantisce il pacchetto i18n caricato)
    _dates: dict[str, str] = {}
    for _fname, _key in (("books.json", "book"), ("adventures.json", "adventure")):
        _p = SITE_DIR / "data" / "5etools" / _fname
        if not _p.exists():
            continue
        try:
            _d = _json.loads(_p.read_text(encoding="utf-8"))
        except Exception:
            continue
        for _it in _d.get(_key, []):
            if _it.get("source") and _it.get("published"):
                _dates.setdefault(_it["source"], _it["published"])
    _with_date = sum(n for s, n in _src_count.items() if s in _dates)
    _date_pct = round(100 * _with_date / _tot_ent) if _tot_ent else 0

    def _src_row_html(code: str, n: int) -> str:
        d = _dates.get(code)
        dtxt = d.split("-")[::-1] if d else []
        when = f"{dtxt[0]}/{dtxt[1]}/{dtxt[2]}" if len(dtxt) == 3 else "data non disponibile"
        # evidenzia le fonti dell'era 2024 (revisione più recente del regolamento)
        era = "2024" if d and d >= "2024-01-01" else ("classica" if d else "")
        badge = f'<span class="src-era">{era}</span>' if era else ""
        return (f'<tr><td class="src-code">{code}</td><td class="src-n">{n}</td>'
                f'<td class="src-date">{when}</td><td>{badge}</td></tr>')

    _top = _src_rows[:12]
    _rest = _src_rows[12:]
    SOURCES_TABLE = (
        '<div class="src-summary">'
        f'<div class="src-stat"><span class="src-stat-n">{_tot_src}</span> <span>fonti nel dataset</span></div>'
        f'<div class="src-stat"><span class="src-stat-n">{_tot_ent:,}</span> <span>entità indicizzate</span></div>'
        f'<div class="src-stat"><span class="src-stat-n">{_date_pct}%</span> <span>con data di pubblicazione verificata</span></div>'
        "</div>"
        '<div class="src-table-wrap"><table class="src-table"><thead><tr>'
        "<th>Fonte</th><th>Entità</th><th>Pubblicazione</th><th>Era</th>"
        "</tr></thead><tbody>"
        + "".join(_src_row_html(c, n) for c, n in _top)
        + (
            '<tr class="src-more"><td colspan="4">'
            f'<details><summary>Mostra tutte le {_tot_src} fonti</summary><table class="src-table">'
            "<tbody>" + "".join(_src_row_html(c, n) for c, n in _rest) + "</tbody></table></details>"
            "</td></tr>"
            if _rest else ""
        )
        + "</tbody></table></div>"
    ).replace(",", ".")  # separatore delle migliaia all'italiana

    SOURCES_LAYERS = """
    <div class="src-layers">
      <div class="src-layer">
        <h3>Entità di gioco &mdash; 5e.tools</h3>
        <p>Mostri, incantesimi, oggetti, classi, razze, talenti, divinità, condizioni, lingue e veicoli:
        ogni voce porta il codice della fonte e il file di origine. Le ristampe sono raggruppate e
        ordinate per data di pubblicazione reale (vedi la tabella).</p>
        <p class="src-lic">Contenuti di regolamento dei manuali Wizards of the Coast; il mirror
        <em>5e.tools</em> è una raccolta della community. Licenza SRD 5.1: CC BY 4.0.</p>
      </div>
      <div class="src-layer">
        <h3>Descrizioni &mdash; Forgotten Realms Wiki</h3>
        <p>Le voci di ambientazione dei Reami si caricano su richiesta dalla wiki e restano nel
        browser: non vengono riversate nel dataset. L'attribuzione e il link all'articolo sono
        sempre presenti accanto al testo.</p>
        <p class="src-lic">Testi della Forgotten Realms Wiki, licenza CC BY-SA 3.0 &mdash;
        attribuzione obbligatoria, resa in pagina.</p>
      </div>
      <div class="src-layer">
        <h3>Fallback live &mdash; SRD 5.1 via dnd5eapi.co</h3>
        <p>Se un incantesimo o un mostro non è nel dataset locale, la scheda viene composta
        interrogando l'API pubblica dell'SRD 5.1: è il percorso di riserva, dichiarato in scheda
        come «fallback SRD live».</p>
        <p class="src-lic">Dati SRD 5.1 (CC BY 4.0) serviti da <em>dnd5eapi.co</em>.</p>
      </div>
      <div class="src-layer">
        <h3>Meteo in gioco &mdash; Open-Meteo</h3>
        <p>Il meteo delle città dei Reami deriva da una città reale scelta per affinità climatica:
        le norme climatiche (media annua e precipitazioni) sono calcolate dall'API archivio di
        Open-Meteo sull'anno 2024, il meteo corrente dall'API di previsione.</p>
        <p class="src-lic">Open-Meteo, licenza CC BY 4.0.</p>
      </div>
      <div class="src-layer">
        <h3>Immagini &mdash; mirror 5etools-img</h3>
        <p>Copertine dei manuali e artwork dei mostri iconici sono serviti localmente dal mirror
        <em>5etools-img</em>; la galleria qui sotto li raccoglie.</p>
        <p class="src-lic">Artwork &copy; Wizards of the Coast e rispettivi autori; uso
        dimostrativo, non commerciale.</p>
      </div>
    </div>"""

    return f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
{render_seo_head("index.html", "Il Grimorio dei Reami — Consultazione, dati e strumenti per D&D 5e", "Directory verificata di 228 risorse D&D (LFG, dati 5e, VTT, tool), live spell/monster lookup SRD e dashboard FAMS-v4.", 1.0)}

<title>Il Grimorio dei Reami &mdash; Consultazione, dati e strumenti per D&D 5e</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=optional" rel="stylesheet">
<style>
{SHARED_CSS}
.hero {{
  padding: 64px 0 48px;
  text-align: left;
}}
.hero h1 {{
  font-size: clamp(32px, 5vw, 48px);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.02em;
  margin-bottom: 16px;
}}
.hero h1 span {{
  color: var(--accent);
}}
.hero p {{
  font-size: 18px;
  color: var(--fg-muted);
  max-width: 720px;
  margin-bottom: 32px;
}}
.stats-bar {{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 48px;
}}
.stat-box {{
  position: relative;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 20px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transition: border-color 0.2s, box-shadow 0.25s;
}}
@supports (backdrop-filter: blur(1px)) {{
  .stat-box {{ backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%); }}
}}
.stat-box:hover {{ border-color: rgba(52, 211, 153, 0.30); }}
@media (prefers-reduced-transparency: reduce) {{
  .stat-box {{ background: var(--bg-card); backdrop-filter: none; -webkit-backdrop-filter: none; }}
}}
.stat-box .num {{
  font-size: 28px;
  font-weight: 800;
  color: var(--accent);
  margin-bottom: 4px;
  font-variant-numeric: tabular-nums;
}}
.stat-box .lbl {{
  font-size: 13px;
  color: var(--fg-muted);
  font-weight: 500;
}}
.section-title {{
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}}
.module-grid {{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 48px;
}}
.module-card {{
  position: relative;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: transform 0.25s var(--ease-out), border-color 0.2s, box-shadow 0.25s;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}}
@supports (backdrop-filter: blur(1px)) {{
  .module-card {{ backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%); }}
}}
.module-card:hover {{
  transform: translateY(-3px);
  border-color: rgba(212, 175, 55, 0.40);
  box-shadow: 0 16px 36px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.12);
}}
@media (prefers-reduced-transparency: reduce) {{
  .module-card {{ background: var(--bg-card); backdrop-filter: none; -webkit-backdrop-filter: none; }}
}}
.module-card:active {{
  transform: translateY(-1px);
}}
.module-card:hover {{
  transform: translateY(-3px);
  border-color: rgba(52, 211, 153, 0.4);
  box-shadow: 0 12px 24px -10px rgba(0,0,0,0.5);
}}
.module-card h3 {{
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--fg);
}}
.module-card p {{
  font-size: 14px;
  color: var(--fg-muted);
  margin-bottom: 20px;
}}
.live-pill {{
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: rgba(212, 175, 55, 0.10);
  border: 1px solid rgba(212, 175, 55, 0.32);
  border-radius: var(--radius-pill);
  font-size: 12px;
  color: var(--success);
  margin-bottom: 20px;
}}
.live-pill .dot {{
  width: 6px;
  height: 6px;
  background: var(--success);
  border-radius: 50%;
  box-shadow: 0 0 6px var(--success);
  animation: dot-ping 0.6s cubic-bezier(0, 0, 0.2, 1) infinite;
}}
@keyframes dot-ping {{
  0% {{ box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.5); }}
  70% {{ box-shadow: 0 0 0 6px rgba(52, 211, 153, 0); }}
  100% {{ box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }}
}}
</style>
</head>
<body>
<svg class="lg-svg-hidden" width="0" height="0" aria-hidden="true" focusable="false">
  <filter id="lg-refract" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.008 0.014" numOctaves="2" seed="7" result="noise"/>
    <feGaussianBlur in="noise" stdDeviation="1.6" result="soft"/>
    <feDisplacementMap in="SourceGraphic" in2="soft" scale="9" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>
{render_nav("index.html")}

<main class="container">
  <div class="hero">
    <div class="live-pill" role="status" aria-live="polite"><span class="dot" aria-hidden="true"></span> Server Locale Operativo &bull; Tunnel Crittografato Attivo</div>
    <h1>Il Grimorio dei Reami<br><span>Consultazione, dati e strumenti per D&D 5e</span></h1>
    <p class="lead">
      Control plane operativo su workstation locale: 228 risorse D&D verificate, lookup SRD live e dashboard analytics, serviti via tunnel crittografato.
    </p>
    <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
      <button type="button" class="btn btn-primary tour-open" style="border-color:var(--accent);">
        <span data-i18n="guideCta">Come funziona questo sito</span>
      </button>
      <span style="font-size:12.5px; color:var(--fg-dim);" data-i18n="guideHint">Percorso guidato in pochi passi: dati, lookup, strumenti e ricerca gruppi.</span>
    </div>
    <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:12px;">
      <a href="risorse.html" class="btn">Esplora 228 Risorse D&D &rarr;</a>
      <a href="cerca.html" class="btn">Lookup Magie & Mostri</a>
      <a href="lfg.html" class="btn">Guida Sessioni (LFG)</a>
    </div>
  </div>

  <!-- ACT-03: Global search in Home — ricerca diretta nel lookup 5e.tools -->
  <div class="card" style="margin-top:28px; padding:24px 28px;">
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
      <span class="dot" style="width:8px; height:8px; border-radius:50%; background:var(--accent); box-shadow:0 0 12px var(--accent);"></span>
      <strong style="font-size:15px; font-weight:700;">Ricerca Global nel Database (13219 entità)</strong>
    </div>
    <form action="cerca.html" method="get" style="display:flex; gap:10px; flex-wrap:wrap;">
      <input type="search" name="q" placeholder="Cerca un mostro, incantesimo, classe, oggetto magico... (es. Ancient Red Dragon, Fireball, Wizard)"
             autocomplete="off"
             style="flex:1; min-width:260px; background:rgba(255,255,255,.05); border:1px solid var(--border); border-radius:var(--radius-sm);
                    color:var(--fg); font-size:15px; padding:13px 16px; "
             aria-label="Ricerca globale nel database D&D"/>
      <button type="submit" class="btn btn-primary">Cerca &rarr;</button>
    </form>
    <p style="color:var(--fg-dim); font-size:12.5px; margin-top:10px;">
      Ricerca fuzzy (tolleranza typo) + filtri per categoria + fallback API SRD live.
    </p>
  </div>

  <!-- R3+R7: Come funziona il sito (schema SVG + spiegazione + galleria) -->
  <div class="card" style="margin-top:28px; padding:28px;">
    <h2 style="margin-bottom:12px; font-size:20px; font-weight:800;">Come Funziona Questo Sito</h2>
    <p style="color:var(--fg-muted); font-size:14.5px; line-height:1.7; max-width:80ch; margin-bottom:20px;">
      Questo hub è un <strong style="color:var(--fg);">research engine D&D</strong> che gira interamente sulla workstation
      locale: un database di <strong style="color:var(--accent);">13219 entità</strong> ufficiali e open (mostri, incantesimi,
      classi, oggetti, razze, background, divinità, regole) indicizzato da 228 fonti verificate, servito senza dipendenze
      esterne e con fallback API live. La ricerca è <strong style="color:var(--fg);">istantanea e fuzzy</strong> (tolleranza
      ai typo), con filtri per categoria, statblock completi e hyperlink incrociati tra le schede.
    </p>

    <!-- Schema architetturale SVG (flusso: utente -> ricerca -> indice -> dataset -> rendering) -->
    <div style="background:rgba(255,255,255,.03); border:1px solid var(--border); border-radius:14px; padding:20px; margin-bottom:24px;">
      <h3 style="color:var(--accent); font-size:13px; text-transform:uppercase; letter-spacing:.08em; margin-bottom:14px;">Architettura del Sistema</h3>
      <svg viewBox="0 0 900 200" style="width:100%; height:auto; display:block;" role="img" aria-label="Schema del flusso: browser, ricerca fuzzy, indice 13219 entità, dataset 5e.tools, rendering statblock">
        <defs>
          <linearGradient id="gFlow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#38bdf8" stop-opacity=".25"/>
            <stop offset="1" stop-color="#d4af37" stop-opacity=".25"/>
          </linearGradient>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8"/></marker>
        </defs>
        <g font-family="Outfit, sans-serif" font-size="13" fill="#e8eaed">
          <!-- nodi -->
          <rect x="10" y="60" width="150" height="72" rx="12" fill="#14161a" stroke="#38bdf8" stroke-width="1.5"/>
          <text x="85" y="90" text-anchor="middle" font-weight="700">Browser</text>
          <text x="85" y="108" text-anchor="middle" font-size="11" fill="#9aa1ab">ricerca fuzzy</text>

          <rect x="200" y="60" width="150" height="72" rx="12" fill="#14161a" stroke="#38bdf8" stroke-width="1.5"/>
          <text x="275" y="90" text-anchor="middle" font-weight="700">Lookup Engine</text>
          <text x="275" y="108" text-anchor="middle" font-size="11" fill="#9aa1ab">filtri + scoring</text>

          <rect x="390" y="60" width="170" height="72" rx="12" fill="#14161a" stroke="#d4af37" stroke-width="1.5"/>
          <text x="475" y="90" text-anchor="middle" font-weight="700">Indice 13219</text>
          <text x="475" y="108" text-anchor="middle" font-size="11" fill="#9aa1ab">lookup-index.json</text>

          <rect x="600" y="60" width="140" height="72" rx="12" fill="#14161a" stroke="#d4af37" stroke-width="1.5"/>
          <text x="670" y="90" text-anchor="middle" font-weight="700">Dataset 5e.tools</text>
          <text x="670" y="108" text-anchor="middle" font-size="11" fill="#9aa1ab">JSON on-demand</text>

          <rect x="780" y="60" width="110" height="72" rx="12" fill="#14161a" stroke="#a8b2bd" stroke-width="1.5"/>
          <text x="835" y="90" text-anchor="middle" font-weight="700">Statblock</text>
          <text x="835" y="108" text-anchor="middle" font-size="11" fill="#9aa1ab">rendering</text>

          <!-- frecce -->
          <path d="M160 96 L200 96" stroke="url(#gFlow)" stroke-width="2.5" marker-end="url(#arrow)"/>
          <path d="M350 96 L390 96" stroke="url(#gFlow)" stroke-width="2.5" marker-end="url(#arrow)"/>
          <path d="M560 96 L600 96" stroke="url(#gFlow)" stroke-width="2.5" marker-end="url(#arrow)"/>
          <path d="M740 96 L780 96" stroke="url(#gFlow)" stroke-width="2.5" marker-end="url(#arrow)"/>
          <!-- fallback -->
          <path d="M275 132 C 275 170, 835 170, 835 132" stroke="#c9808a" stroke-width="1.5" stroke-dasharray="5 4" fill="none"/>
          <text x="555" y="185" text-anchor="middle" font-size="11" fill="#c9808a">fallback API SRD live (dnd5eapi.co)</text>
        </g>
      </svg>
    </div>

    <!-- Fonti dei dati: prospetto per fonte, calcolato dall'indice -->
    <h2 class="section-title">Fonti dei dati</h2>
    <p style="color:var(--fg-muted); font-size:13.5px; max-width:78ch; margin-bottom:18px;">
      Ogni entità del lookup dichiara la propria fonte: qui sotto il prospetto completo con i
      conteggi e le date di pubblicazione, e la provenienza dei testi, del meteo e delle immagini.
    </p>
    {SOURCES_LAYERS}
    {SOURCES_TABLE}

    <!-- Galleria immagini (copertine libri + mostri iconici, 5etools-img) -->
    <h3 style="color:var(--accent); font-size:13px; text-transform:uppercase; letter-spacing:.08em; margin:26px 0 12px;">Copertine e artwork (mirror 5etools-img)</h3>
    <div id="gal-grid" data-collapse="560" data-collapse-label="Mostra tutte le copertine"
         data-collapse-label-open="Comprimi le copertine"
         style="display:grid; grid-template-columns:repeat(auto-fill, minmax(118px, 1fr)); gap:14px;">
      {GALLERY_ITEMS}
    </div>
    <p style="color:var(--fg-dim); font-size:12px; margin-top:14px;">
      Copertine e artwork: mirror 5etools-img (contenuti open, WotC/autori) — serviti localmente dalla workstation.
    </p>
  </div>

  <div class="stats-bar">
    <div class="stat-box">
      <div class="num">{total_sites}</div>
      <div class="lbl">Siti Scansionati</div>
    </div>
    <div class="stat-box">
      <div class="num" style="color:var(--success);">{ok_sites}</div>
      <div class="lbl">Verificate Attive ({ok_sites*100//total_sites}%)</div>
    </div>
    <div class="stat-box">
      <div class="num" style="color:var(--purple);">{srd_count}</div>
      <div class="lbl">Siti Dati / SRD 5e</div>
    </div>
    <div class="stat-box">
      <div class="num" style="color:var(--warning);">{lfg_count}</div>
      <div class="lbl">Piattaforme LFG Attive</div>
    </div>
    <div class="stat-box">
      <div class="num" style="color:var(--purple);">{vtt_count}</div>
      <div class="lbl">VTT / Tool di Gioco</div>
    </div>
    <div class="stat-box">
      <div class="num" style="color:var(--fg-muted);">{wb_count}</div>
      <div class="lbl">Worldbuilding / Homebrew</div>
    </div>
  </div>
  <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:48px; font-size:12.5px; color:var(--fg-dim);">
    <span><strong style="color:var(--fg);">{dead_sites}</strong> domini deprecati ({dead_with_repl} con alternativa verificata)</span> &bull;
    <span><strong style="color:var(--fg);">{js_shell_sites}</strong> SPA vive non ispezionabili staticamente</span> &bull;
    <span><strong style="color:var(--fg);">{failed_sites}</strong> bloccati da rate-limit/proxy (fallback browser)</span>
  </div>

  <h2 class="section-title">Moduli Operativi & Capacità del Sistema</h2>
  <div class="module-grid">
    <div class="module-card">
      <div>
        <span class="badge badge-purple" style="margin-bottom:12px;">Database 228 Fonti</span>
        <h3>Directory Risorse D&D</h3>
        <p>Database interattivo con ricerca full-text istantanea, filtri di categoria, discriminazione regole 2014 vs 2024 e mapping dei domini deprecati, con redirect verificati dove disponibili.</p>
      </div>
      <a href="risorse.html" class="btn">Apri Directory &rarr;</a>
    </div>

    <div class="module-card">
      <div>
        <span class="badge badge-free" style="margin-bottom:12px;">Matchmaking & Scena IT</span>
        <h3>Guida Iscrizione Sessioni (LFG)</h3>
        <p>Matrice comparativa tra le piattaforme LFG (StartPlaying, Warhorn, Meetup, AL) con analisi di pricing per sessione e focus speciale sulla Scena GDR Italiana.</p>
      </div>
      <a href="lfg.html" class="btn">Vedi Comparativa LFG &rarr;</a>
    </div>

    <div class="module-card">
      <div>
        <span class="badge badge-paid" style="margin-bottom:12px;">API Live SRD 5.1</span>
        <h3>Live Spell & Monster Lookup</h3>
        <p>Interrogazione in tempo reale di 319 incantesimi e 334 creature SRD tramite API dnd5eapi.co con statblock completi e dataset di fallback locale offline.</p>
      </div>
      <a href="cerca.html" class="btn">Avvia Lookup &rarr;</a>
    </div>

    <div class="module-card">
      <div>
        <span class="badge badge-dim" style="margin-bottom:12px;">FAMS-v4 Metrics</span>
        <h3>Dashboard Analitica & FAMS-v4</h3>
        <p>Visualizzazione grafica vettoriale (SVG nativo) su tassi di disponibilità, ripartizione dei modelli di prezzo, analisi di Pareto e indice di confidenza epistemica (ECI 90%).</p>
      </div>
      <a href="stats.html" class="btn">Vedi Statistiche &rarr;</a>
    </div>
  </div>

  <div class="card" style="margin-bottom: 48px;">
    <h3 style="margin-bottom: 8px;">Architettura del Sistema & Invarianti Operativi</h3>
    <p style="color:var(--fg-muted); font-size:14px; margin-bottom:16px;">
      Questo deployment implementa l'architettura zero-cost verificata tramite FAMS-v4:
    </p>
    <ul style="color:var(--fg-muted); font-size:14px; padding-left:20px; line-height:1.8;">
      <li><strong>Origine locale</strong>: Server multi-thread <code>ThreadingHTTPServer</code> su Python 3.11/3.14 (nessuna dipendenza esterna o container pesante).</li>
      <li><strong>Tunneling Cloudflare Quick</strong>: Esposizione pubblica su <code>*.trycloudflare.com</code> senza schermate di screening "Caution" e senza registrazione o credenziali cablate.</li>
      <li><strong>Cron Watchdog Autonomo</strong>: Script di auto-riparazione su loop 15m che monitora l'health del listener e del tunnel, persistendo l'URL attivo su <code>current-url.json</code>.</li>
      <li><strong>Protezione XSS & Injection</strong>: Sanitizzazione completa dei dati estratti da 228 siti e rendering deterministico.</li>
    </ul>
  </div>
</main>

{render_footer()}
</body>
</html>
"""

# ------------------------------------------------------------------------------
# 4. Generazione RISORSE.HTML (Enhanced 228 Directory + Full-Text Search)
# ------------------------------------------------------------------------------
def build_risorse() -> str:
    cleaned_records = []
    for r in records:
        url = r.get("url", "")
        status = r.get("status", "unknown")
        
        # Gestione redirect replacement
        replacement_url, replacement_note = DEAD_REPLACEMENTS.get(url, (None, None))
        
        # Determinazione edizione
        freshness = r.get("data_freshness") or ""
        edition_tag = "standard"
        if "2024" in freshness and "2014" in freshness:
            edition_tag = "dual"
        elif "2024" in freshness:
            edition_tag = "2024"
        elif "2014" in freshness:
            edition_tag = "2014"

        # Se esiste una sostituzione verificata (DEAD_REPLACEMENTS), il link
        # punta alla pagina viva; l'URL originale resta tracciato per trasparenza.
        effective_url = replacement_url or url
        cleaned_records.append({
            "id": r.get("id"),
            "n": r.get("name"),
            "c": r.get("cat"),
            "u": effective_url,
            "st": status,
            "p": r.get("pricing") or "",
            "v": r.get("verdict") or "",
            "w": (r.get("works") or [])[:8],
            "iss": (r.get("issues") or [])[:3],
            "iss_all": (r.get("issues") or []),
            "ed": edition_tag,
            "rep_u": replacement_url,
            "rep_n": replacement_note,
            "orig_u": url if replacement_url else None,
            "snip": (r.get("content_snippet") or "")[:600],
            "err": (r.get("fetch_error") or "")[:180],
        })

    json_data = json.dumps(cleaned_records, ensure_ascii=False).replace("</", "<\\/")
    
    # Generazione noscript statico per tutti i 134 OK
    noscript_items = []
    for r in cleaned_records:
        if r["st"] == "ok":
            noscript_items.append(f'<li><strong><a href="{html.escape(r["u"])}" target="_blank" rel="noopener">{html.escape(r["n"])}</a></strong> &mdash; <em>{html.escape(r["p"] or "N/D")}</em> &mdash; {html.escape(r["v"])}</li>')

    return f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
{render_seo_head("risorse.html", "Catalogo delle Risorse D&D — Il Grimorio dei Reami", "Directory interattiva di 228 risorse D&D verificate empiricamente: LFG, dati 5e, VTT, tool, con ricerca full-text e filtri di categoria.", 0.9)}

<title>Catalogo delle Risorse D&D &mdash; Il Grimorio dei Reami</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=optional" rel="stylesheet">
<style>
{SHARED_CSS}
.search-hero {{
  padding: 36px 0 24px;
}}
.controls-bar {{
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}}
.search-row {{
  display: flex;
  gap: 12px;
}}
.search-row input {{
  flex: 1;
  font-size: 15px;
}}
.filters-row {{
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}}
.filter-chip {{
  background: rgba(100, 116, 139, 0.1);
  border: 1px solid var(--border);
  color: var(--fg-muted);
  font-size: 13px;
  padding: 8px 12px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s, border-color 0.15s;
}}
.filter-chip:hover {{
  color: var(--fg);
  border-color: var(--fg-dim);
}}
.filter-chip.active {{
  background: var(--accent-glow);
  color: var(--accent);
  border-color: rgba(52, 211, 153, 0.4);
}}
.resource-card {{
  position: relative;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-md);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 0.2s, box-shadow 0.25s;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}}
@supports (backdrop-filter: blur(1px)) {{
  .resource-card {{ backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%); }}
}}
.resource-card:hover {{ border-color: rgba(212, 175, 55, 0.40); box-shadow: 0 12px 32px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.10); }}
@media (prefers-reduced-transparency: reduce) {{
  .resource-card {{ background: var(--bg-card); backdrop-filter: none; -webkit-backdrop-filter: none; }}
}}
.resource-card:hover {{
  border-color: rgba(212, 175, 55, 0.40);
}}
.card-header {{
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}}
.card-title {{
  font-size: 16px;
  font-weight: 700;
}}
.card-verdict {{
  font-size: 13.5px;
  color: var(--fg-muted);
  line-height: 1.5;
}}
.feature-list {{
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}}
.feature-item {{
  font-size: 12px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--border);
  padding: 3px 8px;
  border-radius: 6px;
  color: var(--fg-dim);
}}
.dead-notice {{
  background: var(--danger-bg);
  border: 1px solid rgba(201, 128, 138, 0.3);
  color: var(--danger);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  margin-top: 4px;
}}
</style>
</head>
<body>
{render_nav("risorse.html")}

<main class="container">
  <div class="search-hero">
    <h1 style="font-size:28px; font-weight:800; margin-bottom:6px;">Directory Globale 228 Risorse D&D</h1>
    <p style="color:var(--fg-muted); font-size:15px;">
      Database analizzato tramite scraping distribuito empirico (11 batch). Include classificazione edizioni 2014/2024, pricing trasparente e tracciamento domini deprecati.
    </p>
  </div>

  <div class="controls-bar">
    <div class="search-row">
      <input type="search" id="search-input" placeholder="Cerca per nome, verdetto, funzionalità o testo estratto..." autocomplete="off" aria-label="Ricerca nella directory risorse D&D">
      <select id="status-select" aria-label="Filtra per stato di verifica dei siti">
        <option value="ok">Solo Verificate Attive (134)</option>
        <option value="all">Tutti i 228 Siti (inclusi dead/failed)</option>
        <option value="dead">Solo Domini Deprecati (18)</option>
      </select>
    </div>
    <div class="filters-row" id="cat-chips">
      <span style="font-size:12px; color:var(--fg-dim); font-weight:600; text-transform:uppercase; margin-right:4px;">Categoria:</span>
      <button class="filter-chip active" data-cat="all">Tutte (228)</button>
      <button class="filter-chip" data-cat="srd">Dati 5e / SRD</button>
      <button class="filter-chip" data-cat="lfg">LFG / Sessioni</button>
      <button class="filter-chip" data-cat="vtt">VTT / Mappe</button>
      <button class="filter-chip" data-cat="wb">Worldbuilding</button>
      <button class="filter-chip" data-cat="av">Audio / Asset</button>
      <button class="filter-chip" data-cat="nw">News / Media</button>
      <button class="filter-chip" data-cat="mk">Marketplace</button>
      <button class="filter-chip" data-cat="tk">Tool / API</button>
    </div>
  </div>

  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
    <div id="results-count" style="font-size:14px; color:var(--fg-muted); font-weight:500;">Caricamento risorse...</div>
  </div>

  <div id="cards-container" class="card-grid"></div>

  <noscript>
    <div class="card" style="margin-top:24px;">
      <h3>Elenco Statico Risorse Verificate (JavaScript Disabilitato)</h3>
      <ul style="margin-top:12px; padding-left:20px; line-height:1.8; font-size:14px;">
        {''.join(noscript_items)}
      </ul>
    </div>
  </noscript>
</main>

<script>
const RAW_DATA = {json_data};
const CAT_LABELS = {json.dumps(CAT_MAP, ensure_ascii=False)};

let activeCat = 'all';
let activeStatus = 'ok';
let searchQuery = '';

function formatPriceBadge(p) {{
  if (!p) return '<span class="badge badge-dim">Pricing n/d</span>';
  const low = p.toLowerCase();
  if (low.startsWith('free') || low.startsWith('gratuito') || low.startsWith('kobold free')) {{
    return `<span class="badge badge-free">${{p.length > 28 ? p.slice(0, 25) + '…' : p}}</span>`;
  }}
  if (low.startsWith('paid') || low.includes('$') || low.includes('€')) {{
    return `<span class="badge badge-paid">${{p.length > 28 ? p.slice(0, 25) + '…' : p}}</span>`;
  }}
  return `<span class="badge badge-purple">${{p.length > 28 ? p.slice(0, 25) + '…' : p}}</span>`;
}}

function formatEditionBadge(ed) {{
  if (ed === 'dual') return '<span class="badge badge-purple">Dual 2014/2024</span>';
  if (ed === '2024') return '<span class="badge badge-free">2024 Rules</span>';
  if (ed === '2014') return '<span class="badge badge-dim">2014 Legacy</span>';
  return '';
}}

function renderCards() {{
  const container = document.getElementById('cards-container');
  const countEl = document.getElementById('results-count');
  const q = searchQuery.toLowerCase().trim();

  const filtered = RAW_DATA.filter(item => {{
    if (activeStatus === 'ok' && item.st !== 'ok') return false;
    if (activeStatus === 'dead' && item.st !== 'dead') return false;
    
    if (activeCat !== 'all' && item.c !== activeCat) return false;

    if (q) {{
      const textToSearch = (
        (item.n || '') + ' ' +
        (item.v || '') + ' ' +
        (item.p || '') + ' ' +
        (item.w || []).join(' ') + ' ' +
        (item.iss_all || []).join(' ') + ' ' +
        pulisciSnippet(item.snip)
      ).toLowerCase();
      if (!textToSearch.includes(q)) return false;
    }}
    return true;
  }});

  countEl.textContent = `Mostrate ${{filtered.length}} risorse su ${{RAW_DATA.length}} totali`;

  if (filtered.length === 0) {{
    container.innerHTML = '<div class="card" style="grid-column: 1/-1; text-align:center; padding:48px; color:var(--fg-muted);">Nessuna risorsa trovata per i criteri specificati.</div>';
    return;
  }}

  let html = '';
  for (const item of filtered) {{
    const priceBadge = formatPriceBadge(item.p);
    const editionBadge = formatEditionBadge(item.ed);
    const catName = CAT_LABELS[item.c] || item.c;
    
    let featuresHtml = '';
    if (item.w && item.w.length > 0) {{
      featuresHtml = `<ul class="feature-list">${{item.w.map(f => `<li class="feature-item">${{f.length > 60 ? f.slice(0, 57) + '…' : f}}</li>`).join('')}}</ul>`;
    }}

    let deadNoticeHtml = '';
    if (item.st === 'dead') {{
      deadNoticeHtml = `<div class="dead-notice"><strong>Dominio Deprecato / Offline:</strong> ${{item.rep_n || 'Sito non più accessibile'}} ${{item.rep_u ? `&bull; <a href="${{item.rep_u}}" target="_blank" rel="noopener" style="color:#fff; text-decoration:underline;">Alternativa Verificata &rarr;</a>` : ''}}</div>`;
    }}
    else if (item.rep_u) {{
      deadNoticeHtml = `<div class="dead-notice"><strong>Link aggiornato:</strong> ${{item.rep_n || 'URL spostato'}} &mdash; l'URL precedente non risponde più.</div>`;
    }}

    const statusBadge = item.st === 'ok' ? '<span class="badge badge-free">✓ Verificato</span>'
      : item.st === 'dead' ? '<span class="badge badge-danger">✗ Offline</span>'
      : item.st === 'js_shell' ? '<span class="badge badge-paid">⚡ SPA Live</span>'
      : item.st === 'login_wall' ? '<span class="badge badge-purple">🔒 Login</span>'
      : '<span class="badge badge-dim">⚠ Fetch fallito</span>';

    // issues complete: tag visibili (tutte, non solo 3)
    let issuesHtml = '';
    if (item.iss_all && item.iss_all.length > 0 && activeStatus !== 'ok') {{
      issuesHtml = `<div style="margin-top:6px;">${{item.iss_all.map(i => `<span class="feature-item" style="color:var(--danger); border-color:rgba(248,113,113,.25);">${{i.length > 80 ? i.slice(0, 77) + '…' : i}}</span>`).join(' ')}}</div>`;
    }} else if (item.iss_all && item.iss_all.length > 0) {{
      issuesHtml = `<div style="margin-top:6px;">${{item.iss_all.slice(0,2).map(i => `<span class="feature-item" style="color:var(--warning); border-color:rgba(251,191,36,.25);">${{i.length > 70 ? i.slice(0, 67) + '…' : i}}</span>`).join(' ')}}</div>`;
    }}

    // snippet estratto: visibile in details/summary (zero JS)
    const snipHtml = item.snip ? `
      <details style="margin-top:8px;">
        <summary data-no-tr style="cursor:pointer; font-size:12px; color:var(--accent); user-select:none;">Testo estratto dal sito (${{item.snip.length}} caratteri)</summary>
        <p data-no-tr style="font-size:12.5px; color:var(--fg-muted); line-height:1.6; margin-top:8px; padding:12px 12px; background:rgba(15,23,42,.5); border-radius:var(--radius-sm); border:1px solid var(--border);">${{item.snip}}…</p>
      </details>` : '';

    // fetch_error per record failed/js_shell
    const errHtml = item.err && (item.st === 'failed' || item.st === 'js_shell') ? `
      <div style="font-size:11px; color:var(--fg-dim); margin-top:6px; font-family:monospace;">${{item.err}}</div>` : '';

    html += `
    <div class="resource-card" data-id="${{item.id}}">
      <div class="card-header">
        <div class="card-title">
          <a href="${{item.u}}" target="_blank" rel="noopener">${{item.n}}</a>
          <span style="font-size:10px; color:var(--fg-dim); font-weight:500; margin-left:6px;">${{item.id}}</span>
        </div>
        <div>
          ${{statusBadge}}
          ${{editionBadge}}
          ${{priceBadge}}
        </div>
      </div>
      <div style="font-size:12px; color:var(--fg-dim); font-weight:600;">${{catName}}</div>
      <div class="card-verdict">${{item.v || 'Nessun verdetto disponibile.'}}</div>
      ${{featuresHtml}}
      ${{issuesHtml}}
      ${{snipHtml}}
      ${{errHtml}}
      ${{deadNoticeHtml}}
    </div>
    `;
  }}

  container.innerHTML = html;
}}

// Event Listeners
document.getElementById('search-input').addEventListener('input', (e) => {{
  searchQuery = e.target.value.slice(0, 200);
  renderCards();
}});

document.getElementById('status-select').addEventListener('change', (e) => {{
  activeStatus = e.target.value;
  renderCards();
}});

document.querySelectorAll('#cat-chips .filter-chip').forEach(btn => {{
  btn.addEventListener('click', () => {{
    document.querySelectorAll('#cat-chips .filter-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCat = btn.dataset.cat;
    renderCards();
  }});
}});

// Init
renderCards();
</script>

{render_footer()}
</body>
</html>
"""

# ------------------------------------------------------------------------------
# 5. Generazione LFG.HTML (LFG & Session Matchmaking + Scena Italiana)
# ------------------------------------------------------------------------------
def build_lfg() -> str:
    lfg_records = [r for r in records if r.get("cat") in ("lfg", "lfg_it")]
    # Modulo di candidatura: CSS+JS in asset esterni, inlinati qui (evita di
    # raddoppiare le graffe dentro l'f-string del template).
    lfg_form_css = (SITE_DIR / "assets" / "lfg-form.css").read_text(encoding="utf-8")
    lfg_form_js = (SITE_DIR / "assets" / "lfg-form.js").read_text(encoding="utf-8")
    
    return f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
{render_seo_head("lfg.html", "Trova Gruppo — sessioni e tavoli — Il Grimorio dei Reami", "Guida e comparativa tecnica alle piattaforme LFG (StartPlaying, Warhorn, Meetup, AL) con focus sulla Scena GDR Italiana.", 0.8)}

<title>Trova Gruppo — sessioni e tavoli &mdash; Il Grimorio dei Reami</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=optional" rel="stylesheet">
<style>
{SHARED_CSS}
{lfg_form_css}
.comparison-table {{
  width: 100%;
  border-collapse: collapse;
  margin: 24px 0 48px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
}}
@supports (backdrop-filter: blur(1px)) {{
  .comparison-table {{ backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%); }}
}}
@media (prefers-reduced-transparency: reduce) {{
  .comparison-table {{ background: var(--bg-card); backdrop-filter: none; -webkit-backdrop-filter: none; }}
}}
.comparison-table th, .comparison-table td {{
  padding: 16px 20px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}}
.comparison-table th {{
  background: rgba(15, 23, 42, 0.8);
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.05em;
}}
.comparison-table tr:hover td {{
  background: rgba(52, 211, 153, 0.02);
}}
.guide-box {{
  position: relative;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: var(--radius-md);
  padding: 28px;
  margin-bottom: 40px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}}
@supports (backdrop-filter: blur(1px)) {{
  .guide-box {{ backdrop-filter: blur(16px) saturate(140%); -webkit-backdrop-filter: blur(16px) saturate(140%); }}
}}
@media (prefers-reduced-transparency: reduce) {{
  .guide-box {{ background: var(--bg-card); backdrop-filter: none; -webkit-backdrop-filter: none; }}
}}
</style>
</head>
<body>
{render_nav("lfg.html")}

<main class="container" style="padding-top:36px;">
  <h1 style="font-size:32px; font-weight:800; margin-bottom:8px;">Iscrizione Sessioni D&D (Looking For Group)</h1>
  <p style="color:var(--fg-muted); font-size:16px; margin-bottom:32px;">
    Guida e comparativa tecnica alle migliori piattaforme per trovare un tavolo da gioco, iscriversi a sessioni one-shot o campagne, con focus su modelli di pricing e canali in lingua italiana.
  </p>

  <div class="lfg-form-card" id="lfg-card">
    <h2 style="font-size:20px; font-weight:800; margin-bottom:6px;">Candidatura per una sessione</h2>
    <p style="color:var(--fg-muted); font-size:14px; margin-bottom:18px;">
      Compila la scheda per proporti a un tavolo. <strong>I dati restano in questo browser</strong>
      (nessun invio automatico): puoi copiare il riepilogo o aprirlo nel tuo client di posta.
    </p>
    <div class="at-summary" id="lfg-errors" hidden role="alert" aria-live="assertive"></div>
    <form id="lfg-form" novalidate>
      <div class="at-grid">
        <div class="at-field">
          <label for="lfg-nome">Nome o handle <span class="at-req">*</span></label>
          <input type="text" id="lfg-nome" name="nome" maxlength="40" autocomplete="nickname">
          <span class="at-error" data-for="lfg-nome"></span>
        </div>
        <div class="at-field">
          <label for="lfg-contatto">Email o Discord <span class="at-req">*</span></label>
          <input type="text" id="lfg-contatto" name="contatto" maxlength="60" autocomplete="email">
          <span class="hint">Un&#39;email valida oppure un handle Discord (es. nome#1234)</span>
          <span class="at-error" data-for="lfg-contatto"></span>
        </div>
        <div class="at-field">
          <label for="lfg-esperienza">Esperienza <span class="at-req">*</span></label>
          <select id="lfg-esperienza" name="esperienza">
            <option value="">— scegli —</option>
            <option>Mai giocato</option>
            <option>Principiante (meno di 10 sessioni)</option>
            <option>Intermedio (1-3 anni)</option>
            <option>Veterano (3+ anni)</option>
            <option>Dungeon Master esperto</option>
          </select>
          <span class="at-error" data-for="lfg-esperienza"></span>
        </div>
        <div class="at-field">
          <label for="lfg-ruolo">Ruolo <span class="at-req">*</span></label>
          <select id="lfg-ruolo" name="ruolo">
            <option value="">— scegli —</option>
            <option>Giocatore</option>
            <option>Dungeon Master</option>
            <option>Entrambi</option>
          </select>
          <span class="at-error" data-for="lfg-ruolo"></span>
        </div>
        <div class="at-field">
          <label for="lfg-frequenza">Frequenza cercata <span class="at-req">*</span></label>
          <select id="lfg-frequenza" name="frequenza">
            <option value="">— scegli —</option>
            <option>Settimanale</option>
            <option>Quindicinale</option>
            <option>Mensile</option>
            <option>One-shot / saltuario</option>
          </select>
          <span class="at-error" data-for="lfg-frequenza"></span>
        </div>
        <div class="at-field">
          <label for="lfg-citta">Città o zona <span class="at-req" data-req-for="lfg-citta"></span></label>
          <input type="text" id="lfg-citta" name="citta" maxlength="60" autocomplete="address-level2">
          <span class="hint" id="lfg-citta-hint">facoltativa</span>
          <span class="at-error" data-for="lfg-citta"></span>
        </div>
      </div>

      <div style="margin-top:16px;">
        <label id="lfg-sistemi-label" style="font-size:12.5px;color:var(--fg-muted);font-weight:600;display:block;margin-bottom:6px;">Sistemi di gioco <span class="at-req">*</span></label>
        <div class="at-checks" role="group" aria-labelledby="lfg-sistemi-label">
          <label><input type="checkbox" name="sistemi" value="D&amp;D 5e (2014)"> D&amp;D 5e (2014)</label>
          <label><input type="checkbox" name="sistemi" value="D&amp;D 5e (2024)"> D&amp;D 5e (2024)</label>
          <label><input type="checkbox" name="sistemi" value="OSR / retrocloni"> OSR / retrocloni</label>
          <label><input type="checkbox" name="sistemi" value="Pathfinder 2e"> Pathfinder 2e</label>
          <label><input type="checkbox" name="sistemi" value="Altro"> Altro</label>
        </div>
        <span class="at-error" data-for="lfg-sistemi"></span>
      </div>

      <div style="margin-top:16px;">
        <label id="lfg-formato-label" style="font-size:12.5px;color:var(--fg-muted);font-weight:600;display:block;margin-bottom:6px;">Formato <span class="at-req">*</span></label>
        <div class="at-checks" role="group" aria-labelledby="lfg-formato-label">
          <label><input type="radio" name="formato" value="online"> Online</label>
          <label><input type="radio" name="formato" value="presenza"> In presenza</label>
          <label><input type="radio" name="formato" value="entrambi"> Entrambi</label>
        </div>
        <span class="at-error" data-for="lfg-formato"></span>
      </div>

      <div class="at-field" style="margin-top:16px;">
        <label for="lfg-note">Note per il tavolo</label>
        <textarea id="lfg-note" name="note" maxlength="600" placeholder="Stile di gioco, giorni disponibili, contenuti da evitare…"></textarea>
        <span class="at-error" data-for="lfg-note"></span>
      </div>

      <div class="at-field" style="margin-top:12px;">
        <label style="display:flex;gap:8px;align-items:flex-start;font-size:13.5px;color:var(--fg-muted);">
          <input type="checkbox" id="lfg-consenso" name="consenso" style="width:18px;height:18px;margin-top:2px;">
          <span>Ho capito che i dati restano <strong>solo in questo browser</strong> e che nessun invio è automatico.</span>
        </label>
        <span class="at-error" data-for="lfg-consenso"></span>
      </div>

      <div class="at-actions">
        <button type="submit" class="btn btn-primary" style="min-height:44px;">Salva la candidatura</button>
        <button type="button" class="btn" id="lfg-copy" style="min-height:44px;">Copia riepilogo</button>
        <button type="button" class="btn" id="lfg-mail" style="min-height:44px;">Apri nell&#39;email</button>
        <button type="button" class="btn" id="lfg-reset" style="min-height:44px;">Azzera</button>
      </div>
      <p class="at-saved" id="lfg-ok" hidden aria-live="polite"></p>
    </form>
    <div class="at-out" id="lfg-out" hidden></div>
    <div class="at-saved" id="lfg-saved" aria-live="polite"></div>
  </div>

  <div class="guide-box">
    <h2 style="color:var(--accent); font-size:18px; margin-bottom:10px;">Come Scegliere la Piattaforma Ideale</h2>
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:16px; font-size:14px; color:var(--fg-muted);">
      <div>
        <strong style="color:var(--fg);">Sessioni a Pagamento (Paid GM):</strong><br>
        <strong>StartPlaying</strong> è il leader assoluto con oltre 1.000 GM professionisti recensiti, pagamenti garantiti e filtri per fascia oraria/sistema ($5&ndash;$25 a sessione).
      </div>
      <div>
        <strong style="color:var(--fg);">Eventi Organizzati Gratuiti:</strong><br>
        <strong>Warhorn</strong> gestisce registrazioni ufficiali D&D Adventurers League e convention, ideale per one-shot strutturate a costo zero.
      </div>
      <div>
        <strong style="color:var(--fg);">Community & In-Person:</strong><br>
        <strong>Meetup</strong> e i server Discord dedicati (D&D Commons, D&D Beyond) per tavoli locali dal vivo o campagne continuative tra appassionati.
      </div>
    </div>
  </div>

  <h2 style="font-size:22px; font-weight:700; margin-bottom:16px;">Matrice Comparativa Piattaforme LFG</h2>
  <table class="comparison-table">
    <thead>
      <tr>
        <th>Piattaforma</th>
        <th>Modello / Prezzo</th>
        <th>Tipo Sessioni</th>
        <th>Punti di Forza</th>
        <th>Frizioni Rilevate</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong><a href="https://startplaying.games/" target="_blank" rel="noopener">StartPlaying</a></strong></td>
        <td><span class="badge badge-paid">A Pagamento ($5-$25/sess)</span></td>
        <td>Campagne &amp; One-Shot VTT</td>
        <td>1000+ GM verificati, safety tools integrati, recensioni reali</td>
        <td>Costo per sessione continuativa elevato</td>
      </tr>
      <tr>
        <td><strong><a href="https://warhorn.net/" target="_blank" rel="noopener">Warhorn</a></strong></td>
        <td><span class="badge badge-free">Gratuito</span></td>
        <td>Adventurers League &amp; Con</td>
        <td>Calendario rigoroso, sincronizzazione tavoli AL ufficiale</td>
        <td>Interfaccia legacy, poco intuitiva per neofiti</td>
      </tr>
      <tr>
        <td><strong><a href="https://dnd.wizards.com/adventurers-league" target="_blank" rel="noopener">D&D Adventurers League</a></strong></td>
        <td><span class="badge badge-free">Gratuito / Store Play</span></td>
        <td>Organized Play Ufficiale</td>
        <td>Personaggio portatile tra tavoli diversi, regole standardizzate</td>
        <td>Dipendenza da store fisici o eventi registrati</td>
      </tr>
      <tr>
        <td><strong><a href="https://www.meetup.com/topics/dnd/" target="_blank" rel="noopener">Meetup D&D</a></strong></td>
        <td><span class="badge badge-free">Gratuito (Community)</span></td>
        <td>In Presenza / Locali</td>
        <td>Gruppi geolocalizzati per città, eventi in pub/negozi</td>
        <td>Copertura disomogenea fuori dai grandi capoluoghi</td>
      </tr>
      <tr>
        <td><strong><a href="https://rpgsessions.com/" target="_blank" rel="noopener">RPG Sessions</a></strong></td>
        <td><span class="badge badge-purple">Freemium</span></td>
        <td>Virtual Tabletop / Discord</td>
        <td>Integrazione bot Discord, character sheet interattivi</td>
        <td>Focalizzato principalmente su sistemi non-5e</td>
      </tr>
    </tbody>
  </table>

  <h2 style="font-size:22px; font-weight:700; margin-bottom:16px;">Scena GDR Italiana &amp; Risorse in Lingua IT</h2>
  <div class="card-grid" style="margin-bottom:48px;">
    <div class="card">
      <div class="badge badge-free" style="margin-bottom:10px;">Festival &amp; Eventi Ufficiali</div>
      <h3><a href="https://www.luccacomicsandgames.com/" target="_blank" rel="noopener">Lucca Comics &amp; Games</a></h3>
      <p style="color:var(--fg-muted); font-size:14px;">
        Il principale riferimento italiano per giochi di ruolo. Ospita il prestigioso premio <em>Gioco di Ruolo dell'Anno</em>, tornei ufficiali D&D 5e e centinaia di tavoli dimostrativi in italiano.
      </p>
    </div>

    <div class="card">
      <div class="badge badge-purple" style="margin-bottom:10px;">Associazioni &amp; Community</div>
      <h3><a href="https://www.contessi.net/" target="_blank" rel="noopener">ConTessi RPG Italia</a></h3>
      <p style="color:var(--fg-muted); font-size:14px;">
        Portale associativo con supporto bilingue (IT/EN) dedicato alla divulgazione del gioco di ruolo e al supporto delle associazioni ludiche sul territorio.
      </p>
    </div>

    <div class="card">
      <div class="badge badge-dim" style="margin-bottom:10px;">Bacheca Giocatori</div>
      <h3>GDR Online &amp; Canali Discord IT</h3>
      <p style="color:var(--fg-muted); font-size:14px;">
        I canali storici di reclutamento italiano (bacheca <em>GDR Online</em> e server <em>D&D Italia Discord</em>) rimangono il punto di ritrovo principale per campagne voice/text in lingua italiana.
      </p>
    </div>
  </div>
  </div><!-- /dettagli tecnici -->
</main>

<script>{lfg_form_js}</script>
{render_footer()}
</body>
</html>
"""

# ------------------------------------------------------------------------------
# 6. Generazione CERCA.HTML (Live SRD 5.1 Spell & Monster Lookup)
# ------------------------------------------------------------------------------


# ------------------------------------------------------------------------------
# 6b. CERCA-APP.JS (asset statico del lookup 5e.tools, servito da data/)
CERCA_APP_JS = '''
/* cerca-app.js — Lookup D&D da 5e.tools (offline-first) + fallback SRD API.
 * Generato da build_site.py (build_cerca_app). Dataset: data/5etools/*, indicizzato in lookup-index.json.
 * Design: anti-slop (single accent), double-bezel, skeleton/circle, empty/error state, tabular-nums. */
(function () {
  "use strict";

  // ---- Glossario italiano (i18n) -------------------------------------------
  // Caricato PRIMA di ogni uso: le mappe di scuole/taglie/allineamenti/abilità/
  // condizioni/danni/rarità/ambienti e le sigle ufficiali (GS, BC, PF, CA, CD)
  // vivono qui; gli alias storici restano per compatibilità dei renderer.
  // ---- Terminologia e lingua attiva ---------------------------------------
  // `BI`, `LABELS`, `LANG`, `L()` e `setLang()` arrivano dallo script condiviso
  // iniettato nella navigazione (assets: i18n_bi.shared_js()), così esistono su
  // tutte le pagine. Qui si tiene un alias LOCALE `I18N`, riallineato da
  // refreshAliases(): i renderer continuano a usare I18N.sizes[…] senza modifiche.
  var I18N = (typeof BI !== "undefined" && BI[LANG]) ? BI[LANG] : {};
    {i18n_dist}
    // Alias storici usati dai renderer: le mappe ora arrivano dal glossario IT
    var SIZE_MAP = I18N.sizes;      // riallineata da refreshAliases()
    // Dichiarate QUI (livello IIFE): se una è dichiarata dentro una funzione
    // interna, refreshAliases() non la vede e il cambio lingua fallisce.
    var CONDITION_MAP = I18N.conditions;
    var ALIGN_MAP = I18N.alignments;
    var SAVE_MAP = I18N.abilityLabel;
    /* Pulizia dell'estratto esterno: dal markdown grezzo alla prosa leggibile.
       Serve perché `content_snippet` è testo raccolto da una pagina esterna: senza
       pulizia l'utente legge i segni del markdown al posto del contenuto. */
    function pulisciSnippet(t) {
      if (!t) return "";
      var s = String(t);
      s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");          // immagini: via del tutto
      s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");        // collegamenti: resta il testo
      s = s.replace(/^[ \t]*#{1,6}[ \t]*/gm, "");              // titoli markdown
      s = s.replace(/^[ \t]*[-*+][ \t]+/gm, "· ");             // elenchi
      s = s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1");
      s = s.replace(/[*_`~|]/g, " ");
      s = s.replace(/\s+/g, " ").trim();
      if (s.length > 260) s = s.slice(0, 257).replace(/[\s,;:.]$/, "") + "…";
      return s;
    }

    function refreshAliases() {
      // Riallinea TUTTE le mappe copiate da I18N: qualunque mappa catturata una
      // sola volta resterebbe nella lingua precedente dopo il cambio lingua.
      if (typeof BI !== "undefined" && BI[LANG]) I18N = BI[LANG];   // alias locale
      SIZE_MAP = I18N.sizes;
      CONDITION_MAP = I18N.conditions;
      ALIGN_MAP = I18N.alignments;
      SAVE_MAP = I18N.abilityLabel;
      refreshSchoolMap();
    }
    refreshAliases();   // mappa scuole/taglie pronta già al primo render
  {i18n_field}

  // Scuole di magia: i codici 5e.tools (V/N/T/E/D/C/A/I) mappavano su nomi INGLESI;
  // ora sul glossario italiano (Manuale del Giocatore IT).
  var SCHOOL_MAP = {};               // riempita da refreshSchoolMap()
  function refreshSchoolMap() {
    SCHOOL_MAP = { V: I18N.schools.Evocation, N: I18N.schools.Necromancy,
    T: I18N.schools.Transmutation, E: I18N.schools.Enchantment,
    D: I18N.schools.Divination, C: I18N.schools.Conjuration,
    A: I18N.schools.Abjuration, I: I18N.schools.Illusion };
  }
  function schoolName(x) { return SCHOOL_MAP[x] || x || ""; }
  function distStr(r) {
    // Portate e aree: metri come unità primaria (edizione IT) e tipi d'area tradotti.
    var AREA = { cone: "cono", line: "linea", sphere: "sfera", cube: "cubo",
                 radius: "raggio", hemisphere: "semisfera", cylinder: "cilindro",
                 square: "quadrato", special: "speciale", point: "personale",
                 self: "personale" };
    if (!r) return "Personale";
    if (typeof r === "string") return AREA[r.toLowerCase()] || r;
    if (r.distance && r.distance.amount) {
      if (r.distance.type === "feet") return DIST(r.distance.amount);
      if (r.distance.type === "miles") return r.distance.amount + " miglia";
      return r.distance.amount + " " + (r.distance.type || "");
    }
    if (r.type === "point" && !r.distance) return "Personale";
    return r.type ? (AREA[String(r.type).toLowerCase()] || r.type) : "Personale";
  }
  function timeStr(t) {
    // Tempi di lancio in italiano ("1 action" -> "1 azione", "1 bonus action" -> ...)
    var UNIT = { action: "azione", "bonus action": "azione bonus", reaction: "reazione",
                 minute: "minuto", hour: "ora", second: "secondo", round: "round",
                 day: "giorno", "move action": "azione di movimento" };
    function one(u) { return UNIT[String(u).toLowerCase()] || u; }
    if (!t) return "1 azione";
    if (typeof t === "string") {
      return t.replace(/^(\d+)\s+(.+)$/, function (_m, n2, u) { return n2 + " " + one(u); });
    }
    if (Array.isArray(t) && t[0]) { var x = t[0]; return (x.number ? x.number + " " : "") + one(x.unit); }
    if (t.number) return t.number + " " + one(t.unit);
    return String(t);
  }
  var DUR_UNIT_MAP = { minute: "minuto|minuti", round: "round|round", hour: "ora|ore", day: "giorno|giorni", year: "anno|anni", second: "secondo|secondi" };
  function durStr5e(d) {
    if (!d || !d.length) return "Istantanea";
    const parts = [];
    d.forEach(function (x) {
      if (!x) return;
      if (x.duration && x.duration.amount) {
        const uv = (DUR_UNIT_MAP[x.duration.type] || x.duration.type || "").split("|");
        parts.push(x.duration.amount + " " + (x.duration.amount === 1 ? uv[0] : (uv[1] || uv[0])));
      } else if (x.type === "instant") {
        parts.push("Istantanea");
      } else if (x.type === "permanent") {
        parts.push("Permanente");
      } else if (x.type === "special") {
        parts.push("Speciale");
      }
      if (x.concentration) parts.push("(concentrazione)");
    });
    return parts.join(" ") || "Istantanea";
  }

  const INDEX_URL = "data/lookup-index.json";
  const DATA_ROOT = "data/5etools/";
  const SRD_API = "https://www.dnd5eapi.co/api/2014/";
  const ABBR = { phb: "PHB", xphb: "2024 PHB", mm: "MM", xmm: "2024 MM", tce: "TCE", xge: "XGE", scag: "SCAG", mge: "MGE", dmg: "DMG", wdh: "WDH", egw: "EGW", ftp: "FTP", ggtr: "GGtR", ai: "AI", mot: "MOT", scc: "SCC", big: "BGG", mpp: "MPP" };

  let INDEX = null;
  let state = { q: "", type: null, rows: [] };
  const fileCache = new Map();

  /* ---------- BINDINGS POST-RENDER ----------
   * Gli elementi app (chip-row, lookup-search, result-list, srd-box) vengono creati
   * DINAMICAMENTE dall'init. Ogni binding DEVE avvenire DOPO root.innerHTML —
   * un addEventListener su null a parse-time uccide l'IIFE prima del fetch indice
   * (root cause del freeze "Caricamento database..."). */

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function srcNice(src) {
    if (ABBR[src]) return ABBR[src];
    if (/^[A-Z0-9]{2,8}$/.test(src)) return src;
    return src;
  }
  function typeLabel(t) {
    if (INDEX && INDEX.types && INDEX.types[t]) return INDEX.types[t].label;
    return t;
  }

  /* ---------- RENDER: lista risultati (righe, no card) ---------- */
  function renderList() {
    const q = state.q.toLowerCase().trim();
    const t = state.type;
    // Fuzzy search: scoring combinato (exact > prefix > substring > fuzzy typo <=2)
    let list = [];
    for (let i = 0; i < INDEX.entries.length; i++) {
      const e = INDEX.entries[i];
      if (e.sup) continue;                       // ristampa: vive come tab nella scheda della primaria
      if (t && e.t !== t) continue;
      const sc = matchScore(e.n.toLowerCase(), q);
      if (sc > 0) { list.push(e); e._sc = sc; }
    }
    // Sort: score desc (exact/prefix/substring/fuzzy), poi nome asc (stabile)
    if (q) list.sort(function (a, b) { return (b._sc - a._sc) || (a.n.length - b.n.length) || a.n.localeCompare(b.n); });
    // Filtro classe per spell: richiede SC_CLASSES (lazy) 
    const cf = document.getElementById("class-filter");
    if (state.type === "spell" && cf && cf.value && !SC_CLASSES) {
      // Il filtro e' selezionato ma mancano i dati: caricali (il .then ri-renderizza)
      loadSpellClasses();
    }
    if (state.type === "spell" && cf && cf.value && SC_CLASSES) {
      const cfv = cf.value;
      list = list.filter(function (e) {
        const classes = spellClassList(e);
        return classes.some(function (c) { return c.toLowerCase() === cfv; });
      });
    }
    list = list.slice(0, 200);
    state.rows = list;
    // URL sync: la ricerca e' condivisibile (history.replaceState, no re-render)
    if (window.history && window.history.replaceState) {
      const p = new URLSearchParams();
      if (state.q) p.set("q", state.q);
      if (state.type) p.set("cat", state.type);
      const qs = p.toString();
      window.history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
    }
    document.getElementById("result-count").innerHTML = "Risultati: <b>" + list.length + "</b>" + (list.length === 200 ? "+" : "");
    const box = document.getElementById("result-list");
    if (!list.length) {
      box.innerHTML = '<div class="r-none">Nessuna entità trovata per "' + esc(state.q) + '". Prova con un altro nome o seleziona un\\'altra categoria o l\\'API SRD live.</div>';
      return;
    }
    box.innerHTML = list.map(function (e, i) {
      return '<div class="result-row" data-i="' + i + '" tabindex="0" role="button">' +
        '<span class="r-type">' + esc(typeLabel(e.t)) + '</span>' +
        '<span class="r-name">' + esc(e.n) + '<small>' + esc(srcNice(e.s)) + " &mdash; " + esc(e.f.replace(".json", "")) + '</small></span>' +
        '<span style="color:var(--fg-dim);font-size:13px;">&rarr;</span></div>';
    }).join("");
  }

  /* ---------- RENDER entità trovata nel file on-demand ---------- */
  function findInData(data, e) {
    if (!data) return null;
    const list = Array.isArray(data[e.t]) ? data[e.t] : [];
    const found = list.find(function (x) {
      if (!x || x.name !== e.n) return false;
      const xs = x.source || (x.inherits && x.inherits.source) || x.edition || "";
      return xs === e.s || e.s === "";
    }) || null;
    // magicvariant: la descrizione sta in inherits — mergea nell'entità per il render
    if (found && found.inherits && typeof found.inherits === "object") {
      const inh = found.inherits;
      ["entries", "desc", "text", "rarity", "reqAttune", "weight", "value", "page"].forEach(function (k) {
        if (found[k] === undefined && inh[k] !== undefined) found[k] = inh[k];
      });
      if (inh.namePrefix && typeof found.name === "string" && found.name.indexOf(inh.namePrefix) === 0) {
        found._baseItemName = (inh.baseItem ? inh.baseItem.replace(/-/g, " ") : "base item");
      }
    }
    return found;
  }

  function loadEntity(i) {
    const e = state.rows[i];
    if (!e) return;
    showSkeleton();
    fetchEntity(e).then(function (ent) {
      renderEntity(e, ent);
    }).catch(function (err) {
      fallbackSRD(e, err);
    });
  }

  // ---- Eredità 5e.tools (`_copy`) ------------------------------------------
  // Un'entità con `_copy` eredita TUTTI i campi dal genitore omonimo (stessa fonte)
  // e poi applica `_mod`. Senza questa risoluzione la scheda resta vuota
  // (1143/4570 mostri, 73/2512 oggetti nel dataset).
  const COPY_FIELDS = ["ac", "hp", "speed", "str", "dex", "con", "int", "wis", "cha",
    "saves", "skills", "senses", "passive", "languages", "cr", "traits", "action",
    "bonusActions", "reaction", "legendary", "mythic", "spellcasting", "type", "size",
    "alignment", "entries", "desc", "text", "rarity", "reqAttune", "weight", "value",
    "traitTags", "environment", "immune", "resist", "vulnerable", "conditionImmune",
    "damageTags", "damageResistances", "skillProficiencies", "toolProficiencies",
    "ability", "typicalSpeakers", "script", "domains", "symbol", "title", "pantheon",
    "category", "basicRules", "additionalSources", "page", "source"];

  function applyMod(target, mod) {
    // Sottoinsieme di `_mod` 5e.tools: append/prepend/replace su array e su chiavi "*".
    if (!mod || typeof mod !== "object") return target;
    Object.keys(mod).forEach(function (k) {
      const spec = mod[k];
      if (!spec || typeof spec !== "object" || !spec.mode) return;
      const val = spec.items !== undefined ? spec.items : spec.value;
      const key = (k === "*") ? null : k;
      if (key === null) return; // `*` richiederebbe il merge profondo di ogni campo: non necessario al render
      const cur = target[key];
      if (spec.mode === "append" || spec.mode === "prepend") {
        const arr = Array.isArray(cur) ? cur.slice() : (cur === undefined ? [] : [cur]);
        const add = Array.isArray(val) ? val : [val];
        target[key] = spec.mode === "append" ? arr.concat(add) : add.concat(arr);
      } else if (spec.mode === "replace") {
        target[key] = val;
      }
    });
    return target;
  }

  function mergeCopy(child, parent) {
    const out = {};
    COPY_FIELDS.forEach(function (k) { if (parent[k] !== undefined) out[k] = parent[k]; });
    Object.keys(child).forEach(function (k) { out[k] = child[k]; });
    out.name = child.name;
    out.source = child.source;
    applyMod(out, child._mod);
    out.__copiedFrom = parent.name + " (" + (parent.source || "") + ")";
    return out;
  }

  function rawEntity(e) {
    if (fileCache.has(e.f)) {
      return Promise.resolve(findInData(fileCache.get(e.f), e));
    }
    return fetch(DATA_ROOT + e.f).then(function (r) {
      if (!r.ok) return Promise.reject(new Error("file " + e.f));
      return r.json();
    }).then(function (data) {
      fileCache.set(e.f, data);
      return findInData(data, e);
    });
  }

  function resolveCopy(ent, type, seen) {
    if (!ent || !ent._copy || typeof ent._copy !== "object") return Promise.resolve(ent);
    const cp = ent._copy;
    seen = seen || {};
    const key = cp.name + "|" + (cp.source || "");
    if (seen[key]) return Promise.resolve(ent); // cicli di copia: evita loop
    seen[key] = true;
    const pe = INDEX.entries.find(function (x) {
      return x.n === cp.name && (cp.source === undefined || x.s === cp.source) && x.t === type;
    });
    if (!pe) return Promise.resolve(ent);
    return rawEntity(pe).then(function (parentRaw) {
      if (!parentRaw) return ent;
      return resolveCopy(parentRaw, type, seen).then(function (parent) {
        return mergeCopy(ent, parent);
      });
    }).catch(function () { return ent; });
  }

  function fetchEntity(e) {
    return rawEntity(e).then(function (ent) {
      if (!ent) return null;
      return resolveCopy(ent, e.t);
    });
  }

  function showSkeleton() {
    const box = document.getElementById("stat-core-zone");
    box.innerHTML = '<div class="stat-bezel"><div class="stat-core st-loading">' +
      '<div class="skel" style="width:40%;height:26px;"></div>' +
      '<div class="skel" style="width:70%;"></div><div class="skel" style="width:90%;"></div>' +
      '<div class="skel" style="width:55%;"></div></div></div>';
  }

  function listOf(arr) { return Array.isArray(arr) ? arr : []; }
  function childName(x) { return (typeof x === "string") ? x : ((x && typeof x === "object") ? (x.name || "") : ""); }
  function textOf(entries) {
    // entries o text o desc: array di stringhe/oggetti {"name":..., "entries":[...]}
    // Le stringhe passano per tags() (conversione {@...} -> hyperlink HTML).
    const out = [];
    function push(v) {
      if (v == null) return;
      if (typeof v === "string") { out.push(tags(v)); }
      else if (Array.isArray(v)) { v.forEach(push); }
      else if (typeof v === "object") {
        if (v.entries) { if (v.name) out.push("<strong>" + esc(v.name) + ".</strong> "); v.entries.forEach(push); }
        else if (v.name) { out.push(esc(v.name)); }
        else if (typeof v.text === "string") { out.push(tags(v.text)); }
        else if (v.type === "list") { (v.items || []).forEach(push); }
        else if (v.type === "table") {
          // tabelle 5e.tools: si rendono le righe come elenco leggibile
          const rows = (v.rows || []);
          const rowsHtml = rows.map(function (row) {
            const cells = Array.isArray(row) ? row : [row];
            return "<li>" + cells.map(function (c) {
              if (c && typeof c === "object" && c.entry !== undefined) return esc(c.entry);
              return esc(c);
            }).join(" — ") + "</li>";
          }).join("");
          if (rowsHtml) out.push("<ul>" + rowsHtml + "</ul>");
        }
        // prerequisiti 5e.tools: {spell: [...]}, {feat: [...]}, {level: N}, {item: [...]}
        else if (v.spell) { out.push(listOf(v.spell).map(function (s) { return tags("{@spell " + s + "}"); }).join(", ")); }
        else if (v.feat) { out.push(listOf(v.feat).map(function (s) { return tags("{@item " + s + "}"); }).join(", ")); }
        else if (v.item) { out.push(listOf(v.item).map(function (s) { return tags("{@item " + s + "}"); }).join(", ")); }
        else if (v.level != null) { out.push("livello " + esc(v.level) + "+"); }
        else if (v.campaign) { out.push("campagna: " + esc(listOf(v.campaign).join(", "))); }
        // attack entries (oggetti/monster item actions): attackEntries + hitEntries
        else if (v.attackEntries) { out.push(textOf(v.attackEntries).join(" ")); }
        else if (v.hitEntries) { out.push("<strong>Colpito:</strong> " + textOf(v.hitEntries).join(" ")); }
      }
    }
    push(entries);
    return out;
  }

  function mig(piece) { // mig/elif per campo bestiario (speed, senses)
    if (!piece || typeof piece !== "object") return piece === true ? null : piece;
    const k = Object.keys(piece).find(function (x) { return x !== "type"; });
    return piece[k];
  }

  /* ---------- TAG CONVERTER (5e.tools inline tags -> HTML hyperlink) ----------
   * {@spell fireball}, {@dc 25}, {@hit 7}, {@damage 2d6+10}, {@dice 1d6}, {@item X},
   * {@creature goblin}, {@condition prone}, {@skill Perception}, {@filter X}, {@quickref X},
   * {@recharge 5-6}, {@5etools X|URL} -> hyperlink incrociato (ricerca interna o esterno). */
  var TAG_RE = /\{@([a-zA-Z]+)(?:\s+([^}]*?))?\}/g;
  
  {i18n_weight}
  // Condizioni dal glossario IT: "charmed" e' **Affascinato** (non "Amaliato") e
  // "restrained" e' **Trattenuto** (non "Costretto").
  CONDITION_MAP = I18N.conditions;

  function slugName(s) { return String(s || "").toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""); }

  /* ---------- FUZZY SEARCH (typo-tolerance) ----------
   * Levenshtein distance (bound O(n*m) con early-exit) + scoring combinato:
   * exact(4) > prefix(3) > substring(2) > fuzzy(1, dist<=2 per q>=4) > no(0). */
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = new Array(b.length + 1), curr = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      curr[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      const tmp = prev; prev = curr; curr = tmp;
    }
    return prev[b.length];
  }
  function matchScore(name, q) {
    if (!q) return 1; // nessuna query: tutti i risultati (ordine indice)
    if (name === q) return 4;
    if (name.indexOf(q) === 0) return 3;
    if (name.indexOf(q) !== -1) return 2;
    // fuzzy solo per query >= 4 char: dist <= 2 (tolleranza typo)
    if (q.length >= 4) {
      // parola singola del nome fuzzy-matching la query: score intermedio (sopra il fuzzy
      // su tutto il nome — "Wizard" per "wizerd" prima di "Abjurer Wizard")
      const words = name.split(/\s+/);
      let best = 0;
      for (let i = 0; i < words.length; i++) {
        if (words[i] === q) return 2.5;
        const wd = levenshtein(words[i], q);
        if (wd <= 2) best = Math.max(best, 1.5 - wd / 10); // dist 1 -> 1.4, dist 2 -> 1.3
      }
      if (best > 0) return best;
      const d = levenshtein(name, q);
      if (d <= 2) return 1 - d / 10;
    }
    return 0;
  }

  function renderTag(tag, body, depth) {
    depth = depth || 0;
    var inner = body || "";
    // innesta tag annidati (es. {@damage 2d6+10} dentro {@dc 25} -> non presente ma safe)
    // ponytail: depth cap a 3 — i tag 5e.tools reali non superano 2 livelli; oltre
    // quello e' un tag ciclico (es. {@action Help} dentro Help) che senza cap esplode
    // a RangeError "Invalid string length" e maschera la scheda come "non trovato".
    if (depth < 3 && inner.indexOf("{@") !== -1) inner = inner.replace(TAG_RE, function (_m, t2, b2) { return renderTag(t2, b2, depth + 1); });
    switch (tag) {
      case "spell": {
        var parts = body.split("|");
        var label = inner;
        var q = slugName(parts[0]);
        // hyperlink di ricerca interna: apre cerca.html?q=slug (ricerca DB locale istantanea)
        return '<a class="tag-link tag-spell" href="cerca.html?q=' + encodeURIComponent(q) + '" title="Cerca l’incantesimo nel database locale">' + esc(label) + '</a>';
      }
      case "dc": {
        var dc = inner.split("|")[0];
        return '<span class="tag-dc">CD ' + esc(dc) + '</span>';
      }
      case "hit":
        return '<span class="tag-hit">' + esc(inner.split("|")[0]) + '</span>';
      case "damage":
        return '<span class="tag-dice">' + esc(inner.split("|")[0]) + '</span>';
      case "dice":
        return '<span class="tag-dice">' + esc(inner.split("|")[0]) + '</span>';
      case "recharge":
        return '<span class="tag-dice">Ricarica ' + esc(inner.split("|")[0]) + '</span>';
      case "condition": {
        var cs = inner.split("|")[0];
        var cl = CONDITION_MAP[cs.trim().toLowerCase()] || cs;
        return '<a class="tag-link tag-cond" href="cerca.html?cat=condition&q=' + encodeURIComponent(cs) + '" title="Cerca la condizione">' + esc(cl) + '</a>';
      }
      case "skill": {
        var sk = inner.split("|")[0];
        return '<span class="tag-skill">' + esc(sk) + '</span>';
      }
      case "creature": {
        var cr2 = inner.split("|")[0];
        var crq = slugName(cr2);
        return '<a class="tag-link tag-creature" href="cerca.html?q=' + encodeURIComponent(crq) + '" title="Cerca la creatura nel database locale">' + esc(cr2) + '</a>';
      }
      case "item": {
        var it = inner.split("|")[0];
        var itq = slugName(it);
        return '<a class="tag-link tag-item" href="cerca.html?cat=item&q=' + encodeURIComponent(itq) + '" title="Cerca l’oggetto nel database locale">' + esc(it) + '</a>';
      }
      case "filter": {
        var fk = inner.split("|");
        return esc(fk[0]);
      }
      case "quickref": case "book": case "adventure": case " sensedetect": {
        var bk = inner.split("|");
        return esc(bk[0]);
      }
      case "5etools": case "loader": {
        var lk = inner.split("|");
        var url = lk[1] ? ("https://5e.tools/" + lk[1].replace(/^\//, "")) : "https://5e.tools/";
        return '<a class="tag-link" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(lk[0]) + '</a>';
      }
      default:
        return esc(inner.split("|")[0]);
    }
  }

  function tags(s) {
    // Converte i tag inline {@...} in HTML e ESCAPA tutto il resto.
    // Sicurezza: prima il testo letterale passava intatto in innerHTML e il fallback
    // SRD ci inseriva la `desc` di un'API esterna (vettore di injection HTML).
    if (s == null) return "";
    const str = String(s);
    let out = "", last = 0;
    // ponytail: regex LOCALE per chiamata — TAG_RE e' /g condivisa e re-entrante:
    // se renderTag (nested) fa .replace(TAG_RE) durante il ciclo exec() qui sotto,
    // lastIndex si azzera e il ciclo riparte dall'inizio -> stringa infinita ->
    // RangeError "Invalid string length" -> la scheda diventa "non trovato".
    const re = new RegExp(TAG_RE.source, "g");
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(str)) !== null) {
      out += esc(str.slice(last, m.index));
      out += renderTag(m[1], m[2]);
      last = m.index + m[0].length;
    }
    out += esc(str.slice(last));
    return out;
  }

  function renderStat(block, label) {
    return '<div class="st-stat"><strong>' + esc(label) + '</strong><span>' + esc(block) + '</span></div>';
  }

  let CURRENT_ENTITY = null; // ultima entità aperta (per re-render quando SC_CLASSES arriva)
  let CURRENT_INDEX = null;
  let FAV_ADD = null; // pulsante preferito (assegnata dal then-init, scope locale)

  /* ---------- TAB PER FONTE (una scheda per entità, più fonti consultabili) ----------
   * L'indice raggruppa le ristampe: la entry primaria porta `alt` con le altre fonti
   * (file + codice + data di pubblicazione). Qui si disegna la barra e si ricarica
   * la scheda dalla fonte scelta, mantenendo i tab visibili. */
  /* Ridisegna la vista al cambio di lingua. Gli alias SIZE_MAP/SCHOOL_MAP
     vanno riallineati: erano calcolati sulla lingua attiva all'avvio. */
  function onLangChange() {
    refreshAliases();
    if (typeof INDEX !== "undefined" && INDEX) {
      if (typeof renderChips === "function") renderChips();
      if (typeof state !== "undefined" && state && state.q && state.q.length >= 2) renderList();
    }
    if (_lastCard && document.getElementById("stat-core-zone")) {
      // Niente catch silenzioso: un errore qui lascerebbe la scheda a metà
      // (etichette nuove, valori vecchi) senza alcun segnale in console.
      renderEntity(_lastCard.e, _lastCard.ent);
    }
  }
  // Il runtime condiviso chiama window.onLangChange() dopo aver cambiato lingua.
  window.onLangChange = function () { onLangChange(); };
  function fmtDate(iso) {
    if (!iso) return "";
    var p2 = String(iso).split("-");
    return p2.length === 3 ? (p2[2] + "/" + p2[1] + "/" + p2[0]) : String(iso);
  }
  function sourceTabs(e) {
    // La lista dei tab viene CALCOLATA UNA VOLTA sulla entry di gruppo e messa in cache:
    // quando l'utente cambia fonte, `e.f/e.s` vengono sovrascritti con quelli della
    // fonte scelta, quindi ricostruire la lista qui farebbe coincidere il tab primario
    // con l'alternativa (entrambi "attivi").
    if (!e._tabs) {
      var alts = listOf(e.alt);
      e._tabs = alts.length
        ? [{ f: e.f, s: e.s, p: e.p }].concat(alts.map(function (a) { return { f: a.f, s: a.s, p: a.p }; }))
        : [{ f: e.f, s: e.s, p: e.p }];
    }
    var all = e._tabs;
    if (all.length === 1) {
      return e.p ? '<div class="src-tabs"><span class="src-date-solo">Pubblicazione: ' + esc(fmtDate(e.p)) + '</span></div>' : "";
    }
    var cur = e._curS || e.s;
    var btns = all.map(function (x) {
      var act = (x.s === cur);
      var date = x.p ? '<span class="src-date">' + esc(fmtDate(x.p)) + '</span>'
                     : '<span class="src-date nd">data non disponibile</span>';
      return '<button type="button" role="tab" aria-selected="' + (act ? 'true' : 'false') +
        '" class="src-tab' + (act ? ' act' : '') + '" data-f="' + esc(x.f) + '" data-s="' + esc(x.s) + '">' +
        esc(srcNice(x.s)) + ' ' + date + '</button>';
    }).join("");
    return '<div class="src-tabs" role="tablist" aria-label="Fonti disponibili">' + btns +
      '<span class="src-hint">' + all.length + ' fonti &middot; la più recente per prima</span></div>';
  }
  function bindSourceTabs(e) {
    var box = document.getElementById("stat-core-zone");
    if (!box) return;
    box.querySelectorAll(".src-tab").forEach(function (b) {
      b.addEventListener("click", function () {
        var f = b.dataset.f, s = b.dataset.s;
        if (!f || s === (e._curS || e.s)) return;
        var e2 = Object.assign({}, e, { f: f, s: s, _curS: s });   // mantiene `alt` per i tab
        showSkeleton();
        fetchEntity(e2).then(function (ent) {
          if (!ent) { renderNotFound(e2); return; }
          renderEntity(e2, ent);
        }).catch(function () { renderNotFound(e2); });
      });
    });
  }

  var _lastCard = null;   // ultima scheda disegnata: la usa il cambio lingua
  /* ---------- immagine della scheda ----------
   * Mostri: illustrazione reale dal mirror 5e.tools (il flag `e.img` dice se esiste).
   * Tutto il resto: un sigillo SVG generato (iniziale + colore del tipo), perché
   * incantesimi, oggetti, classi e razze non hanno immagini in quel mirror.
   * In entrambi i casi l'immagine ha `onerror`: mai un'icona rotta. */
  var TYPE_COLOR = { monster: "#8b3a3a", spell: "#3a5f8b", item: "#8b7a3a", class: "#5f3a8b",
    race: "#3a8b5f", background: "#6b6b6b", condition: "#8b5f3a", feat: "#3a8b8b",
    deity: "#8b3a6b", language: "#5f6b3a", object: "#6b5f3a", vehicle: "#3a6b8b",
    reward: "#8b6b3a", optionalfeature: "#4a4a7a", variantrule: "#7a4a4a" };

  function sigil(name, type) {
    var iniziale = (String(name || "?").trim()[0] || "?").toUpperCase();
    var colore = TYPE_COLOR[type] || "#555f6b";
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + colore + '" stop-opacity="0.55"/>' +
      '<stop offset="1" stop-color="' + colore + '" stop-opacity="0.15"/></linearGradient></defs>' +
      '<rect width="120" height="120" rx="14" fill="url(#g)" stroke="' + colore + '" stroke-opacity="0.6"/>' +
      '<text x="60" y="78" font-family="Georgia,serif" font-size="56" font-weight="700" ' +
      'text-anchor="middle" fill="#f2ede4" fill-opacity="0.92">' + iniziale + '</text></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  /* URL dell'illustrazione reale, solo per i mostri che ne hanno una. */
  /* Cartella di 5e.tools per ogni tipo di voce: prima era ammesso solo `monster`,
     quindi oggetti, razze, sottoclassi, incantesimi e talenti con illustrazione
     reale venivano disegnati con il sigillo generico (misurato). */
  var CARTELLE = { monster: "bestiary", spell: "spells", item: "items", baseitem: "items", magicvariant: "items", race: "races", subrace: "races", class: "classes", subclass: "classes", classFeature: "classes", subclassFeature: "classes", feat: "feats", background: "backgrounds", language: "languages", condition: "conditions", deity: "deities", action: "actions", object: "objects", trap: "traps", vehicle: "vehicles", reward: "rewards", boon: "boons", disease: "diseases", cult: "cults", hazard: "hazards", psionic: "psionics", variantrule: "variantrules", optionalfeature: "optionalfeatures", skill: "skills", sense: "senses" };

  function entityImageSrc(e) {
    if (!e || e.img === undefined || e.img === null) return null;
    if (e.img === 3) { var ic = e.ic ? String(e.ic) : "azione-generica";
                       return "data/icons/" + encodeURIComponent(ic) + ".svg"; }
    if (!e.n || !e.s) return null;
    var cart = CARTELLE[e.t];
    if (!cart) return null;
    var percorso = (e.img === 2 ? "tokens/" : "") + encodeURIComponent(e.s) + "/" +
      encodeURIComponent(e.n) + ".webp";
    return "https://5e.tools/img/" + cart + "/" + percorso;
  }

  function imageBlock(e) {
    var src = entityImageSrc(e);
    /* ripiego: per le voci con icona tematica si ripiega su QUELLA (più informativa
       del sigillo generico); per le altre resta il sigillo. */
    var fallback = (e && e.img === 3)
      ? "data/icons/" + encodeURIComponent(e.ic || "azione-generica") + ".svg"
      : sigil(e.n, e.t);
    var isIcona = (e.img === 3);
    var titolo = (isIcona ? "Icona tematica di "
                 : (src ? "Illustrazione di " : "Sigillo di ")) + esc(e.n || "") + " — " + esc(e.t || "");
      (src ? " (5e.tools)" : " \u2014 nessuna illustrazione disponibile per questo tipo");
    return '<figure class="ent-img">' +
      '<img src="' + esc(src || fallback) + '" alt="' + titolo + '" width="120" height="120" ' +
      'loading="lazy" decoding="async" data-sigil="' + esc(fallback) + '" ' +
      'onerror="this.onerror=null;this.src=this.dataset.sigil;">' +
      '</figure>';
  }

  function renderEntity(e, ent) {
    _lastCard = { e: e, ent: ent };
    const box = document.getElementById("stat-core-zone");
    if (!ent) { renderNotFound(e); return; }
    CURRENT_ENTITY = ent; CURRENT_INDEX = e;
    const src = srcNice(e.s);
    let html = '<div class="stat-bezel"><div class="stat-core"><div class="st-h"><div>' +
          '<h2>' + iconaAzione(ent.name) + esc(ent.name) + '</h2>' +
      '<div class="st-sub">' + (e.t === "monster" ? typeSub(ent) : typeLine(e.t, ent)) + '</div></div>' +
      '<span class="db-badge">&#10003; 5e.tools locale</span></div>' +
      '<div class="st-src">Fonte: ' + esc(srcNice(e.s)) + ' &middot; ' + esc(e.s) + ' &middot; ' + esc(e.f) + '</div>' +
      imageBlock(e) +
      sourceTabs(e);
    html += bodyFor(e.t, ent);
    // Arricchimento wiki: in fondo, dopo i dati di gioco (è contenuto esterno).
    html += wikiBlock(e);
    html += '</div></div>';
    box.innerHTML = html;
    bindSourceTabs(e);
    // Le barre "Traduci" per blocco non vengono più create: la lingua scelta nella
    // navigazione traduce automaticamente tutto il testo, compresi i blocchi di
    // fonte (marcati lang="en", quindi riconosciuti dal traduttore automatico).
    // La scheda è appena nata: si traduce subito, senza aspettare l'observer.
    if (window.dndTr && window.dndTr.state && window.dndTr.state.lang && window.dndTr.state.lang !== "it") {
      setTimeout(function () { window.dndTr.translateNow(); }, 120);
    }
    // Auto-reveal minimale: scroll SOLO se lo statblock non e' nel viewport
    // (ACT-04 — scrollIntoView("smooth") sempre-forzato perdeva la barra di ricerca).
    const rect = box.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top > vh || rect.bottom < 0) {
      box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    // Pulsante preferito (FAV_ADD assegnata dal then-init — scope IIFE)
    if (FAV_ADD) FAV_ADD();
  }

  // Allineamenti dal glossario IT: la mappa precedente aveva NG->"legale neutrale"
  // e NE->"legale malvagio" (che sono invece LG e LE): traduzioni sbagliate.
  ALIGN_MAP = I18N.alignments;
  function alignStr(a) {
    if (!a) return "";
    if (typeof a === "string") return ALIGN_MAP[a] || a;
    if (Array.isArray(a)) {
      // [{alignment: [...], chance: N}] = allineamento probabile (special)
      if (a[0] && typeof a[0] === "object" && a[0].alignment) {
        return "di solito " + alignStr(a[0].alignment) + (a[0].chance ? " (" + a[0].chance + "%)" : "");
      }
      const parts = a.map(function (x) { return ALIGN_MAP[x] || x; });
      // ["C","E"] = caotico malvagio (combinazione)
      return parts.join(" ");
    }
    return String(a);
  }
  // Fonti di CA non gestite come {@item ...}: restano in inglese da 5e.tools.
  var AC_SOURCE_IT = {
    "natural armor": "armatura naturale", "mage armor": "armatura magica",
    "unarmored defense": "difesa senza armatura", "barkskin": "pelle coriacea",
    "leather armor": "armatura di cuoio", "studded leather armor": "cuoio borchiato",
    "hide armor": "armatura di pelli", "scale mail": "cotta di scaglie",
    "plate armor": "armatura di piastre", "splint armor": "armatura a piastre",
    "shield": "scudo", "dex": "Destrezza", "dodge": "schivata", "cover": "copertura"
  };
  // Valori testuali dell'API SRD (dnd5eapi.co) in inglese: traduzione in italiano.
  var SRD_SCHOOL = { abjuration: "Abiurazione", conjuration: "Evocazione",
    divination: "Divinazione", enchantment: "Ammaliamento", evocation: "Invocazione",
    illusion: "Illusione", necromancy: "Necromanzia", transmutation: "Trasmutazione" };
  var SRD_DUR = { instantaneous: "Istantanea", "until dispelled": "Fino a dissoluzione",
    "until dispelled or triggered": "Fino a dissoluzione o innesco",
    special: "Speciale", permanent: "Permanente" };
  function SCHOOL_IT(name) {
    var s = String(name == null ? "" : name);
    return SRD_SCHOOL[s.trim().toLowerCase()] || s;
  }
  function TIME_IT(v) {
    // "1 action" -> "1 azione"; "1 bonus action" -> "1 azione bonus"; "1 reaction" -> "1 reazione"
    var U = { action: "azione", "bonus action": "azione bonus", reaction: "reazione",
              minute: "minuto", minutes: "minuti", hour: "ore", hours: "ore",
              second: "secondo", seconds: "secondi", round: "round", rounds: "round" };
    return String(v == null ? "" : v).replace(/^(\d+)\s+(.+)$/, function (_m, n, u) {
      var k = String(u).trim().toLowerCase();
      return n + " " + (U[k] || u);
    });
  }
  function RANGE_IT(v) {
    // "150 feet" -> "45 m (150 ft)"; "Self" -> "Personale"; "Touch" -> "Contatto"
    var s = String(v == null ? "" : v).trim();
    var m = s.match(/^([\d.,]+)\s*feet$/i);
    if (m) return DIST(m[1]);
    if (/^self$/i.test(s)) return "Personale";
    if (/^touch$/i.test(s)) return "Contatto";
    if (/^sight$/i.test(s)) return "Vista";
    if (/^unlimited$/i.test(s)) return "Illimitata";
    return s;
  }
  function DUR_IT(v) {
    var s = String(v == null ? "" : v).trim();
    var conc = s.match(/^concentration,\s*(?:up to\s*)?(.+)$/i);
    if (conc) return "Concentrazione, fino a " + TIME_IT(conc[1]);
    if (SRD_DUR[s.toLowerCase()]) return SRD_DUR[s.toLowerCase()];
    return TIME_IT(s);
  }
  function AC_SOURCE(x) {
    var s = String(x == null ? "" : x).trim();
    var k = s.toLowerCase().replace(/\s*\(.*\)$/, "");
    if (AC_SOURCE_IT[k]) return AC_SOURCE_IT[k] + (s.length > k.length ? s.slice(k.length) : "");
    return s;
  }
  function ITEM_TYPE(raw) {
    // Il campo type degli oggetti è "CODICE|FONTE" (es. "WD|DMG"): si traduce il codice.
    if (!raw) return "oggetto";
    var code = String(raw).split("|")[0].trim().toUpperCase();
    return I18N.itemTypes[code] || String(raw).split("|")[0].replace(/-/g, " ");
  }
  function RARITY_IT(v) {
    var k = String(v == null ? "" : v).trim().toLowerCase();
    return I18N.rarity[k] || v;
  }
  function typeStr5e(t) {
    // Tipo di creatura e sottotipo dal glossario IT (dragon -> drago, goblinoid -> goblinoide)
    if (!t) return "creatura";
    var raw = (typeof t === "string") ? t : (t.type || "");
    var base = I18N.creatureTypes[String(raw).toLowerCase()] || raw || "creatura";
    var tags = (typeof t === "object" && t.tags) ? t.tags.map(function (x) {
      return I18N.creatureTags[String(x).toLowerCase()] || x;
    }) : [];
    return base + (tags.length ? " (" + tags.join(", ") + ")" : "");
  }
  function typeSub(m) {
    // 5e.tools v2.35+: size e' un ARRAY di lettere (es. ['H']) — MAI una stringa.
    const size = (Array.isArray(m.size) ? m.size.join("") : (typeof m.size === "string" ? m.size : "")).trim();
    const sizeFull = SIZE_MAP[size] || size || "taglia n/d";
    const cr = typeof m.cr === "object" ? (m.cr.cr != null ? m.cr.cr : m.cr.crRating) : m.cr;
    // UN NODO PER PARTE: la stringa unica era una chiave dinamica e non poteva stare
    // in nessun bundle, quindi ogni render passava dal motore in linea (rate-limited).
    // Con i nodi separati l'estrattore prende le singole etichette e il bundle le
    // serve a runtime senza rete. Resa visiva identica.
    return '<span>' + sizeFull + '</span> &middot; <span>' + typeStr5e(m.type) + '</span>' +
      (m.alignment ? ' &middot; <span>' + alignStr(m.alignment) + '</span>' : '') +
      (cr !== null && cr !== undefined
        ? ' &middot; <span>' + L('cr') + '</span> <span>' + esc(cr) + '</span>' : '');
  }

  function typeLine(t, e) {
    switch (t) {
      case "spell":
        return "Livello " + (e.level === 0 ? "0 (Trucchetto)" : e.level) + " &middot; " +
          schoolName(typeof e.school === "object" ? (e.school.name || e.school) : e.school) +
          (e.time ? " &middot; " + timeStr(e.time) : "") +
          (e.range ? " &middot; " + distStr(e.range) : "");
      case "item": case "baseitem": case "magicvariant":
        return ITEM_TYPE(e.type) + (e.rarity ? " &middot; Rarità: " + RARITY_IT(typeof e.rarity === "object" ? (e.rarity.name || Object.keys(e.rarity)[0]) : e.rarity) : "") +
          (e.weight ? " &middot; Peso " + WEIGHT(e.weight) : "") +
          (e.value ? " &middot; " + (typeof e.value === "object" ? e.value.addition + " " + e.value.multiplier : e.value) + " po" : "");
      case "race":
        return (e.size ? e.size.join ? e.size.join("–") : e.size : "") + (e.speed && e.speed.walk ? " &middot; " + L('speed') + " " + DIST(e.speed.walk) : "");
      case "feat":
        return (e.prerequisite && e.prerequisite[0] ? "Prerequisito: " + esc(e.prerequisite[0].text || e.prerequisite[0]) : "Talento");
      case "deity":
        return (e.pantheon ? e.pantheon : "Divinità") + (e.category ? " &middot; " + e.category : "");
      case "condition":
        return "Condizione di stato";
      default:
        return cap(t);
    }
  }

  function cap(s) { return s ? s.replace(/^./, function (c) { return c.toUpperCase(); }) : ""; }

  function statsRow(ent) {
    const keys = [["str", "FOR"], ["dex", "DES"], ["con", "COS"], ["int", "INT"], ["wis", "SAG"], ["cha", "CAR"]];
    // Nascondi il grid se NESSUNA ability score e' presente (oggetti/veicoli: rumore)
    const hasAny = keys.some(function (k) { return ent[k[0]] != null; });
    if (!hasAny) return "";
    return '<div class="st-stats">' + keys.map(function (k) {
      // ent[k[0]] (k è una coppia [chiave, label]) + modificatore D&D (floor((score-10)/2))
      const v = ent[k[0]];
      const mod = (typeof v === "number") ? Math.floor((v - 10) / 2) : null;
      const modStr = (mod !== null) ? (mod >= 0 ? "+" + mod : String(mod)) : "";
      return renderStat(v != null ? v + (modStr ? " (" + modStr + ")" : "") : "—", k[1]);
    }).join("") + '</div>';
  }

  function block(entries) {
    if (!entries || !entries.length) return "";
    const items = textOf(entries).map(function (t) { return "<li>" + t + "</li>"; }).join("");
    // I testi di 5e.tools sono in inglese: si marcano linguisticamente (lang="en")
    // per lettori di schermo e traduzione automatica del browser, con un avviso
    // esplicito. Non vengono tradotti a macchina: 13.219 entità non sono
    // verificabili a mano e una traduzione non controllata sarebbe peggio.
    // Blocco descrizione in inglese (fonte 5e.tools) + traduzione automatica su richiesta:
    // il testo tradotto va in un contenitore separato, così l'originale resta intatto
    // e alternabile. La nota dichiara che la traduzione NON è verificata.
    var mtId = "mt" + Math.random().toString(36).slice(2, 9);
    return '<div class="st-sec st-src-en" lang="en"><h4>' + L('description') + ' <span class="lang-note">' +
      L('originalText') + '</span></h4>' +
      '<div class="mt-bar"><button type="button" class="mt-btn" data-mt="' + mtId +
      '" aria-expanded="false">' + L('translateIt') + '</button>' +
      '<span class="mt-note" id="' + mtId + '-note" hidden>' + L('autoTranslation') + ' &mdash; MyMemory, non verificata</span>' +
      '</div>' +
      '<div class="mt-out" id="' + mtId + '-out" hidden></div>' +
      '<ul id="' + mtId + '-src">' + items + '</ul></div>';
  }
  
/* ICONE AZIONI (20 glifi, game-icons.net CC BY 3.0 - credito nel footer) */
var ICONE_AZIONI = {
  "activate_an_item": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M94.055 21.9L18.998 96.96l42.727 23.6-26.98 26.952L142.35 212.39c-40.443 70.148-30.72 161.07 29.2 220.958 71.605 71.606 187.737 71.587 259.356 0 71.62-71.587 71.642-187.654.037-259.22-59.915-59.878-150.896-69.57-221.084-29.177L144.95 37.415l-8.44 8.432-18.588 18.57L94.055 21.9zm47.224 45.598l62.337 103.275 8.098-5.248c44.21-28.663 99.014-34.044 147.166-16.078-1.16-.026-2.328-.04-3.503-.04-38.988 0-70.594 14.807-70.594 33.073 0 18.27 31.606 33.075 70.594 33.075 31.53 0 58.225-9.684 67.287-23.05 15.942 17.34 27.492 37.224 34.65 58.253-7.76-3.387-18.28-6.706-30.902-9.563-31.383-7.1-75.547-11.615-124.305-11.615-48.757 0-92.92 4.514-124.304 11.615-13.71 3.102-24.997 6.75-32.893 10.438 4.34-12.997 10.343-25.568 18.018-37.383l5.263-8.104-103.33-62.3 13.894-13.88 46.937 25.923 27.914-27.915-26.18-46.635 13.855-13.842zm-1.087 201.287c.482.28.982.56 1.506.84 7.89 4.22 20.41 8.487 36.103 12.037 31.383 7.1 75.547 11.615 124.304 11.615 48.758 0 92.922-4.514 124.305-11.615 15.687-3.55 28.203-7.813 36.094-12.033 1.236 5.837 2.153 11.727 2.746 17.643-9.432 4.277-21.204 7.893-35.074 11.032-33.205 7.513-78.27 12.037-128.07 12.037-49.802 0-94.866-4.524-128.07-12.037-14.67-3.32-27-7.17-36.69-11.776.625-5.952 1.57-11.876 2.845-17.745z'/>",
  "attack": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M19.75 14.438c59.538 112.29 142.51 202.35 232.28 292.718l3.626 3.75.063-.062c21.827 21.93 44.04 43.923 66.405 66.25-18.856 14.813-38.974 28.2-59.938 40.312l28.532 28.53 68.717-68.717c42.337 27.636 76.286 63.646 104.094 105.81l28.064-28.06c-42.47-27.493-79.74-60.206-106.03-103.876l68.936-68.938-28.53-28.53c-11.115 21.853-24.413 42.015-39.47 60.593-43.852-43.8-86.462-85.842-130.125-125.47-.224-.203-.432-.422-.656-.625C183.624 122.75 108.515 63.91 19.75 14.437zm471.875 0c-83.038 46.28-154.122 100.78-221.97 161.156l22.814 21.562 56.81-56.812 13.22 13.187-56.438 56.44 24.594 23.186c61.802-66.92 117.6-136.92 160.97-218.72zm-329.53 125.906l200.56 200.53c-4.36 4.443-8.84 8.793-13.405 13.032L148.875 153.53l13.22-13.186zm-76.69 113.28l-28.5 28.532 68.907 68.906c-26.29 43.673-63.53 76.414-106 103.907l28.063 28.06c27.807-42.164 61.758-78.174 104.094-105.81l68.718 68.717 28.53-28.53c-20.962-12.113-41.08-25.5-59.937-40.313 17.865-17.83 35.61-35.433 53.157-52.97l-24.843-25.655-55.47 55.467c-4.565-4.238-9.014-8.62-13.374-13.062l55.844-55.844-24.53-25.374c-18.28 17.856-36.602 36.06-55.158 54.594-15.068-18.587-28.38-38.758-39.5-60.625z'/>",
  "cast_a_spell": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M247.79 18.734C137.967 17.596 19.874 96.94 19.73 244.53l21.403-51.395c-9.485 72.28-7.75 147.236 38.79 202.502L38.2 377.355c39.24 69.774 126.333 90.976 200.855 92.51C124.11 429.9 67.87 342.277 63.912 246.492c-6.722-211.78 260.658-217.694 340.78-75.77-3.417-19.492-8.623-38.426-15.618-56.11 77.406 89.155 59.293 214.875-21.29 253.036-24.25 3.95-48.93 12.06-60.954 19-58.548 33.802-6.27 126.536 53.225 92.188 9.44-5.45 23.404-17.303 36.494-31.352 64.36-59.52 98.1-118.24 93.108-188.94-6.52 29.1-19.175 57.904-35.623 84.683 63.158-146.822 7.956-263.89-144.838-301.354 12.097 5.835 23.503 13.63 33.873 23.36-57.415-23.752-131.123-22.62-186.884 3.505 28.066-26.2 64.776-43.73 102.2-49.642-3.52-.205-7.054-.325-10.597-.362zm-19.74 160.202l-19.843 100.566c-2.958 3.81-5.64 6.852-9.033 9.94l-25.688-49.096-22.705 11.93 31.37 60.945c4.48 11.474 10.02 20.68 15.162 28.524 28.063 42.803 64.547 35.252 95.303 9.555l87.28-48.452-12.71-22.498-66.136 36.94c-1.517-3.154-3.266-6.552-5.056-9.51l67.818-64.96-17.54-18.695-66.47 63.762c-2.356-2.318-4.238-4.527-6.765-6.54l45.084-78.085-22.733-13.127-45.864 78.297c-3.79-1.31-7.72-2.2-11.595-2.745l15.656-81.896-25.533-4.854z'/>",
  "dash": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M372.97 24.938c-8.67.168-17.816 3.644-26.69 10.28-12.618 9.44-24.074 25.203-30.5 44.844-6.424 19.642-6.48 39.12-1.874 54.157 4.608 15.036 13.375 25.225 24.97 29 11.593 3.772 24.724.72 37.343-8.72 12.618-9.44 24.074-25.234 30.5-44.875 6.424-19.642 6.512-39.12 1.905-54.156-4.607-15.038-13.404-25.196-25-28.97-2.9-.944-5.88-1.465-8.938-1.563-.573-.018-1.14-.01-1.718 0zm-155.69 69.78c-21.696.024-43.394 2.203-65.093 7.094-24.91 29.824-43.848 60.255-52.875 98.47l37.376 17.812c8.273-30.735 21.485-53.817 43.375-77 22.706-7.844 45.418-6.237 68.125 1.5-74.24 65.137-51.17 120.676-80.344 226.47-42.653 17.867-85.098 20.53-123.25-.002L23 415.625c59.418 27.09 125.736 29.818 190.844 0 20.368-43.443 27.214-88.603 25-132.906C295.31 354.663 323.11 398.2 338.78 498.56h57.94c-3.12-14.706-6.21-28.394-9.345-41.218-22.522-92.133-47.263-139.63-100.22-198.406 9.695-36.13 22.143-59.665 52.44-74.282 11.167 19.767 29.982 36.682 51.092 48.906l97.375 1.563.47-41.03L402 191.968c-8.05-5.556-14.925-11.73-20.75-18.314-14.886 9.08-32.024 12.563-48.156 7.313-18.422-5.997-31.143-21.962-37.063-41.282-3.482-11.37-4.742-24.05-3.686-37.25-25.017-4.884-50.047-7.746-75.063-7.72z'/>",
  "disengage": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M135.6 38.35l-17 6.17c6.2 16.99 9.1 34.17 2.3 51.32 4.5 4.76 8.9 9.46 13.3 14.06 12.5-24.41 9.2-50.15 1.4-71.55zm-25.8 71.95c-6.8 2.6-12.82 5.9-18.27 9.7 27.17 29.8 50.17 61.6 63.77 92.1 12.7 28.7 17.4 57.3 7.2 81.1l219.8 158.9c27.5-1.4 45.3-8.1 57.5-17.5 12.8-9.8 20.1-22.9 25.4-38.4-2.9-3.2-6.1-6.3-9.6-9.4-25.7 4.5-48.2-.6-66.9-12.4-19.5-12.2-34.8-31.1-47.8-53-24.5-41.3-41-94-57.7-137.5-44.5 4.5-77.1-1.7-102.7-14.2-30.6-15-50.7-38.1-70.7-59.4zm-31.92 21.5c-4.57 4.9-8.65 10.3-12.34 16.1-10.56 16.7-17.8 37-23.99 57.9l105.85 76.5c5.7-17.1 2.3-38.5-8.6-62.9-12.5-27.9-34.6-58.6-60.92-87.6zm238.92 47c-5.2 1-10.2 1.9-15.2 2.7 3.7 9.7 7.4 19.7 11.1 29.8l26 13.1c-6.9-16.1-13.7-31.5-21.9-45.6zm-285.29 42c-2.72 2.9-4.48 5.9-5.39 9-1.23 4-1.07 8.4 1.01 13.8L266 398c21.8 14 41.4 25.6 59.2 35.1zm290.29 15.3c6.9 18.3 14.2 36.4 22.3 53.1l33.2 14.7c-11.2-18.1-19.8-36.1-27.5-53.7zm36.2 78.8c11.7 19.2 25 34.7 40.3 44.3 11 6.9 22.9 10.9 36.8 11.3-14.8-12.4-27.1-25.2-37.6-38.2zm119.8 98.4c-5.9 13.3-14.2 25.8-27 35.6-11.4 8.7-26 15.2-44.7 18.6 17.5 4.9 31.2 6.5 41.6 6.1 14.9-.6 23.4-4.7 28.6-8.8 5.2-4.1 7.2-8.2 8.1-10.2 3.5-7.8 3.2-19.9-2.5-33.3-1.1-2.6-2.5-5.3-4.1-8z'/>",
  "dodge": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M196.5 18.95c-20.1.1-40.9 4.3-61.3 12.3 6 18.3 23 69.15 23 69.15l-17.7 6s-15.7-47.05-22.4-67.45c-17.9 9.3-35.34 21.7-50.94 37.3-16 16.1-28.9 34.15-38.3 52.85 21.8 7.2 66.6 22.3 66.6 22.3l-6 17.8s-48-16.2-68.3-22.9c-14.002 36.2-15.902 74-5 105.9 12.7-12.7 32.7-19.5 56.4-20.7l65.84 65.9 13.2-13.2-51.64-51.8c49.24 5.6 107.44 30.9 150.64 74.1l45.9-45.8c-42.4-42.4-66.8-101.3-72.5-150.9l51 51 13.2-13.2-65.3-65.35c.9-24.2 7.3-44.2 19.2-56.1-14.3-4.9-29.7-7.3-45.6-7.2zM318.3 154.9c-2.7 0-5.4.3-8 .9 2.7 1.8 5.4 3.9 7.8 6.3 12.1 12.1 15.9 28 8.4 35.5s-23.5 3.7-35.6-8.4c-2.4-2.4-4.5-5-6.2-7.7-.6 2.6-.9 5.2-.9 7.9 0 19 15.4 34.4 34.5 34.4 5.6 0 10.9-1.3 15.5-3.7l16.3 16.3 13.2-13.2-15.7-15.7c3.3-5.3 5.2-11.5 5.2-18.1 0-19.1-15.4-34.5-34.5-34.5zm-95.4 42c66.2 66.2 32 100.5-34.2 34.3zm153.6 39.5l-13.2 13.2 30.7 30.7 13.2-13.3zm43.9 43.9l-13.2 13.2 29.2 29.2 13.2-13.2zm-240 11.5c-2.7 0-5.4.3-7.9.9 2.6 1.7 5.2 3.9 7.7 6.3 12.1 12.1 15.8 28 8.3 35.5-7.4 7.4-23.3 3.7-35.4-8.4-2.4-2.5-4.5-5.1-6.3-7.7-.6 2.5-.9 5.1-.9 7.8 0 19.1 15.5 34.5 34.5 34.5 6.6 0 12.8-1.9 18-5.1l16.2 16.2 13.2-13.2-16.7-16.7c2.4-4.7 3.8-10 3.8-15.7 0-19-15.5-34.4-34.5-34.4zm282.5 30.9L449.6 336l34.5 34.4V344zM241 371.8L227.8 385l30.7 30.6 13.2-13.1zm43.9 43.8l-13.2 13.3 29.3 29.2 13.1-13.2zm42.6 42.5l-13.3 13.2 21.8 21.8h26.4z'/>",
  "escape": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M208.7 22.36l22.4 77.23c8.9-1.66 18.1-2.49 27.6-2.49 8.5 0 16.8.68 24.9 2.02l22.2-76.76zm103.1 46.26l-10 34.78c15.2 4.8 29.1 12.3 40.8 22.7l25.5-23.8c-16-14.79-35.1-26.35-56.3-33.68zm-108.9.86c-21 7.67-39.9 19.61-55.6 34.72l25.5 23.8c.1-.1.2-.3.4-.4 11.4-10.6 24.9-18.3 39.8-23.4zM97.56 83.35L59.71 139l86.09 30.1c3.7-10 8.6-19.1 14.5-27.1zm318.24 0l-60.3 56.35c6.4 8.2 11.7 17.6 15.7 28.1l82.4-28.8zM268 116v317.5h93.4V218.6c0-35.3-11.5-60.4-29.8-77.3-16.2-15-38.3-23.6-63.6-25.3zm-18.6 0c-25.2 1.7-47.3 10.3-63.6 25.3-18.2 16.8-29.7 42-29.7 77.3v214.9h93.3zm163 57.3l-35.8 12.5c2.2 10.2 3.4 21.1 3.4 32.8v9.3h38.9v-9.3c0-15.8-2.3-31-6.5-45.3zM105 174.7c-3.9 13.9-6.05 28.6-6.05 43.9v9.3h38.55v-9.3c0-11.2 1.1-21.7 3.1-31.4zm-39.3 71.8v56.2h71.8v-56.2zm314.3 0v56.2h66v-56.2zM98.95 321.3v37.5h38.55v-37.5zm281.05 0v37.5h38.9v-37.5zM56.16 377.4v56.1h81.34v-56.1zm323.84 0v56.1h75.8v-56.1zm-233.3 74.7l-39.6 37.5h297.4l-33-37.5z'/>",
  "grapple": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M257.08 11.29l-9.232 1.437-62.868 9.765 3.586 23.08C175.62 49.84 163.09 55.3 151.15 61.875l-14.51-18.03-7.28 5.86-49.56 39.89 14.163 17.594C84.847 117.31 76.6 128.367 69.39 140.3l-20.78-8.046-3.374 8.715-22.976 59.325 20.26 7.846c-2.96 13.812-4.544 27.692-4.805 41.47l-21.02 3.267 11.2 72.1 20.634-3.206c4.347 13.326 9.955 26.213 16.74 38.474l-16.165 13.012 45.75 56.84 15.858-12.764c10.425 9.35 21.846 17.776 34.183 25.104l-7.27 18.773 68.042 26.347 7.266-18.76c14.02 2.89 28.103 4.36 42.074 4.482l3.115 20.05 72.1-11.2-3.168-20.386c13.326-4.498 26.2-10.26 38.433-17.205l13.075 16.24 56.84-45.747-13.315-16.543c9.093-10.365 17.275-21.698 24.394-33.906l20.11 7.787 26.35-68.038-20.63-7.988c2.71-13.685 4.057-27.422 4.133-41.05l22.29-3.462-1.434-9.234-9.765-62.866-22.85 3.55c-4.413-12.947-10.017-25.466-16.746-37.378l18.103-14.57-5.86-7.28-39.89-49.56-18.28 14.715c-10.058-8.863-21.032-16.864-32.835-23.868l8.562-22.112-8.713-3.375L309.7 16.88 301.136 39c-13.31-2.74-26.68-4.21-39.95-4.45-.166-.004-.33-.002-.494-.005l-3.61-23.252zm-15.598 21.337l3.108 20.008-35.164 5.463-3.11-20.006 35.166-5.465zm78.897 8.43l33.184 12.85-7.312 18.882-33.184-12.853 7.31-18.88zM263.6 53.27c10.2.34 20.456 1.458 30.687 3.406l-5.4 13.94 68.042 26.35 5.402-13.952c8.848 5.43 17.16 11.487 24.91 18.08l-11.842 9.53 45.75 56.84 12.098-9.735c4.986 9.14 9.272 18.65 12.787 28.45l-15.443 2.398 11.2 72.1 15.98-2.483c-.226 10.394-1.278 20.852-3.174 31.29l-15.395-5.964-3.373 8.714-22.977 59.327 15.975 6.188c-5.567 9.24-11.81 17.91-18.633 25.97l-10.926-13.575-7.278 5.86-49.56 39.89 11.24 13.964c-9.47 5.195-19.338 9.627-29.514 13.24l-2.78-17.908-9.235 1.433-62.866 9.766 2.828 18.202c-10.74-.272-21.548-1.413-32.328-3.47l6.7-17.3-8.713-3.375-59.327-22.974-6.695 17.29c-9.38-5.763-18.16-12.224-26.3-19.286l14.302-11.512-5.86-7.28-39.888-49.56-14.02 11.285c-5.058-9.483-9.343-19.362-12.826-29.53l17.688-2.75-1.436-9.232-9.765-62.867-17.182 2.67c.385-10.546 1.607-21.15 3.715-31.723l15.826 6.128 26.35-68.04-15.258-5.91c5.624-8.986 11.9-17.41 18.726-25.24l10.118 12.57 56.84-45.75-9.778-12.147c9.155-4.854 18.672-8.996 28.465-12.387l2.366 15.234 72.1-11.202-2.324-14.96zM133.8 70.124l12.694 15.772-27.723 22.312-12.694-15.77L133.8 70.122zm283.653 30.648l22.313 27.722-15.774 12.696-22.312-27.72 15.773-12.697zm-84.244 42c-1.918-.015-3.84.045-5.76.187-23.033 1.7-45.933 15.003-61.29 44.006l-7.906 14.933-8.445-14.636c-20.227-35.054-56.5-47.824-87.093-41.81-30.592 6.012-55.328 29.383-53.947 72.85 1.278 40.24 29.05 67.447 63.59 97.54 30.045 26.176 64.672 53.784 85.763 93.478 22.093-39.507 57.856-65.95 88.133-91.453 17.386-14.644 33.017-28.982 43.86-44.736 10.846-15.755 17.13-32.66 16.456-54.243-1.262-40.46-26.58-66.478-56.316-73.916-5.576-1.394-11.296-2.148-17.047-2.2zM59.286 156.433l18.88 7.31-12.85 33.186-18.88-7.31 12.85-33.186zm412.65 44.636l5.463 35.164-20.01 3.11-5.462-35.164 20.01-3.11zm-413.9 64.3l5.465 35.165-20.006 3.108-5.465-35.163 20.007-3.11zm391.846 42.33l18.88 7.312-12.85 33.185-18.88-7.312 12.85-33.186zM91.156 363.4l22.313 27.723-15.775 12.695-22.312-27.722L91.156 363.4zm305.274 33.02l12.695 15.77-27.723 22.316-12.695-15.774 27.723-22.312zm-227.315 35.23l33.186 12.852-7.31 18.88-33.185-12.85 7.31-18.882zm136.662 14.873l3.11 20.01-35.164 5.463-3.11-20.008 35.164-5.465z'/>",
  "help": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M256 21.98c-64 48-128 68-224.03 100.02C31.97 234 112 394 256 490c144-96 224-250 224-362-96-32.02-160-58.02-224-106.02zM229 128h54v101h101v54H283v101h-54V283H128v-54h101V128z'/>",
  "hide": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M257.375 32.03C139.957 87.197 42.343 247.886 17.5 367.75c71.742 0 124.22 22.845 162.094 63.03l10.47-11.436c-28.06-28.873-64.935-52.446-113.564-75.906 26.142-65.033 66.028-163.458 116.72-169.188 19.835-2.243 41.05 9.735 64.155 43.438 72.33-120.27 141.014 38.54 180.875 125.75-47.687 25.854-84.5 49.463-112.97 78.718l9.25 10.406c37.335-39.758 89.657-64.812 162.72-64.812C467.784 249.384 377.24 90.37 257.375 32.03zm-79.72 243.314c-15.3-.083-26.405 6.436-26.405 16.656 0 12.58 16.834 26.038 37.594 30.063 20.76 4.024 37.594-2.92 37.594-15.5s-16.835-26.038-37.594-30.063c-3.893-.755-7.657-1.137-11.188-1.156zm156.345 0c-3.53.02-7.295.4-11.188 1.156-20.76 4.025-37.593 17.483-37.593 30.063 0 12.58 16.833 19.524 37.592 15.5 20.76-4.025 37.594-17.484 37.594-30.063 0-10.22-11.105-16.74-26.406-16.656z'/>",
  "improvise": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M256.016 17.172c-103.018 0-188.532 105.858-188.532 238.812 0 55.877 15.122 106.973 40.282 147.438 96.796 34.218 203.558 38.207 295.187 2.062 25.932-40.785 41.563-92.667 41.563-149.5 0-132.953-85.483-238.81-188.498-238.812zm1.752 18.75c80.747 0 146.03 65.252 146.03 146s-65.283 146.03-146.03 146.03c-80.75 0-146-65.282-146-146.03s65.25-146 146-146zm.484 25.562c-42.402 0-76.92 28.05-76.92 70.264 0 23.897 8.254 35.09 17.447 49.672 6.13 9.725 12.446 20.9 15.988 36.953h86.46c3.524-16.437 9.903-27.82 16.086-37.64 9.207-14.622 17.448-25.615 17.448-48.983 0-42.242-34.107-70.264-76.51-70.264zm-40.87 176.555v30.368h81.33v-30.37zm11.18 48.976v18h58.97v-18zm-57.36 47.218c18.365 0 33.157 14.84 33.157 33.5s-14.793 33.532-33.157 33.532c-18.364 0-33.125-14.872-33.125-33.532 0-18.66 14.76-33.5 33.123-33.5zm165.292.307c18.26 0 33.06 14.803 33.06 33.062 0 18.26-14.8 33.062-33.06 33.062s-33.06-14.803-33.06-33.062c0-18.26 14.8-33.06 33.06-33.06zm-208.447 96.694c11.517 13.484 24.36 25.148 38.22 34.688l-7.095-26.375c-10.68-2.355-21.077-5.124-31.125-8.313zm254.594 1.532a361.784 361.784 0 0 1-27.406 7.062l-6.437 23.97c12.174-8.753 23.526-19.176 33.844-31.03zm-203.03 10.75l9.593 35.78c11.34 5.466 23.184 9.572 35.406 12.188l-5.063-43.125c-13.51-1.05-26.868-2.657-39.936-4.844zm155.22.216l-.002.002a450.38 450.38 0 0 1-30.935 3.97l-4.815 40.812c9.134-2.722 18.01-6.314 26.596-10.66zm-49.91 5.346c-16.24.828-31.392.948-46.467.375l5.313 44.846c4.052.332 8.135.528 12.25.528a149.5 149.5 0 0 0 23.718-1.904z'/>",
  "influence": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M18 18v207.053c19.25 18.903 53.07 37.274 84.973 47.933 28.11 9.392 46.653 12.82 66.886 5.338 15.865-5.866 34.172-10.222 46.44-18.12 12.266-7.896 19.334-16.98 15.82-39.366l-.036-.233-.023-.234c-.327-3.16-.745-6.478-1.208-9.866-.18.048-.353.1-.536.146-10.828 2.783-26.286 4.28-45.757.356-1.35.83-2.715 1.64-4.107 2.41l-7.877 4.355-8.71-15.75 7.874-4.356c19.52-10.796 36.083-31.545 46.055-47.434-.362-1.25-.745-2.51-1.12-3.765-12.854 8.896-31.028 13.176-52.173 4.945l-8.387-3.265 6.53-16.774 8.386 3.265c19.01 7.4 29.868 2.503 39.136-5.938 7.444-6.78 12.796-16.308 16.33-23.72C200.162 74.25 174.97 45.817 150.072 18zm184.098 0c9.883 14.11 23.515 29.61 39.943 44.97 2.322-.828 4.714-1.657 7.226-2.462 12.116-3.887 25.88-7.772 38.888-7.238 4.336.177 8.587.846 12.664 2.17l8.56 2.78-5.556 17.118-8.56-2.777c-7.706-2.5-25.637.32-40.498 5.086-8.86 2.842-16.452 5.906-21.157 7.924 3.427 3.978 6.868 7.985 10.336 12.045l3.65 4.27-2.234 5.154c-1.224 2.822-2.9 6.616-5.104 10.833 10.92 13.352 26.323 27.074 37.03 34.844 17.4 12.628 42.365 27.795 61.884 31.898 9.76 2.052 17.528 1.385 23.1-1.996 5.572-3.382 10.426-9.972 12.86-24.143l1.524-8.872 17.74 3.05-1.525 8.868c-.04.223-.086.436-.126.657 31.894 13.803 62.577 22.355 87.45 22.82 4.85.09 9.452-.125 13.806-.633V106.63c-8.336 6.688-18.94 14.612-32.676 24.112l-10.24-14.803C472.05 101.436 485.12 90.98 494 82.956V18zm-140.23 1.408c11.063.573 118.618 57.055 88.53 46.65-1.587-.548-9.626-1.652-20.597-2.624 2.99 5.485 4.843 11.576 5.403 17.86.696 7.81-.678 14.718-4.043 19.93-3.365 5.21-9.344 8.953-17.078 7.756-7.734-1.196-14.553-6.918-18.953-13.33-4.4-6.41-7.063-13.943-7.76-21.752-.393-4.423-.122-8.556.798-12.255-22.742.214-43.964 2.89-48.23 11.275L61.11 19.53c.148-.1.404-.14.76-.122zm48.243 45.004c-.487-.075-1.508.018-2.813 2.04-1.305 2.02-2.272 5.74-1.87 10.237.4 4.497 2.065 8.626 3.772 11.113 1.706 2.487 2.772 2.905 3.26 2.98.49.076 1.512-.02 2.817-2.04 1.305-2.022 2.272-5.74 1.87-10.24-.4-4.497-2.065-8.623-3.772-11.11-1.707-2.487-2.775-2.905-3.264-2.98zm189.033 24.102c.576.01 1.155.03 1.736.064 18.6 1.05 37.856 12.446 57.638 33.215l-13.036 12.414c-17.96-18.858-33.937-27-45.617-27.658-11.68-.66-20.613 4.674-28.44 18.493l-15.66-8.87c9.8-17.305 25.495-27.965 43.378-27.66zm-75.247 84.984c-5.424 7.34-11.826 14.886-19.17 21.854 8.736.288 15.768-.762 21.112-2.135.762-.196 1.43-.396 2.115-.596-1.153-6.153-2.514-12.555-4.057-19.122zm163.516 6.063c-2.47 5.277-5.564 9.725-9.225 13.303 31.756 24.712 60.36 54.72 77.924 91.237l.894 1.857c30.018 39.74 39.6 93.688 31.875 140.422l-.427 2.585-1.75 1.95c-27.812 31.048-73.822 47.28-115.084 53.597-20.632 3.157-40.1 3.763-55.972 1.95-15.872-1.815-28.883-4.708-35.914-15.536l-1.035-1.594-.302-1.875c-1.843-11.445-2.61-22.47-3.927-33.252-17.095 19.167-29.632 38.814-36.216 59.795H494V202.477c-4.6.443-9.322.61-14.143.52-28.046-.525-59.884-9.43-92.445-23.436zM18 248.92v50.342c9.123 6.8 33.478 24.938 62.78 46.496 17.705 13.026 35.537 26.052 49.144 35.785 6.146 4.396 11.06 7.835 15.04 10.557.42-1.207.71-1.858 1.173-3.27 2.58-7.876 5.727-18.634 8.748-29.394 4.688-16.703 8.28-30.408 10.013-37.067-1.166-7.074-1.57-14.938-1.146-23.665-21.102 4.21-42.043-.48-66.484-8.646-28.234-9.435-57.335-23.897-79.268-41.14zm408.607 31.94c-.558-.018-1.087-.027-1.503.005-4.856.37-6.203 2.073-8.16 4.252-1.303 1.453-2.563 3.47-4.815 5.963-2.253 2.492-6.56 5.677-11.724 5.91-4.653.21-8.815-1.813-11.35-3.65-2.534-1.837-4.092-3.443-5.46-4.496-2.736-2.106-3.71-3.362-11.24-1.64-3.17.724-3.98 2.038-5.827 5.558-.923 1.76-1.817 3.907-3.128 6.324-1.31 2.417-3.092 5.53-7.095 7.713-2.902 1.58-5.935 1.408-7.737 1.026-1.8-.38-2.926-.905-3.955-1.365-2.057-.92-3.683-1.764-5.547-2.413-3.728-1.3-7.94-2.22-15.793.848-6.544 2.557-6.794 4.043-7.48 5.79-.343.874-.54 1.99-1.217 4.106-.677 2.117-2.908 6.577-7.324 8.29-3.775 1.464-7.653 1.175-10.342.604-2.69-.572-4.63-1.286-6.558-1.766-3.856-.96-7.658-1.625-15.57.95-4.61 1.5-9.89 8.046-12.335 16.86-2.4 8.648-1.578 18.425 1.157 23.342 30.118 34.035 28.01 69.583 32.198 98.74 2.26 1.604 9.918 5.4 21.886 6.766 5.613.642 11.98.935 18.855.864 1.086-34.234-7.61-76.94-20.19-104.827l16.405-7.404c13.87 30.74 22.888 73.896 21.845 111.273 4.66-.436 9.442-1.022 14.29-1.764 9.362-1.434 18.96-3.473 28.46-6.107-6.532-36.43-12.015-75.947-31.57-109.668l15.57-9.03c21.366 36.845 27.08 77.85 33.293 113.18 8.396-3.052 16.54-6.588 24.184-10.607-1.915-42.748-7.087-79.433-24.318-106.14l15.125-9.76c18.78 29.108 24.406 65.356 26.676 105.17 5.61-4.036 10.723-8.41 15.184-13.115 7.132-48.38-6.747-105.394-43.217-139.723-.53-.01-1.117-.04-1.676-.06zM18 321.7V494h201.545c7.798-28.846 25.177-54.816 48.295-79.12l-64.578-39.228-.065-.04c-9.837-6.207-19.81-13.738-27.28-24.73-1.19 4.364-2.42 8.847-3.702 13.42-3.056 10.885-6.236 21.773-8.973 30.132-1.368 4.18-2.605 7.693-3.787 10.5-.59 1.403-1.124 2.597-1.935 3.93-.406.668-.84 1.376-1.8 2.355-.963.978-2.718 2.94-6.853 2.94-2.477 0-2.973-.462-3.56-.69-.588-.23-.965-.42-1.33-.607-.73-.376-1.366-.752-2.098-1.2-1.464-.898-3.24-2.067-5.405-3.534-4.33-2.936-10.154-7.034-17.022-11.946-13.735-9.825-31.6-22.878-49.34-35.928C49.467 345.066 31.506 331.74 18 321.7z'/>",
  "magic": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M254.563 20.75c-42.96 0-85.918 16.387-118.688 49.156-65.54 65.54-65.852 172.15-.313 237.688 65.54 65.54 172.15 65.226 237.688-.313 65.54-65.538 65.54-171.835 0-237.374-32.77-32.77-75.728-49.156-118.688-49.156zm-.157 18.47c25.68.053 51.363 6.724 74.313 19.968-13.573-3.984-26.266-2.455-34.22 5.5-14.437 14.437-7.796 44.485 14.813 67.093 22.608 22.61 52.625 29.22 67.062 14.782 8.523-8.522 9.706-22.468 4.594-37.125 36.352 57.684 29.586 134.6-20.69 184.875-29.158 29.16-67.353 43.773-105.56 43.813 9.436-2.3 17.762-6.732 24.436-13.406 28.885-28.886 15.64-88.954-29.594-134.19-45.234-45.233-105.302-58.51-134.187-29.624-4.052 4.052-7.266 8.723-9.688 13.875 3.092-33.537 17.473-66.222 43.157-91.905 29.198-29.2 67.384-43.737 105.562-43.656zM386.97 319.28c-.205.206-.39.422-.595.626-72.78 72.78-191.252 73.155-264.03.375-.278-.275-.54-.565-.814-.842-11.987 9.483-18.81 20.384-18.81 32 0 36.523 67.315 66.125 151.343 66.125 84.027 0 152.093-29.6 152.093-66.125 0-11.68-6.97-22.637-19.187-32.157zm39.717 54.564c-22.225 32.29-91.192 55.906-172.625 55.906-81.172 0-149.954-23.46-172.406-55.594-12.638 11.3-19.72 24.052-19.72 37.563.002 46.928 85.546 85.03 192.064 85.03 106.518 0 192.97-38.1 192.97-85.03 0-13.637-7.313-26.498-20.283-37.876z'/>",
  "magic_action": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M365.47 18.727c-11.353-.18-21.053 7.365-24.786 20.058h-.002c-24.423-7.6-57.52-4.092-68.328 19.856-15.69-20.86-47.866-13.98-55.194 9.85-7.328 23.828 13.462 49.474 44.68 48.55-3.078 33.98 44.304 54.69 81.764 39.132-.473 19.307 8.312 41.853 30.37 44.97-6.395 18.11 3.104 42.047 28.614 42.047 31.47 0 38.024-36.316 21.025-53.145 9.474-10.39 12.832-25.167 11.096-39.13 17.282 12.104 34.59-6.52 33.767-20.08-1.516-24.97-20.366-35.97-33.768-24.3-8.8-27.616-37.243-32.007-52.562-16.353 1.35-7.425.2-13.105-5.255-19.274 22.605-5.702 18.913-37.698 4.68-46.904-5.44-3.517-10.942-5.195-16.102-5.277zm68.37 5.13c-22.7 0-22.882 34.655 0 34.655s22.7-34.655 0-34.655zM177.672 74.842c-22.7 0-22.882 34.654 0 34.654s22.7-34.654 0-34.654zm64.695 59.38c-1.695.06-3.792.895-5.877 2.887-4.765 4.554-8.11 13.804-1.814 24.216 1.365 2.257 2.837 4.486 4.408 6.672l-14.21 26.414-34.43 59.637-153.62 87.682-.008.006c-11.038 6.375-16.508 14.786-17.537 24.037-1.03 9.254 2.46 20.22 13.083 31.508 45.295 48.134 101.19 77.71 164.907 95.106 15.645 4.267 26.47 2.614 33.156-2.1 6.686-4.712 11.047-13.382 11.047-28.413v-.006l.214-177.61 38.008-65.832c-14.036-3.907-26.16-10.638-36.332-18.932l8.967-16.67c13.568 12.152 31.753 20.64 55.14 20.645 11.536-.03 18.363-7.457 20.046-13.542.84-3.044.414-5.247-.604-6.73-1.018-1.48-3.004-3.204-8.754-3.66-31.006-2.452-53.782-15.764-68.293-39.714-2.816-4.65-5-5.413-6.797-5.584-.224-.02-.46-.028-.7-.02zm234.053 39.305c-22.7 0-22.882 34.655 0 34.655s22.7-34.655 0-34.655zm-44.668 86.022c-35.27 0-35.553 53.837 0 53.837s35.27-53.838 0-53.838zm-235.256 8.337l9.367 16.172-136.506 79.06-.005.003c-4 2.31-4.756 3.894-5.043 5.127-.29 1.233-.127 3.423 1.852 7.027.543.988 1.228 2.044 2.024 3.15l-.416-.193c18.068 27.077 54.2 61.967 89.34 80.934-23.56-10.45-50.91-25.15-72.737-40.756C69.11 407.5 56.51 396.524 49.78 384.272c-3.363-6.124-5.332-13.14-3.673-20.262 1.66-7.123 6.93-13.046 13.9-17.07l136.49-79.053zm-88.068 88.87c18.55 6.4 52.894 25.26 80.154 46.013 13.63 10.375 25.305 20.885 32.086 31.998 3.022 4.952 5.264 10.303 5.2 16.203l-20.626-9.488c-9.495-11.61-23.806-22.776-35.75-29.517-24.435-17.28-54.436-33.15-67.16-37.54l6.096-17.667z'/>",
  "ready": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M92.656 19.188v41.5h331.72v-41.5H92.655zM119.5 79.374V433.53h22.28V79.376H119.5zm46.594 0c3.212 43.324 13.312 82.022 27.78 110.906 17.685 35.304 40.845 54.75 64.064 54.75 23.218 0 46.346-19.446 64.03-54.75 14.47-28.883 24.57-67.58 27.782-110.905H166.094zm209.156 0V433.53h22.28V79.376h-22.28zm-117.313 185.22c-23.218 0-46.378 19.415-64.062 54.717-14.835 29.614-25.098 69.562-28.03 114.22H350c-2.933-44.658-13.197-84.606-28.03-114.22-17.686-35.302-40.814-54.718-64.033-54.718zM92.657 452.218v41.467h331.718V452.22H92.655z'/>",
  "search": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M333.78 20.188c-39.97 0-79.96 15.212-110.405 45.656-58.667 58.667-60.796 152.72-6.406 213.97l-15.782 15.748 13.25 13.25 15.75-15.78c61.248 54.39 155.3 52.26 213.968-6.407 60.887-60.886 60.888-159.894 0-220.78C413.713 35.4 373.753 20.187 333.78 20.187zm0 18.562c35.15 0 70.285 13.44 97.158 40.313 53.745 53.745 53.744 140.6 0 194.343-51.526 51.526-133.46 53.643-187.5 6.375l.218-.217c-2.35-2.05-4.668-4.17-6.906-6.407-2.207-2.206-4.288-4.496-6.313-6.812l-.218.22c-47.27-54.04-45.152-135.976 6.374-187.502C263.467 52.19 298.63 38.75 333.78 38.75zm0 18.813c-30.31 0-60.63 11.6-83.81 34.78-46.362 46.362-46.362 121.234 0 167.594 10.14 10.142 21.632 18.077 33.905 23.782-24.91-19.087-40.97-49.133-40.97-82.94 0-15.323 3.292-29.888 9.22-43-4.165 20.485.44 40.88 14.47 54.907 24.583 24.585 68.744 20.318 98.624-9.562 29.88-29.88 34.146-74.04 9.56-98.625-2.375-2.376-4.943-4.473-7.655-6.313 45.13 8.648 79.954 46.345 84.25 92.876 4.44-35.07-6.82-71.726-33.813-98.72-23.18-23.18-53.47-34.78-83.78-34.78zM176.907 297.688L42.094 432.5l34.562 34.563L211.47 332.25l-34.564-34.563zM40 456.813L24 472.78 37.22 486l15.968-16L40 456.812z'/>",
  "shove": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M224 27.027l14.037 110.54 14.807-103.032L224 27.027zm112.71 21.127l-61.58 92.37 88.4-70.518-26.82-21.852zM125.15 69.012V98.81l77.475 41.715-77.475-71.513zM319 143.088C364.826 255.36 348.206 384 319 493h174V143.088H319zm-78.598 11.463c-.567-.006-1.14 0-1.718.02-12.517.413-26.47 6.774-37.893 17.274-15.774 14.527-23.843 34.25-20.167 49.3-45 12.35-76.594 62.683-81.64 102.18-3.968 37.166 15.322 61.415.558 85.432L40.77 447.54l-20.458 9.997L55.33 496.19h15.686l-17.27-32.17 72.906-38.573c14.698-8.6 16.065-23.74 19.28-41.092 16.147 11.876 33.577 23.202 47.56 32.48-6.36 27.685-38.544 52.854-58.512 79.356h77.827l-2.905-5.21s-39.03-6.813-43.77-7.498c-.15.01-.29.005-.407-.02-.327-.076-.082-.05.408.02 8.143-.477 65.126-51.946 63.53-64.54-13.498-23.115-34.03-44.835-54.974-66.276 1.845-25.475 2.3-52.734 40.75-75.596l110.044-4.566c-.94-22.375-4.53-59.816-10.35-66.018-9.702 7.54-10.872 30.843-11.628 48.637l-79.463-2.283c-8.445-.63-14.943-7.846-21.15-12.822 13.6 1.556 30.02-4.91 43.218-17.024 20.673-19.002 27.286-45.857 14.77-59.982-4.795-5.412-11.97-8.365-20.478-8.46z'/>",
  "study": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M102.53 26.063l90 345.75 289.22 23.25-90.03-345.72-289.19-23.28zm-18.968 1.406c-30.44 11.894-55.62 53.07-49.687 75.28l3.25 11.813c.654-1.722 1.345-3.44 2.063-5.157C49.102 85.688 65.734 62.636 89.56 50.5l-6-23.03zM94.44 69.187c-16.66 10.016-29.916 28.1-38 47.437-5.2 12.44-8 25.417-8.75 36.25v.03L112.56 388.5c.305-.572.593-1.148.907-1.72 10.585-19.223 27.804-37.623 51.06-48.405L94.438 69.187zM154 107.968l239.78 16.188-1.28 18.625-239.75-16.155L154 107.97zm46.03 34.407l5.657 8.875 14.188 22.313 39.03-15.25 7.595-2.938 3.97 7.094 16.28 29.124 4.313 7.72-7.438 4.717c-10.267 6.524-17.392 12.284-21.75 16.782-3.03 3.13-4.247 5.232-4.906 6.594 1.38.303 3.433.577 6.624.28 18.268-1.69 56.285-19.964 79-61.592l5.47-10.03 8.748 7.374 46 38.812 11.532 9.72-13.844 6-33.28 14.374c5.447 4.925 11.436 5.916 18.436 5.406 9.95-.724 21.427-6.07 29.125-11.063l10.158 15.657c-9.41 6.1-22.867 12.934-37.938 14.03-15.07 1.098-32.27-5.296-42.594-23.155l-5.25-9.095 9.625-4.156 30.44-13.157-26.033-22c-25.716 40.294-62.68 59.168-87.843 61.5-6.78.628-12.945.26-18.594-2.688-5.65-2.95-9.984-10.6-9-17.406.984-6.806 4.838-12.4 10.688-18.44 4.385-4.526 10.612-9.367 17.875-14.436l-8.188-14.656L219.5 193.75l-7.156 2.78-4.125-6.468L196 170.875c-6.308 7.158-9.485 14.528-9 21.406.654 9.28 7.854 21.054 30.594 33.69l-9.094 16.343c-25.688-14.273-38.877-31.016-40.125-48.72-1.248-17.703 9.393-33.013 23.5-44.562l8.156-6.655zm-5.968 118.188l239.782 16.156-1.25 18.655-239.78-16.188 1.25-18.625zm-24.75 96.25c-17.637 9.072-31.065 23.708-39.468 38.968-4.49 8.153-7.307 16.452-8.72 23.876l11.626 42.156 1.688.157c-3.824-27.514 11.358-60.383 41.187-80.97l-6.313-24.188zm26.22 34c-32.403 17.28-46.273 52.303-41.657 72.78l289.78 24.532c-5.298-7.743-8.625-17.827-8.592-28.313l-22.47-9.03 46.626-7.313-13.69-13.064c5.552-6.838 13.54-12.915 24.47-17.53l-274.47-22.063z'/>",
  "utilize": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M235.344 31.188c-35.92.543-70.472 6.628-102.97 18l5.72 17.468c30.61-10.843 63.185-16.653 97.187-17.156l.064-18.313zm18.687.187l-.06 18.375c46.9 1.963 96.236 13.842 146.56 36.47l9.376-16.25C356.84 45.9 304.253 33.282 254.03 31.374zm-139.093 24.5c-20.133 8.42-39.376 18.953-57.562 31.5l8.813 16.53c17.207-12.117 35.41-22.284 54.468-30.436l-5.72-17.595zm312.97 20.25l-61.5 106.53 55.124 31.814 61.5-106.532-55.124-31.813zm-174.063 6.313l-.03 18.406c39.736 1.29 80.36 11.3 120.342 31.062l9.375-16.22c-42.846-21.33-86.708-32.012-129.686-33.25zm-18.688.062c-29.644 1.034-58.722 6.555-86.625 16.156l5.72 17.53c26.066-9.063 53.198-14.28 80.875-15.28l.03-18.406zM42.126 98.53c-8.205 6.396-16.177 13.24-23.876 20.5l9.97 16.345c7.376-7.136 15.013-13.842 22.874-20.125l-8.938-16.72h-.03zm88.905 6.72c-17.292 7.142-34.04 15.886-50.124 26.125l8.813 16.5c15.13-9.78 30.847-18.16 47.06-25l-5.75-17.625zm122.626 35.28l-.062 18.44c30.17 1.18 61.405 7.815 93.156 20.405l9.438-16.344c-34.7-14.046-69.15-21.353-102.532-22.5zm-18.687.032c-23.744.82-46.85 4.73-69 11.563l5.718 17.5c20.297-6.28 41.433-9.915 63.218-10.688l.063-18.375zm-169.626 1.375c-7.647 5.49-15.13 11.32-22.406 17.5l9.874 16.157c6.96-6.02 14.107-11.72 21.407-17.063l-8.876-16.593zm82.97 16.344c-14.515 5.62-28.545 12.503-42.033 20.595l8.782 16.406c12.534-7.633 25.55-14.124 39-19.436l-5.75-17.563zM90.53 189.03c-6.896 4.782-13.607 9.887-20.155 15.314l9.844 16.125c6.23-5.272 12.61-10.237 19.155-14.876L90.53 189.03zm279.19 17.126L292.28 340.25c11.3 3.162 22.027 7.753 31.94 13.563l75.31-130.47-29.81-17.187zm-114.033 147.78c-60.607.002-110.206 45.816-116.406 104.752h82.126c-2.206-4.67-3.437-9.87-3.437-15.344 0-19.872 16.315-36.156 36.186-36.156 19.872 0 36.188 16.284 36.188 36.156 0 5.475-1.23 10.674-3.438 15.344h85.188c-6.2-58.936-55.8-104.75-116.406-104.75zm-1.53 71.94c-9.773 0-17.5 7.696-17.5 17.468 0 6.678 3.626 12.39 9.03 15.344h16.938c5.404-2.955 9.03-8.666 9.03-15.344 0-9.772-7.727-17.47-17.5-17.47zm-153.47 51.5v15.687h303.344v-15.688H100.69z'/>",
  "withdraw": "<path d='M0 0h512v512H0z'/><path fill='#fff' d='M265.22 19.688v57.75c91.033 4.56 164.143 77.686 168.717 168.718h57.75c-4.635-123.12-103.345-221.85-226.468-226.47zm-18.69.03C123.67 24.65 24.717 123.244 20.063 246.157H78.44C83 155.333 155.786 82.33 246.53 77.47V19.72zm9.69 107.22c-32.23 0-61.768 11.79-84.408 31.312l22.47 22.47c12.306-10.246 27.204-17.487 43.562-20.626l18.78 70.53 18.75-70.374c15.887 3.182 30.37 10.232 42.407 20.156l22.345-22.344c-22.465-19.41-51.782-31.125-83.906-31.125zm97.124 44.343L331 193.626c9.996 12.136 17.072 26.77 20.22 42.813l-70.095 18.687 70.125 18.656c-3.15 16.247-10.31 31.112-20.438 43.44l22.344 22.342c19.513-22.637 31.312-52.154 31.313-84.375 0-32.124-11.716-61.44-31.126-83.906zm-194.75.157c-19.478 22.446-31.28 51.697-31.28 83.75 0 32.15 11.885 61.6 31.467 84.22l22.532-22.532c-9.933-12.202-16.96-26.866-20.093-42.875l70.936-18.875-70.906-18.906c3.136-15.81 10.098-30.235 19.906-42.25l-22.562-22.532zm-138.5 93.407C25.044 387.51 123.868 486.332 246.53 491.28V432.94c-90.544-4.852-163.21-77.547-168.06-168.094H20.093zm413.812 0C429.044 355.6 356.056 428.42 265.22 432.97v58.342c122.924-4.638 221.507-103.596 226.436-226.468h-57.75zm-177.28 14.75l-18.97 71.28c-16.208-3.188-30.995-10.455-43.22-20.687L172 352.625c22.618 19.582 52.072 31.47 84.22 31.47 32.05 0 61.304-11.803 83.75-31.283l-22.345-22.343c-11.955 9.914-26.296 16.98-42.03 20.217l-18.97-71.093z'/>"
};
function iconaAzione(nomeAzione) {
  var chiave = (nomeAzione || "").toLowerCase().replace(/\./g, "").trim().replace(/\s+/g, "_").replace(/[^a-z_]/g, "");
  if (ICONE_AZIONI[chiave]) return '<svg class="act-ic" viewBox="0 0 512 512" aria-hidden="true" focusable="false">' + ICONE_AZIONI[chiave] + '</svg>';
  var k2 = chiave.replace(/_(action|item)$/, "");
  if (ICONE_AZIONI[k2]) return '<svg class="act-ic" viewBox="0 0 512 512" aria-hidden="true" focusable="false">' + ICONE_AZIONI[k2] + '</svg>';
  var PER = [[/multiattack|attacca comb|multiple/, "attack"], [/tentacle|claw|bite|slam|strike|swoop|peck|stab|beak|tail|foot|hoof|wing|charge|rend|maul|constrict|flail|clubs|kick/, "attack"], [/cast|spell|magic|sorcer|arcane|conjure|summon|enchant|charm|dimension|teleport|blink|invisibility|dispel/, "cast_a_spell"], [/breathe|breath|fire|poison|acid|cold|frost|lightning|thunder|steam/, "magic"], [/swallow|consume|engulf|devour|absorb|drain|suck/, "shove"], [/grapple|restrain|grab|entangle|ensnare|web|coil|labyrinth/, "grapple"], [/dominate|frighten|fear|mind|psionic|confus|charm|hypnot/, "influence"], [/heal|regenerat|cure|restore|fount/, "help"], [/dodge|deflect|parry|evade|uncanny/, "dodge"], [/flee|escape|retreat|withdraw|flying|soar|levitat|burrow/, "dash"], [/detect|sense|discern|see invisible|truesight|scry/, "search"], [/shapechange|polymorph|disguise|transform|imitate|mimic|camouflage|illusion/, "improvise"], [/legendary|lair/, "magic_action"]];
  for (var i = 0; i < PER.length; i++) if (PER[i][0].test(chiave)) {
    return '<svg class="act-ic" viewBox="0 0 512 512" aria-hidden="true" focusable="false">' + ICONE_AZIONI[PER[i][1]] + '</svg>';
  }
  return "";
}

function featureBlock(title, list) {
    const l = listOf(list);
    if (!l.length) return "";
    const items = l.map(function (f) {
      // f STRINGA = testo puro (fluff entries): va nel BODY, mai nel name (childName tratta
      // le stringhe come nome -> il lore finirebbe tutto dentro <strong>).
      if (typeof f === "string") return "<li>" + tags(f) + "</li>";
      const name = childName(f);
      const _ic = iconaAzione(name);
      const t = textOf(f.entries || f.desc);
      const body = t.length ? t.join(" ") : "";
      // f.text (stringa) passa per tags() — mai esc() grezzo (tag {@..} altrimenti non convertiti).
      // Il name e' opzionale (fluff entries = oggetti senza name): salta il bold se vuoto.
      const nameHtml = name ? iconaAzione(name) + "<strong>" + tags(name) + ".</strong> " : "";
      return "<li>" + nameHtml + (f.text ? tags(f.text) : body) + "</li>";
    }).join("");
    // I tratti di 5e.tools sono in inglese: stessa marcatura linguistica delle descrizioni.
    // Blocco di fonte 5e.tools (inglese) + traduzione automatica su richiesta:
    // ogni blocco ha il proprio id, così il pulsante sa quale testo tradurre.
    var mtId = "mt" + Math.random().toString(36).slice(2, 9);
    return '<div class="st-sec st-src-en" lang="en"><h4>' + esc(title) +
      ' <span class="lang-note">' + L('originalText') + '</span></h4>' +
      '<div class="mt-bar"><button type="button" class="mt-btn" data-mt="' + mtId +
      '" aria-expanded="false">' + L('translateIt') + '</button>' +
      '<span class="mt-note" id="' + mtId + '-note" hidden>' + L('autoTranslation') + ' &mdash; MyMemory, non verificata</span>' +
      '</div>' +
      '<div class="mt-out" id="' + mtId + '-out" hidden></div>' +
      '<ul id="' + mtId + '-src">' + items + '</ul></div>';
  }

  /* ---------- SPELLCASTING BLOCK (mostri con incantesimi preparati) ----------
   * 5e.tools: spellcasting: [{name, type: "spellcasting", headerEntries, ability,
   * spells: {"0": {spells:[...]}, "1": {slots: 3, spells:[...]}, ...}}] */
  function spellcastingBlock(list) {
    const l = listOf(list);
    if (!l.length) return "";
    return l.map(function (sc) {
      if (!sc) return "";
      const ABIL = { wis: "Saggezza", int: "Intelligenza", cha: "Carisma" };
      let h = '<div class="st-sec st-spellcasting"><h4>' + esc(sc.name || "Lancio Incantesimi") +
        (sc.ability ? ' <span class="tag-skill">(' + (ABIL[sc.ability] || sc.ability) + ')</span>' : '') + '</h4>';
      h += '<p>' + textOf(sc.headerEntries).join(" ") + '</p>';
      const groups = sc.spells && typeof sc.spells === "object" ? sc.spells : {};
      const levels = Object.keys(groups).sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });
      if (levels.length) {
        h += '<ul>';
        levels.forEach(function (lv) {
          const g = groups[lv];
          const spells = listOf(g && g.spells).map(function (s) { return tags(s); }).join(", ");
          const lvLabel = lv === "0" ? "Trucchetti (a volontà)" : (lv + (g && g.slots ? " (" + g.slots + " slot)" : "° livello"));
          h += '<li><strong>' + esc(lvLabel) + ':</strong> ' + spells + '</li>';
        });
        h += '</ul>';
      }
      if (sc.footerEntries) h += '<p>' + textOf(sc.footerEntries).join(" ") + '</p>';
      return h + '</div>';
    }).join("");
  }

  /* ---------- REGIONAL EFFECTS (mostri leggendari con tana) ---------- */
  function regionalEffectsBlock(list) {
    const l = listOf(list);
    if (!l.length) return "";
    const items = l.map(function (x) { return "<li>" + tags(typeof x === "string" ? x : (x && x.entries ? textOf(x.entries).join(" ") : "")) + "</li>"; }).join("");
    return '<div class="st-sec"><h4>' + L('regional') + '</h4><ul>' + items + '</ul></div>';
  }

  /* ---------- TABELLA CLASSI (classTableGroups: spell slots per livello) ---------- */
  function classTable(e) {
    const groups = listOf(e.classTableGroups);
    if (!groups.length) return "";
    let h = "";
    groups.forEach(function (g) {
      const labels = listOf(g.colLabels).map(function (l) {
        // {@filter Cantrips Known|spells|level=0|class=Wizard} -> "Cantrips Known"
        const m = /\{@filter\s+([^|}]+)/.exec(String(l));
        return m ? m[1] : esc(String(l));
      });
      const rows = listOf(g.rows);
      if (!rows.length) return;
      h += '<div class="st-sec"><h4>' + L('levelProgression') + '</h4>' +
        '<table class="class-table"><thead><tr><th>Liv.</th>' +
        labels.map(function (l) { return "<th>" + l + "</th>"; }).join("") + '</tr></thead><tbody>';
      rows.forEach(function (row, i) {
        h += "<tr><td><strong>" + (i + 1) + "</strong></td>" +
          listOf(row).map(function (cell) { return "<td>" + esc(String(cell)) + "</td>"; }).join("") + "</tr>";
      });
      h += '</tbody></table></div>';
    });
    return h;
  }

  /* ---------- SCALING INCANTESIMI (scalingLevelDice / damage at spellslot) ---------- */
  function scalingBlock(e) {
    const sld = e.scalingLevelDice;
    if (!sld) return "";
    let h = "<ul>";
    if (Array.isArray(sld) && sld.length) {
      sld.forEach(function (s) {
        const lv = s.level != null ? s.level : "?";
        const dice = s.dice ? "" : "";
        h += "<li><strong>Livello " + esc(lv) + ":</strong> " + esc(dice || JSON.stringify(s)) + "</li>";
      });
    } else if (typeof sld === "object" && sld.scaling) {
      h += textOf(sld.scaling).map(function (t) { return "<li>" + t + "</li>"; }).join("");
    } else {
      h += "<li>" + esc(JSON.stringify(sld).slice(0, 300)) + "</li>";
    }
    return h + "</ul>";
  }

  /* ---------- CLASSI INCANTESIMO (badge classi per spell) ----------
   * Mappa da gendata-spell-source-lookup.json (fetch lazy, 709KB, cache). Fallback: e.classes. */
  let SC_CLASSES = null;
  let SC_CLASSES_LOADING = false;
  function loadSpellClasses() {
    if (SC_CLASSES || SC_CLASSES_LOADING) return;
    SC_CLASSES_LOADING = true;
    fetch(DATA_ROOT + "generated/gendata-spell-source-lookup.json").then(function (r) {
      if (!r.ok) throw new Error("sc " + r.status);
      return r.json();
    }).then(function (j) {
      SC_CLASSES = j;
      SC_CLASSES_LOADING = false;
      // I dati sono arrivati DOPO il primo render: la lista va ricalcolata,
      // altrimenti un filtro per classe attivo resta con 0 risultati.
      const cf = document.getElementById("class-filter");
      if (cf && cf.value) renderList();
      // Re-render della spell aperta: i badge classi arrivano ora (fetch lazy completato)
      if (CURRENT_ENTITY && CURRENT_INDEX && CURRENT_INDEX.t === "spell") {
        renderEntity(CURRENT_INDEX, CURRENT_ENTITY);
      }
    })
      .catch(function () {
        // Stato NON caricato (non {} che e' "vuoto ma truthy" e bloccherebbe
        // ogni retry): cosi' un secondo tentativo e' ancora possibile.
        SC_CLASSES = null;
        SC_CLASSES_LOADING = false;
      });
  }
  /* ---------- LORE (fluff multi-tipo: monster/race/background/item/vehicle, fetch lazy) ----------
   * fluff-index.json: { "name|source": {t, entries, images} } — catene _copy risolte in build. */
  let FLUFF = null;
  let FLUFF_LOADING = false;
  function loadFluff() {
    if (FLUFF || FLUFF_LOADING) return;
    FLUFF_LOADING = true;
    fetch("data/fluff-index.json").then(function (r) {
      if (!r.ok) throw new Error("fl " + r.status);
      return r.json();
    }).then(function (j) {
      FLUFF = j;
      // Re-render dell'entita' aperta: la lore arriva ora (fetch lazy completato)
      if (CURRENT_ENTITY && CURRENT_INDEX) {
        renderEntity(CURRENT_INDEX, CURRENT_ENTITY);
      }
    }).catch(function () { FLUFF = {}; });
  }
  function loreBlock(e) {
    if (!FLUFF) { loadFluff(); return ""; }
    // entry indice usa n (non name), entita' usa name
    const nm = e.name || e.n || "";
    const key = String(nm).toLowerCase() + "|" + (e.s || e.source || (CURRENT_INDEX && CURRENT_INDEX.s) || "");
    const fl = FLUFF[key];
    if (!fl || !fl.entries || !fl.entries.length) return "";
    return featureBlock("Lore & Descrizione", fl.entries);
  }

  function spellClassList(e) {
    // 1) entita' completa (scheda aperta): le classi sono nel payload 5e.tools
    if (e.classes) {
      if (e.classes.classList) return listOf(e.classes.classList);
      if (e.classes.fromClassList) {
        return listOf(e.classes.fromClassList).map(function (c) { return (c && c.name) ? c.name : c; });
      }
    }
    if (!SC_CLASSES) { loadSpellClasses(); return []; }
    // gendata-spell-source-lookup usa slug CON SPAZI ("delayed blast fireball"), non trattini.
    // e puo' essere l'entry indice (con s) o l'entita' (source) — risolvi entrambe.
    // gendata keys sono LOWERCASE ('phb' non 'PHB')
    const srcKey = String(e.s || e.source || (CURRENT_INDEX && CURRENT_INDEX.s) || "").toLowerCase();
    const bySrc = SC_CLASSES[srcKey] || {};
    // Le righe dell'indice usano chiavi ABBREVIATE ({n,t,f,s}): leggere solo `e.name`
    // restituiva "" e il lookup falliva -> ogni riga veniva scartata (filtro a 0).
    const nm = String(e.name || e.n || "").toLowerCase().trim();
    const entry = bySrc[nm];
    if (!entry || !entry.class) return [];
    const out = [];
    Object.keys(entry.class).forEach(function (src) {
      Object.keys(entry.class[src]).forEach(function (c) { out.push(c); });
    });
    return out.filter(function (c, i) { return out.indexOf(c) === i; });
  }

  function speedStr(sp) {
    // 5e.tools: un valore di velocita' puo' essere un numero oppure un oggetto
    // {number, condition, hover}; 'canHover' e' un flag booleano, non una velocita'
    // (prima veniva stampato come "canHover true ft" e gli oggetti come [object Object]).
    if (!sp || typeof sp !== "object") return "—";
    const out = [];
    Object.keys(sp).forEach(function (k) {
      if (k === "canHover") return;
      const v = sp[k];
      if (v == null) return;
      let num = v, extra = "";
      if (typeof v === "object") {
        num = (v.number != null ? v.number : (v.amount != null ? v.amount : "?"));
        // "hover" puo' arrivare come flag booleano o gia' dentro condition: non duplicare.
        if (v.hover && !(v.condition && String(v.condition).toLowerCase().indexOf("hover") !== -1)) extra += " (hover)";
        if (v.condition) {
          var cs = String(v.condition);
          extra += /^[(\[]/.test(cs) ? " " + cs : " (" + cs + ")";
        }
      }
      out.push((I18N.speedModes[k] ? I18N.speedModes[k] + " " : "") + DIST(num) + extra);
    });
    return out.length ? out.join(", ") : "—";
  }

  function bodyFor(t, e) {
    switch (t) {
      case "monster": {
        let h = "";
        const hp = typeof e.hp === "object" ? ((e.hp.average || "?") + (e.hp.formula ? " (" + e.hp.formula + ")" : "")) : e.hp;
        const crRaw = typeof e.cr === "object" ? (e.cr.cr != null ? e.cr.cr : e.cr.crRating) : e.cr;
        const pb = 2 + Math.floor(((parseInt(crRaw, 10) || 0) - 1) / 4);
        h += '<div class="st-meta">' +
          '<div><strong>CA</strong>' + tags(listOf(e.ac).map(function (a) { return typeof a === "object" ? (a.ac + (a.from ? " (" + listOf(a.from).map(function (x) {
            // i tag {@item ...} restano grezzi: li converte il tags() esterno
            // (convertirli qui li farebbe ri-escapare in &lt;a ...&gt;)
            return /^\{@/.test(String(x)) ? String(x) : AC_SOURCE(x);
          }).join(", ") + ")" : "")) : a; }).join(" / ") || "—") + '</div>' +
          '<div><strong>PF</strong>' + esc(hp) + '</div>' +
          '<div><strong>' + L('speed') + '</strong>' + esc(speedStr(e.speed)) + '</div>' +
          (crRaw !== undefined ? '<div><strong>' + L('cr') + '</strong>' + esc(crRaw) + ' <span class="tag-dc">' + esc(I18N.sigle.prof_bonus || "BC") + ' +' + pb + '</span></div>' : "") +
          '</div>';
        h += statsRow(e);
        // Proficienze di salvataggio e abilità (5e.tools: {dex: '+7', ...})
        if (e.save && Object.keys(e.save).length) {
          SAVE_MAP = I18N.abilityLabel;
          h += '<div class="st-sec"><h4>' + L('saves') + '</h4><p>' + Object.keys(e.save).map(function (k) {
            return '<strong>' + (SAVE_MAP[k] || k) + '</strong> ' + esc(e.save[k]);
          }).join(" &middot; ") + '</p></div>';
        }
        if (e.skill && Object.keys(e.skill).length) {
          h += '<div class="st-sec"><h4>' + L('skills') + '</h4><p>' + Object.keys(e.skill).map(function (k) {
            return '<strong>' + tags(I18N.skills[k] || (k.charAt(0).toUpperCase() + k.slice(1))) + '</strong> ' + esc(e.skill[k]);
          }).join(" &middot; ") + '</p></div>';
        }
        // Resistenze / immunità / vulnerabilità danni + condizioni
        const dmgList = function (v) { return listOf(v).map(function (x) { return typeof x === "object" ? (x.note ? x.note : Object.keys(x).join(", ")) : tags(x); }).join(", "); };
        let dmgHtml = "";
        if (e.resist) dmgHtml += '<div><strong>' + L('resistances') + '</strong>' + esc(dmgList(e.resist)) + '</div>';
        if (e.immune) dmgHtml += '<div><strong>' + L('immunities') + '</strong>' + esc(dmgList(e.immune)) + '</div>';
        if (e.vulnerable) dmgHtml += '<div><strong>' + L('vulnerabilities') + '</strong>' + esc(dmgList(e.vulnerable)) + '</div>';
        if (e.conditionImmune) dmgHtml += '<div><strong>' + L('conditionImmune') + '</strong>' + esc(dmgList(e.conditionImmune)) + '</div>';
        if (dmgHtml) h += '<div class="st-meta">' + dmgHtml + '</div>';
        // Sensi + linguaggi
        let slHtml = "";
        if (e.senses) slHtml += '<div><strong>' + L('senses') + '</strong>' + esc(listOf(e.senses).map(function (x) { return SENSE_IT(tags(x)); }).join(", ")) + '</div>';
        if (e.languages) slHtml += '<div><strong>' + L('languages') + '</strong>' + esc(listOf(e.languages).map(function (x) { return LANG_IT(tags(x)); }).join(", ")) + '</div>';
        if (e.environment) slHtml += '<div><strong>' + L('environments') + '</strong>' + esc(listOf(e.environment).map(function (x) { return ENV_IT(typeof x === "object" ? Object.keys(x)[0] : x); }).join(", ")) + '</div>';
        if (slHtml) h += '<div class="st-meta">' + slHtml + '</div>';
        h += featureBlock(L('traits'), e.trait);
        h += spellcastingBlock(e.spellcasting);
        h += featureBlock(L('actions'), e.action);
        h += featureBlock(L('legendary'), e.legendary);
        h += featureBlock(L('reactions'), e.reaction);
        h += featureBlock(L('lair'), e.lairActions || (e.legendaryGroup && e.legendaryGroup.lairActions));
        h += regionalEffectsBlock(e.legendaryGroup && e.legendaryGroup.regionalEffects);
        h += loreBlock(CURRENT_INDEX);
        // Hyperlink esterni 5e.tools + API + link sezioni sito
        const slug = slugName(e.name);
        h += '<div class="st-links">' +
          '<a class="tag-link" href="https://5e.tools/bestiary.html#' + esc(slug) + '_' + esc((CURRENT_INDEX && CURRENT_INDEX.s) || ent.source || "") + '" target="_blank" rel="noopener">5e.tools &rarr;</a>' +
          '<a class="tag-link" href="https://www.dnd5eapi.co/api/2014/monsters/' + esc(slug) + '" target="_blank" rel="noopener">API SRD &rarr;</a>' +
          '<a class="tag-link" href="cerca.html?cat=spell&q=' + esc(slug) + '">Incantesimi correlati</a>' +
          '</div>';
        return h;
      }
      case "spell": {
        const conc = (e.duration && e.duration[0] && e.duration[0].concentration);
        const comps = (e.components && typeof e.components === "object") ? (e.components.components || []) : (typeof e.components === "string" ? [e.components] : []);
        // Classi incantesimo: da gendata-spell-source-lookup (SC_CLASSES globale) o e.classes
        const spellClasses = spellClassList(e);
        const classBadges = spellClasses.length
          ? '<div class="st-sec"><h4>' + L('classes') + '</h4><p>' + spellClasses.map(function (c) {
              // Il link resta in inglese (slugName(c)): la ricerca interna usa i nomi 5e.tools.
              // Solo l'etichetta visibile è tradotta (Wizard -> Mago).
              return '<a class="tag-link tag-class" href="cerca.html?cat=class&q=' + encodeURIComponent(slugName(c)) + '">' + esc(CLASS_IT(c)) + '</a>';
            }).join(" &middot; ") + '</p></div>'
          : "";
        const slug = slugName(e.name);
        return '<div class="st-meta">' +
          '<div><strong>' + L('time') + '</strong>' + esc(timeStr(e.time)) + '</div>' +
          '<div><strong>' + L('range') + '</strong>' + esc(distStr(e.range)) + '</div>' +
          '<div><strong>' + L('components') + '</strong>' + esc(comps.join(", ") || "V, S") + (e.components && e.components.material ? '<div class="st-sec"><p style="font-size:12px">' + esc(e.components.material) + '</p></div>' : "") + '</div>' +
          '<div><strong>' + L('duration') + '</strong>' + esc(durStr5e(e.duration)) + '</div>' +
          '<div><strong>' + L('concentration') + '</strong>' + esc(conc ? "Sì" : "No") + '</div>' +
          '</div>' + classBadges + block(e.entries) +
          (e.higherLevel ? '<div class="st-sec"><h4>' + L('higherLevels') + '</h4><ul>' + textOf(e.higherLevel).map(function (t) { return "<li>" + t + "</li>"; }).join("") + '</ul></div>' : "") +
          (e.scalingLevelDice ? '<div class="st-sec"><h4>' + L('scaling') + '</h4>' + scalingBlock(e) + '</div>' : "") +
          '<div class="st-links">' +
          '<a class="tag-link" href="https://5e.tools/spells.html#' + esc(slug) + '_' + esc((CURRENT_INDEX && CURRENT_INDEX.s) || ent.source || "") + '" target="_blank" rel="noopener">5e.tools &rarr;</a>' +
          '<a class="tag-link" href="https://www.dnd5eapi.co/api/2014/spells/' + esc(slug) + '" target="_blank" rel="noopener">API SRD &rarr;</a>' +
          '</div>';
      }
      case "item": case "baseitem": case "magicvariant": {
        const base = e._baseItemName || (e.baseItem ? String(e.baseItem).replace(/-/g, " ") : "");
        const attune = e.reqAttune === true ? "Sì (richiede sintonia)" : typeof e.reqAttune === "string" ? esc(e.reqAttune) : "No";
        return '<div class="st-meta">' +
          '<div><strong>' + L('rarity') + '</strong>' + esc(RARITY_IT(typeof e.rarity === "object" ? (e.rarity.name || Object.keys(e.rarity)[0]) : (e.rarity || "N/D"))) + '</div>' +
          '<div><strong>' + L('attunement') + '</strong>' + attune + '</div>' +
          (base ? '<div><strong>' + L('base') + '</strong>' + esc(base) + '</div>' : "") +
          (e.weight ? '<div><strong>' + L('weight') + '</strong>' + esc(WEIGHT(e.weight)) + '</div>' : "") +
          '</div>' + block(e.entries || e.desc || e.text) +
          (e.effect ? '<div class="st-sec"><h4>' + L('effect') + '</h4><ul>' + textOf(e.effect).map(function (t) { return "<li>" + t + "</li>"; }).join("") + '</ul></div>' : "") +
          loreBlock(CURRENT_INDEX);
      }
      case "race":
        return featureBlock(L('traits'), e.trait || e.entries) +
          (e.speed && e.speed.walk ? '<div class="st-meta"><div><strong>' + L('speed') + '</strong>' + esc(e.speed.walk) + " ft</div></div>" : "") +
          loreBlock(CURRENT_INDEX);
      case "subrace":
        return featureBlock(L('traits'), e.trait || e.entries);
      case "class": {
        // Classe: HD, proficienze, feature per livello, sottoclassi correlate
        let h = "";
        const hd = e.hd ? (e.hd.number + "d" + e.hd.faces) : "n/d";
        const feats = listOf(e.classFeatures);
        h += '<div class="st-meta">' +
          '<div><strong>' + L('hitDice') + '</strong>' + esc(hd) + '</div>' +
          '<div><strong>Feature di Classe</strong>' + feats.length + '</div>' +
          '</div>';
        if (e.startingProficiencies) {
          h += '<div class="st-sec"><h4>' + L('startingProficiencies') + '</h4>' +
            '<p>' + textOf(e.startingProficiencies.armors || []).join(" ") + " " +
            textOf(e.startingProficiencies.weapons || []).join(" ") + " " +
            textOf(e.startingProficiencies.skills || []).join(" ") + " " +
            textOf(e.startingProficiencies.tools || []).join(" ") + '</p></div>';
        }
        if (e.spellsKnownProgression || e.spellsKnownProgressionFixed) {
          h += '<div class="st-sec"><h4>' + L('spellcasting') + '</h4><p>Classe lanciatrice completa (progressione incantesimi nota).</p></div>';
        }
        h += classTable(e);
        h += '<div class="st-sec"><h4>' + L('features') + '</h4><ul>' +
          feats.slice(0, 20).map(function (f) {
            // classFeatures: "Name|Class||Level" (pipe) o {classFeature, gainSubclassFeature}
            if (typeof f === "object" && f.classFeature) {
              return '<li><em>Feature di Sottoclasse</em> (livello ' + esc(String(f.classFeature).split("|").pop() || "?") + ')</li>';
            }
            const parts = String(f).split("|");
            const fname = parts[0];
            const flevel = parts[parts.length - 1];
            const fsrc = parts[2] || "";
            return '<li><a class="tag-link tag-class" href="cerca.html?cat=classFeature&q=' + encodeURIComponent(slugName(fname)) + '">' + esc(fname) + '</a>' +
              (flevel ? ' <span class="tag-skill">liv. ' + esc(flevel) + '</span>' : '') + '</li>';
          }).join("") + '</ul>' + '</div>';
        const slug = slugName(e.name);
        h += '<div class="st-links">' +
          '<a class="tag-link" href="https://5e.tools/classes.html#' + esc(slug) + '_' + esc((CURRENT_INDEX && CURRENT_INDEX.s) || ent.source || "") + '" target="_blank" rel="noopener">5e.tools &rarr;</a>' +
          '<a class="tag-link" href="cerca.html?cat=subclass&q=' + esc(slug) + '">Sottoclassi correlate</a>' +
          '<a class="tag-link" href="cerca.html?cat=spell&q=' + esc(slug) + '">Incantesimi di classe</a>' +
          '</div>';
        return h;
      }
      case "subclass": {
        // Sottoclasse: classe madre, feature, hyperlink
        let h = "";
        h += '<div class="st-meta">' +
          '<div><strong>Classe Madre</strong><a class="tag-link tag-class" href="cerca.html?cat=class&q=' + encodeURIComponent(slugName(e.className || "")) + '">' + esc(e.className || "n/d") + '</a></div>' +
          '<div><strong>Feature</strong>' + listOf(e.subclassFeatures).length + '</div>' +
          '</div>';
        h += '<div class="st-sec"><h4>' + L('subclass') + '</h4><ul>' +
          listOf(e.subclassFeatures).slice(0, 15).map(function (f) {
            // subclassFeatures: "Name|Class||Subclass||Level" (pipe)
            const parts = String(f).split("|");
            const fname = parts[0];
            const flevel = parts[parts.length - 1];
            return '<li><a class="tag-link tag-class" href="cerca.html?cat=subclassFeature&q=' + encodeURIComponent(slugName(fname)) + '">' + esc(fname) + '</a>' +
              (flevel ? ' <span class="tag-skill">liv. ' + esc(flevel) + '</span>' : '') + '</li>';
          }).join("") + '</ul></div>';
        const slug = slugName(e.name);
        h += '<div class="st-links">' +
          '<a class="tag-link" href="https://5e.tools/classes.html#' + esc(slugName(e.className || "")) + '_' + esc(e.classSource || "PHB") + '" target="_blank" rel="noopener">5e.tools &rarr;</a>' +
          '</div>';
        return h;
      }
      case "classFeature": case "subclassFeature": {
        // Feature di classe/sottoclasse: descrizione + classe madre
        let h = "";
        const parentLabel = e.className || "Classe";
        const parentHref = e.classFeature !== undefined ? "class" : "subclass";
        h += '<div class="st-meta">' +
          '<div><strong>' + (e.subclassShortName ? "Sottoclasse" : "Classe") + '</strong><a class="tag-link tag-class" href="cerca.html?cat=' + parentHref + '&q=' + encodeURIComponent(slugName(parentLabel)) + '">' + esc(parentLabel) + '</a></div>' +
          '<div><strong>' + L('level') + '</strong>' + esc(e.level != null ? e.level : "n/d") + '</div>' +
          (e.srd ? '<div><strong>SRD</strong>Sì</div>' : '') +
          '</div>'; h += block(e.entries || e.text);
        const slug2 = slugName(e.name);
        h += '<div class="st-links">' +
          '<a class="tag-link" href="https://5e.tools/classes.html#' + esc(slug2) + '_' + esc((CURRENT_INDEX && CURRENT_INDEX.s) || ent.source || "") + '" target="_blank" rel="noopener">5e.tools &rarr;</a>' +
          '</div>';
        return h;
      }
      case "background":
        return featureBlock("Competenze", e.skillProficiencies || []) +
          block(e.entries || e.text) +
          loreBlock(CURRENT_INDEX);
      case "feat":
        return block(e.entries || e.text) + loreBlock(CURRENT_INDEX);
      case "condition": case "disease": case "hazard": case "trap":
        return block(e.entries || e.text) + loreBlock(CURRENT_INDEX);
      case "deity": {
        // Divinità: pantheon, titolo, domini e simbolo anche quando manca `entries`
        const dm = '<div class="st-meta">' +
          (e.pantheon ? '<div><strong>Pantheon</strong>' + esc(e.pantheon) + '</div>' : "") +
          (e.title ? '<div><strong>Titolo</strong>' + esc(e.title) + '</div>' : "") +
          (e.domains ? '<div><strong>Domini</strong>' + tags(Array.isArray(e.domains) ? e.domains.join(", ") : e.domains) + '</div>' : "") +
          (e.symbol ? '<div><strong>Simbolo</strong>' + (typeof e.symbol === "string" ? esc(e.symbol) : esc((e.symbol && e.symbol.name) || "")) + '</div>' : "") +
          '</div>';
        return dm + block(e.entries || e.text) + loreBlock(CURRENT_INDEX);
      }
      case "cult": case "boon":
        return block(e.entries || e.text) + loreBlock(CURRENT_INDEX);
      case "language":
        return '<div class="st-meta">' +
          '<div><strong>Parlanti tipici</strong>' + esc(listOf(e.typicalSpeakers).join(", ") || "—") + '</div>' +
          '<div><strong>Scrittura</strong>' + esc(e.script || "—") + '</div></div>' +
          block(e.entries || e.text);
      case "sense": case "skill":
        return block(e.entries || e.text);
      case "psionic":
        return featureBlock("Discipline", e.disciplines) + block(e.entries || e.text);
      case "optionalfeature": {
        // Opzione di classe: featureType (EI: Eldritch Invocation, ecc.) + prerequisito
        const FT_MAP = { EI: "Eldritch Invocation", AS: "Abilità Speciale", PB: "Pact Boon", OR: "Opzione Razza", F: "Feature", S: "Sottoclasse" };
        const fts = listOf(e.featureType).map(function (x) { return FT_MAP[x] || x; }).join(", ");
        let h2 = '<div class="st-meta"><div><strong>Tipo</strong>' + esc(fts || "opzione") + '</div></div>';
        if (e.prerequisite) {
          h2 += '<div class="st-sec"><h4>' + L('prerequisite') + '</h4><p>' + textOf(e.prerequisite).join(" ") + '</p></div>';
        }
        return h2 + block(e.entries || e.text);
      }
      case "reward": {
        // Ricompensa (benedizioni, charme): tipo + descrizione
        return '<div class="st-meta"><div><strong>Tipo</strong>' + esc(e.type || "ricompensa") + '</div></div>' +
          block(e.entries || e.text) + loreBlock(CURRENT_INDEX);
      }
      case "variantrule": {
        // Regola variante: tipo regola + descrizione
        return '<div class="st-meta"><div><strong>Tipo Regola</strong>' + esc(e.ruleType || "variante") + '</div></div>' +
          block(e.entries || e.text);
      }
      case "action": {
        // Azione standard: tempo + descrizione
        return '<div class="st-meta"><div><strong>' + L('time') + '</strong>' + esc(timeStr(e.time)) + '</div></div>' +
          block(e.entries || e.text);
      }
      case "object": {
        // Oggetto fisico: CA/PF/immunita + azioni (statblock semplificato)
        const hpO = typeof e.hp === "object" ? (e.hp.average || "?") : e.hp;
        let h3 = '<div class="st-meta">' +
          '<div><strong>CA</strong>' + esc(listOf(e.ac).map(function (a) { return typeof a === "object" ? a.ac : a; }).join(" / ") || "—") + '</div>' +
          '<div><strong>PF</strong>' + esc(hpO) + '</div>' +
          (e.immune ? '<div><strong>' + L('immunities') + '</strong>' + esc(listOf(e.immune).join(", ")) + '</div>' : "") +
          '</div>' + statsRow(e) + featureBlock(L('actions'), e.actionEntries);
        return h3;
      }
      case "vehicle": {
        // Veicolo: CA/PF/capienza + velocita
        const hpV = typeof e.hp === "object" ? (e.hp.average || e.hp.formula || "?") : e.hp;
        const cap = [e.capCrew ? e.capCrew + " equipaggio" : "", e.capPassenger ? e.capPassenger + " passeggeri" : ""].filter(Boolean).join(", ");
        return '<div class="st-meta">' +
          '<div><strong>CA</strong>' + esc(listOf(e.ac).map(function (a) { return typeof a === "object" ? a.ac : a; }).join(" / ") || "—") + '</div>' +
          '<div><strong>PF</strong>' + esc(hpV) + '</div>' +
          (cap ? '<div><strong>Capienza</strong>' + esc(cap) + '</div>' : "") +
          (e.speed ? '<div><strong>' + L('speed') + '</strong>' + esc(typeof e.speed === "object" ? Object.keys(e.speed).map(function (k) { return (k === "walk" ? "" : k + " ") + e.speed[k] + " ft"; }).join(", ") : e.speed) + '</div>' : "") +
          '</div>' + block(e.entries || e.text) + loreBlock(CURRENT_INDEX);
      }
      default:
        return featureBlock(L('traits'), e.trait) + block(e.entries || e.text || e.desc) + loreBlock(CURRENT_INDEX);
    }
  }

  function renderNotFound(e) {
    const box = document.getElementById("stat-core-zone");
    box.innerHTML = '<div class="stat-bezel"><div class="stat-core"><div class="st-h"><h2>' + esc(e.n) + '</h2>' +
      '<span class="db-badge" style="color:var(--warning);border-color:rgba(251,191,36,.3);background:rgba(251,191,36,.1)">non trovato in file</span></div>' +
      '<p class="where">L\\'entità non è stata trovata nel file sorgente <code>' + esc(e.f) + '</code>. Prova a usare la ricerca API SRD live sottostante, o contatta il manutentore del dataset.</p></div></div>';
  }

  function fallbackSRD(e, err) {
    // Fallback per SRD spells / monsters / magic-items / conditions verso dnd5eapi.co.
    // Il <select id="srd-type"> invia valori PLURALI ("spells"): qui vengono
    // normalizzati al singolare, altrimenti apiType restava null e il form
    // rispondeva sempre "non trovato" senza mai contattare l'API.
    const T_ALIAS = { spells: "spell", monsters: "monster", "magic-items": "item",
                      magicitems: "item", items: "item", equipment: "item",
                      conditions: "condition" };
    const t = T_ALIAS[e.t] || e.t;
    let apiType = null;
    if (t === "spell") apiType = "spells";
    else if (t === "monster") apiType = "monsters";
    else if (t === "item" || t === "baseitem") apiType = "magic-items";
    else if (t === "condition") apiType = "conditions";
    if (!apiType) { renderNotFound(e); return; }
    const key = e.n.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    fetch(SRD_API + apiType + "/" + key).then(function (r) {
      if (!r.ok) return Promise.reject(new Error("srde " + r.status));
      return r.json();
    }).then(function (data) {
      const box = document.getElementById("stat-core-zone");
      let sub = apiType === "spells" ? ("Livello " + (data.level || 0) + " · " + SCHOOL_IT(data.school ? data.school.name : "")) :
        apiType === "monsters" ? (cap(I18N.sizes[String(data.size || "").charAt(0).toUpperCase()] || data.size || "") + " · " + (I18N.creatureTypes[String(data.type || "").toLowerCase()] || data.type || "") + (data.challenge_rating != null ? " · GS " + data.challenge_rating : "")) :
          (data.equipment_category ? data.equipment_category.name : "");
      let body = "";
      if (apiType === "monsters") {
        body = '<div class="st-meta"><div><strong>CA</strong>' + esc(Array.isArray(data.armor_class) ? data.armor_class[0].value : data.armor_class) + '</div><div><strong>PF</strong>' + esc(data.hit_points) + '</div><div><strong>Grado di Sfida</strong>' + esc(data.challenge_rating) + '</div></div>' +
          '<div class="st-stats">' + ["str", "dex", "con", "int", "wis", "cha"].map(function (k) { return renderStat(data[k] != null ? data[k] : "—", (I18N.abilityAbbr[k] || k.toUpperCase())); }).join("") + '</div>' +
          featureBlock("Abilità Speciali", data.special_abilities) +
          featureBlock(L('actions'), data.actions);
      } else if (apiType === "spells") {
        body = '<div class="st-meta"><div><strong>' + L('time') + '</strong>' + esc(TIME_IT(data.casting_time)) + '</div><div><strong>Gittata</strong>' + esc(RANGE_IT(data.range)) + '</div><div><strong>Componenti</strong>' + esc((data.components || []).join(", ")) + '</div><div><strong>Durata</strong>' + esc(DUR_IT(data.duration)) + '</div></div>' +
          block(data.desc) + (data.higher_level ? '<div class="st-sec"><h4>' + L('higherLevels') + '</h4><ul>' + data.higher_level.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ul></div>' : "");
      } else {
        body = block(data.desc || data.text);
      }
      box.innerHTML = '<div class="stat-bezel"><div class="stat-core"><div class="st-h"><div><h2>' + iconaAzione(data.name) + esc(data.name) + '</h2>' +
        '<div class="st-sub">' + esc(sub) + '</div></div><span class="db-badge">fallback SRD live</span></div>' + body + '</div></div>';
    }).catch(function () { renderNotFound(e); });
  }

  /* ---------- INPUT / CHIPS (binding post-render) ---------- */
  function bindApp() {
    const input = document.getElementById("lookup-search");
    input.addEventListener("input", function () { state.q = input.value; renderList(); });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        const first = document.querySelector("#result-list .result-row");
        if (first) first.click();
      }
    });

    const chipRow = document.querySelector(".chip-row");
    const cfWrap = document.getElementById("class-filter-wrap");
    const cfSel = document.getElementById("class-filter");
    if (cfSel) {
      cfSel.addEventListener("change", function () {
        if (cfSel.value && !SC_CLASSES) loadSpellClasses();
        renderList();
      });
    }
    function buildChips() {
      // Filtro per classe: listener DELEGATO sul document. Quello legato al singolo
      // elemento non risultava efficace (il cambio di valore non ri-renderizzava la
      // lista: la select cambiava ma i risultati restavano quelli di prima).
      if (!window.__clsFilterBound) {
        window.__clsFilterBound = true;
        document.addEventListener("change", function (ev) {
          const t = ev.target;
          if (t && t.id === "class-filter") {
            if (t.value && typeof loadSpellClasses === "function") loadSpellClasses();
            renderList();
          }
        }, true);
        document.addEventListener("input", function (ev) {
          const t = ev.target;
          if (t && t.id === "class-filter") {
            if (t.value && typeof loadSpellClasses === "function") loadSpellClasses();
            renderList();
          }
        }, true);
      }
      const top = ["all", "monster", "spell", "item", "baseitem", "race", "subrace", "class", "subclass", "classFeature", "subclassFeature", "background", "feat", "condition", "deity", "language"];
      chipRow.innerHTML = top.filter(function (t) { return t === "all" || INDEX.types[t]; }).map(function (t) {
        // Conteggio delle VOCI VISIBILI (deduplicate per fonte più recente); il totale
        // delle entità incluse le ristampe resta nel riepilogo dell'hero.
        const nVis = INDEX.types[t] ? (INDEX.types[t].unique || INDEX.types[t].count) : 0;
        const label = t === "all" ? "Tutte (" + (INDEX.unique || INDEX.count) + ")" : INDEX.types[t].label + " (" + nVis + ")";
        return '<button class="search-chip' + (t === state.type ? " on" : "") + '" data-t="' + t + '">' + label + '</button>';
      }).join("");
    }
    chipRow.addEventListener("click", function (ev) {
      const chip = ev.target.closest(".search-chip");
      if (!chip) return;
      state.type = chip.dataset.t === "all" ? null : chip.dataset.t;
      // Reset query al cambio tab: la categoria nuova puo' non contenere la query corrente
      // (ACT-05 — senza reset, il passaggio a una categoria filtrata mostra "Nessun risultato"
      // perche' lo stato filtrato per la query precedente).
      if (state.q) { state.q = ""; input.value = ""; }
      chipRow.querySelectorAll(".search-chip").forEach(function (c) { c.classList.toggle("on", c === chip); });
      // Filtro classe visibile SOLO per incantesimi
      if (cfWrap) cfWrap.style.display = (state.type === "spell") ? "" : "none";
      if (state.type === "spell" && !SC_CLASSES) loadSpellClasses();
      renderList();
    });

    document.getElementById("result-list").addEventListener("click", function (ev) {
      const row = ev.target.closest(".result-row");
      if (row) loadEntity(+row.dataset.i);
    });

    const srd = document.getElementById("srd-box");
    srd.addEventListener("submit", function (ev) {
      ev.preventDefault();
      const type = document.getElementById("srd-type").value;
      const raw = document.getElementById("srd-input").value;
      if (!raw) return;
      fallbackSRD({ t: type, n: raw, s: "" }, null);
    });
    // Deep-link ?cls=<classe>: popola la select del filtro (prima il parametro
    // veniva ignorato e il filtro restava a "Tutte le classi").
    try {
      const qsCls = new URLSearchParams(window.location.search).get("cls");
      if (qsCls) {
        const cfW = document.getElementById("class-filter-wrap");
        const cfS = document.getElementById("class-filter");
        if (cfW) cfW.style.display = "block";
        if (cfS) {
          const want = qsCls.toLowerCase();
          const has = Array.prototype.some.call(cfS.options, function (o) { return o.value === want; });
          if (has) { cfS.value = want; if (!SC_CLASSES) loadSpellClasses(); }
        }
      }
    } catch (e) { /* URLSearchParams non disponibile: nessun problema */ }

    const srdQ = document.getElementById("srd-q");
    if (srdQ) srdQ.addEventListener("click", function () {
      document.getElementById("srd-input").focus();
    });

    return { input: input, buildChips: buildChips };
  }

  /* ---------- init ---------- */
  fetch(INDEX_URL).then(function (r) {
    if (!r.ok) throw new Error("idx " + r.status);
    return r.json();
  }).then(function (idx) {
    INDEX = idx;
    const root = document.getElementById("app-root");
    root.innerHTML =
      '<div class="search-bezel"><div class="search-core">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4-4"></path></svg>' +
      '<input id="lookup-search" type="search" placeholder="Cerca un mostro, incantesimo, oggetto magico, divinità, lingua, condizione..." autocomplete="off" aria-label="Ricerca nel database D&D" role="searchbox"/></div></div>' +
      '<div class="chip-row"></div>' +
      '<div id="fav-list"></div>' +
      '<div class="class-filter-row" id="class-filter-wrap" style="display:none; margin-bottom:16px;">' +
      '<select id="class-filter" aria-label="Filtra gli incantesimi per classe" style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:8px 12px; color:var(--fg); font-size:13px;">' +
      '<option value="">Tutte le classi</option>' +
      '<option value="barbarian">Barbarian</option><option value="bard">Bard</option>' +
      '<option value="cleric">Chierico</option><option value="druid">Druid</option>' +
      '<option value="fighter">Fighter</option><option value="monk">Monk</option>' +
      '<option value="paladin">Paladin</option><option value="ranger">Ranger</option>' +
      '<option value="rogue">Rogue</option><option value="sorcerer">Sorcerer</option>' +
      '<option value="warlock">Warlock</option><option value="wizard">Wizard</option>' +
      '<option value="artificer">Artificer</option>' +
      '</select></div>' +
      '<div class="result-meta"><span id="result-count"></span><span style="font-size:12px;color:var(--fg-dim)">' +
      INDEX.count + ' entità &#8226; ' + Object.keys(INDEX.types).length + ' categorie &#8226; 5e.tools ' + INDEX.version + '</span></div>' +
      '<div class="result-list" id="result-list"></div>' +
      '<div id="stat-core-zone"></div>' +
      '<div class="stat-bezel" style="margin-top:24px"><div class="stat-core">' +
      '<div class="st-h"><h2 style="font-size:20px">Fallback API SRD live</h2><span class="db-badge" style="color:var(--warning);border-color:rgba(251,191,36,.3);background:rgba(251,191,36,.1)">on-demand</span></div>' +
      '<p class="where">Interroga direttamente <code>dnd5eapi.co</code> (SRD 5.1) se l\\'entità non è nel database locale 5e.tools, o per consultare MAGIE, MOSTRI, OGGETTI e CONDIZIONI dello SRD con i dati canonici.</p>' +
      '<form id="srd-box" class="search-core" style="margin-top:14px;padding:10px 14px">' +
      '<select id="srd-type" aria-label="Tipo di entità SRD da interrogare" style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--fg)">' +
      '<option value="spells">Incantesimi</option><option value="monsters">Mostri</option>' +
      '<option value="magic-items">Oggetti Magici</option><option value="conditions">Condizioni</option></select>' +
      '<input id="srd-input" aria-label="Testo da cercare nell’SRD 5.1" type="text" placeholder="Es. Fireball, Goblin, Bag of Holding..." style="border:none;background:transparent;color:var(--fg);flex:1;aria-label="Ricerca API SRD live"/>' +
      '<button class="btn btn-primary">Cerca SRD &rarr;</button></form></div></div>';
    const app = bindApp();
    app.buildChips();
    // Deep-link: {@spell}/{@creature} tag aprono cerca.html?q=slug[&cat=type] -> auto-apertura
    const params = new URLSearchParams(location.search);
    const qParam = params.get("q");
    const catParam = params.get("cat");
    if (catParam && INDEX.types[catParam]) {
      state.type = catParam;
      const chipRowDl = document.querySelector(".chip-row");
      if (chipRowDl) chipRowDl.querySelectorAll(".search-chip").forEach(function (c) { c.classList.toggle("on", c.dataset.t === catParam); });
      // Coerenza deep-link: il filtro classe si mostra anche via URL (cat=spell)
      const cfWrapDl = document.getElementById("class-filter-wrap");
      if (cfWrapDl) cfWrapDl.style.display = (catParam === "spell") ? "" : "none";
      if (catParam === "spell" && !SC_CLASSES) loadSpellClasses();
    }
    if (qParam) {
      state.q = qParam.slice(0, 120);
      app.input.value = state.q;
      // Se cat=class|subclassFeature e q contiene un nome classe (es. "cleric"),
      // pre-filtra al risultato della classe giusta (non il primo alfabetico — ACT-07).
      const clsP = params.get("cls");
      renderList();
      let pick = document.querySelector("#result-list .result-row");
      if (clsP) {
        const qLower = String(clsP).toLowerCase();
        const rows = document.querySelector("#result-list").querySelectorAll(".result-row");
        for (let i = 0; i < rows.length; i++) {
          if (rows[i].textContent.toLowerCase().includes(qLower)) { pick = rows[i]; break; }
        }
      }
      if (pick) pick.click();
    } else if (catParam) {
      renderList();
    } else {
      // Nessuna query: mostra TUTTO l'indice (R4 — il default "ancient red dragon"
      // bloccava la navigazione con query residua)
      state.q = "";
      renderList();
    }
    // Preferiti + cronologia (localStorage, chiave lookup-*)
    const favKey = "lookup-favorites";
    let favorites = [];
    try { favorites = JSON.parse(localStorage.getItem(favKey) || "[]"); } catch (e) { favorites = []; }

    // Pulsante stella sullo statblock aperto (toggle preferito)
    function addFavButton() {
      const zone = document.getElementById("stat-core-zone");
      const stH = zone && zone.querySelector(".st-h");
      if (!stH || !CURRENT_INDEX) return;
      const key = CURRENT_INDEX.n + "|" + CURRENT_INDEX.s + "|" + CURRENT_INDEX.t;
      const isFav = favorites.indexOf(key) !== -1;
      const old = stH.querySelector(".fav-btn");
      if (old) old.remove();
      const btn = document.createElement("button");
      btn.className = "fav-btn" + (isFav ? " on" : "");
      // innerHTML con letterale COSTANTE: nessun dato utente, nessun XSS possibile.
btn.innerHTML = isFav ? '<span class="emoji-icona emoji-preferito" role="img" aria-label="Preferito"></span> Preferito' : '<span class="emoji-icona emoji-preferito" style="opacity:.45" role="img" aria-label="Non preferito"></span> Preferito';
      btn.addEventListener("click", function () {
        const k = CURRENT_INDEX.n + "|" + CURRENT_INDEX.s + "|" + CURRENT_INDEX.t;
        const i2 = favorites.indexOf(k);
        if (i2 === -1) { favorites.push(k); } else { favorites.splice(i2, 1); }
        try { localStorage.setItem(favKey, JSON.stringify(favorites)); } catch (e) {}
        addFavButton();
        renderFavList();
      });
      stH.appendChild(btn);
    }

    // Lista preferiti (sotto la search, se non vuota)
    function renderFavList() {
      const wrap = document.getElementById("fav-list");
      if (!wrap) return;
      if (!favorites.length) { wrap.innerHTML = ""; wrap.style.display = "none"; return; }
      wrap.style.display = "";
      wrap.innerHTML = '<div class="st-sec" style="margin:0 0 16px"><h4>Preferiti (' + favorites.length + ')</h4><div class="chip-row" style="margin-bottom:0">' +
        favorites.map(function (k) {
          const parts = k.split("|");
          return '<button class="search-chip" data-fav="' + esc(k) + '">' + esc(parts[0]) + ' <span style="opacity:.6">' + esc(parts[2] || "") + '</span> &times;</button>';
        }).join("") + '</div></div>';
    }
    const favWrap = document.getElementById("fav-list");
    if (favWrap) favWrap.addEventListener("click", function (ev) {
      const chip = ev.target.closest("[data-fav]");
      if (!chip) return;
      const k = chip.dataset.fav;
      if (ev.target.textContent.indexOf("×") !== -1 || ev.target.textContent.indexOf("&times;") !== -1) {
        const i2 = favorites.indexOf(k);
        if (i2 !== -1) { favorites.splice(i2, 1); try { localStorage.setItem(favKey, JSON.stringify(favorites)); } catch (e) {} }
        addFavButton();
        renderFavList();
        return;
      }
      // click sul chip: apri l'entita' preferita (ricerca diretta)
      const parts = k.split("|");
      state.q = parts[0]; state.type = null;
      app.input.value = parts[0];
      renderList();
    });

    // Cronologia ricerche: push su loadEntity (max 10)
    const histKey = "lookup-history";
    let history = [];
    try { history = JSON.parse(localStorage.getItem(histKey) || "[]"); } catch (e) { history = []; }
    const origLoad = loadEntity;
    loadEntity = function (i) {
      const e = state.rows[i];
      if (e) {
        const k = e.n + " (" + typeLabel(e.t) + ")";
        const hi = history.indexOf(k);
        if (hi !== -1) history.splice(hi, 1);
        history.unshift(k);
        history = history.slice(0, 10);
        try { localStorage.setItem(histKey, JSON.stringify(history)); } catch (e2) {}
      }
      return origLoad(i);
    };

    FAV_ADD = addFavButton;
    app.addFavButton = addFavButton;
    app.renderFavList = renderFavList;
    renderFavList();
    // Onboarding: banner solo alla prima visita (R7)
    const obKey = "lookup-onboarded";
    const ob = document.getElementById("onboarding");
    if (ob) {
      let seen = false;
      try { seen = localStorage.getItem(obKey) === "1"; } catch (e) {}
      if (seen) { ob.style.display = "none"; }
      else {
        const dismiss = document.getElementById("onboard-dismiss");
        if (dismiss) dismiss.addEventListener("click", function () {
          ob.style.display = "none";
          try { localStorage.setItem(obKey, "1"); } catch (e2) {}
        });
      }
    }
    app.input.focus();
  }).catch(function (err) {
    document.getElementById("app-root").innerHTML = '<div class="r-none">Impossibile caricare l\\'indice locale (' +
      esc(err.message) + '). La pagina <a href="cerca.html">home</a> è comunque attiva.</div>';
  });
})();
'''


# ------------------------------------------------------------------------------

def build_cerca_app() -> None:
    data_dir = Path(r"C:\Users\Fabrizio\workspace\public-site\data")
    out = data_dir / "cerca-app.js"
    # Localizzazione: il glossario IT risolve il segnaposto {i18n_json} dentro
    # CERCA_APP_JS (mappe di scuole, taglie, allineamenti, abilità, condizioni,
    # tipi di danno, rarità, ambienti + sigle ufficiali GS/BC/PF/CA/CD).
    js = CERCA_APP_JS.replace("{i18n_json}", i18n_it.js_maps())
    js = js.replace("{i18n_bi}", i18n_bi.js_blob())
    js = js.replace("{i18n_labels}", i18n_bi.labels_blob())
    js = js.replace("{i18n_dist}", i18n_it.DIST_JS)
    js = js.replace("{i18n_weight}", i18n_it.WEIGHT_JS)
    js = js.replace("{i18n_field}", i18n_it.FIELD_JS)   # il runtime bilingue è nello script condiviso della navigazione
    out.write_text(js, encoding="utf-8")


CACHE_BUST = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
LOOKUP_COUNT = 13219  # entità nell'indice 5e.tools (post magicvariant fix)

def build_cerca() -> str:
    return f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Consultazione Live — mostri, incantesimi, oggetti &mdash; Il Grimorio dei Reami</title>
{render_seo_head("cerca.html", "Consultazione Live — mostri, incantesimi, oggetti — Il Grimorio dei Reami", "Lookup D&D 5e.tools: 13219 entità — mostri, incantesimi, classi, oggetti magici, razze, background. Ricerca fuzzy offline-first, statblock e fallback API SRD.", 0.8)}

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=optional" rel="stylesheet">
<style>
{SHARED_CSS}
.lookup-app {{ max-width: 1200px; margin: 0 auto; padding: 40px 24px 80px; }}
.lookup-hero {{ margin-bottom: 28px; }}
.lookup-hero h1 {{ font-family: 'Outfit', sans-serif; font-size: clamp(28px, 4vw, 40px); font-weight: 800; letter-spacing: -0.02em; margin-bottom: 10px; }}
.lookup-hero h1 span {{ color: var(--accent); }}
.lookup-hero p {{ color: var(--fg-muted); max-width: 72ch; line-height: 1.6; }}
.lookup-glow {{ display:inline-flex; align-items:center; gap:8px; margin-bottom:18px; }}
.lookup-glow .dot {{ width:8px; height:8px; border-radius:50%; background: var(--success); box-shadow:0 0 12px var(--success); animation:pulseLk 0.6s ease-in-out infinite; }}
@keyframes pulseLk {{ 0%,100%{{opacity:1}} 50%{{opacity:.4}} }}

/* Barra di ricerca — doppio bezel */
.search-bezel {{ background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.10); border-radius:18px; padding:8px; margin-bottom:16px; }}
@supports (backdrop-filter: blur(1px)) {{ .search-bezel {{ backdrop-filter: blur(12px) saturate(140%); -webkit-backdrop-filter: blur(12px) saturate(140%); }} }}
.search-core {{
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    gap: 12px;
    align-items: center;
  }}
.search-core svg {{ flex-shrink:0; opacity:.6; }}
.search-core input {{ flex:1; background:transparent; border:none; color:var(--fg); font-size:17px; font-family:'Outfit',sans-serif; min-width:0; }}
.search-core input::placeholder {{ color: var(--fg-dim); }}
.search-chip {{ padding:8px 16px; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--bg-card); color:var(--fg-muted); font-size:13px; font-weight:600; cursor:pointer; transition:color .18s cubic-bezier(.2,.8,.3,1.1), background-color .18s cubic-bezier(.2,.8,.3,1.1), border-color .18s cubic-bezier(.2,.8,.3,1.1), transform .18s cubic-bezier(.2,.8,.3,1.1); }}
.search-chip:hover {{ border-color:var(--fg-dim); color:var(--fg); }}
.search-chip.on {{ background: var(--accent-glow); border-color:rgba(56,189,248,.45); color:var(--accent); }}
.search-chip:focus-visible {{ outline:2px solid var(--accent); outline-offset:2px; }}

.chip-row {{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:22px; }}
.result-meta {{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:16px; font-size:14px; color:var(--fg-muted); flex-wrap:wrap; gap:8px; }}
.result-meta b {{ color:var(--fg); font-variant-numeric:tabular-nums; }}

/* Lista risultati — righe, non card (anti-card-overuse, density) */
.result-list {{ display:flex; flex-direction:column; }}
.result-row {{ display:flex; align-items:center; gap:12px; padding:12px 14px; border-top:1px solid var(--border); cursor:pointer; transition:background .15s; border-radius:var(--radius-sm); }}
.result-row:first-child {{ border-top:none; }}
.result-row:hover {{ background: rgba(56,189,248,.06); }}
.result-row .r-name {{ flex:1; font-weight:600; color:var(--fg); }}
.result-row .r-name small {{ display:block; color:var(--fg-dim); font-weight:400; font-size:12px; }}
.result-row .r-type {{ font-size:11px; color:var(--accent); background:rgba(56,189,248,.12); border:1px solid rgba(56,189,248,.25); padding:2px 9px; border-radius:20px; font-weight:600; }}
.r-none {{ color:var(--fg-muted); text-align:center; padding:60px 20px; border:1px dashed var(--border); border-radius:12px; }}

/* Statblock — doppio bezel */
.stat-bezel {{ background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.10); border-radius:20px; padding:12px; margin-top:20px; }}
@supports (backdrop-filter: blur(1px)) {{ .stat-bezel {{ backdrop-filter: blur(12px) saturate(140%); -webkit-backdrop-filter: blur(12px) saturate(140%); }} }}
.stat-core {{
    background: rgba(255, 255, 255, 0.045);
    border-radius: 12px;
    padding: 26px 28px;
    border-top: 3px solid var(--accent);
  }}
.st-h {{ display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:14px; }}
.st-h h2 {{ font-family:'Outfit',sans-serif; font-size:26px; font-weight:800; letter-spacing:-.01em; }}
.st-sub {{ color:var(--accent); font-style:italic; font-size:14px; margin-top:4px; }}
.st-meta {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px 18px; font-size:13.5px; background:rgba(15,23,42,.5); border:1px solid var(--border); padding:14px 16px; border-radius:var(--radius-sm); margin-bottom:16px; }}
.st-meta div {{ line-height:1.5; }}
.st-meta strong {{ color:var(--fg-dim); font-size:11px; text-transform:uppercase; letter-spacing:.05em; display:block; }}
.st-stats {{ display:grid; grid-template-columns:repeat(6,1fr); gap:8px; margin:14px 0 18px; }}
.st-stat {{ background:rgba(56,189,248,.05); border:1px solid var(--border); border-radius:var(--radius-sm); padding:8px; text-align:center; }}
.st-stat strong {{ display:block; font-size:10px; color:var(--fg-dim); letter-spacing:.04em; }}
.st-stat span {{ font-family:'JetBrains Mono',monospace; font-weight:600; font-variant-numeric:tabular-nums; font-size:18px; }}
.st-sec {{ margin-top:16px; }}
.st-sec h4 {{ color:var(--accent); font-size:13px; text-transform:uppercase; letter-spacing:.08em; margin-bottom:8px; font-weight:700; }}
.st-sec p, .st-sec li {{ font-size:14px; color:var(--fg-muted); line-height:1.7; margin-bottom:8px; }}
.st-sec li {{ list-style:none; }}
.st-sec li strong {{ color:var(--fg); }}
.st-src {{ font-size:11px; color:var(--fg-dim); margin-top:16px; font-family:'JetBrains Mono',monospace; }}
.rendered-by {{ font-size:11px; color:var(--fg-dim); margin-top:8px; }}
.st-loading {{ display:flex; flex-direction:column; gap:12px; padding:20px; }}
.skel {{ height:14px; border-radius:6px; background:linear-gradient(90deg,var(--bg-card) 0%,#1a2233 50%,var(--bg-card) 100%); background-size:200% 100%; animation:shimLk 1.2s ease-in-out infinite; }}
@media (prefers-reduced-motion: reduce) {{ .skel,.lookup-glow .dot {{ animation:none; }} }}
@keyframes shimLk {{ 0%{{background-position:200% 0}} 100%{{background-position:-200% 0}} }}

.db-badge {{ display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--success); background:rgba(52,211,153,.1); border:1px solid rgba(212,175,55,.32); padding:4px 8px; border-radius:20px; font-weight:600; }}
.where {{ color:var(--fg-muted); font-size:14px; line-height:1.7; margin-top:8px; }}
.where code {{ font-family:'JetBrains Mono',monospace; background:rgba(56,189,248,.1); padding:2px 8px; border-radius:5px; font-size:12px; }}

/* Tag converter (5e.tools inline tags -> HTML) */
.tag-link {{ color:var(--accent); text-decoration:none; border-bottom:1px dotted rgba(212,175,55,.5); cursor:pointer; transition:color .15s, border-color .15s; }}
.tag-link:hover {{ color:var(--gold); border-bottom-color:var(--gold); }}
.tag-link.tag-spell {{ font-style:italic; }}
.tag-link.tag-class {{ font-weight:700; border-bottom:1px solid rgba(212,175,55,.4); }}
.tag-link.tag-cond {{ color:var(--danger); border-bottom-color:rgba(201,128,138,.5); }}
.tag-link.tag-creature {{ font-weight:600; }}
.tag-link.tag-item {{ color:var(--silver); border-bottom-color:rgba(192,199,209,.5); }}
.tag-dc {{ font-family:'JetBrains Mono',monospace; font-weight:700; color:var(--fg); background:rgba(212,175,55,.12); padding:1px 6px; border-radius:5px; font-size:12.5px; white-space:nowrap; }}
.tag-hit {{ font-family:'JetBrains Mono',monospace; font-weight:600; color:var(--success); font-size:12.5px; }}
.tag-dice {{ font-family:'JetBrains Mono',monospace; font-weight:600; color:var(--gold); font-size:13px; }}
.tag-skill {{ color:var(--fg-muted); font-size:12.5px; }}
.st-links {{ display:flex; flex-wrap:wrap; gap:14px; margin-top:18px; padding-top:12px; border-top:1px dashed var(--border); font-size:12.5px; }}
.st-links .tag-link {{ border-bottom:none; background:rgba(255,255,255,.04); padding:4px 10px; border-radius:8px; border:1px solid var(--border); }}
.st-links .tag-link:hover {{ border-color:var(--accent); background:var(--accent-glow); }}
.st-spellcasting {{ background:rgba(212,175,55,.04); border:1px solid rgba(212,175,55,.18); border-radius:var(--radius-sm); padding:12px 16px; }}
.st-spellcasting h4 {{ margin-top:0; }}

/* Tabella classi (progressione per livello) */
.class-table {{ width:100%; border-collapse:collapse; font-size:12px; margin-top:8px; }}
.class-table th, .class-table td {{ padding:4px 6px; text-align:center; border-bottom:1px solid var(--border); }}
.class-table th {{ color:var(--fg-muted); font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.04em; }}
.class-table td:first-child {{ color:var(--accent); font-weight:700; }}
.class-table tr:hover td {{ background:rgba(212,175,55,.05); }}

/* Preferiti (stella) */
.fav-btn {{ display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:600; color:var(--fg-muted); background:transparent; border:1px solid var(--border); padding:4px 10px; border-radius:20px; cursor:pointer; transition:color .15s, border-color .15s, background .15s; }}
.fav-btn:hover {{ color:var(--fg); border-color:var(--fg-dim); }}
.fav-btn.on {{ color:var(--gold); border-color:rgba(212,175,55,.45); background:var(--accent-glow); }}

/* Print statblock (tavolo da gioco) */
@media print {{
  body {{ background:#fff; color:#000; }}
  header, footer, .search-bezel, .chip-row, #fav-list, .result-meta, .result-list, .st-links, .lookup-hero {{ display:none !important; }}
  .stat-bezel {{ border:1px solid #ccc; break-inside:avoid; }}
  .stat-core {{ background:#fff !important; color:#000; }}
  .st-stat, .st-meta {{ background:#f5f5f5 !important; border-color:#ddd; }}
  .st-stat strong, .st-meta strong {{ color:#444; }}
  .st-stat span {{ color:#000; }}
  .tag-link {{ color:#000; border-bottom:1px solid #999; }}
  .tag-dc, .tag-dice {{ background:#eee; color:#000; border:1px solid #ccc; }}
}}
</style>
</head>
<body>
{render_nav("cerca.html")}
<main class="lookup-app">
  <div class="lookup-hero">
    <span class="lookup-glow"><span class="dot" aria-hidden="true"></span> Dataset locale 5e.tools v2.35.1 &bull; offline-first</span>
    <h1>Lookup D&D <span>Completo</span></h1>
    <p>Motore di ricerca su <b>{LOOKUP_COUNT}</b> entità dal compendio open 5e.tools — mostri, incantesimi, oggetti magici, razze, sottorazze, talenti, background, divinità, lingue, condizioni, regole varianti. Ricerca istantanea full-text con fetch on-demand del file sorgente e fallback API SRD live.</p>
  </div>

  <div id="onboarding" class="card" style="margin-bottom:24px; padding:22px 26px; border-color:rgba(212,175,55,.35);">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
      <div style="max-width:70ch;">
        <h2 style="font-size:17px; font-weight:800; margin-bottom:8px;">Benvenuto nel Lookup D&D</h2>
        <p style="color:var(--fg-muted); font-size:14px; line-height:1.7; margin-bottom:8px;">
          <strong style="color:var(--fg);">1.</strong> Cerca un'entità (mostro, incantesimo, classe, oggetto) nella barra qui sopra — la ricerca è fuzzy, accetta anche typo.
          <strong style="color:var(--fg);">2.</strong> Filtra per categoria con i chip; per gli incantesimi appare anche il <strong style="color:var(--accent);">filtro per classe</strong>.
          <strong style="color:var(--fg);">3.</strong> Clicca un risultato per aprire lo statblock completo, con hyperlink incrociati e pulsante <em>Preferito</em>.
        </p>
        <p style="color:var(--fg-dim); font-size:12.5px;">
          Tutto gira offline dal database locale 5e.tools; il fallback API SRD live interroga dnd5eapi.co quando serve.
        </p>
      </div>
      <button id="onboard-dismiss" class="btn" style="padding:8px 16px; font-size:13px; min-height:36px;">Ho capito</button>
    </div>
  </div>
  <div id="app-root">Caricamento database...</div>
</div>
{render_footer()}
<script src="data/cerca-app.js?v={CACHE_BUST}" defer></script>
</body>
</html>
"""
def build_widgets() -> str:
    """Pagina Faerûn Tools: Calendario di Harptos interattivo + clima/stagione per regione.
    Dati lore canonici offline (12 mesi x 30 giorni + intercalari, ciclo lunare Selûne 30gg)."""
    import json as _json
    cal = _json.loads((SITE_DIR / "data" / "faerun-calendar.json").read_text(encoding="utf-8"))
    wx_css = (SITE_DIR / "assets" / "widgets-wx.css").read_text(encoding="utf-8")
    wx_js = (SITE_DIR / "assets" / "widgets-wx.js").read_text(encoding="utf-8")
    # Rifinitura visiva + "gemello di Faerûn" (matching climatico): inlinati DOPO
    # gli asset base, così gli override CSS vincono senza toccare i file esistenti.
    # Il vecchio motore "gemello di Faerûn" (wx-sky.js) è stato sostituito: la
    # direzione era invertita (meteo reale -> Faerûn) mentre ora si parte dalla
    # città dei Reami. Restano solo gli stili base dei widget.
    wx_sky_css = (SITE_DIR / "assets" / "wx-sky.css").read_text(encoding="utf-8")
    wx_faerun_js = (SITE_DIR / "assets" / "wx-faerun.js").read_text(encoding="utf-8")
    wx_faerun_css = (SITE_DIR / "assets" / "wx-faerun.css").read_text(encoding="utf-8")
    calendar_faerun_js = (SITE_DIR / "assets" / "calendar-harptos.js").read_text(encoding="utf-8")
    wx_cards = """    <div class="cal-card">
      <h3 style="font-size:18px; font-weight:800; margin-bottom:6px;">Meteo in gioco del Faerûn</h3>
      <p style="color:var(--fg-muted); font-size:13.5px; margin-bottom:14px; max-width:76ch;">Scegli una città dei Reami e leggi il suo meteo in gioco. Il dato proviene dalla città reale climaticamente più affine, selezionata automaticamente volta per volta dalle norme climatiche misurate: se le condizioni o la stagione cambiano, cambia la città e l'affinità mostrata si aggiorna. Senza rete il widget produce una stima stagionale dichiarata come tale.</p>
      <div class="fx-picker">
        <label class="dl" for="fx-city-pick">Città del Faerûn</label>
        <select id="fx-city-pick" aria-label="Città del Faerûn di cui mostrare il meteo in gioco"></select>
        <button id="fx-refresh" class="btn" style="min-height:38px;">Aggiorna</button>
        <button id="fx-geo" class="btn" style="min-height:38px;">Usa la mia posizione</button>
        <span id="fx-badge" class="wx-badge">inizializzazione…</span>
      </div>
      <div id="fx-now" class="wx-now" aria-live="polite"></div>
      <div id="fx-days" class="wx-live-grid" role="group" aria-label="Previsione dei prossimi tre giorni in gioco"></div>
      <p id="fx-prov" class="wx-meta"></p>
    </div>

    <!-- I dadi sono nella pagina Strumenti del Tavolo (tavolo.html) -->
"""
    months_js = _json.dumps(cal["months"], ensure_ascii=False)
    return f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Strumenti del Tavolo — calendario, meteo, dadi &mdash; Il Grimorio dei Reami</title>
{render_seo_head("widgets.html", "Strumenti del Tavolo — calendario, meteo, dadi — Il Grimorio dei Reami", "Calendario di Harptos interattivo (12 mesi, festival, fasi lunari di Selûne) e clima per regione del Forgotten Realms. Dati lore canonici offline.", 0.7)}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=optional" rel="stylesheet">
<style>
{SHARED_CSS}
.cal-app {{ max-width: 1000px; margin: 0 auto; padding: 40px 24px 80px; }}
.cal-hero {{ margin-bottom: 24px; }}
.cal-hero h1 {{ font-size: clamp(26px, 4vw, 36px); font-weight: 800; margin-bottom: 8px; }}
.cal-hero p {{ color: var(--fg-muted); max-width: 72ch; }}
.cal-card {{ background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 24px; margin-bottom: 24px; }}
.cal-nav {{ display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }}
.cal-nav h2 {{ font-size: 22px; font-weight: 800; }}
.cal-grid {{ display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }}
.cal-day {{ background: rgba(255,255,255,.04); border: 1px solid var(--border); border-radius: 10px; padding: 10px 6px; text-align: center; cursor: pointer; transition: background .15s, border-color .15s; min-height: 64px; }}
.cal-day:hover {{ border-color: var(--border-hover); background: rgba(255,255,255,.07); }}
.cal-day.sel {{ border-color: var(--accent); background: var(--accent-glow); box-shadow: 0 0 14px rgba(212,175,55,.2); }}
.cal-day.fest {{ border-color: rgba(201,138,138,.4); background: rgba(201,138,138,.08); }}
.cal-day .d-num {{ font-family: 'JetBrains Mono', monospace; font-weight: 700; font-variant-numeric: tabular-nums; font-size: 16px; }}
.cal-day .d-moon {{ font-size: 16px; margin-top: 4px; }}
.cal-day .d-fest {{ font-size: 10px; color: var(--danger); margin-top: 2px; }}
.cal-info {{ margin-top: 16px; font-size: 14px; color: var(--fg-muted); line-height: 1.7; }}
.wx-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }}
.wx-card {{ background: rgba(255,255,255,.04); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }}
.wx-card h4 {{ color: var(--accent); font-size: 14px; margin-bottom: 6px; }}
.wx-card p {{ font-size: 13px; color: var(--fg-muted); line-height: 1.6; }}
{wx_css}
{wx_sky_css}
{wx_faerun_css}
</style>
</head>
<body>
{render_nav("widgets.html")}
<main>
  <div class="cal-app">
    <div class="cal-hero">
      <h1>Faerûn Tools</h1>
      <p>Calendario di Harptos interattivo (12 mesi × 30 giorni + intercalari, ciclo lunare di Selûne) e clima tipico per regione. Dati lore canonici, offline.</p>
    </div>

    <div class="cal-card">
      <div class="cal-nav">
        <button id="cal-prev" class="btn" style="padding:8px 16px; min-height:36px;">&larr; Mese prec.</button>
        <div class="cal-head">
          <h2 id="cal-month">Hammer</h2>
          <span id="cal-season" class="cal-season"></span>
        </div>
        <button id="cal-next" class="btn" style="padding:8px 16px; min-height:36px;">Mese succ. &rarr;</button>
      </div>
      <div class="cal-controls">
        <label class="dl" for="cal-year">Anno di Dalereckoning</label>
        <select id="cal-year" aria-label="Anno DR della campagna"></select>
        <button id="cal-today" class="btn" style="min-height:36px;">Oggi nei Reami</button>
        <span class="cal-hint">Il festival &#9733; segue il mese; Shieldmeet cade ogni quattro anni dopo Midsummer.</span>
      </div>
      <div class="cal-grid" id="cal-grid"></div>
      <div class="cal-info" id="cal-info"></div>
      <p class="wx-meta" style="margin-top:10px;">Stagioni ancorate ai quattro festival:
        Midwinter (inverno) · Greengrass (primavera) · Midsummer (estate) · Highharvestide (autunno).</p>
    </div>

    <div class="cal-card">
      <h3 style="font-size:18px; font-weight:800; margin-bottom:8px;">Clima per Regione</h3>
      <p style="color:var(--fg-muted); font-size:13.5px; margin-bottom:12px; max-width:76ch;">Tutte le regioni presenti nel dataset dei Reami (non un sottoinsieme): il profilo è derivato dai dati delle città &mdash; media annua e classe di umidità &mdash; e dove esiste una descrizione d'autore viene mostrata quella. Usa il filtro per isolare una regione.</p>
      <div class="fx-picker">
        <label class="dl" for="fx-region-pick">Regione</label>
        <select id="fx-region-pick" aria-label="Filtra le regioni"></select>
      </div>
      <div class="wx-grid" id="fx-regions" data-collapse="620"
           data-collapse-label="Mostra tutte le regioni"
           data-collapse-label-open="Comprimi le regioni"></div>
    </div>

{wx_cards}
  </div>
</main>
<script>
window.FAERUN_MONTHS = {months_js};
{wx_js}
{wx_faerun_js}
</script>
<script>{calendar_faerun_js}</script>
</script>
{render_footer()}
</body>
</html>
"""


def build_mappa() -> str:
    # ══ MAPPA INTERATTIVA DI FAERÛN ══════════════════════════════════════════
    # Reverse engineering misurato di loremaps.net/maps/faerun (2026-10-15):
    #   - Leaflet 1.x, CRS di default, minZoom 0, zoom nativo = ceil(log2(4763/256)) = 5
    #   - maxZoom = nativo+1, maxBounds = bounds.pad(0.1), tileLayer noWrap+bounds
    #   - tiles: github.com/loremaps LoreMaps-Faerun-Tiles (GitHub Pages, pubblico)
    #   - marker: map.unproject([x,y], nativo) con coordinate in pixel immagine
    #   - immagine nativa 4763x3185, 1287.473 m/px (scala), pin SVG 26x34
    # I NOSTRI marker: 166 città del dataset meteo (lore IT + link lookup).
    # Layer extra: 8 dataset LoreMaps (297 luoghi) serviti LOCO da data/.
    img_w, img_h, img_mpp = 4763, 3185, 1287.473
    return f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
{render_seo_head("mappa.html", "Mappa interattiva di Faerûn — Il Grimorio dei Reami", "Mappa interattiva di Faerûn: città, porti, capitali, rovine e luoghi dei Forgotten Realms con schede informative, ricerca e livelli attivabili.")}
<title>Mappa di Faerûn &mdash; Il Grimorio dei Reami</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/vendor/leaflet.css">
<style>
{SHARED_CSS}
#faerun-map {{
  height: min(72vh, 860px); min-height: 420px;
  border-radius: 18px; border: 1px solid var(--border);
  background: #0b0d11; overflow: hidden;
  box-shadow: 0 18px 44px rgba(0,0,0,.5), 0 2px 10px rgba(0,0,0,.4);
  outline: none;
}}
.map-tools {{ display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin: 18px 0 14px; }}
.map-search {{ flex: 1 1 280px; display: flex; gap: 8px; }}
.map-search input {{
  flex: 1; background: var(--card); border: 1px solid var(--border); color: var(--fg);
  border-radius: 12px; padding: 10px 14px; font-size: 15px; font-family: inherit;
}}
.map-search input:focus {{ outline: 2px solid var(--accent); outline-offset: 1px; }}
.map-search button {{
  background: linear-gradient(145deg, #e8c95a, var(--gold) 55%, #8a6d18);
  color: #14110a; border: none; border-radius: 12px; padding: 10px 18px;
  font-weight: 700; cursor: pointer; font-family: inherit;
}}
.layers {{
  display: flex; flex-wrap: wrap; gap: 8px 14px; padding: 12px 16px;
  background: var(--card); border: 1px solid var(--border); border-radius: 14px;
  font-size: 13.5px;
}}
.layers label {{ display: inline-flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }}
.layers input {{ accent-color: var(--gold); width: 15px; height: 15px; }}
.layers .dot {{ width: 10px; height: 10px; border-radius: 50%; display: inline-block; }}
.map-note {{ color: var(--fg-muted); font-size: 13px; line-height: 1.55; margin-top: 14px; }}
.map-note a {{ color: var(--accent); }}
.leaflet-container {{ font-family: inherit; }}
.leaflet-popup-content-wrapper {{
  background: var(--card); color: var(--fg); border-radius: 14px;
  border: 1px solid var(--border); box-shadow: 0 12px 32px rgba(0,0,0,.55);
}}
.leaflet-popup-tip {{ background: var(--card); border: 1px solid var(--border); }}
.leaflet-popup-content {{ margin: 14px 16px; min-width: 210px; }}
.mp-name {{ font-weight: 800; font-size: 16px; color: var(--gold); margin-bottom: 4px; }}
.mp-region {{ font-size: 12.5px; color: var(--fg-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: .04em; }}
.mp-lore {{ font-size: 13.5px; line-height: 1.5; }}
.mp-link {{ display: inline-block; margin-top: 8px; color: var(--accent); font-size: 13px; font-weight: 600; }}
.leaflet-control-attribution {{ background: rgba(11,13,17,.82) !important; color: #94a3b8; font-size: 11px; }}
.leaflet-control-attribution a {{ color: var(--accent); }}
.leaflet-bar a {{ background: var(--card); color: var(--fg); border-color: var(--border); }}
.leaflet-bar a:hover {{ background: #1a1d24; }}
#map-fallback {{ display: none; padding: 26px; color: var(--fg-muted); }}
</style>
</head>
<body>
{render_nav("mappa.html")}
<main class="wrap">
  <h1>Mappa di <span>Faerûn</span></h1>
  <p class="lead">Città, porti, capitali, rovine e luoghi dei Forgotten Realms.
  Ogni città del nostro dataset ha la sua scheda con lore e link alla consultazione.</p>
  <div class="map-tools">
    <div class="map-search">
      <label for="map-q" class="sr-only" style="position:absolute;left:-9999px">Cerca un luogo</label>
      <input id="map-q" type="search" placeholder="Cerca una città (es. Waterdeep, Athkatla...)" autocomplete="off">
      <button id="map-go" type="button">Vai</button>
    </div>
  </div>
  <div id="faerun-map" role="application" aria-label="Mappa interattiva di Faerûn" tabindex="0"></div>
  <p id="map-fallback">La mappa richiede Leaflet (CDN unpkg). Se la vedi vuota, la CDN è momentaneamente irraggiungibile: aggiorna la pagina.</p>
  <div class="layers" id="map-layers" aria-label="Livelli della mappa"></div>
  <p class="map-note">Cartografia: <a href="https://loremaps.net" rel="noopener">LoreMaps</a> ·
  Map data <a href="http://www.pocketplane.net/" rel="noopener">Pocket Plane Group</a> ·
  Info <a href="https://forgottenrealms.fandom.com" rel="noopener">Forgotten Realms Wiki</a> ·
  Le posizioni dei luoghi sono derivate dai dataset aperti di LoreMaps; le schede delle città sono del Grimorio dei Reami.</p>
</main>
{render_footer()}
<script>/* salva l'helper i18n L() PRIMA che Leaflet (vendor) sovrascriva window.L */
window.__I18N_L = (typeof window.L === 'function') ? window.L : null;</script>
<script src="assets/vendor/leaflet.js"></script>
<script>
(function () {{
  var LM = (typeof window.L !== 'undefined' && typeof window.L.map === 'function') ? window.L : null;
  // Leaflet ha appena SOVRASCRITTO window.L; il resto della pagina (i18n condiviso)
  // chiama L(chiave). Ripristiniamo l'helper i18n salvato prima del vendor:
  // applyLang continuera' a tradurre con LABELS.it (navHome -> Home, ecc.).
  window.L = window.__I18N_L || function (k) {{ return k; }};
  if (!LM) {{
    document.getElementById('faerun-map').style.display = 'none';
    document.getElementById('map-fallback').style.display = 'block';
    return;
  }}
  var IMG = {{ w: {img_w}, h: {img_h}, tiles: 'assets/vendor/tiles', mpp: {img_mpp} }};
  var map = LM.map('faerun-map', {{ zoomControl: false, minZoom: 0 }});
  var NZ = Math.ceil(Math.log2(Math.max(IMG.w, IMG.h) / 256));
  var un = function (p) {{ return map.unproject(p, NZ); }};
  var bounds = LM.latLngBounds(un([0, 0]), un([IMG.w, IMG.h]));
  map.setMaxZoom(NZ + 1);
  map.setMaxBounds(bounds.pad(0.1));
  map.fitBounds(bounds);
  LM.control.zoom({{ position: 'bottomright' }}).addTo(map);
  LM.tileLayer(IMG.tiles + '/{{z}}/{{x}}/{{y}}.png', {{
    noWrap: true, bounds: bounds, maxNativeZoom: NZ, maxZoom: NZ + 1,
    attribution: '<a href="https://loremaps.net">LoreMaps</a> &middot; <a href="http://www.pocketplane.net/">Pocket Plane Group</a>'
  }}).addTo(map);

  var COLORI = {{ cities: '#4fa3c7', ports: '#e5a83b', portcapitals: '#5bc0a8', capitals: '#e0563f',
                  temples: '#9a7bc8', sites: '#d96fa4', fortresses: '#8a9a5b', ruins: '#b3907a' }};
  var LABEL = {{ cities: 'Citt&agrave;', ports: 'Porti', portcapitals: 'Porti/Capitali', capitals: 'Capitali',
                 temples: 'Templi', sites: 'Siti', fortresses: 'Fortezze', ruins: 'Rovine' }};
  function pin(color) {{
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">'
      + '<path d="M13 1C6.4 1 1 6.4 1 13c0 9 12 20 12 20s12-11 12-20C25 6.4 19.6 1 13 1z" fill="' + color + '" stroke="#1a1510" stroke-width="1.5"/>'
      + '<circle cx="13" cy="13" r="4.5" fill="#f5eeda"/></svg>';
    return LM.divIcon({{ className: 'lm-pin', html: svg, iconSize: [26, 34], iconAnchor: [13, 33], tooltipAnchor: [0, -30] }});
  }}
  function esc(s) {{ var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }}

  var nostri = LM.layerGroup().addTo(map);
  var extraLayers = {{}};
  var idxNostri = [];

  fetch('data/faerun-map-markers.json').then(function (r) {{ return r.json(); }}).then(function (d) {{
    (d.markers || []).forEach(function (m) {{
      var ll = un([m.x, m.y]);
      var lore = (m.lore || m.fact || '').toString().slice(0, 260);
      var pop = '<div class="mp-name">' + esc(m.name) + '</div>'
        + '<div class="mp-region">' + esc(m.region) + (m.verified ? ' &middot; verificata' : '') + '</div>'
        + (lore ? '<div class="mp-lore">' + esc(lore) + '</div>' : '')
        + '<a class="mp-link" href="cerca.html?q=' + encodeURIComponent(m.name) + '">Apri nella consultazione &rarr;</a>';
      var mk = LM.marker(ll, {{ icon: pin('#d4af37'), title: m.name, alt: m.name, riseOnHover: true }}).bindPopup(pop);
      mk.addTo(nostri);
      idxNostri.push({{ name: m.name.toLowerCase(), marker: mk }});
    }});
  }}).catch(function () {{}});

  fetch('data/faerun-map-layers.json').then(function (r) {{ return r.json(); }}).then(function (d) {{
    var panel = document.getElementById('map-layers');
    var html = '<label style="font-weight:700;color:var(--gold)"><input type="checkbox" id="ly-nostre" checked> <span class="dot" style="background:#d4af37"></span> Le nostre citt&agrave; (con scheda)</label> ';
    Object.keys(d.layers || {{}}).forEach(function (k) {{
      var lg = LM.layerGroup();
      (d.layers[k] || []).forEach(function (pt) {{
        LM.marker(un([pt.x, pt.y]), {{ icon: pin(COLORI[k] || '#888'), title: pt.name, alt: pt.name }})
          .bindPopup('<div class="mp-name">' + esc(pt.name) + '</div><div class="mp-region">' + (LABEL[k] || esc(k)) + '</div>'
            + '<a class="mp-link" href="https://forgottenrealms.fandom.com/wiki/Special:Search?query=' + encodeURIComponent(pt.name) + '" target="_blank" rel="noopener">Cerca nel Forgotten Realms Wiki &rarr;</a>')
          .addTo(lg);
      }});
      extraLayers[k] = lg;
      html += '<label><input type="checkbox" data-ly="' + k + '"> <span class="dot" style="background:' + (COLORI[k] || '#888') + '"></span> ' + (LABEL[k] || esc(k)) + '</label> ';
    }});
    panel.innerHTML = html;
    panel.addEventListener('change', function (ev) {{
      var t = ev.target;
      if (t.id === 'ly-nostre') {{ t.checked ? nostri.addTo(map) : map.removeLayer(nostri); return; }}
      var lg = extraLayers[t.getAttribute('data-ly')];
      if (lg) {{ t.checked ? lg.addTo(map) : map.removeLayer(lg); }}
    }});
  }}).catch(function () {{}});

  function cerca() {{
    var q = (document.getElementById('map-q').value || '').trim().toLowerCase();
    if (!q) return;
    var hit = null;
    for (var i = 0; i < idxNostri.length; i++) {{
      if (idxNostri[i].name.indexOf(q) !== -1) {{ hit = idxNostri[i]; break; }}
    }}
    if (!hit) return;
    map.flyTo(hit.marker.getLatLng(), NZ + 1, {{ duration: .8 }});
    setTimeout(function () {{ hit.marker.openPopup(); }}, 850);
  }}
  document.getElementById('map-go').addEventListener('click', cerca);
  document.getElementById('map-q').addEventListener('keydown', function (e) {{ if (e.key === 'Enter') cerca(); }});
}})();
</script>
</body>
</html>"""


def build_stats() -> str:
    from collections import Counter
    status_counts = Counter(r.get("status", "unknown") for r in records)
    cat_counts = Counter(r.get("cat", "unknown") for r in records)

    ok_val = status_counts["ok"]
    failed_val = status_counts["failed"]
    jsshell_val = status_counts["js_shell"]
    dead_val = status_counts["dead"]
    # 5° bucket: i record dietro login/paywall non erano mai letti -> la legenda
    # somma va a 228 solo includendoli (prima 134+54+21+18 = 227).
    loginwall_val = status_counts["login_wall"]

    # Il Compendio interattivo vive nella sua pagina: l'asset si legge qui, dove serve.
    compendio_js = (SITE_DIR / "assets" / "compendio.js").read_text(encoding="utf-8")

    def pct_round(v: int) -> int:
        """Percentuale arrotondata (prima `v*100//total` troncava 58,77 -> 58)."""
        return round(v * 100 / total) if total else 0

    # Pricing distribution: normalizza i pricing dichiarati nei record (109/228 + derivazioni)
    def _pricing_bucket(rr: dict) -> str:
        pw = (rr.get("pricing") or "").strip().lower()
        if not pw or pw in ("none", "unknown"):
            return "Non dichiarato"
        if "open-source" in pw or "mit" in pw or "apache" in pw or "gratuito (open" in pw:
            return "Open Source / MIT"
        if pw.startswith("free") or pw.startswith("gratuito") or "free tier" in pw or "demo gratuita" in pw or "generatori gratuiti" in pw:
            return "Gratuito"
        if "freemium" in pw or "piani opzionali" in pw or "contenuti gratuiti limitati" in pw:
            return "Freemium"
        if "$" in pw or "€" in pw or "usd" in pw or "eur " in pw or "pagamento" in pw or "a pagamento" in pw or "abbonamento" in pw or "licenza software" in pw or "sale price" in pw or "pay what" in pw:
            return "A Pagamento"
        return "Altro / Ibrido"

    price_buckets = Counter(_pricing_bucket(r) for r in records)
    bucket_order = ["Gratuito", "Freemium", "A Pagamento", "Open Source / MIT", "Altro / Ibrido", "Non dichiarato"]
    bucket_colors = {"Gratuito": "#d4af37", "Freemium": "#d4af37", "A Pagamento": "#d4af37",
                     "Open Source / MIT": "#9aa1ab", "Altro / Ibrido": "#9aa1ab", "Non dichiarato": "#475569"}
    price_total = sum(price_buckets.values())
    total = len(records)

    # SVG Bar Chart per categorie
    max_cat = max(cat_counts.values()) if cat_counts else 1
    bars_svg = []
    y_offset = 20
    for cat_key, cat_label in CAT_MAP.items():
        cnt = cat_counts.get(cat_key, 0)
        ok_cnt = sum(1 for r in records if r.get("cat") == cat_key and r.get("status") == "ok")
        width = int((cnt / max_cat) * 360)
        ok_width = int((ok_cnt / max_cat) * 360)
        
        bars_svg.append(f"""
        <text x="10" y="{y_offset + 14}" fill="#94a3b8" font-size="12" font-family="sans-serif">{html.escape(cat_label)}</text>
        <rect x="220" y="{y_offset}" width="{width}" height="18" rx="4" fill="#1e293b" />
        <rect x="220" y="{y_offset}" width="{ok_width}" height="18" rx="4" fill="#d4af37" />
        <text x="{230 + width}" y="{y_offset + 14}" fill="#f1f5f9" font-size="12" font-family="sans-serif">{ok_cnt}/{cnt}</text>
        """)
        y_offset += 32

    # Pricing distribution SVG bars
    max_price = max(price_buckets.values()) if price_buckets else 1
    price_svg = []
    py_off = 20
    for bucket in bucket_order:
        cnt = price_buckets.get(bucket, 0)
        if cnt == 0:
            continue
        width = int((cnt / max_price) * 360)
        color = bucket_colors.get(bucket, "#475569")
        pct = cnt * 100 // price_total if price_total else 0
        price_svg.append(f"""
        <text x="10" y="{py_off + 14}" fill="#94a3b8" font-size="12" font-family="sans-serif">{bucket}</text>
        <rect x="220" y="{py_off}" width="{width}" height="18" rx="4" fill="{color}"></rect>
        <text x="{232 + width}" y="{py_off + 14}" fill="#e6edf3" font-size="12" font-family="sans-serif">{cnt} ({pct}%)</text>
        """)
        py_off += 32

    return f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
{render_seo_head("stats.html", "Compendio dei Reami — numeri e curiosità — Il Grimorio dei Reami", "Dashboard analitica del sito: tassi di disponibilità, ripartizione pricing, analisi di Pareto e indice ECI.", 0.6)}

<title>Compendio dei Reami — numeri e curiosità &mdash; Il Grimorio dei Reami</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=optional" rel="stylesheet">
<style>
{SHARED_CSS}
.chart-grid {{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 24px;
  margin-bottom: 48px;
}}
.chart-card {{
  position: relative;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-md);
  padding: 24px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transition: border-color 0.2s;
}}
@supports (backdrop-filter: blur(1px)) {{
  .chart-card {{ backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%); }}
}}
.chart-card:hover {{ border-color: rgba(52, 211, 153, 0.30); }}
@media (prefers-reduced-transparency: reduce) {{
  .chart-card {{ background: var(--bg-card); backdrop-filter: none; -webkit-backdrop-filter: none; }}
}}
.chart-card h3 {{
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--fg);
}}
.audit-table {{
  width: 100%;
  border-collapse: collapse;
  background: rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 13.5px;
}}
@supports (backdrop-filter: blur(1px)) {{
  .audit-table {{ backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%); }}
}}
@media (prefers-reduced-transparency: reduce) {{
  .audit-table {{ background: var(--bg-card); backdrop-filter: none; -webkit-backdrop-filter: none; }}
}}
.audit-table th, .audit-table td {{
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}}
.audit-table th {{
  background: rgba(15, 23, 42, 0.8);
  color: var(--accent);
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.05em;
}}
</style>
</head>
<body>
{render_nav("stats.html")}

<main class="container" style="padding-top:36px;">
  <h1 style="font-size:32px; font-weight:800; margin-bottom:8px;">Compendio dei Reami</h1>
  <p style="color:var(--fg-muted); max-width:78ch; margin-bottom:18px;">
    I numeri del database, per chi gioca: quanti mostri per Grado di Sfida, quali scuole di magia
    sono più affollate, come si distribuiscono le rarità, quanto pesa ogni manuale. Ogni barra è
    cliccabile e porta alla consultazione già filtrata; «Sorprendimi» apre una scheda a caso.
  </p>

  <div class="cmp-actions">
    <button type="button" id="cmp-random" class="btn btn-primary" style="min-height:40px;">Sorprendimi: apri una scheda a caso</button>
    <span id="cmp-random-out" class="tv-meta" aria-live="polite"></span>
  </div>

  <div class="cmp-grid">
    <section class="cal-card cmp-card"><div id="cmp-tipi"></div></section>
    <section class="cal-card cmp-card"><div id="cmp-cr"></div></section>
    <section class="cal-card cmp-card"><div id="cmp-scuole"></div></section>
    <section class="cal-card cmp-card"><div id="cmp-rarita"></div></section>
    <section class="cal-card cmp-card"><div id="cmp-fonti"></div></section>
    <section class="cal-card cmp-card"><div id="cmp-fatti"></div></section>
  </div>

  <h2 class="section-title" style="margin-top:34px;">Dettagli tecnici del sito</h2>
  <p style="color:var(--fg-dim); font-size:12.5px; max-width:78ch; margin-bottom:10px;">
    Disponibilità delle risorse esterne, punteggi di verifica e metriche FAMS: servono alla
    manutenzione del sito, non al tavolo. Sono qui sotto, chiusi.
  </p>
  <div id="det-tecnici" data-collapse="420"
       data-collapse-label="Mostra i dettagli tecnici" data-collapse-label-open="Comprimi i dettagli tecnici">
  <p style="color:var(--fg-muted); font-size:16px; margin-bottom:32px;">
    Rappresentazione grafica e verifica formale dei 228 siti D&D analizzati su 11 batch distribuiti. Grafici renderizzati in SVG puro (zero dipendenze JS esterne).
  </p>

  <div class="chart-grid">
    <div class="chart-card">
      <h2>Distribuzione Risorse per Categoria (OK / Totale)</h2>
      <svg width="100%" height="320" viewBox="0 0 640 320" style="overflow:visible;">
        {''.join(bars_svg)}
      </svg>
      <div style="font-size:12px; color:var(--fg-dim); margin-top:8px;">Barra ciano = Risorse con fetch verificato (OK). Barra scura = Totale scansionato.</div>
    </div>

    <div class="chart-card">
      <h3>Ripartizione dello Stato Operativo (228 Siti)</h3>
      <div style="display:flex; align-items:center; justify-content:center; padding:20px 0;">
        <svg width="200" height="200" viewBox="0 0 42 42" style="transform: rotate(-90deg);">
          <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#1e293b" stroke-width="6"></circle>
          <!-- OK Segment (59%) -->
          <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#d4af37" stroke-width="6" stroke-dasharray="58.77 41.23" stroke-dashoffset="0"></circle>
          <!-- Failed Segment (24%) -->
          <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#c9808a" stroke-width="6" stroke-dasharray="23.68 76.32" stroke-dashoffset="-58.77"></circle>
          <!-- JS Shell Segment (9%) -->
          <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#d4af37" stroke-width="6" stroke-dasharray="9.21 90.79" stroke-dashoffset="-82.45"></circle>
          <!-- Dead Segment (8%) -->
          <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#9aa1ab" stroke-width="6" stroke-dasharray="7.89 92.11" stroke-dashoffset="-91.66"></circle>
        </svg>
      </div>
      <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; font-size:13px;">
        <div><span style="color:#d4af37;">■</span> <strong>{ok_val} OK ({pct_round(ok_val)}%)</strong> &mdash; Verificate</div>
        <div><span style="color:#c9808a;">■</span> <strong>{failed_val} Failed ({pct_round(failed_val)}%)</strong> &mdash; Blocco/Rate-limit</div>
        <div><span style="color:#d4af37;">■</span> <strong>{jsshell_val} JS-Shell ({pct_round(jsshell_val)}%)</strong> &mdash; SPA Live</div>
        <div><span style="color:#9aa1ab;">■</span> <strong>{dead_val} Dead ({pct_round(dead_val)}%)</strong> &mdash; 404/Dismessi</div>
        <div><span style="color:#8b93a1;">■</span> <strong>{loginwall_val} Login-wall ({pct_round(loginwall_val)}%)</strong> &mdash; Dietro autenticazione</div>
        <div style="grid-column:1/-1; margin-top:4px; color:var(--fg-dim); font-size:12px;">Totale: <strong>{ok_val + failed_val + jsshell_val + dead_val + loginwall_val}</strong> record ({pct_round(ok_val)}+{pct_round(failed_val)}+{pct_round(jsshell_val)}+{pct_round(dead_val)}+{pct_round(loginwall_val)} = 100%)</div>
      </div>
    </div>

    <div class="chart-card">
      <h3>Modelli di Prezzo Dichiarati (228 Siti)</h3>
      <svg width="100%" height="240" viewBox="0 0 640 240" style="overflow:visible;">
        {''.join(price_svg)}
      </svg>
      <div style="font-size:12px; color:var(--fg-dim); margin-top:8px;">Classificazione dai pricing dichiarati sulle pagine dei siti (109 dichiarazioni testuali + derivazioni: open-source, MIT, freemium, Patreon).</div>
    </div>
  </div>

  <h2 style="font-size:22px; font-weight:700; margin-bottom:16px;">Risultati Analisi FAMS-v4 &amp; Mitigazioni Ingegneristiche</h2>
  <table class="audit-table" style="margin-bottom:48px;">
    <thead>
      <tr>
        <th>Codice FM</th>
        <th>Modalità di Guasto Mitigata</th>
        <th>RPN Pre</th>
        <th>RPN Post</th>
        <th>Soluzione Implementata sul Sito</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>FM-01 / FM-02</strong></td>
        <td>Downtime origine o scadenza quick tunnel</td>
        <td>192</td>
        <td><span class="badge badge-free">24</span></td>
        <td>Cron Watchdog 15m autonomo (<code>site-watchdog.py</code>) su loop continuo</td>
      </tr>
      <tr>
        <td><strong>FM-03</strong></td>
        <td>Screening page "Caution" di Pinggy</td>
        <td>120</td>
        <td><span class="badge badge-free">0</span></td>
        <td>Migrazione a Cloudflare Quick Tunnel (nessun interstitial browser)</td>
      </tr>
      <tr>
        <td><strong>FM-04</strong></td>
        <td>URL effimero non rintracciabile</td>
        <td>126</td>
        <td><span class="badge badge-free">18</span></td>
        <td>Persistenza atomica su <code>current-url.json</code> via watchdog</td>
      </tr>
      <tr>
        <td><strong>FM-05</strong></td>
        <td>Degrado interfaccia con JavaScript disabilitato</td>
        <td>90</td>
        <td><span class="badge badge-free">12</span></td>
        <td>Blocco <code>&lt;noscript&gt;</code> statico con tutte le 134 risorse iniettate al build</td>
      </tr>
      <tr>
        <td><strong>FM-08</strong></td>
        <td>Blocco I/O con richieste simultanee</td>
        <td>80</td>
        <td><span class="badge badge-free">8</span></td>
        <td>Server multi-thread dedicato <code>ThreadingHTTPServer</code> su porta 8777</td>
      </tr>
    </tbody>
  </table>

  <div class="chart-card" style="margin-top:24px;">
    <h3>FAMS-v4 — Pareto &amp; Indice di Confidenza Epistemica</h3>
    <p style="color:var(--fg-muted); font-size:13.5px; margin-bottom:16px;">
      Sintesi della verifica sistemica del sito (report <code>fams-v4-report.md</code>): modi di
      guasto quantificati, frontiera di Pareto sulle azioni residue e confidenza epistemica
      calcolata sulle variabili di sistema dichiarate.
    </p>
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 170px), 1fr)); gap:12px;">
      <div class="stat-box">
        <div class="num">90.0%</div>
        <div class="lbl">ECI (4 variabili ignote su 40)</div>
      </div>
      <div class="stat-box">
        <div class="num">11</div>
        <div class="lbl">Modi di guasto (FMEA)</div>
      </div>
      <div class="stat-box">
        <div class="num">4</div>
        <div class="lbl">Azioni non dominate (Pareto)</div>
      </div>
      <div class="stat-box">
        <div class="num">288 &rarr; 2</div>
        <div class="lbl">RPN peggiore, prima &rarr; dopo</div>
      </div>
    </div>
    <p style="color:var(--fg-dim); font-size:12.5px; margin-top:14px;">
      Frontiera di Pareto (impatto massimo, costo e rischio minimi): <strong>A · C · D · G</strong>.
      Criterio formale: una soluzione è dominata se un'altra è pari su tutti i criteri e superiore
      su almeno uno. Le variabili epistemiche ignote (rendering su dispositivi fisici, stabilità
      dell'URL pubblico, screen reader reali, Core Web Vitals con throttling) sono dichiarate, non stimate.
    </p>
  </div>
<script>{compendio_js}</script>
</main>

{render_footer()}
</body>
</html>
"""

# ------------------------------------------------------------------------------
# 8. Generazione SITEMAP.XML & ROBOTS.TXT
# ------------------------------------------------------------------------------
def build_seo() -> None:
    _cur_url = None
    try:
        _cur_url = json.loads((SITE_DIR / "current-url.json").read_text(encoding="utf-8")).get("url")
    except Exception:
        _cur_url = None
    _sitemap_abs = (_cur_url.rstrip("/") + "/sitemap.xml") if _cur_url else "http://127.0.0.1:8777/sitemap.xml"
    robots_txt = f"""User-agent: *
Allow: /
Sitemap: {_sitemap_abs}
"""
    (SITE_DIR / "robots.txt").write_text(robots_txt, encoding="utf-8")

    today = datetime.datetime.now().strftime("%Y-%m-%d")
    # <loc> ASSOLUTI: la specifica sitemap 0.9 li richiede assoluti (i relativi
    # vengono ignorati dai crawler) e devono coprire TUTTE le pagine, widgets.html
    # inclusa (prima mancava). L'URL della home coincide col canonical (…/index.html).
    _base = (_cur_url.rstrip("/") if _cur_url else "http://127.0.0.1:8777")
    _pages = [
        ("index.html", "1.0", "daily"),
        ("risorse.html", "0.9", "daily"),
        ("cerca.html", "0.8", "weekly"),
        ("widgets.html", "0.8", "weekly"),
        ("tavolo.html", "0.8", "weekly"),
        ("personaggi.html", "0.85", "weekly"),
        ("lfg.html", "0.8", "weekly"),
        ("stats.html", "0.7", "weekly"),
    ]
    _entries = "\n".join(
        f"  <url>\n    <loc>{_base}/{p}</loc>\n    <lastmod>{today}</lastmod>\n"
        f"    <changefreq>{cf}</changefreq>\n    <priority>{pr}</priority>\n  </url>"
        for p, pr, cf in _pages
    )
    sitemap_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{_entries}\n</urlset>\n"
    )
    (SITE_DIR / "sitemap.xml").write_text(sitemap_xml, encoding="utf-8")

# ------------------------------------------------------------------------------
# 9. Main Builder Execution
# ------------------------------------------------------------------------------

def build_tavolo() -> str:
    """Pagina Strumenti del Tavolo: dadi + strumenti usabili durante la partita.

    Tutto funziona nel browser e senza rete; l'unica chiamata esterna è la lettura
    dell'indice locale degli oggetti, usata dal generatore di tesori.
    """
    wx_css = (SITE_DIR / "assets" / "widgets-wx.css").read_text(encoding="utf-8")
    wx_js = (SITE_DIR / "assets" / "widgets-wx.js").read_text(encoding="utf-8")
    tv_css = (SITE_DIR / "assets" / "tavolo.css").read_text(encoding="utf-8")
    tv_js = (SITE_DIR / "assets" / "tavolo.js").read_text(encoding="utf-8")
    strumenti_js = (SITE_DIR / "assets" / "strumenti-quick.js").read_text(encoding="utf-8")

    presets = ["Goblin", "Orco", "Bandito", "Scheletro", "Lupo", "Ogre", "Drago", "Capo banda"]
    quick = "".join(
        f'<button type="button" class="tv-chip" data-preset="{n}" data-mod="{m}">{n} {m:+d}</button>'
        for n, m in zip(presets, [2, 2, 1, 0, 2, 0, 5, 3])
    )

    return f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Strumenti del Tavolo — dadi, iniziativa, tesori &mdash; Il Grimorio dei Reami</title>
{render_seo_head("tavolo.html", "Strumenti del Tavolo — dadi, iniziativa, tesori — Il Grimorio dei Reami", "Strumenti da tavolo per D&amp;D: dadi con vantaggio/svantaggio, ordine di iniziativa, tesori casuali dal database, generatore di nomi e PNG, oracolo sì/no, contatore di turni. Tutto offline.", 0.75)}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=optional" rel="stylesheet">
<style>
{SHARED_CSS}
{wx_css}
{tv_css}
</style>
</head>
<body>
{render_nav("tavolo.html")}

<main class="container" id="tavolo-app">
  <div class="cal-hero" style="margin-bottom:22px;">
    <h1>Strumenti del Tavolo</h1>
    <p style="color:var(--fg-muted); max-width:78ch;">
      Tutto ciò che serve durante la partita, senza cambiare applicazione: dadi, ordine di
      iniziativa, tesori tirati sul momento, nomi e PNG improvvisati, oracolo per le decisioni
      e contatore dei turni. Funziona anche senza rete; l'unica cosa che legge dal sito è
      l'elenco degli oggetti magici, usato per i tesori.
    </p>
  </div>

  <div class="cal
<section class="cal-card tv-card">
      <h2 class="tv-sec">Ordine di iniziativa</h2>
      <form id="ini-add" class="tv-form">
        <input id="ini-name" type="text" placeholder="Nome del combattente" aria-label="Nome del combattente" maxlength="40">
        <input id="ini-mod" type="number" value="0" min="-10" max="15" aria-label="Modificatore di iniziativa" style="max-width:96px;">
        <button type="submit" class="btn" style="min-height:40px;">Aggiungi e tira</button>
      </form>
      <div class="tv-chips" id="ini-quick">{quick}</div>
      <ol class="ini-list" id="ini-list"></ol>
      <div class="tv-actions">
        <button type="button" id="ini-next" class="btn" style="min-height:38px;">Prossimo turno</button>
        <button type="button" id="ini-rollall" class="btn" style="min-height:38px;">Ritira tutto</button>
        <button type="button" id="ini-reset" class="btn" style="min-height:38px;">Azzera</button>
        <span class="tv-meta" id="ini-round"></span>
      </div>
    </section>
    <h2 class="tv-sec">Dadi</h2>
    <div class="dice-grid" id="dice-grid" role="group" aria-label="Selezione del dado"></div>
    <div class="dice-panel">
      <div><label class="dl" for="dice-n">Quantità</label><input id="dice-n" type="number" min="1" max="20" value="1" style="width:100%;"></div>
      <div><label class="dl" for="dice-mod">Modificatore</label><input id="dice-mod" type="number" min="-10" max="10" value="0" style="width:100%;"></div>
      <div><label class="dl" for="dice-mode">Modalità</label><select id="dice-mode" style="width:100%;"><option value="n">Normale</option><option value="adv">Vantaggio</option><option value="dis">Svantaggio</option></select></div>
      <div><button id="dice-roll" class="btn" style="min-height:44px; width:100%;">Tira i dadi</button></div>
    </div>
    <div class="dice-out" id="dice-out" aria-live="polite">—</div>
    <div class="dice-detail" id="dice-detail"></div>
    <div class="dice-prob" id="dice-prob" aria-live="polite"></div>
    <div class="dice-log" id="dice-log" aria-label="Cronologia tiri"></div>
  </div>

  <div class="cal-card" id="tool-incontro">
    <h2 class="tv-sec">Calcolatore di incontro 5e</h2>
    <p style="color:var(--fg-muted); max-width:78ch; margin-top:0;">
      Budget XP dell'incontro con le regole <b>2014</b> (soglie + moltiplicatore per numero di
      mostri) e <b>2024</b> (budget per carattere, niente moltiplicatore). Numeri dalle tabelle
      ufficiali, non stime.
    </p>
    <div class="tv-form" style="display:flex; flex-wrap:wrap; gap:10px; align-items:end;">
      <label class="dl-wrap" style="display:flex; flex-direction:column; gap:4px; font-size:12.5px; color:var(--fg-muted);">
        Personaggi
        <input id="enc-party" type="number" min="1" max="12" value="4" inputmode="numeric" style="min-width:84px; min-height:40px; padding:6px 10px; background:rgba(255,255,255,.05); color:inherit; border:1px solid var(--border); border-radius:8px; font:inherit;">
      </label>
      <label class="dl-wrap" style="display:flex; flex-direction:column; gap:4px; font-size:12.5px; color:var(--fg-muted);">
        Livello
        <input id="enc-liv" type="number" min="1" max="20" value="5" inputmode="numeric" style="min-width:84px; min-height:40px; padding:6px 10px; background:rgba(255,255,255,.05); color:inherit; border:1px solid var(--border); border-radius:8px; font:inherit;">
      </label>
      <label class="dl-wrap" style="display:flex; flex-direction:column; gap:4px; font-size:12.5px; color:var(--fg-muted);">
        Mostri
        <input id="enc-n" type="number" min="1" max="30" value="2" inputmode="numeric" style="min-width:84px; min-height:40px; padding:6px 10px; background:rgba(255,255,255,.05); color:inherit; border:1px solid var(--border); border-radius:8px; font:inherit;">
      </label>
      <label class="dl-wrap" style="display:flex; flex-direction:column; gap:4px; font-size:12.5px; color:var(--fg-muted);">
        CR medio
        <input id="enc-cr" type="number" min="0" max="30" step="0.5" value="3" inputmode="decimal" style="min-width:84px; min-height:40px; padding:6px 10px; background:rgba(255,255,255,.05); color:inherit; border:1px solid var(--border); border-radius:8px; font:inherit;">
      </label>
      <label class="dl-wrap" style="display:flex; flex-direction:column; gap:4px; font-size:12.5px; color:var(--fg-muted);">
        Regole
        <select id="enc-ed" style="min-width:96px; min-height:40px; padding:6px 10px; background:rgba(255,255,255,.05); color:inherit; border:1px solid var(--border); border-radius:8px; font:inherit;">
          <option value="2024">2024</option>
          <option value="2014">2014</option>
        </select>
      </label>
    </div>
    <div class="dice-out" id="enc-out" aria-live="polite" style="margin-top:12px;">—</div>
    <p style="color:var(--fg-muted); font-size:12px; margin:10px 0 0;">
      Regole 2024: i budget per liv. 2, 4 e 6-20 sono interpolati sui valori pubblicati
      (liv. 1, 3, 5, 10 — SRD 5.2.1). Dichiarato, non inventato.
    </p>
  </div>

  <div class="cal-card" id="tool-slot">
    <h2 class="tv-sec">Slot d'incantesimo per livello</h2>
    <p style="color:var(--fg-muted); max-width:78ch; margin-top:0;">Slot per classe incantatrice per livello (recuperi al riposo lungo). Classi con incantesimi "pact" (warlock) hanno slot diversi.</p>
    <div class="tv-form" style="display:flex; flex-wrap:wrap; gap:10px; align-items:end;">
      <label style="display:flex; flex-direction:column; gap:4px; font-size:12.5px; color:var(--fg-muted);">Livello lanciatore
        <select id="slot-liv" style="min-width:96px; min-height:40px; padding:6px 10px; background:rgba(255,255,255,.05); color:inherit; border:1px solid var(--border); border-radius:8px; font:inherit;">
        </select>
      </label>
    </div>
    <div class="dice-out" id="slot-out" aria-live="polite" style="margin-top:12px;">—</div>
  </div>

  <div class="cal-card" id="tool-condizioni">
    <h2 class="tv-sec">Condizioni 5e (2024)</h2>
    <p style="color:var(--fg-muted); max-width:78ch; margin-top:0;">Le 15 condizioni con la regola completa e un segnaposto per chi ha cosa.</p>
    <div id="cond-lista" style="display:grid; gap:6px;"></div>
  </div>

  <div class="cal-card" id="tool-viaggio">
    <h2 class="tv-sec">Viaggi e visibilità</h2>
    <p style="color:var(--fg-muted); max-width:78ch; margin-top:0;">Velocità a piedi/cavallo per ritmo, e quanto si vede per condizione del cielo (DMG 2024).</p>
    <div id="viaggio-out"></div>
  </div>

  <div class="cal-card" id="tool-crafting">
    <h2 class="tv-sec">Prezzi e crafting di oggetti magici</h2>
    <p style="color:var(--fg-muted); max-width:78ch; margin-top:0;">Costo d'acquisto e giorni di lavoro per rarità (DMG 2024: costo/10, 25 mo al giorno).</p>
    <div id="crafting-out"></div>
  </div>



  <div class="tv-grid">
    

    <section class="cal-card tv-card">
      <h2 class="tv-sec">Tesoro sul momento</h2>
      <div class="tv-form">
        <label class="dl" for="tre-tier">Fascia</label>
        <select id="tre-tier">
          <option value="1-4">livelli 1-4</option>
          <option value="5-10">livelli 5-10</option>
          <option value="11-16">livelli 11-16</option>
          <option value="17+">livelli 17+</option>
        </select>
        <button type="button" id="tre-roll" class="btn" style="min-height:40px;">Tira il tesoro</button>
      </div>
      <div id="tre-out" class="tre-out" aria-live="polite"></div>
      <p class="tv-meta">Le quantità di monete sono una riduzione pratica per tirare al volo, non le tabelle ufficiali del Manuale del Dungeon Master. L'oggetto magico è estratto dal database del sito.</p>
    </section>

    <section class="cal-card tv-card">
      <h2 class="tv-sec">Nomi e PNG improvvisati</h2>
      <div class="tv-form">
        <label class="dl" for="nom-culture">Cultura</label>
        <select id="nom-culture"></select>
        <button type="button" id="nom-roll" class="btn" style="min-height:40px;">Genera nomi</button>
        <button type="button" id="npc-roll" class="btn" style="min-height:40px;">Genera un PNG</button>
      </div>
      <div id="nom-out" class="tv-out" aria-live="polite"></div>
      <div id="npc-out" class="tv-out" aria-live="polite"></div>
    </section>

    <section class="cal-card tv-card">
      <h2 class="tv-sec">Oracolo sì / no</h2>
      <div class="tv-form">
        <input id="ora-q" type="text" placeholder="La domanda che fai al destino" aria-label="Domanda per l'oracolo" maxlength="120">
        <select id="ora-prob" aria-label="Probabilità dichiarata"></select>
        <button type="button" id="ora-ask" class="btn" style="min-height:40px;">Chiedi</button>
      </div>
      <div id="ora-out" class="tv-out" aria-live="polite"></div>
      <p class="tv-meta">Utile per il DM alle prese con un imprevisto o per il gioco in solitaria: la probabilità la dichiari tu, il tiro è trasparente.</p>
    </section>

    <section class="cal-card tv-card">
      <h2 class="tv-sec">Turni e tempo</h2>
      <div class="tv-actions">
        <span class="tim-out" id="tim-out" aria-live="off">0:00</span>
        <button type="button" id="tim-start" class="btn" style="min-height:38px;">Avvia</button>
        <button type="button" id="tim-stop" class="btn" style="min-height:38px;">Pausa</button>
        <button type="button" id="tim-reset" class="btn" style="min-height:38px;">Azzera</button>
      </div>
      <p class="tv-meta">Un minuto di sabbia per il turno: utile per tenere il ritmo quando il tavolo si distrae.</p>
      <div class="tv-form" style="margin-top:14px;">
        <span class="tv-out" id="rnd-out2" style="min-width:110px; text-align:center;">Round 0</span>
        <button type="button" id="rnd-plus" class="btn">+1 Round</button>
        <button type="button" id="rnd-reset" class="btn">Azzera round</button>
      </div>
      <div class="tv-form" style="margin-top:10px;">
        <input id="eff-nome" type="text" placeholder="Effetto (es. Incastro, Avvelenato)" aria-label="Nome effetto" maxlength="40">
        <input id="eff-giri" type="number" min="1" max="99" value="2" aria-label="Durata in round" style="max-width:90px;">
        <button type="button" id="eff-add" class="btn">Traccia</button>
      </div>
      <div id="eff-list" class="tv-out" aria-live="polite" style="margin-top:8px;"></div>
      <p class="tv-meta">Il combattimento vive in ROUND: ogni "+1 Round" scala i countdown degli effetti e toglie gli scaduti.</p>
    </section>
  </div>
</main>

<script>{wx_js}</script>
<script>{tv_js}</script>
<script>{strumenti_js}</script>
{render_footer()}
</body>
</html>
"""


RC_CSS = """<style>
.rc-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 12px}
.rc-tab{border:1px solid var(--border,#3a3a44);background:transparent;color:var(--fg-muted,#a9a9b6);
  padding:7px 12px;border-radius:10px;cursor:pointer;font:inherit;font-size:.86rem}
.rc-tab.on{border-color:var(--accent,#c9a227);color:var(--fg,#f2f2f5)}
.rc-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:12px}
.rc-kpi{border:1px solid var(--border,#3a3a44);border-radius:10px;padding:8px 10px}
.rc-kpi-l{color:var(--fg-muted,#a9a9b6);font-size:.68rem;text-transform:uppercase;letter-spacing:.04em}
.rc-kpi-v{font-size:1.05rem;font-weight:600}
.rc-ctrl{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:10px 0}
.rc-select{background:rgba(255,255,255,.05);color:inherit;border:1px solid var(--border,#3a3a44);
  border-radius:8px;padding:6px 8px;font:inherit;max-width:100%}
.rc-num{font-variant-numeric:tabular-nums;font-size:.85rem;color:var(--fg-muted,#a9a9b6)}
.rc-table{width:100%;border-collapse:collapse;font-size:.84rem}
.rc-table th,.rc-table td{text-align:right;padding:6px 7px;border-bottom:1px solid var(--border,#3a3a44)}
.rc-table th:first-child,.rc-table td:first-child,.rc-table th:nth-child(2),.rc-table td:nth-child(2){text-align:left}
.rc-table th{color:var(--fg-muted,#a9a9b6);font-size:.7rem;text-transform:uppercase;font-weight:500}
.rc-table td.rc-note{text-align:left;color:var(--fg-muted,#a9a9b6);font-size:.76rem}
tr.rc-top td{color:var(--accent,#c9a227);font-weight:600}
tr.rc-detrow td{border-bottom:1px solid transparent;padding-top:0}
.rc-rank{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}
.rc-rank-n{width:24px;color:var(--fg-muted,#a9a9b6);font-size:.85rem}
.rc-rank-mid{flex:1;min-width:0}
.rc-rank-name{font-weight:600;font-size:.9rem}
.rc-bar{height:6px;border-radius:4px;background:var(--border,#3a3a44);margin:5px 0}
.rc-bar-fill{height:6px;border-radius:4px;background:var(--accent,#c9a227)}
.rc-rank-det{color:var(--fg-muted,#a9a9b6);font-size:.74rem;line-height:1.45;word-break:break-word}
.rc-rank-score{font-variant-numeric:tabular-nums;font-weight:600;color:var(--accent,#c9a227);min-width:56px;text-align:right}
.rc-badge{font-size:.68rem;padding:1px 6px;border-radius:6px;border:1px solid var(--border,#3a3a44);color:var(--fg-muted,#a9a9b6)}
.rc-fonti{margin-top:8px;padding-top:7px;border-top:1px solid var(--border,#3a3a44);font-size:.72rem;
  color:var(--fg-muted,#a9a9b6);line-height:1.6;word-break:break-word}
.rc-fonti-lab{text-transform:uppercase;letter-spacing:.04em;font-size:.66rem;margin-right:6px}
.rc-fonti-lnk{color:inherit;text-decoration:underline;margin-right:9px;white-space:nowrap}
.rc-fonti-lnk:hover{color:var(--accent,#c9a227)}
@media (max-width:520px){.rc-table{font-size:.76rem}.rc-rank-name{font-size:.84rem}}
</style>"""


def build_personaggi() -> str:
    """Pagina del generatore di personaggi: creazione guidata + categorie.

    Il calcolo dei valori (PF, CA, BC, tiri salvezza, CD incantesimi) avviene nel
    browser a partire dai dati reali delle classi: la pagina non contiene personaggi
    pre-confezionati, contiene il motore e i menu.
    """
    pg_css = (SITE_DIR / "assets" / "personaggi.css").read_text(encoding="utf-8")
    pg_js = (SITE_DIR / "assets" / "personaggi.js").read_text(encoding="utf-8")
    # Elenco VERO delle cartelle di livello presenti su disco: la pagina collega solo
    # queste (il gate dei link segnalava /pdf/levels/T01/lv20.pdf e simili, che NON
    # esistono: pdf/levels ha 37 cartelle e 37 lv20.pdf, nessuna T0x).
    _pdfdir = SITE_DIR / "pdf" / "levels"
    PDF_LEVELS_PRESENTI = sorted(p.name for p in _pdfdir.iterdir()
                                 if p.is_dir() and (p / "lv20.pdf").is_file()) \
        if _pdfdir.is_dir() else []
    raggiungibili_js = "window.PDF_LEVELS = " + __import__("json").dumps(PDF_LEVELS_PRESENTI) + ";\n"
    ric_js = (SITE_DIR / "assets" / "ricerca.js").read_text(encoding="utf-8")
    sp_js = (SITE_DIR / "assets" / "scheda-pdf.js").read_text(encoding="utf-8")
    return f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Generatore di Personaggi &mdash; creazione guidata e per categorie &mdash; Il Grimorio dei Reami</title>
{render_seo_head("personaggi.html", "Generatore di Personaggi — creazione guidata e per categorie — Il Grimorio dei Reami", "Crea un personaggio D&amp;D 5e passo per passo (edizione, classe, livello, sottoclasse, razza, talenti, incantesimi) oppure genera personaggi casuali per 26 categorie di ruolo, con le build del canale d4: D&amp;D Deep Dive.", 0.85)}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=optional" rel="stylesheet">
<style>
{SHARED_CSS}
{pg_css}
{RC_CSS}
</style>
</head>
<body>
{render_nav("personaggi.html")}

<main class="container" id="pg-app">
  <div class="cal-hero" style="margin-bottom:22px;">
    <h1>Generatore di Personaggi</h1>
    <p style="color:var(--fg-muted); max-width:80ch;">
      Due modi per creare un personaggio di D&amp;D 5e. <strong>Guidato</strong>: scegli edizione,
      classe, livello, sottoclasse, razza, talenti e incantesimi dai menu, e leggi la scheda con i
      valori calcolati. <strong>Per categorie</strong>: 26 ruoli («DPS», «Healer», «Tank»,
      «Battlefield Controller»…) popolati con personaggi pronti, dove possibile con il nome delle
      build reali del canale d4: D&amp;D Deep Dive.
    </p>
  </div>

  <section class="cal-card">
    <h2 class="cmp-h3">1 · Creazione guidata</h2>
    <div class="pg-form">
      <div><label class="dl" for="pg-ed">Edizione (dalla fonte)</label>
        <select id="pg-ed"><option value="2014">2014 (PHB, XGE…)</option><option value="2024">2024 (XPHB…)</option></select></div>
      <div><label class="dl" for="pg-classe">Classe</label><select id="pg-classe"></select></div>
      <div><label class="dl" for="pg-liv">Livello</label>
        <input id="pg-liv" type="number" min="1" max="20" value="5"></div>
      <div><label class="dl" for="pg-sottoclasse">Sottoclasse</label><select id="pg-sottoclasse"></select></div>
      <div><label class="dl" for="pg-razza">Razza / Specie</label><select id="pg-razza"></select></div>
      <div><label class="dl" for="pg-bg">Background</label><select id="pg-bg"></select></div>
      <div><label class="dl" for="pg-fonte">Fonte dei materiali (imposta l'edizione)</label><select id="pg-fonte"></select></div>
      <div><label class="dl" for="pg-seed">Seme</label>
        <input id="pg-seed" type="number" min="1" value="1"></div>
      <div><button type="button" id="pg-pdf" class="btn-pdf"><span class="emoji-icona emoji-verificato" role="img" aria-label="Salva scheda PDF"></span> Salva scheda PDF</button><span id="pg-pdf-esito" class="tv-meta"></span></div>    <div><button type="button" id="pg-dado" class="btn" style="min-height:40px;">Seme casuale</button></div>
    </div>
    <p class="tv-meta">Talenti: un menu per ogni livello che ne concede uno (4-8-12-16, più 19 nel
      2014). Incantesimi: trucchetti e incantesimi per ogni livello accessibile. Le scelte si possono
      cambiare in qualsiasi momento; il seme rende riproducibile ciò che non si sceglie a mano.</p>
    <div id="pg-scelte" class="pg-scelte"></div>
    <div id="pg-out" class="pg-out" aria-live="polite"></div>
    <div id="pg-dettaglio" class="pg-dettaglio"></div>
  </section>

  <section class="cal-card">
    <h2 class="cmp-h3">2 · Generatore per categorie</h2>
    <div class="pg-form">
      <div><label class="dl" for="pg-cat">Categoria di ruolo</label><select id="pg-cat"></select></div>
      <div><label class="dl" for="pg-cat-ed">Edizione</label>
        <select id="pg-cat-ed"><option value="">entrambe</option><option value="2014">2014</option><option value="2024">2024</option></select></div>
      <div><label class="dl" for="pg-cat-n">Quanti</label>
        <input id="pg-cat-n" type="number" min="1" max="8" value="3"></div>
      <div><label class="dl" for="pg-cat-sort">Ordine build del canale</label>
        <select id="pg-cat-sort">
          <option value="cronologia">cronologico</option>
          <option value="numero">per numero (decrescente)</option>
        </select></div>
      <div><button type="button" id="pg-cat-btn" class="btn btn-primary" style="min-height:40px;">Genera personaggi</button></div>
    </div>
    <p class="tv-meta">26 categorie: DPS, danno esplosivo, blaster ad area, guaritore, tank,
      battlefield controller, supporto, indebolimento, evocatore, negromante, illusionista,
      ammaliatore, tiratore, mischia, furtività, volto sociale, esperto di abilità, esploratore,
      gish, lottatore, cavaliere, protettore, supporto tecnico, multiclasse, duellante, schermagliatore.</p>
    <div id="pg-cat-out" aria-live="polite"></div>
  </section>
  <section class="cal-card" id="ricerca">
    <h2 class="cmp-h3">3 · Ricerca ottimizzata — numeri calcolati, non opinioni</h2>
    <p class="tv-meta">15 build e 71 combinazioni verificate sul testo delle regole (PHB/DMG 2024, Heroes of Faer&ucirc;n,
      Ravenloft, Arcana Unleashed) pi&ugrave; 20 classifiche di ruolo con metrica dichiarata. Ogni numero viene da un
      motore deterministico rieseguibile, non da una stima: dove una formula esiste (EHP, cura per giornata, area,
      piedi per round, danno per slot) il punteggio &egrave; calcolato, altrove &egrave; una rubrica con pesi visibili.</p>
    <div class="rc-tabs">
      <button type="button" class="rc-tab on" data-tab="build">Build (DPR 5-20)</button>
      <button type="button" class="rc-tab" data-tab="ruoli">Ruoli (20 &times; Top 5)</button>
      <button type="button" class="rc-tab" data-tab="combo">Combo (71)</button>
      <button type="button" class="rc-tab" data-tab="oneshot">Colpo singolo</button>
    </div>
    <div id="rc-view" aria-live="polite"></div>
  </section>
</main>

<script>{pg_js}
{sp_js}</script>
<script>{raggiungibili_js}</script>
<script>{ric_js}</script>
{render_footer()}
</body>
</html>
"""


def main() -> None:
    print("Inizio compilazione del sito pubblico...")
    (SITE_DIR / "index.html").write_text(build_index(), encoding="utf-8")
    print("  ✓ index.html generato")
    
    (SITE_DIR / "risorse.html").write_text(build_risorse(), encoding="utf-8")
    print("  ✓ risorse.html generato (228 record)")
    
    (SITE_DIR / "lfg.html").write_text(build_lfg(), encoding="utf-8")
    print("  ✓ lfg.html generato")
    
    # auto-refresh indice lookup se manca (il fetch 5e.tools è manuale con --force)
    idx_path = SITE_DIR / "data" / "lookup-index.json"
    if not idx_path.exists():
        subprocess.run([sys.executable, str(SITE_DIR / "generate_lookup_index.py")],
                       capture_output=True, text=True, timeout=120)
        print("  ✓ lookup-index.json rigenerato (era assente)")
    global LOOKUP_COUNT
    try:
        LOOKUP_COUNT = json.loads(idx_path.read_text(encoding="utf-8"))["count"]
    except Exception:
        pass
    (SITE_DIR / "cerca.html").write_text(build_cerca(), encoding="utf-8")
    print(f"  ✓ cerca.html generato ({LOOKUP_COUNT} entità 5e.tools)")
    build_cerca_app()
    print("  ✓ data/cerca-app.js generato (asset lookup offline-first)")
    
    (SITE_DIR / "stats.html").write_text(build_stats(), encoding="utf-8")
    (SITE_DIR / "mappa.html").write_text(build_mappa(), encoding="utf-8")
    print("  ok mappa.html generato (mappa interattiva Faerun)")
    (SITE_DIR / "widgets.html").write_text(build_widgets(), encoding="utf-8")
    (SITE_DIR / "tavolo.html").write_text(build_tavolo(), encoding="utf-8")
    (SITE_DIR / "personaggi.html").write_text(build_personaggi(), encoding="utf-8")
    print("  ok personaggi.html generato (generatore di PG)")
    print("  ✓ tavolo.html generato (strumenti da tavolo)")
    print("  ✓ stats.html generato (SVG Vector Charts)")
    
    build_seo()
    print("  ✓ robots.txt & sitemap.xml generati")
    
    print("\nCompilazione completata con successo in:", SITE_DIR)

if __name__ == "__main__":
    main()

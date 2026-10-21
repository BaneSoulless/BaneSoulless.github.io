"""DQS post-integrazione: probe su 9 pagine reali con Vetro Arcano permanente."""
from playwright.sync_api import sync_playwright
import time, json

PAGES = ["index.html", "cerca.html", "lfg.html", "mappa.html", "personaggi.html",
         "risorse.html", "stats.html", "tavolo.html", "widgets.html"]

PROBE = r"""() => {
  const out = {};
  const vw = document.documentElement.clientWidth;
  const hero = document.querySelector('.hero');
  if (hero) {
    const r = hero.getBoundingClientRect();
    const cs = getComputedStyle(hero);
    out.hero_centered = (cs.textAlign === 'center') && (Math.abs(r.left - (vw - r.right)) < 16);
    out.hero_align = cs.textAlign;
  } else out.hero_centered = null;
  const main = document.querySelector("main") || document.querySelector(".wrap");
  if (main) {
    const r = main.getBoundingClientRect();
    /* NB: max-width puo' essere 'min(1760px,100%)' -> parseFloat NaN;
       la simmetria si misura geometricamente: margine sinistro == destro. */
    out.main_centered = Math.abs(r.left - (vw - r.right)) < 16;
    out.main_maxw = r.width;
  } else out.main_centered = null;
  out.orbs = document.querySelectorAll('.va-orb').length;
  out.sigil = !!document.querySelector('.va-sigil');
  const rc = document.querySelector('.va-runecol');
  out.runecols = rc ? (rc.textContent.match(/[\u16A0-\u16FF]/g) || []).length : 0;
  out.band = !!document.querySelector('.va-runeband');
  out.cards = document.querySelectorAll('.card, .cal-card').length;
  let raw = 0;
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    const t = n.textContent.trim();
    if (/^(nav[A-Z][a-zA-Z]*|guide|language|navStats)$/.test(t) && t.length < 12) raw++;
  }
  out.i18n_raw = raw;
  const imgs = Array.from(document.images);
  out.imgs_broken = imgs.filter(i => i.complete && i.naturalWidth === 0).length;
  out.h_overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
  return out;
}"""

results = {}
with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_context(viewport={"width": 1440, "height": 1000}).new_page()
    for name in PAGES:
        errs = []
        pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)[:60]))
        pg.goto(f"http://127.0.0.1:8777/{name}", wait_until="load", timeout=60000)
        time.sleep(2.5)
        for label in ("Salta", "Chiudi", "Ho capito"):
            try:
                btn = pg.get_by_role("button", name=label, exact=True)
                if btn.count() and btn.first.is_visible():
                    btn.first.click(); time.sleep(0.5); break
            except Exception:
                pass
        time.sleep(1.5)
        r = pg.evaluate(PROBE)
        r["pageerrors"] = len(errs)
        r["page"] = name
        results[name] = r
    b.close()

tot = len(PAGES)
comp = {
    "simmetria":   sum(1 for r in results.values() if r["hero_centered"] is True or r["main_centered"] is True),
    "orbs":        sum(1 for r in results.values() if r["orbs"] >= 4),
    "pulizia":     sum(1 for r in results.values() if r["i18n_raw"] == 0 and r["pageerrors"] == 0 and r["imgs_broken"] == 0 and not r["h_overflow"]),
    "interattivita": sum(1 for r in results.values() if r["band"] and (r["cards"] > 0 or r["page"] in ("mappa.html", "risorse.html"))),
    "rune_scritte": sum(1 for r in results.values() if r["runecols"] >= 8),
}
# DQS pesato (100 pt): simmetria 30, palette/pulizia 20, orbs/ambiente 15, interattivita' 15, rune 20
DQS = (comp["simmetria"]/tot*30 + comp["pulizia"]/tot*25 + comp["orbs"]/tot*15
       + comp["interattivita"]/tot*10 + comp["rune_scritte"]/tot*20)
print(json.dumps(results, indent=1, ensure_ascii=False))
print(f"COMPONENTI: {comp} su {tot} pagine")
print(f"DQS post = {DQS:.1f}/100")

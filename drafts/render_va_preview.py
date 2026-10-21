"""Render di 4 pagine reali con override 'Vetro Arcano' iniettato via Playwright.
Genera screenshot in _ocr/va-<pagina>.png per il giudizio dell'operatore."""
from playwright.sync_api import sync_playwright
import pathlib, time, json

ROOT = pathlib.Path(r"C:\Users\Fabrizio\workspace\public-site")
CSS = (ROOT / "drafts" / "vetro-arcano-override.css").read_text(encoding="utf-8")

# Rune Elder Futhark: mappa lettere -> rune (Unicode 16A0-16FF)
FUTHARK = {"A":"ᚨ","B":"ᛒ","C":"ᚲ","D":"ᛞ","E":"ᛖ","F":"ᚠ","G":"ᚷ","H":"ᚺ","I":"ᛁ","J":"ᛃ",
           "K":"ᚲ","L":"ᛚ","M":"ᛗ","N":"ᚾ","O":"ᛟ","P":"ᛈ","Q":"ᚲᚹ","R":"ᚱ","S":"ᛊ","T":"ᛏ",
           "U":"ᚢ","V":"ᚢ","W":"ᚹ","X":"ᚲᛊ","Y":"ᛇ","Z":"ᛉ"}
def futhark(word):
    return "".join(FUTHARK.get(c, c) for c in word.upper() if c != " ")

RUNE_LEFT  = futhark("IL GRIMORIO")   # ᛁᛚ ᚷᚱᛁᛗᛟᚱᛁᛟ
RUNE_RIGHT = futhark("FAERUN")        # ᚠᚨᛖᚱᚢᚾ
RUNE_BAND  = futhark("IL GRIMORIO DEI REAMI")

# innerHTML qui è sicuro: il contenuto è costante costruita da futhark() su stringhe
# letterali (nessun input utente/esterno), therefore no XSS surface.
INJECT_JS = f"""
(() => {{
  // 1. ambient orbs
  const amb = document.createElement('div'); amb.className = 'va-ambient';
  ['o1','o2','o3','o4'].forEach(k => {{
    const o = document.createElement('div'); o.className = 'va-orb ' + k; amb.appendChild(o);
  }});
  document.body.prepend(amb);

  // 2. sigillo arcano dentro .hero (se esiste) con frase iscritta che ruota
  const hero = document.querySelector('.hero');
  if (hero && !document.querySelector('.va-sigil')) {{
    const s = document.createElement('div'); s.className = 'va-sigil'; s.setAttribute('aria-hidden','true');
    s.innerHTML = '<div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div>'
      + '<div class="ring r4"></div>'
      + '<div class="inscribed">' + {RUNE_BAND!r} + '</div>'
      + '<div class="gem g1"></div><div class="gem g2"></div><div class="gem g3"></div><div class="gem g4"></div>';
    hero.prepend(s);
  }}

  // 3. colonne runiche laterali con hint al hover (scritte reali)
  const mkcol = (cls, runes, hint) => {{
    const c = document.createElement('div'); c.className = 'va-runecol ' + cls;
    c.textContent = runes;
    const h = document.createElement('span'); h.className = 'hint'; h.textContent = hint;
    c.appendChild(h); return c;
  }};
  if (!document.querySelector('.va-runecol')) {{
    document.body.appendChild(mkcol('l', {RUNE_LEFT!r}, 'IL GRIMORIO — Elder Futhark'));
    document.body.appendChild(mkcol('r', {RUNE_RIGHT!r}, 'FAERUN — Elder Futhark'));
  }}

  // 4. fascia runica centrata sopra il footer
  const f = document.querySelector('footer');
  if (f && !document.querySelector('.va-runeband')) {{
    const band = document.createElement('div'); band.className = 'va-runeband';
    band.innerHTML = {RUNE_BAND!r} + '<b>IL GRIMORIO DEI REAMI</b>' + {RUNE_RIGHT!r};
    f.parentNode.insertBefore(band, f);
  }}

  // 5. interattività: glow tracking + tilt 3D sulle card
  document.querySelectorAll('.card, .cal-card').forEach(c => {{
    c.classList.add('va-reveal');
    c.addEventListener('pointermove', e => {{
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty('--mx', (x*100).toFixed(1) + '%');
      c.style.setProperty('--my', (y*100).toFixed(1) + '%');
      c.style.transform = 'perspective(900px) rotateY(' + ((x-.5)*5).toFixed(2) + 'deg) rotateX('
        + ((.5-y)*4).toFixed(2) + 'deg) translateY(-2px)';
    }});
    c.addEventListener('pointerleave', () => {{ c.style.transform = ''; }});
  }});

  // 6. reveal on scroll
  const io = new IntersectionObserver(es => es.forEach(en => {{
    if (en.isIntersecting) {{ en.target.classList.add('va-in'); io.unobserve(en.target); }}
  }}), {{ threshold: .08 }});
  document.querySelectorAll('.va-reveal').forEach(el => io.observe(el));

  // 7. parallax orbs col mouse
  addEventListener('pointermove', e => {{
    const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
    document.querySelectorAll('.va-orb').forEach((o, i) => {{
      const d = (i + 1) * 22; o.style.translate = (nx*d) + 'px ' + (ny*d) + 'px';
    }});
  }}, {{ passive: true }});
}})();
"""

PAGES = ["index.html", "cerca.html", "lfg.html", "mappa.html", "personaggi.html",
         "risorse.html", "stats.html", "tavolo.html", "widgets.html"]

PROBE_JS = """() => {
  const q = s => document.querySelector(s);
  const bb = e => { if(!e) return null; const r = e.getBoundingClientRect();
    return {x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height)}; };
  const sig = q('.va-sigil'); const l = q('.va-runecol.l'); const band = q('.va-runeband');
  const orb = q('.va-orb');
  return {
    sigil: bb(sig), sigilRings: sig ? sig.children.length : 0,
    runecolL: bb(l), runecolR: bb(q('.va-runecol.r')),
    runecolFont: l ? getComputedStyle(l).fontFamily.slice(0,40) : null,
    runecolColor: l ? getComputedStyle(l).color : null,
    band: bb(band), bandText: band ? band.textContent.slice(0,44) : null,
    orb: bb(orb),
    hero: bb(q('.hero')), fontH1: getComputedStyle(q('h1')).fontFamily.slice(0,30),
    brandFont: (q('.brand span') ? getComputedStyle(q('.brand span')).fontFamily.slice(0,30) : 'n/a')
  };
}"""

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 1000})
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:100]))
    for name in PAGES:
        errs.clear()
        pg.goto(f"http://127.0.0.1:8777/{name}", wait_until="load", timeout=60000)
        pg.add_style_tag(content=CSS)
        pg.evaluate(INJECT_JS)
        time.sleep(2.5)
        # chiudi l'onboarding tour nativo se presente (altrimenti copre le card nello screenshot)
        for label in ("Salta", "Chiudi", "Ho capito"):
            try:
                btn = pg.get_by_role("button", name=label, exact=True)
                if btn.count() and btn.first.is_visible():
                    btn.first.click()
                    time.sleep(0.8)
                    break
            except Exception:
                pass
        time.sleep(1.5)
        # dimostra l'interattività: hover con pointermove sulla prima card
        try:
            c = pg.query_selector(".card, .cal-card")
            if c:
                box = c.bounding_box()
                if box:
                    pg.mouse.move(box["x"] + box["width"]*0.7, box["y"] + box["height"]*0.4, steps=6)
                    time.sleep(0.4)
        except Exception:
            pass
        out = ROOT / "_ocr" / f"va-{name.replace('.html','')}.png"
        pg.screenshot(path=str(out))
        print(f"{name}: {out.name} | pageerror: {errs if errs else 'nessuno'}")
        # full-page + tile per l'analisi dettagliata
        base = name.replace(".html", "")
        pg.screenshot(path=str(ROOT / "_ocr" / f"va-full-{base}.png"), full_page=True)
        try:
            import PIL.Image as I
            img = I.open(ROOT / "_ocr" / f"va-full-{base}.png")
            W, H = img.size
            tdir = ROOT / "_ocr" / "va-tiles"
            tdir.mkdir(exist_ok=True)
            n = 0
            for y in range(0, H, 1000):
                n += 1
                img.crop((0, y, W, min(y + 1150, H))).save(tdir / f"{base}-{n}.png")
            print(f"  full {H}px -> {n} tiles")
        except ImportError:
            print("  PIL assente, full-page salvato senza tile")
        if name == "index.html":
            print(json.dumps(pg.evaluate(PROBE_JS), indent=1, ensure_ascii=False))
    b.close()
print("render vetro arcano su 4 pagine reali: completato")

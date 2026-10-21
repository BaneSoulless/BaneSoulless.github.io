/* ============================================================
   ARCANA v2 — sigilli generati + simboli ufficiali D&D + flottanti
   Ogni entità riceve una VERA immagine: un sigillo arcano SVG
   deterministico dal nome (hash -> geometria). Nessuna icona emoji.
   ============================================================ */
(function () {
  'use strict';
  if (window.__ARCANA__) return;
  window.__ARCANA__ = true;

  /* ---------- hash deterministico ---------- */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* ---------- simboli ufficiali delle 8 scuole di magia ---------- */
  var SCHOOLS = {
    abjuration:   { c: '#8a9bff', path: 'M32 6 L54 20 L54 44 L32 58 L10 44 L10 20 Z M32 14 L46 24 L46 40 L32 50 L18 40 L18 24 Z' },
    conjuration:  { c: '#b88aff', path: 'M32 4 A28 28 0 1 1 31.9 4 Z M32 14 A18 18 0 1 0 32.1 14 Z M32 22 L40 32 L32 42 L24 32 Z' },
    divination:   { c: '#ffd76e', path: 'M32 6 C44 18 50 28 32 58 C14 28 20 18 32 6 Z M32 26 A7 7 0 1 1 31.9 26 Z' },
    enchantment:  { c: '#ff8ac2', path: 'M32 6 L42 20 L58 24 L44 36 L48 54 L32 44 L16 54 L20 36 L6 24 L22 20 Z' },
    evocation:    { c: '#ff7a5c', path: 'M32 4 L38 22 L56 16 L44 32 L60 40 L40 42 L44 58 L32 46 L20 58 L24 42 L4 40 L20 32 L8 16 L26 22 Z' },
    illusion:     { c: '#6ee7d8', path: 'M10 10 L54 10 L54 54 L10 54 Z M18 18 L46 18 L46 46 L18 46 Z M32 26 A6 6 0 1 1 31.9 26 Z' },
    necromancy:   { c: '#9aa7b8', path: 'M32 6 L46 18 L46 34 L36 46 L36 58 L28 58 L28 46 L18 34 L18 18 Z M24 24 A4 4 0 1 1 23.9 24 Z M40 24 A4 4 0 1 1 39.9 24 Z' },
    transmutation:{ c: '#8affa0', path: 'M18 8 L46 8 L46 24 L32 32 L46 40 L46 56 L18 56 L18 40 L32 32 L18 24 Z' }
  };
  var SCHOOL_KEYS = Object.keys(SCHOOLS);

  /* simboli delle 12 classi */
  var CLASSES = {
    barbaro:    'M32 6 L38 18 L54 12 L48 28 L58 32 L48 36 L54 52 L38 46 L32 58 L26 46 L10 52 L16 36 L6 32 L16 28 L10 12 L26 18 Z',
    bardo:      'M26 6 L38 6 L38 40 A10 10 0 1 1 26 40 Z M38 12 L50 16 L50 22 L38 18 Z',
    chierico:   'M28 6 L36 6 L36 22 L52 22 L52 30 L36 30 L36 58 L28 58 L28 30 L12 30 L12 22 L28 22 Z',
    druido:     'M32 6 A26 26 0 1 1 31.9 6 Z M32 14 A18 18 0 1 0 32.1 14 Z M32 20 L44 34 L32 50 L20 34 Z',
    guerriero:  'M32 4 L36 14 L58 14 L58 22 L40 22 L40 58 L32 50 L24 58 L24 22 L6 22 L6 14 L28 14 Z',
    monaco:     'M32 6 L52 44 L12 44 Z M32 20 L24 40 L40 40 Z M18 50 L46 50 L46 58 L18 58 Z',
    paladino:   'M32 4 L44 16 L58 10 L52 26 L60 32 L52 38 L58 54 L44 48 L32 60 L20 48 L6 54 L12 38 L4 32 L12 26 L6 10 L20 16 Z',
    ranger:     'M6 10 L56 52 L52 56 L38 44 L38 58 L26 58 L26 34 L6 14 Z',
    ladro:      'M20 8 L44 8 L44 20 L38 20 L38 34 L26 34 L26 20 L20 20 Z M14 40 L50 40 L50 48 L14 48 Z M14 52 L50 52 L50 58 L14 58 Z',
    stregone:   'M32 4 C46 16 52 24 52 36 A20 20 0 1 1 12 36 C12 24 18 16 32 4 Z M32 22 A10 10 0 1 1 31.9 22 Z',
    warlock:    'M32 6 A26 26 0 0 1 58 32 L44 32 A12 12 0 0 0 32 20 Z M32 20 A12 12 0 0 0 20 32 L6 32 A26 26 0 0 1 32 6 Z M6 32 L20 32 L26 44 L12 44 Z M58 32 L44 32 L38 44 L52 44 Z M26 48 L38 48 L32 60 Z',
    mago:       'M32 6 L58 52 L6 52 Z M32 22 L18 48 L46 48 Z M32 34 L27 44 L37 44 Z'
  };

  /* ---------- generatore di sigilli: VERA immagine per ogni entità ---------- */
  function sigilSVG(name, opts) {
    opts = opts || {};
    var h = hash(name);
    var r = rng(h);
    var size = opts.size || 64;
    var type = (opts.type || '').toLowerCase();
    var accent = opts.accent || null;

    /* colore: per incantesimi la scuola se nota, altrimenti da hash */
    var schoolKey = opts.school && SCHOOLS[opts.school] ? opts.school : null;
    var col = accent || (schoolKey ? SCHOOLS[schoolKey].c :
      ['#c9a227', '#e8c95a', '#8a6bff', '#6ee7d8', '#ff8ac2', '#ff7a5c'][h % 6]);

    var s = size / 64;
    var parts = [];

    /* anelli concentrici con tick */
    var rings = 2 + Math.floor(r() * 2);
    for (var i = 0; i < rings; i++) {
      var rad = 8 + i * (20 / rings) + r() * 4;
      var dash = r() > .5 ? ' stroke-dasharray="' + (2 + Math.floor(r() * 5)) + ' ' + (3 + Math.floor(r() * 6)) + '"' : '';
      parts.push('<circle cx="32" cy="32" r="' + rad.toFixed(1) + '" fill="none" stroke="' + col +
        '" stroke-width="' + (0.6 + r() * 0.8).toFixed(2) + '" opacity="' + (.35 + r() * .4).toFixed(2) + '"' + dash + '/>');
    }
    /* tick radiali */
    var ticks = 6 + Math.floor(r() * 10);
    var tk = '';
    for (var t = 0; t < ticks; t++) {
      var a = (t / ticks) * Math.PI * 2 + r() * .3;
      var r1 = 24 + r() * 2, r2 = 28 + r() * 3;
      tk += 'M' + (32 + Math.cos(a) * r1).toFixed(1) + ' ' + (32 + Math.sin(a) * r1).toFixed(1) +
            'L' + (32 + Math.cos(a) * r2).toFixed(1) + ' ' + (32 + Math.sin(a) * r2).toFixed(1);
    }
    parts.push('<path d="' + tk + '" stroke="' + col + '" stroke-width=".7" fill="none" opacity=".5"/>');

    /* glifo centrale: simbolo scuola per incantesimi, simbolo classe per classi,
       geometria generata per tutto il resto */
    var glyph = '';
    if (type === 'spell') {
      var sk = schoolKey || SCHOOL_KEYS[h % 8];
      glyph = '<path d="' + SCHOOLS[sk].path + '" fill="none" stroke="' + col +
        '" stroke-width="1.6" opacity=".92"/><path d="' + SCHOOLS[sk].path + '" fill="' + col + '" opacity=".14"/>';
    } else if (CLASSES[type]) {
      glyph = '<path d="' + CLASSES[type] + '" fill="none" stroke="' + col +
        '" stroke-width="1.6" opacity=".92"/>';
    } else {
      var pts = 5 + Math.floor(r() * 4);
      var gp = '';
      var inner = 6 + r() * 6;
      for (var p = 0; p < pts; p++) {
        var pa = (p / pts) * Math.PI * 2 - Math.PI / 2 + (r() - .5) * .35;
        var pr = 10 + r() * 12;
        gp += (p ? 'L' : 'M') + (32 + Math.cos(pa) * pr).toFixed(1) + ' ' + (32 + Math.sin(pa) * pr).toFixed(1);
      }
      gp += 'Z';
      glyph = '<path d="' + gp + '" fill="none" stroke="' + col + '" stroke-width="1.5" opacity=".9"/>' +
              '<circle cx="32" cy="32" r="' + inner.toFixed(1) + '" fill="' + col + '" opacity=".22"/>';
    }
    parts.push(glyph);

    /* rune minori orbitanti (deterministiche dal nome) */
    var RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛟᛞ';
    var nr = 3 + (h % 4);
    for (var n2 = 0; n2 < nr; n2++) {
      var na = (n2 / nr) * Math.PI * 2 + (h % 100) / 100;
      var nrad = 22 + r() * 4;
      parts.push('<text x="' + (32 + Math.cos(na) * nrad).toFixed(1) + '" y="' + (32 + Math.sin(na) * nrad).toFixed(1) +
        '" fill="' + col + '" font-size="' + (3.5 + r() * 2.5).toFixed(1) + '" text-anchor="middle" dominant-baseline="middle" opacity=".75">' +
        RUNES[(h + n2 * 7) % RUNES.length] + '</text>');
    }

    return '<svg viewBox="0 0 64 64" width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg" ' +
      'role="img" aria-label="Sigillo arcano di ' + String(name).replace(/[<>&"]/g, '') + '">' +
      '<defs><radialGradient id="sg' + (h % 9999) + '"><stop offset="0%" stop-color="' + col + '" stop-opacity=".18"/>' +
      '<stop offset="100%" stop-color="' + col + '" stop-opacity="0"/></radialGradient></defs>' +
      '<circle cx="32" cy="32" r="31" fill="url(#sg' + (h % 9999) + ')"/>' + parts.join('') + '</svg>';
  }

  /* ---------- API pubblica ---------- */
  window.Arcana = {
    sigil: sigilSVG,
    schoolColor: function (school) { return SCHOOLS[school] ? SCHOOLS[school].c : '#c9a227'; },
    symbol: function (kind, name) {
      var size = 64;
      if (kind === 'class' && CLASSES[name])
        return '<svg viewBox="0 0 64 64" width="' + size + '" height="' + size + '"><path d="' + CLASSES[name] + '" fill="none" stroke="#e8c95a" stroke-width="1.6"/></svg>';
      return sigilSVG(name || kind, { size: size });
    }
  };

  /* ---------- simboli arcani che VOLANO nella pagina ----------
     Tre famiglie: dadi D&D (d4-d20 con numero), simboli delle scuole
     di magia, parole runiche. Percorsi diagonali casuali (start Y ≠
     end Y) + bob + parallax che reagisce al movimento del mouse. */
  var FLY_GLYPHS = ['ᛗᚨᚷᛁᚨ', 'ᛞᚱᚨᚲᛟ', 'ᛖᛚᚢᚾᚨ', 'ᛟᚲᚲᚢᛚᛏᚢᛋ', 'ᚠᛖᚱᚨ', 'ᛚᚢᛗᛖᚾ', 'ᛏᛖᛗᛈᚢᛋ', 'ᚹᛁᛋᛞᛟᛗ'];

  /* dadi D&D: silhouette dei 6 poliedri con il numero di facce */
  var DICE = [
    { n: '4',  p: 'M32 8 L56 52 L8 52 Z' },
    { n: '6',  p: 'M16 14 L48 14 L48 50 L16 50 Z' },
    { n: '8',  p: 'M32 4 L56 32 L32 60 L8 32 Z' },
    { n: '10', p: 'M32 4 L54 24 L46 56 L18 56 L10 24 Z' },
    { n: '12', p: 'M32 4 L58 24 L48 56 L16 56 L6 24 Z' },
    { n: '20', p: 'M32 4 L56 18 L56 46 L32 60 L8 46 L8 18 Z M32 14 L48 44 L16 44 Z' }
  ];

  function flyerContent() {
    var roll = Math.random();
    var col = Math.random() > .5 ? 'rgba(232,201,90,.55)' : 'rgba(138,107,255,.45)';
    if (roll < .38) {
      /* dado */
      var d = DICE[Math.floor(Math.random() * DICE.length)];
      return { html: '<svg viewBox="0 0 64 64" width="36" height="36">' +
        '<path d="' + d.p + '" fill="none" stroke="' + col + '" stroke-width="1.6" opacity=".6"/>' +
        '<text x="32" y="36" text-anchor="middle" fill="' + col + '" font-size="13" font-family="Castellar,serif" font-weight="700" opacity=".65">' + d.n + '</text></svg>',
        sym: true };
    }
    if (roll < .68) {
      /* simbolo scuola di magia */
      var k = SCHOOL_KEYS[Math.floor(Math.random() * SCHOOL_KEYS.length)];
      return { html: '<svg viewBox="0 0 64 64" width="34" height="34"><path d="' +
        SCHOOLS[k].path + '" fill="none" stroke="' + col + '" stroke-width="1.4" opacity=".55"/></svg>',
        sym: true };
    }
    /* parola runica */
    return { html: FLY_GLYPHS[Math.floor(Math.random() * FLY_GLYPHS.length)], sym: false, col: col };
  }

  var flyParRaf = null;
  function applyFlyParallax(e) {
    if (flyParRaf) return;
    flyParRaf = requestAnimationFrame(function () {
      flyParRaf = null;
      var nx = e.clientX / window.innerWidth - .5;
      var ny = e.clientY / window.innerHeight - .5;
      document.querySelectorAll('.fly-arcana .fly-par').forEach(function (p) {
        var d = parseFloat(p.dataset.depth || .6);
        p.style.transform = 'translate(' + (-nx * d * 34).toFixed(1) + 'px,' + (-ny * d * 22).toFixed(1) + 'px)';
      });
    });
  }

  function spawnFlyer() {
    if (document.hidden) return;
    var host = document.getElementById('amb');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'fly-arcana';
    el.setAttribute('aria-hidden', 'true');

    var content = flyerContent();
    var y0 = 6 + Math.random() * 78;                       /* altezza di ingresso */
    var y1 = Math.max(6, Math.min(88, y0 + (Math.random() - .5) * 46));  /* altezza d'uscita: percorso diagonale */
    var fromLeft = Math.random() > .5;
    var dur = 17 + Math.random() * 15;
    var rot = (fromLeft ? 1 : -1) * (10 + Math.random() * 26);
    var depth = .35 + Math.random() * .75;                 /* per la parallax col mouse */

    var inner = content.sym
      ? content.html
      : '<span style="font-size:15px;color:' + content.col + ';letter-spacing:.35em;font-family:\'Segoe UI Historic\',\'Noto Sans Runic\',sans-serif">' + content.html + '</span>';

    el.innerHTML =
      '<div class="fly-par" data-depth="' + depth.toFixed(2) + '">' +
        '<div class="fly-bob">' + inner + '</div>' +
      '</div>';
    el.style.top = y0 + 'vh';
    el.style.left = fromLeft ? '-160px' : 'calc(100vw + 60px)';
    el.style.transition = 'transform ' + dur + 's linear, opacity ' + dur + 's ease-in';
    host.appendChild(el);

    var dx = (fromLeft ? 1 : -1) * (window.innerWidth + 340);
    var dy = (y1 - y0) * (window.innerHeight / 100);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.style.transform = 'translate(' + dx.toFixed(0) + 'px,' + dy.toFixed(0) + 'px) rotate(' + rot.toFixed(0) + 'deg)';
        el.style.opacity = '0';
      });
    });
    setTimeout(function () { el.remove(); }, dur * 1000 + 1500);
  }

  window.addEventListener('pointermove', applyFlyParallax, { passive: true });
  setInterval(spawnFlyer, 7500);
  setTimeout(spawnFlyer, 1800);
  setTimeout(spawnFlyer, 4600);
})();

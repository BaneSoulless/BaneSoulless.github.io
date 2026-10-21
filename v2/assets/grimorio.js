/* ============================================================
   GRIMORIO v2 runtime — scritto da zero.
   Le animazioni usano EVENT DELEGATION su document: funzionano
   su contenuto statico E dinamico (card renderizzate dopo).
   ============================================================ */
(function () {
  'use strict';
  if (window.__GRIMORIO_V2__) return;
  window.__GRIMORIO_V2__ = true;

  var boot = function () {

    /* ---------- 1. ambiente (orbs) ---------- */
    if (!document.getElementById('amb')) {
      var amb = document.createElement('div');
      amb.id = 'amb'; amb.setAttribute('aria-hidden', 'true');
      ['o1', 'o2', 'o3', 'o4'].forEach(function (k) {
        var o = document.createElement('div');
        o.className = 'orb ' + k;
        amb.appendChild(o);
      });
      document.body.prepend(amb);
    }

    /* ---------- 2. sigillo dietro l'hero ---------- */
    var hero = document.querySelector('.hero') || document.querySelector('main');
    if (hero && !document.querySelector('.sigil')) {
      var s = document.createElement('div');
      s.className = 'sigil'; s.setAttribute('aria-hidden', 'true');
      s.innerHTML =
        '<div class="ring r1"></div><div class="ring r2"></div>' +
        '<div class="ring r3"></div><div class="ring r4"></div>' +
        (window.__RUNE_BAND__
          ? '<div class="inscribed" style="position:absolute;inset:96px;animation:spin 150s linear infinite;font-family:\'Segoe UI Historic\',sans-serif;font-size:16px;letter-spacing:.4em;color:rgba(232,201,90,.42);display:flex;justify-content:center;">' + window.__RUNE_BAND__ + '</div>'
          : '') +
        '<div class="gem g1"></div><div class="gem g2"></div><div class="gem g3"></div><div class="gem g4"></div>';
      hero.appendChild(s);
    }

    /* ---------- 3. rune-scritte laterali (Elder Futhark, hint al hover) ---------- */
    if (!document.querySelector('.runecol')) {
      var mkcol = function (cls, glyphs, label) {
        var c = document.createElement('div');
        c.className = 'runecol ' + cls;
        c.textContent = glyphs;
        var h = document.createElement('span');
        h.className = 'hint'; h.textContent = label;
        c.appendChild(h);
        document.body.appendChild(c);
      };
      if (window.__RUNE_LEFT__)  mkcol('l', window.__RUNE_LEFT__,  window.__RUNE_LEFT_LABEL__  || 'IL GRIMORIO');
      if (window.__RUNE_RIGHT__) mkcol('r', window.__RUNE_RIGHT__, window.__RUNE_RIGHT_LABEL__ || 'FAERUN');
    }

    /* ---------- 4. fascia runica sopra il footer ---------- */
    var foot = document.querySelector('footer');
    if (foot && window.__RUNE_BAND__ && !document.querySelector('.runeband')) {
      var band = document.createElement('div');
      band.className = 'runeband'; band.setAttribute('aria-hidden', 'true');
      band.textContent = window.__RUNE_BAND__;
      var b = document.createElement('b');
      b.textContent = 'IL GRIMORIO DEI REAMI';
      band.appendChild(b);
      band.appendChild(document.createTextNode(window.__RUNE_RIGHT__ || ''));
      foot.parentNode.insertBefore(band, foot);
    }

    /* ---------- 5. notches su ogni card ---------- */
    document.querySelectorAll('.card').forEach(function (c) {
      if (c.querySelector('.notch')) return;
      ['n1', 'n2'].forEach(function (k) {
        var n = document.createElement('span');
        n.className = 'notch ' + k;
        c.appendChild(n);
      });
    });

    /* ---------- 6. EVENT DELEGATION: tilt 3D + glow tracking ----------
       Delegato su document => funziona anche per le card create DOPO
       dal JS (lookup, risultati dinamici, ecc.). */
    document.addEventListener('pointermove', function (e) {
      var c = e.target.closest ? e.target.closest('.card') : null;
      document.querySelectorAll('.card.tilting').forEach(function (el) {
        if (!c || el !== c) { el.classList.remove('tilting'); el.style.transform = ''; }
      });
      if (!c) return;
      var r = c.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      var y = (e.clientY - r.top) / r.height;
      c.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      c.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      c.classList.add('tilting');
      c.style.transform = 'perspective(900px) rotateY(' + ((x - .5) * 5).toFixed(2) +
        'deg) rotateX(' + ((.5 - y) * 4).toFixed(2) + 'deg) translateY(-2px)';
    }, { passive: true });
    document.addEventListener('pointerleave', function (e) {
      var c = e.target && e.target.closest ? e.target.closest('.card') : null;
      if (c) { c.classList.remove('tilting'); c.style.transform = ''; }
    }, true);

    /* stile tilt: transition solo quando NON sta ruotando (così è fluido) */
    var st = document.createElement('style');
    st.textContent =
      '.card.tilting{transition:transform .08s ease-out!important}' +
      '.card:not(.tilting){transition:transform .45s cubic-bezier(.22,.61,.36,1)}';
    document.head.appendChild(st);

    /* ---------- 7. parallax orbs col mouse ---------- */
    window.addEventListener('pointermove', function (e) {
      var nx = e.clientX / window.innerWidth - .5;
      var ny = e.clientY / window.innerHeight - .5;
      document.querySelectorAll('.orb').forEach(function (o, i) {
        var d = (i + 1) * 16;
        o.style.translate = (nx * d) + 'px ' + (ny * d) + 'px';
      });
    }, { passive: true });

    /* ---------- 8. reveal on scroll (osserva anche nodi nuovi via MutationObserver) ---------- */
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: .06 });
    var observeRv = function (root) {
      (root || document).querySelectorAll('.rv:not(.in)').forEach(function (el) { io.observe(el); });
    };
    observeRv(document);
    new MutationObserver(function () { observeRv(document); })
      .observe(document.body, { childList: true, subtree: true });

    /* ---------- 9. parallax leggero del sigillo ---------- */
    var sig = document.querySelector('.sigil');
    if (sig) {
      window.addEventListener('pointermove', function (e) {
        var nx = e.clientX / window.innerWidth - .5;
        var ny = e.clientY / window.innerHeight - .5;
        sig.style.translate = (nx * 18) + 'px ' + (ny * 12) + 'px';
      }, { passive: true });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

/* barra di progresso lettura (arco arcano) */
(function () {
  function arc() {
    if (document.getElementById('read-arc')) return;
    var b = document.createElement('div'); b.id = 'read-arc'; document.body.appendChild(b);
    window.addEventListener('scroll', function () {
      var h = document.documentElement;
      var p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      b.style.width = (p * 100).toFixed(2) + '%';
    }, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arc);
  else arc();
})();

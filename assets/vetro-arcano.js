/* Vetro Arcano — runtime: orbs, sigillo, rune-colonne, interattività.
 * I18n-safe: non usa la variabile L (conflitto Leaflet su mappa.html).
 * Nota: lo script è INLINE, quindi `defer` è ignorato dallo standard HTML —
 * il body è ancora in parsing quando gira. Si attende DOMContentLoaded. */
(function () {
  var boot = function () {
  if (window.__VETRO_ARCANO__) return;      // idempotente
  window.__VETRO_ARCANO__ = true;

  /* 1. ambient orbs (illuminano il vetro da dietro) */
  var amb = document.createElement('div');
  amb.className = 'va-ambient'; amb.setAttribute('aria-hidden', 'true');
  ['o1', 'o2', 'o3', 'o4'].forEach(function (k) {
    var o = document.createElement('div');
    o.className = 'va-orb ' + k;
    amb.appendChild(o);
  });
  document.body.prepend(amb);

  /* 2. sigillo arcano dentro l'hero della home */
  var hero = document.querySelector('.hero');
  if (hero && !document.querySelector('.va-sigil')) {
    var s = document.createElement('div');
    s.className = 'va-sigil'; s.setAttribute('aria-hidden', 'true');
    s.innerHTML =
      '<div class="ring r1"></div><div class="ring r2"></div>' +
      '<div class="ring r3"></div><div class="ring r4"></div>' +
      '<div class="inscribed">' + (window.__VA_RUNE_BAND__ || '') + '</div>' +
      '<div class="gem g1"></div><div class="gem g2"></div>' +
      '<div class="gem g3"></div><div class="gem g4"></div>';
    hero.prepend(s);
  }

  /* 3. colonne runiche laterali con hint al passaggio del mouse */
  if (!document.querySelector('.va-runecol')) {
    var mkcol = function (cls, runes, hint) {
      var c = document.createElement('div');
      c.className = 'va-runecol ' + cls;
      c.textContent = runes;
      var h = document.createElement('span');
      h.className = 'hint'; h.textContent = hint;
      c.appendChild(h);
      return c;
    };
    document.body.appendChild(mkcol('l', window.__VA_RUNE_LEFT__ || '', 'IL GRIMORIO — Elder Futhark'));
    document.body.appendChild(mkcol('r', window.__VA_RUNE_RIGHT__ || '', 'FAERUN — Elder Futhark'));
  }

  /* 4. fascia runica centrata sopra il footer */
  var f = document.querySelector('footer');
  if (f && !document.querySelector('.va-runeband')) {
    var band = document.createElement('div');
    band.className = 'va-runeband'; band.setAttribute('aria-hidden', 'true');
    band.textContent = (window.__VA_RUNE_BAND__ || '') + ' IL GRIMORIO DEI REAMI ' + (window.__VA_RUNE_RIGHT__ || '');
    f.parentNode.insertBefore(band, f);
  }

  /* 5. interattività: glow che segue il cursore + tilt 3D sulle card */
  document.querySelectorAll('.card, .cal-card').forEach(function (c) {
    c.classList.add('va-reveal');
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      var y = (e.clientY - r.top) / r.height;
      c.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      c.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      c.style.transform = 'perspective(900px) rotateY(' + ((x - .5) * 5).toFixed(2) +
        'deg) rotateX(' + ((.5 - y) * 4).toFixed(2) + 'deg) translateY(-2px)';
    });
    c.addEventListener('pointerleave', function () { c.style.transform = ''; });
  });

  /* 6. reveal on scroll */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('va-in'); io.unobserve(en.target); }
      });
    }, { threshold: .08 });
    document.querySelectorAll('.va-reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.va-reveal').forEach(function (el) { el.classList.add('va-in'); });
  }

  /* 7. parallax orbs col mouse */
  window.addEventListener('pointermove', function (e) {
    var nx = e.clientX / window.innerWidth - .5;
    var ny = e.clientY / window.innerHeight - .5;
    document.querySelectorAll('.va-orb').forEach(function (o, i) {
      var d = (i + 1) * 22;
      o.style.translate = (nx * d) + 'px ' + (ny * d) + 'px';
    });
  }, { passive: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

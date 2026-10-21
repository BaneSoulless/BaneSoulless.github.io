/* reveal.js 2026-10-15 — entrata scroll-reveal per tutte le pagine.
   Il CSS (.rv/.rv-in) fa il lavoro; qui solo l'osservatore + lo stagger.
   Fail-open: senza JS il contenuto resta visibile (il CSS parte da opacity 0
   SOLO quando .rv e' presente, e senza observer gli elementi restano nascosti;
   per questo qui aggiungiamo .rv e subito .rv-in se IntersectionObserver manca). */
(function () {
  'use strict';
  var SEL = '.cal-card, .tv-card, .gal-item, .stat-bezel, section > .card';
  var els = Array.prototype.slice.call(document.querySelectorAll(SEL));
  if (!els.length || !('IntersectionObserver' in window)) return;
  els.forEach(function (el, i) {
    if (el.dataset.rvDone) return;
    el.dataset.rvDone = '1';
    el.classList.add('rv');
    el.style.setProperty('--rv-i', Math.min(i % 6, 5));
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        en.target.classList.add('rv-in');
        io.unobserve(en.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  els.forEach(function (el) { io.observe(el); });
  // fail-open: dopo 1200ms tutto visibile comunque (contenuto > effetto)
  setTimeout(function () {
    els.forEach(function (el) { el.classList.add('rv-in'); });
  }, 1200);
})();

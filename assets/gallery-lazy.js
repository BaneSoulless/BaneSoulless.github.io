/* Copertine ~14 MB: il lazy nativo scarica comunque quelle entro il margine di
   pre-fetch di Chromium (~3000 px) -> l'home scaricava 13.976 KB senza scrollare
   (misurato). Con data-src + IntersectionObserver le immagini partono SOLO
   quando entrano davvero nel viewport. */
(function () {
  var imgs = Array.prototype.slice.call(document.querySelectorAll('.gal-item img[data-src]'));
  if (!imgs.length) return;
  if (!('IntersectionObserver' in window)) {
    imgs.forEach(function (i) { i.src = i.getAttribute('data-src'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var im = en.target;
      im.src = im.getAttribute('data-src');
      im.removeAttribute('data-src');
      io.unobserve(im);
    });
  }, { rootMargin: '260px 0px' });
  imgs.forEach(function (i) { io.observe(i); });
})();

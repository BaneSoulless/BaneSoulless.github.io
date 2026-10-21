/* ── glass-tint.js — tinta dinamica delle card dalla COPERTINA (relazione kmpalette
   di SimpMusic, reimplementata per il web: campiono l'immagine su canvas 8x8, calcolo
   tinta e luminanza, e imposto --card-tint / --card-blur sulla card).
   Il campionamento avviene solo per immagini SAME-ORIGIN (covers locali ✓). */
(function () {
  function campiona(img) {
    var c = document.createElement("canvas");
    c.width = 8; c.height = 8;
    var x = c.getContext("2d", { willReadFrequently: true });
    if (!x) return null;
    try { x.drawImage(img, 0, 0, 8, 8); } catch (e) { return null; }
    var d;
    try { d = x.getImageData(0, 0, 8, 8).data; } catch (e) { return null; }
    var r = 0, g = 0, b2 = 0;
    for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b2 += d[i + 2]; }
    var n = d.length / 4;
    return { r: r / n, g: g / n, b: b2 / n };
  }
  function rgbHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0, s = 0;
    var l = (max + min) / 2;
    if (max !== min) {
      var dd = max - min;
      s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
      if (max === r) h = ((g - b) / dd + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / dd + 2;
      else h = (r - g) / dd + 4;
      h *= 60;
    }
    return { h: h, s: s, l: l };
  }
  function applica(card, img) {
    var avg = campiona(img);
    if (!avg) return false;
    var hsl = rgbHsl(avg.r, avg.g, avg.b);
    /* la tinta della copertina, con saturazione domata e luce agganciata al tema:
       il Gold resta l'accento del sito, la copertina dà solo l'alone della card. */
    var hue = Math.round(hsl.h);
    var sat = Math.round(Math.max(18, Math.min(58, hsl.s * 100 + 12)));
    card.style.setProperty("--card-tint", "hsl(" + hue + " " + sat + "% 52%)");
    card.style.setProperty("--card-tint-strength", hsl.l > 0.72 ? "0.10" : "0.18");
    /* blur adattivo (relazione GlassLuminance): contenuto chiaro -> piu' blur,
       contenuto scuro -> meno blur, dentro la gamma del tema (10..26 px) */
    var blur = Math.round(26 - hsl.l * 16);
    card.style.setProperty("--card-blur", blur + "px");
    return true;
  }
  function avvia() {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".gal-item"));
    cards.forEach(function (card) {
      var img = card.querySelector("img");
      if (!img) return;
      var prova = function () { applica(card, img); };
      if (img.complete && img.naturalWidth > 0) prova();
      else img.addEventListener("load", prova, { once: true });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", avvia);
  else avvia();
})();

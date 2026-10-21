/* soft-router.js — navigazione fetch-based per Il Grimorio dei Reami (v2).
 *
 * Perche' esiste: la musica di sfondo (music-player.js) deve continuare senza
 * interruzioni tra una pagina e l'altra (richiesta operatore, punto A). Con la
 * navigazione document completa l'audio muore a ogni click; questo router
 * sostituisce SOLO header/main/footer/title/styles con transizione a fade
 * (punto B) e re-esegue gli script pagina-specifici del nuovo corpo.
 *
 * Regole:
 *  - intercetta solo <a> interni *.html senza target/_blank/#download
 *  - cerca.html?q=... viene riscritto in lookup.html?...&open=1 (il wrapper
 *    esegue un redirect via location.replace che altrimenti forzerebbe reload)
 *  - gli script "globali una-volta-sola" non vengono rieseguiti (runtime tema,
 *    i18n, player); tutto il resto (app pagina-specifiche) si riesegue
 *  - fallback: se il fetch fallisce, navigazione normale
 *  - dopo lo swap, se la lingua attiva non e' la sorgente, re-traduce
 */
(function () {
  "use strict";

  var FADE_MS = 170;

  /* runtime globali che NON vanno rieseguiti: sono gia' vivi nel documento */
  var GLOBAL_ONCE = [
    "grimorio.js", "arcana.js", "music-player.js", "soft-router.js",
    "i18n-auto.js", "i18n-bi.js", "lang-menu.js", "helpers.js",
    "collapse.js", "leaflet.js"
  ];
  function isGlobalOnce(src) {
    var s = (src || "").toLowerCase();
    return GLOBAL_ONCE.some(function (g) { return s.indexOf(g) !== -1; });
  }
  function isInternal(href) {
    if (!href) return false;
    if (/^(https?:)?\/\//i.test(href)) {
      return href.indexOf("grimorio-dei-reami.serveousercontent.com") !== -1 ||
             href.indexOf("127.0.0.1:8777") !== -1;
    }
    return /\.html(\?|#|$)/i.test(href.split("#")[0]) || href.indexOf(".html") !== -1;
  }
  function normalizeHref(href) {
    /* il wrapper cerca.html redirecta con location.replace: qui lo evitiamo */
    if (/(^|\/)cerca\.html/i.test(href)) {
      return href.replace(/cerca\.html/i, "lookup.html").replace(/(\?|$)/, function (m) {
        return m === "?" ? "?open=1&" : "?open=1";
      });
    }
    return href;
  }

  function swapFrom(doc, url) {
    /* title */
    if (doc.title) document.title = doc.title;
    /* styles: rimuovo gli <style> esistenti e reinstallo quelli della pagina nuova */
    Array.prototype.slice.call(document.head.querySelectorAll("style")).forEach(function (s) { s.remove(); });
    Array.prototype.slice.call(doc.head.querySelectorAll("style")).forEach(function (st) {
      document.head.appendChild(st.cloneNode(true));
    });
    /* canonical/og:url aggiornati */
    var canon = doc.head.querySelector('link[rel="canonical"]');
    var oldCanon = document.head.querySelector('link[rel="canonical"]');
    if (canon && oldCanon) oldCanon.setAttribute("href", canon.getAttribute("href"));

    /* header / main / footer */
    var nh = doc.querySelector("header"), nm = doc.querySelector("main"), nf = doc.querySelector("footer");
    var ch = document.querySelector("header"), cm = document.querySelector("main"), cf = document.querySelector("footer");
    if (nh && ch) ch.replaceWith(nh);
    if (nm && cm) cm.replaceWith(nm);
    if (nf && cf) cf.replaceWith(nf);

    /* 1) rimuovo gli script pagina-specifici della pagina abbandonata:
          i loro listener puntano a elementi ormai staccati e l'accumulo
          nel body causava doppie inizializzazioni ai re-visit */
    Array.prototype.slice.call(document.body.querySelectorAll("script[src]")).forEach(function (sc) {
      if (!isGlobalOnce(sc.src)) sc.remove();
    });

    /* 2) script del nuovo body: skip globali, re-esegui pagina-specifici e inline */
    Array.prototype.slice.call(doc.body.querySelectorAll("script")).forEach(function (sc) {
      if (sc.type && sc.type !== "text/javascript" && sc.type !== "application/ld+json") {
        if (sc.type === "application/ld+json") return; /* non eseguibile */
      }
      if (sc.type === "application/ld+json") return;
      if (sc.src && isGlobalOnce(sc.src)) return;
      var n = document.createElement("script");
      if (sc.src) {
        n.src = sc.src;
        n.async = false;
      } else {
        n.textContent = sc.textContent;
      }
      document.body.appendChild(n);
    });

    /* ritraduci se la lingua attiva non e' la sorgente */
    try { if (window.dndTr && window.dndTr.state && window.dndTr.state.lang &&
               window.dndTr.state.lang !== (window.dndTr.state.SRC_LANG || "it")) window.dndTr.translateNow(); } catch (e) {}
    /* riparti osservatori legati al main (barra progresso ecc. ricevono il main nuovo:
       la scroll-bar vive su window, nessun rebind necessario) */
    window.scrollTo(0, 0);
  }

  function go(href) {
    var url = normalizeHref(href);
    var main = document.querySelector("main");
    if (main) main.style.transition = "opacity " + FADE_MS + "ms ease";
    if (main) main.style.opacity = "0.12";
    fetch(url, { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        swapFrom(doc, url);
        var m = document.querySelector("main");
        if (m) { m.style.opacity = "0"; requestAnimationFrame(function () { m.style.opacity = "1"; }); }
        history.pushState({ gdr: true }, "", url);
      })
      .catch(function () { location.href = url; /* fallback: navigazione normale */ });
  }

  document.addEventListener("click", function (ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target.closest ? ev.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href");
    if (a.target === "_blank" || a.hasAttribute("download") || href.charAt(0) === "#" || !isInternal(href)) return;
    ev.preventDefault();
    go(href);
  });

  /* back/forward del browser */
  window.addEventListener("popstate", function () { go(location.href); });
})();

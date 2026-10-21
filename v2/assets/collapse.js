/* collapse.js — contenitori lunghi comprimibili, con animazione.
 *
 * Requisito dell'operatore: ogni menu o elenco troppo lungo deve poter essere
 * compresso a mano, con un'animazione.
 *
 * COME SI USA (nessuna configurazione nel markup)
 *   un elemento con `data-collapse` viene limitato in altezza; lo script gli
 *   aggiunge un pulsante «Mostra tutto / Comprimi» e anima l'apertura.
 *   Attributi opzionali:
 *     data-collapse      (obbligatorio) altezza massima chiusa in pixel, es. 420
 *     data-collapse-label / data-collapse-label-open  (testi dei pulsanti)
 *
 * PERCHÉ COSÌ
 *   · l'animazione usa `max-height` con valore esplicito: animare fino a `none`
 *     non è animabile e il contenuto salterebbe;
 *   · a fine apertura l'altezza massima viene tolta, così i contenuti che cambiano
 *     (filtri, nuove schede) non restano tagliati;
 *   · il pulsante è un vero <button> con `aria-expanded` e `aria-controls`;
 *   · con `prefers-reduced-motion` l'animazione è disattivata.
 */
(function () {
  "use strict";

  function makeButton(target, id, closedLabel, openLabel) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "collapse-btn";
    b.setAttribute("aria-controls", id);
    b.setAttribute("aria-expanded", "false");
    b.textContent = closedLabel;
    b.dataset.labelClosed = closedLabel;
    b.dataset.labelOpen = openLabel;
    b.addEventListener("click", function () {
      var aperto = target.classList.contains("is-open");
      if (aperto) {
        /* per animare la chiusura serve un'altezza di partenza esplicita */
        target.style.maxHeight = target.scrollHeight + "px";
        void target.offsetHeight;
        target.classList.remove("is-open");
        target.style.maxHeight = "";
        b.textContent = closedLabel;
        b.setAttribute("aria-expanded", "false");
      } else {
        target.style.maxHeight = target.scrollHeight + "px";
        target.classList.add("is-open");
        b.textContent = openLabel;
        b.setAttribute("aria-expanded", "true");
        /* a fine transizione si libera l'altezza: il contenuto può cambiare */
        var done = function () {
          target.style.maxHeight = "none";
          target.removeEventListener("transitionend", done);
        };
        target.addEventListener("transitionend", done);
        setTimeout(done, 700);   // rete di sicurezza se transitionend non arriva
      }
    });
    return b;
  }

  function setup(el, i) {
    if (el.dataset.collapseReady === "1") return;
    el.dataset.collapseReady = "1";
    var id = el.id || "collapse-" + i;
    el.id = id;
    var max = parseInt(el.getAttribute("data-collapse"), 10) || 420;
    var closedLabel = el.getAttribute("data-collapse-label") || "Mostra tutto";
    var openLabel = el.getAttribute("data-collapse-label-open") || "Comprimi";
    el.classList.add("collapse-body");
    el.style.maxHeight = max + "px";

    /* Se il contenuto è più corto del limite, non serve comprimere: nessun pulsante. */
    if (el.scrollHeight <= max + 24) {
      el.style.maxHeight = "none";
      el.classList.remove("collapse-body");
      return;
    }
    var b = makeButton(el, id, closedLabel, openLabel);
    el.parentNode.insertBefore(b, el);
  }

  /* Contenitori che si comprimono da soli quando sono lunghi, senza doverlo
     dichiarare nel markup: le pagine hanno elenchi e tabelle che crescono con i
     dati (catalogo risorse, tabella comparativa LFG). Sotto la soglia non
     cambia nulla: nessun pulsante inutile. */
  var AUTO = [
    [".card-grid", 900, "Mostra tutte le risorse", "Comprimi l'elenco"],
    [".comparison-table", 520, "Mostra la tabella completa", "Comprimi la tabella"],
    [".src-table-wrap", 560, "Mostra tutte le fonti", "Comprimi l'elenco delle fonti"],
    ["#lfg-form-card", 900, "Mostra il modulo completo", "Comprimi il modulo"],
    /* aggiunti su MISURA (contenitori lunghi senza alcun controllo di compressione):
       cal-card 3938px · cmp-grid 2048 · rc-view 1775 · rc-table 1321 · chart-grid 889 ·
       module-grid 652. */
    ["#cal-card, .cal-card", 620, "Mostra il calendario completo", "Comprimi il calendario"],
    [".cmp-grid", 560, "Mostra tutti i numeri del compendio", "Comprimi il riepilogo"],
    [".chart-grid", 560, "Mostra tutti i grafici", "Comprimi i grafici"],
    ["#rc-view", 620, "Mostra tutti i materiali disponibili", "Comprimi l'elenco dei materiali"],
    [".rc-table", 560, "Mostra la tabella completa", "Comprimi la tabella"],
    [".module-grid", 560, "Mostra tutti i moduli della home", "Comprimi i moduli"],
  ];

  function auto() {
    AUTO.forEach(function (spec, i) {
      Array.prototype.forEach.call(document.querySelectorAll(spec[0]), function (el) {
        if (el.dataset.collapseReady === "1") return;
        if (el.closest(".collapse-body")) return;          // già dentro un contenitore compresso
        el.setAttribute("data-collapse", String(spec[1]));
        el.setAttribute("data-collapse-label", spec[2]);
        el.setAttribute("data-collapse-label-open", spec[3]);
        setup(el, "auto-" + i + "-" + Math.random().toString(36).slice(2, 6));
      });
    });
  }

  function boot() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-collapse]"), setup);
    auto();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  /* i contenuti generati dopo (schede del meteo, regioni, galleria) vengono
     compresi quando compaiono */
  window.dndCollapse = { run: boot };
})();

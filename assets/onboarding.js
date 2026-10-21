/* ==========================================================================
   onboarding.js — Sistema introduttivo de Il Grimorio dei Reami.
   Tour guidato a 5 passi mostrato al primo accesso (localStorage) e
   riapribile dal pulsante "?" fisso in basso a destra su OGNI pagina.
   Inlinato da build_site.py/render_nav(). Nessuna dipendenza; contenuti
   = costanti locali di questo file (innerHTML quindi sicuro).
   ========================================================================== */
(function () {
  "use strict";
  var KEY = "dndhub_tour_done_v1";
  var STEPS = [
    {
      ico: "🎲",
      t: "Benvenuto nel Grimorio dei Reami",
      body: "Questo sito è un motore di ricerca e una cassetta di strumenti per D&D 5e che gira interamente sulla workstation locale: nessun tracciamento, nessuna dipendenza esterna, pagine servite istantaneamente.",
      list: ["13.219 entità indicizzate da 5e.tools", "228 fonti verificate empiricamente", "Offline-first: funziona anche senza rete"]
    },
    {
      ico: "🔎",
      t: "1 · Ricerca globale",
      body: "Dalla Home cerchi in tutto il database: mostri, incantesimi, classi e sottoclassi, oggetti magici, razze, background, talenti, condizioni. La ricerca tollera gli errori di battitura.",
      list: ["Fuzzy match (es. «wizerd» trova Wizard)", "Filtri per categoria e per classe incantatore", "Risultato con scheda completa, non solo il nome"]
    },
    {
      ico: "📜",
      t: "2 · SRD Lookup",
      body: "La pagina di consultazione: digita un nome e apri la scheda con statblock, tratti, azioni, incantesimi e hyperlink incrociati verso le altre entità del sito.",
      list: ["Statblock: CA, PF, velocità, caratteristiche, tiri salvezza, sensi, lingue", "Incantesimi collegati e classi che li apprendono", "Preferiti salvati nel browser (nessun login)"]
    },
    {
      ico: "🌙",
      t: "3 · Faerûn Tools",
      body: "Gli strumenti per il DM: il calendario di Harptos interattivo, il meteo reale tradotto nel linguaggio di Faerûn con previsione a tre giorni, e un tavolo di dadi.",
      list: ["Calendario: 12 mesi, festival, fasi di Selûne", "Meteo Open-Meteo + fallback stagionale deterministico", "Dadi d4–d100 con quantità, modificatore, vantaggio/svantaggio"]
    },
    {
      ico: "🧭",
      t: "4 · Directory & LFG",
      body: "228 risorse selezionate per giocare e masterare, più la pagina LFG per trovare o formare un gruppo nella scena italiana, e la dashboard con le metriche del progetto.",
      list: ["Directory con ricerca e categorie", "LFG: iscrizione sessioni e matchmaking", "Dashboard analytics: entità, fonti, incidenti"]
    }
  ];

  var idx = 0;
  var overlay, card, fab, lastFocus;

  function render() {
    if (!overlay) return;
    var s = STEPS[idx];
    var dots = STEPS.map(function (_, i) {
      return '<span class="' + (i === idx ? "act" : "") + '"></span>';
    }).join("");
    card.innerHTML =
      '<div class="tour-ico" aria-hidden="true">' + s.ico + "</div>" +
      '<h2 id="tour-title">' + s.t + "</h2>" +
      (s.body ? '<p id="tour-body">' + s.body + "</p>" : "") +
      (s.list && s.list.length
        ? "<ul>" + s.list.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>"
        : "") +
      '<div class="tour-foot">' +
        '<div class="tour-dots" aria-hidden="true">' + dots + "</div>" +
        '<div class="tour-actions">' +
          '<button type="button" class="btn" id="tour-skip">' + (idx === STEPS.length - 1 ? "Chiudi" : "Salta") + "</button>" +
          (idx > 0 ? '<button type="button" class="btn" id="tour-prev">Indietro</button>' : "") +
          '<button type="button" class="btn" id="tour-next">' + (idx === STEPS.length - 1 ? "Inizia a esplorare" : "Avanti") + "</button>" +
        "</div>" +
      "</div>";
    var next = document.getElementById("tour-next");
    var prev = document.getElementById("tour-prev");
    var skip = document.getElementById("tour-skip");
    if (next) next.addEventListener("click", function () {
      if (idx === STEPS.length - 1) { close(true); } else { idx++; render(); }
    });
    if (prev) prev.addEventListener("click", function () { if (idx > 0) { idx--; render(); } });
    if (skip) skip.addEventListener("click", function () { close(true); });
    if (next) next.focus();
  }

  function open() {
    if (!overlay) return;
    lastFocus = document.activeElement;
    idx = 0;
    overlay.hidden = false;
    render();
    // Focus trap: il pannello e' aria-modal="true", quindi il focus NON deve
    // uscire dal dialogo (prima servivano 19 Tab per raggiungere "Salta").
    var first = overlay.querySelector("button");
    if (first) first.focus();
    document.addEventListener("keydown", trapTab, true);
  }

  function trapTab(ev) {
    if (overlay.hidden || ev.key !== "Tab") return;
    var f = Array.prototype.slice.call(overlay.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
    if (!f.length) return;
    var firstEl = f[0], lastEl = f[f.length - 1];
    var active = document.activeElement;
    if (ev.shiftKey && (active === firstEl || !overlay.contains(active))) {
      ev.preventDefault(); lastEl.focus();
    } else if (!ev.shiftKey && (active === lastEl || !overlay.contains(active))) {
      ev.preventDefault(); firstEl.focus();
    }
  }

  function close(mark) {
    if (!overlay) return;
    overlay.hidden = true;
    document.removeEventListener("keydown", trapTab, true);
    if (mark) { try { localStorage.setItem(KEY, "1"); } catch (e) { /* storage negato: nessun problema */ } }
    // Ripristina il focus su un elemento REALE e VISIBILE: se il FAB è nascosto
    // (viewport strette) si usa il pulsante "Guida introduttiva" del footer.
    // NOTA: per position:fixed `offsetParent` è SEMPRE null — va testato `display`.
    if (lastFocus && lastFocus !== document.body && lastFocus.focus) { lastFocus.focus(); return; }
    var fabVisible = fab && getComputedStyle(fab).display !== "none";
    var opener = fabVisible ? fab : document.querySelector(".tour-open");
    if (opener && opener.focus) opener.focus();
  }

  function init() {
    fab = document.getElementById("tour-fab");
    overlay = document.getElementById("tour-overlay");
    if (!overlay) return;
    card = document.createElement("div");
    card.className = "tour-card";
    overlay.appendChild(card);
    // Apri il tour da qualunque elemento marcato .tour-open: il FAB flottante e il
    // pulsante nel footer (il FAB e' nascosto sotto 1025px per non rubare tap).
    Array.prototype.forEach.call(document.querySelectorAll(".tour-open, #tour-fab"), function (el) {
      el.addEventListener("click", open);
    });

    // ORDINE DI TABULAZIONE = ORDINE VISIVO.
    // Il FAB del tour e' `position:fixed` (angolo in basso a destra) ma nel DOM viene
    // emesso PRIMA del contenuto: il Tab lo raggiunge per primo e poi risale in cima
    // alla pagina. Misurato su tutte le pagine del sito come "inversione".
    // Si spostano in fondo al body SOLO i comandi del tour con posizione fissa: la
    // guardia su `position` protegge il pulsante di guida che sta regolarmente dentro
    // la nav. Nessun mascheramento: l'elemento resta presente e visibile, cambia solo
    // la sua posizione nel documento.
    Array.prototype.forEach.call(document.querySelectorAll("#tour-fab, .tour-open"), function (el) {
      // La condizione deve chiedere se e' l'ULTIMO figlio, non se e' figlio di body:
      // il FAB e' gia' un figlio diretto di body ma e' il PRIMO (indice 1 su 6 figli),
      // quindi `parentNode !== document.body` era falsa e lo spostamento non avveniva
      // (misurato: indiceFAB=1, ultimoFiglioDiBody=FOOTER).
      if (getComputedStyle(el).position === "fixed" && document.body.lastElementChild !== el) {
        document.body.appendChild(el);
      }
    });
    overlay.addEventListener("click", function (ev) { if (ev.target === overlay) close(true); });
    document.addEventListener("keydown", function (ev) {
      if (overlay.hidden) return;
      if (ev.key === "Escape") { close(true); }
      else if (ev.key === "ArrowRight") { if (idx < STEPS.length - 1) { idx++; render(); } }
      else if (ev.key === "ArrowLeft") { if (idx > 0) { idx--; render(); } }
    });
    var done = false;
    try { done = localStorage.getItem(KEY) === "1"; } catch (e) { done = false; }
    if (!done) open();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

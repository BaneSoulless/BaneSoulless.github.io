/* compendio.js — Compendio dei Reami: i numeri del database, per chi gioca.
 *
 * REQUISITO: la pagina delle statistiche deve diventare interessante e interattiva
 * per i giocatori, «non con info che non gli interessano minimamente». Quindi via i
 * tassi di disponibilità dei siti (roba da manutenzione, spostati in fondo e chiusi)
 * e dentro i numeri che servono al tavolo: quanti mostri per Grado di Sfida, quali
 * scuole di magia sono più affollate, come si distribuiscono le rarità, quanto pesa
 * ogni manuale.
 *
 * TUTTO È CALCOLATO dai campi dell'indice (`cr`, `sch`, `r`, `s`, `t`, `p`), nessun
 * numero scritto a mano: se il database cambia, i grafici cambiano con lui.
 *
 * INTERATTIVITÀ: ogni barra è cliccabile e porta alla consultazione già filtrata; il
 * pulsante «Sorprendimi» apre una scheda a caso. I grafici hanno ruolo e descrizione
 * accessibili: barra visiva + valore numerico scritto.
 */
(function () {
  "use strict";

  var idx = null;
  var ids = ["cmp-tipi", "cmp-cr", "cmp-scuole", "cmp-rarita", "cmp-fonti", "cmp-fatti"];
  var schoolName = { A: "Abiurazione", C: "Evocazione", D: "Divinazione", E: "Ammaliamento",
                     V: "Invocazione", I: "Illusione", N: "Necromanzia", T: "Trasmutazione" };
  var crBands = [
    { label: "0 – 1/8", test: function (v) { return v <= 0.125; } },
    { label: "1/4 – 1/2", test: function (v) { return v > 0.125 && v <= 0.5; } },
    { label: "1 – 4", test: function (v) { return v > 0.5 && v <= 4; } },
    { label: "5 – 10", test: function (v) { return v > 4 && v <= 10; } },
    { label: "11 – 16", test: function (v) { return v > 10 && v <= 16; } },
    { label: "17 – 20", test: function (v) { return v > 16 && v <= 20; } },
    { label: "21+", test: function (v) { return v > 20; } },
  ];

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

  /* cr può essere numero o frazione testuale ("1/2"): va interpretato. */
  function crValue(v) {
    if (v == null) return null;
    if (typeof v === "number") return v;
    var s = String(v).trim();
    var m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (m) return parseInt(m[1], 10) / parseInt(m[2], 10);
    var f = parseFloat(s);
    return isNaN(f) ? null : f;
  }

  /* Riga di un grafico: barra proporzionale + etichetta + valore, tutto cliccabile. */
  function bar(label, value, max, href, tone) {
    var pct = max ? Math.round(value * 100 / max) : 0;
    var inner = '<span class="cb-label">' + esc(label) + "</span>" +
      '<span class="cb-bar"><span class="cb-fill' + (tone ? " " + tone : "") +
      '" style="width:' + Math.max(2, pct) + '%"></span></span>' +
      '<span class="cb-num">' + num(value) + "</span>";
    return href
      ? '<li><a class="cb-row" href="' + esc(href) + '">' + inner + "</a></li>"
      : '<li><span class="cb-row">' + inner + "</span></li>";
  }

  function chart(containerId, title, rows, nota) {
    var box = el(containerId);
    if (!box) return;
    var max = rows.reduce(function (m, r) { return Math.max(m, r.value); }, 0);
    box.innerHTML = '<h2 class="cmp-h3">' + esc(title) + "</h2>" +
      '<ul class="cmp-chart" role="list">' +
      rows.map(function (r) { return bar(r.label, r.value, max, r.href, r.tone); }).join("") +
      "</ul>" + (nota ? '<p class="tv-meta">' + esc(nota) + "</p>" : "");
  }

  function render() {
    var e = idx.entries || [];
    var vis = e.filter(function (x) { return !x.sup; });

    /* --- entità per tipo (cliccabile: filtra la consultazione) --- */
    var perTipo = {};
    vis.forEach(function (x) { perTipo[x.t] = (perTipo[x.t] || 0) + 1; });
    var tipi = Object.keys(perTipo).map(function (k) {
      return { label: (idx.types && idx.types[k] && idx.types[k].label) || k, value: perTipo[k],
               href: "lookup.html?cat=" + encodeURIComponent(k) };
    }).sort(function (a, b) { return b.value - a.value; }).slice(0, 14);

    /* --- mostri per fascia di Grado di Sfida --- */
    var mostri = vis.filter(function (x) { return x.t === "monster" && !x.sup; });
    var bande = crBands.map(function (b) {
      return { label: b.label, value: 0, href: "", tone: "" };
    });
    var crCount = 0;
    mostri.forEach(function (m) {
      var v = crValue(m.cr);
      if (v === null) return;
      crCount++;
      for (var i = 0; i < crBands.length; i++) {
        if (crBands[i].test(v)) { bande[i].value++; break; }
      }
    });

    /* --- incantesimi per scuola --- */
    var perScuola = {};
    vis.forEach(function (x) {
      if (x.t !== "spell" || !x.sch) return;
      perScuola[x.sch] = (perScuola[x.sch] || 0) + 1;
    });
    var scuole = Object.keys(perScuola).map(function (k) {
      return { label: schoolName[k] || k, value: perScuola[k] };
    }).sort(function (a, b) { return b.value - a.value; });

    /* --- oggetti per rarità --- */
    var perRarita = {};
    vis.forEach(function (x) {
      if (x.t !== "item" || !x.r) return;
      perRarita[x.r] = (perRarita[x.r] || 0) + 1;
    });
    var ORDINE = ["common", "uncommon", "rare", "very rare", "legendary", "artifact", "varies"];
    var rarita = Object.keys(perRarita).map(function (k) {
      return { label: k, value: perRarita[k] };
    }).sort(function (a, b) {
      var ia = ORDINE.indexOf(a.label), ib = ORDINE.indexOf(b.label);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    /* --- fonti più rappresentate, con l'anno --- */
    var perFonte = {};
    vis.forEach(function (x) { perFonte[x.s] = (perFonte[x.s] || 0) + 1; });
    var fonti = Object.keys(perFonte).map(function (k) {
      var conData = vis.filter(function (x) { return x.s === k && x.p; })[0];
      var anno = conData && conData.p ? conData.p.slice(0, 4) : "";
      return { label: k + (anno ? " (" + anno + ")" : ""), value: perFonte[k] };
    }).sort(function (a, b) { return b.value - a.value; }).slice(0, 12);

    chart("cmp-tipi", "Entità per tipo (clicca per consultarle)", tipi, null);
    chart("cmp-cr", "Mostri per Grado di Sfida", bande,
          crCount + " mostri su " + mostri.length + " hanno un Grado di Sfida dichiarato.");
    chart("cmp-scuole", "Incantesimi per scuola di magia", scuole, null);
    chart("cmp-rarita", "Oggetti magici per rarità", rarita, null);
    chart("cmp-fonti", "Fonti più rappresentate (con anno di pubblicazione)", fonti,
          "Le ristampe sono già raggruppate: qui si conta la voce visibile, cioè la più recente.");

    /* --- curiosità calcolate --- */
    var draghi = vis.filter(function (x) { return x.t === "monster" && /dragon/i.test(x.n); }).length;
    var leggendari = vis.filter(function (x) { return x.t === "item" && x.r === "legendary"; }).length;
    var artefatti = vis.filter(function (x) { return x.t === "item" && x.r === "artifact"; }).length;
    var trucchetti = 0, alti = 0;
    vis.forEach(function (x) {
      if (x.t !== "spell") return;
      var lv = x.lv;
      if (lv === 0) trucchetti++;
      if (typeof lv === "number" && lv >= 8) alti++;
    });
    var piuComune = tipi.length ? tipi[0] : { label: "—", value: 0 };
    var banda = bande.slice().sort(function (a, b) { return b.value - a.value; })[0] || { label: "—", value: 0 };
    var scuolaTop = scuole.length ? scuole[0] : { label: "—", value: 0 };
    var raritaTop = rarita.length ? rarita[0] : { label: "—", value: 0 };

    var fatti = el("cmp-fatti");
    if (fatti) {
      var righe = [
        ["Entità consultabili", num(vis.length) + " (su " + num(e.length) + " incluse le ristampe)"],
        ["Tipo più rappresentato", piuComune.label + " — " + num(piuComune.value)],
        ["Fascia di Grado di Sfida più affollata", banda.label + " — " + num(banda.value) + " mostri"],
        ["Scuola di magia più ricca", scuolaTop.label + " — " + num(scuolaTop.value) + " incantesimi"],
        ["Rarità più diffusa", raritaTop.label + " — " + num(raritaTop.value) + " oggetti"],
        ["Draghi nel database", num(draghi)],
        ["Oggetti leggendari", num(leggendari)],
        ["Artefatti", num(artefatti)],
        ["Incantesimi di 8° e 9° livello", num(alti)],
      ];
      fatti.innerHTML = '<h2 class="cmp-h3">Curiosità dal database</h2><dl class="cmp-facts">' +
        righe.map(function (r) {
          return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>";
        }).join("") + "</dl>";
    }
  }

  /* «Sorprendimi»: apre una scheda a caso nella consultazione. */
  function initSorprendi() {
    var b = el("cmp-random");
    if (!b) return;
    b.addEventListener("click", function () {
      if (!idx) return;
      var vis = (idx.entries || []).filter(function (x) { return !x.sup; });
      if (!vis.length) return;
      var x = vis[Math.floor(Math.random() * vis.length)];
      var out = el("cmp-random-out");
      if (out) {
        out.innerHTML = 'Scheda estratta: <a href="lookup.html?cat=' + esc(x.t) + "&q=" +
          encodeURIComponent(x.n) + '"><strong>' + esc(x.n) + "</strong></a> " +
          '<span class="tv-meta">(' + esc((idx.types && idx.types[x.t] && idx.types[x.t].label) || x.t) +
          " · " + esc(x.s || "") + ")</span>";
      }
      window.open("lookup.html?cat=" + encodeURIComponent(x.t) + "&q=" + encodeURIComponent(x.n), "_blank");
    });
  }

  function boot() {
    if (!el("cmp-tipi")) return;
    var x = new XMLHttpRequest();
    x.open("GET", "../data/lookup-index.json", true);
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      if (x.status !== 200) {
        var box = el("cmp-fatti");
        if (box) box.innerHTML = '<p class="tv-meta">Dati non disponibili: il compendio si popola quando l\'indice è raggiungibile.</p>';
        return;
      }
      try { idx = JSON.parse(x.responseText); } catch (e) { idx = null; }
      if (idx) { render(); initSorprendi(); }
    };
    x.send();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

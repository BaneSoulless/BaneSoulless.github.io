/* calendar-harptos.js — calendario di Harptos con le informazioni di OGNI giorno.
 *
 * COSA MOSTRA
 *   · griglia del mese in tre decadi (tenday), con la fase lunare di ogni giorno;
 *   · data di OGGI nei Reami, evidenziata;
 *   · anno di Dalereckoning selezionabile (1480–1520 DR; predefinito 1508 DR, l'anno
 *     corrente della campagna) e memorizzato;
 *   · Shieldmeet, festival intercalare che cade ogni quattro anni dopo Midsummer;
 *   · per il giorno selezionato le voci da `data/faerun-days.json`: quelle con
 *     `generated: false` vengono dalla Forgotten Realms Wiki e portano il link alla
 *     voce, quelle con `generated: true` sono composte dall'autore e sono marcate
 *     «composto» nel pannello — mai spacciate per canoniche;
 *   · i giorni con almeno una voce reale sono marcati con un punto nella griglia.
 *
 * DIPENDENZE: window.FAERUN_MONTHS (da data/faerun-calendar.json) e data/faerun-days.json.
 * Le stagioni sono esportate in window.FAERUN_SEASONS e riusate dal widget meteo.
 */
(function () {
  "use strict";

  var MONTHS = window.FAERUN_MONTHS || [];
  var DAYS = 30;
  var MOON = ["Luna nuova", "Crescente", "Primo quarto", "Gibbosa", "Luna piena",
              "Gibbosa", "Ultimo quarto", "Crescente"];
  var YEAR_DEFAULT = 1508;          // anno corrente della campagna

  var FESTIVAL_INFO = {
    "Midwinter": "Mezzo d'inverno: la notte più lunga dell'anno, festa del fuoco, dei giuramenti e dei conti chiusi.",
    "Greengrass": "Inizio della primavera: benedizione dei campi, primo raccolto e apertura delle rotte.",
    "Midsummer": "Mezzo d'estate: il giorno più lungo, con falò, tornei e corteggiamenti.",
    "Highharvestide": "Inizio dell'autunno: festa del raccolto e delle partenze verso i Reami lontani.",
    "Feast of the Moon": "Inizio dell'inverno: commemorazione dei morti e delle gesta degli eroi.",
    "Shieldmeet": "Festival intercalare di Shieldmeet: cade ogni quattro anni dopo Midsummer; giorno di tornei, consigli e grandi alleanze."
  };

  var SEASONS = ["Inverno", "Inverno", "Inverno", "Primavera", "Primavera", "Estate",
                 "Estate", "Estate", "Autunno", "Autunno", "Autunno", "Inverno"];
  window.FAERUN_SEASONS = SEASONS;

  var mi = 0, sel = null, year = YEAR_DEFAULT;
  var days = null;                  // contenuto di data/faerun-days.json

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function moonPhase(day) { return MOON[Math.floor(((day - 1) % 30) / 30 * 8) % 8]; }

  /* Shieldmeet: regola dichiarata (anno DR divisibile per 4), non dedotta. */
  function isShieldmeetYear(y) { return y % 4 === 0; }

  /* Festival che seguono il mese: possono essere PIÙ DI UNO (Flamerule → Midsummer
     e, negli anni divisibili per 4, anche Shieldmeet). */
  function festsOf(m) {
    var out = [];
    if (!m) return out;
    if (m.festival_after) out.push(m.festival_after);
    if (m.name === "Flamerule" && isShieldmeetYear(year)) out.push("Shieldmeet");
    return out;
  }

  function loadYear() {
    try {
      var v = parseInt(localStorage.getItem("dndhub_dr_year"), 10);
      if (v >= 1000 && v <= 2000) year = v;
    } catch (e) { /* storage negato: resta l'anno predefinito */ }
  }
  function saveYear() {
    try { localStorage.setItem("dndhub_dr_year", String(year)); } catch (e) {}
  }

  /* Oggi nei Reami: giorno dell'anno reale mappato su Harptos (12×30 + 5 festival). */
  function todayHarptos() {
    var d = new Date();
    var doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    var idx = Math.min(11, Math.floor((doy - 1) / 30.42));
    var day = Math.min(30, Math.max(1, Math.round(doy - idx * 30.42)));
    return { mi: idx, day: day };
  }

  /* Voci del giorno dal file dei giorni (ricorrenze wiki + note composte). */
  function entriesFor(monthIdx, day, festivalName) {
    if (!days) return null;
    for (var i = 0; i < days.length; i++) {
      var g = days[i];
      if (g.month === monthIdx && g.day === day && (!!g.festival) === !!festivalName) return g;
    }
    return null;
  }

  function hasWiki(monthIdx, day, festivalName) {
    var g = entriesFor(monthIdx, day, festivalName);
    if (!g || !g.entries) return false;
    return g.entries.some(function (e) { return !e.generated; });
  }

  function fillYears() {
    var s = el("cal-year");
    if (!s) return;
    var h = "";
    for (var y = 1480; y <= 1520; y++) {
      h += '<option value="' + y + '"' + (y === year ? " selected" : "") + ">" + y + " DR</option>";
    }
    s.innerHTML = h;
  }

  function tendayOf(day) { return Math.min(3, Math.floor((day - 1) / 10) + 1); }

  function vociHtml(g) {
    if (!g || !g.entries || !g.entries.length) return "";
    return g.entries.map(function (e) {
      var tipo = e.tipo ? '<span class="day-tipo">' + esc(e.tipo) + "</span>" : "";
      var nome = e.nome ? "<strong>" + esc(e.nome) + "</strong> " : "";
      var luogo = e.luogo ? ' <span class="day-luogo">(' + esc(e.luogo) + ")</span>" : "";
      var bollo = e.generated
        ? '<span class="day-gen" title="contenuto composto dall\'autore: non canonico">composto</span>'
        : '<span class="day-wiki" title="dalla Forgotten Realms Wiki">wiki</span>';
      var link = (!e.generated && e.wiki)
        ? ' <a href="' + esc(e.wiki) + '" target="_blank" rel="noopener nofollow">voce</a>' : "";
      return '<li class="day-entry">' + bollo + tipo + nome + esc(e.descrizione || "") + luogo + link + "</li>";
    }).join("");
  }

  function render() {
    var m = MONTHS[mi];
    if (!m) return;
    var season = SEASONS[mi];
    el("cal-month").textContent = m.name;
    var badge = el("cal-season");
    if (badge) badge.textContent = season + " \u00b7 " + year + " DR";

    var today = todayHarptos();
    var grid = el("cal-grid");
    var h = "";
    for (var d = 1; d <= DAYS; d++) {
      var isToday = (today.mi === mi && today.day === d);
      var newTenday = (d > 1 && (d - 1) % 10 === 0);
      var lore = hasWiki(mi, d, null);
      h += '<div class="cal-day' + (sel === d ? " sel" : "") + (isToday ? " today" : "") +
        (newTenday ? " tenday-start" : "") + (lore ? " has-lore" : "") + '" data-d="' + d + '"' +
        ' title="' + esc(d + " " + m.name + (lore ? " — con ricorrenza documentata" : "")) + '">' +
        '<div class="d-num">' + d + "</div>" +
        '<div class="d-moon">' + moonPhase(d) + "</div>" +
        (lore ? '<div class="d-lore" aria-hidden="true">&#9679;</div>' : "") +
        (isToday ? '<div class="d-today">oggi</div>' : "") + "</div>";
    }
    var fests = festsOf(m);
    for (var fi = 0; fi < fests.length; fi++) {
      var fnum = 31 + fi;
      h += '<div class="cal-day fest' + (sel === fnum ? " sel" : "") +
        (hasWiki(mi, 31, fests[fi]) ? " has-lore" : "") + '" data-d="' + fnum + '">' +
        '<div class="d-num">&#9733;</div><div class="d-fest">' + fests[fi] + "</div></div>";
    }
    grid.innerHTML = h;

    /* -------- pannello del giorno -------- */
    var info;
    var festSel = (sel >= 31) ? fests[sel - 31] : null;
    if (festSel) {
      var gf = entriesFor(mi, 31, festSel);
      info = "<strong>Festival: " + esc(festSel) + "</strong> \u2014 giorno intercalare dopo " +
        esc(m.name) + " (stagione: " + esc(season) + "). " + esc(FESTIVAL_INFO[festSel] || "") +
        (festSel === "Shieldmeet"
          ? " <em>Anno " + year + ": Shieldmeet cade perché " + year + " è divisibile per 4.</em>" : "") +
        (gf && gf.entries && gf.entries.length ? '<ul class="day-entries">' + vociHtml(gf) + "</ul>" : "");
    } else if (sel) {
      var isOggi = (today.mi === mi && today.day === sel);
      var g = entriesFor(mi, sel, null);
      info = (isOggi ? "<strong>Oggi nei Reami:</strong> " : "") +
        "<strong>" + sel + " " + esc(m.name) + " \u00b7 " + year + " DR</strong> \u2014 " + esc(season) +
        " \u00b7 " + tendayOf(sel) + "\u00b0 decade" +
        " \u00b7 luna: " + esc(moonPhase(sel)) +
        (g && g.meteo ? ' \u00b7 <span class="day-meteo">' + esc(g.meteo) + "</span>" : "") +
        (g && g.entries && g.entries.length
          ? '<ul class="day-entries">' + vociHtml(g) + "</ul>"
          : '<p class="tv-meta">Nessuna nota per questo giorno.</p>');
    } else {
      info = "<strong>" + esc(m.name) + "</strong> è il " + (mi + 1) + "\u00b0 mese dell'anno Harptos, " +
        "stagione <strong>" + esc(season) + "</strong>, anno <strong>" + year + " DR</strong>. " +
        "Il mese conta 30 giorni in tre decadi; il ciclo di Selûne dura 30 giorni, quindi la luna piena cade il 16. " +
        (m.festival_after ? "Segue il festival <strong>" + esc(m.festival_after) + "</strong>. " : "") +
        (m.name === "Flamerule" && isShieldmeetYear(year)
          ? "Nel " + year + " DR dopo Midsummer cade anche <strong>Shieldmeet</strong>. " : "") +
        "I giorni con un punto hanno una ricorrenza documentata: selezionali per leggerla. " +
        "Oggi nei Reami è <strong>" + today.day + " " + esc(MONTHS[today.mi].name) + "</strong>" +
        (today.mi !== mi ? " (altro mese: usa \u00abOggi nei Reami\u00bb)" : "") + ".";
    }
    el("cal-info").innerHTML = info;
  }

  function goToday() {
    var t = todayHarptos();
    mi = t.mi;
    sel = t.day;
    render();
  }

  function loadDays() {
    var x = new XMLHttpRequest();
    x.open("GET", "../data/faerun-days.json", true);
    x.onreadystatechange = function () {
      if (x.readyState !== 4 || x.status !== 200) return;
      try { days = JSON.parse(x.responseText).days || []; } catch (e) { days = []; }
      render();
    };
    x.send();
  }

  function boot() {
    if (!el("cal-grid") || !MONTHS.length) return;
    loadYear();
    fillYears();
    var prev = el("cal-prev"), next = el("cal-next");
    if (prev) prev.addEventListener("click", function () { mi = (mi + 11) % 12; sel = null; render(); });
    if (next) next.addEventListener("click", function () { mi = (mi + 1) % 12; sel = null; render(); });
    var y = el("cal-year");
    if (y) y.addEventListener("change", function () {
      year = parseInt(y.value, 10) || year;
      saveYear();
      render();
    });
    var t = el("cal-today");
    if (t) t.addEventListener("click", goToday);
    el("cal-grid").addEventListener("click", function (ev) {
      var day = ev.target.closest ? ev.target.closest(".cal-day") : null;
      if (!day) return;
      sel = parseInt(day.dataset.d, 10);
      render();
    });
    /* All'apertura si posiziona sul mese corrente dei Reami. */
    var now = todayHarptos();
    mi = now.mi;
    sel = now.day;
    render();
    loadDays();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

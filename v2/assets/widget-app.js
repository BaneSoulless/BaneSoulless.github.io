/* widget-app.js — motore dei 4 widget del reame (widgets.html).
 * Calendario di Harptos (12 mesi x 30 gg + 5 festivita' intercalari, regola
 * canonica FR:Shieldmeet ogni 4 anni), fase di Selune (ciclo 30 gg, SVG),
 * meteo narrativo per stagione (tabelle locali dichiarate), orologio di Faerun.
 * Zero rete; persistenza in localStorage (anno/mese/giorno correnti di campagna).
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;" }[c];
    });
  }
  function dN(n) { return 1 + Math.floor(Math.random() * n); }

  /* ================= CALENDARIO DI HARPTOS ================= */
  var MESI = window.FAERUN_MONTHS || [];
  var FESTE = ["Midwinter", "Greengrass", "Midsummer", "Highharvestide", "Feast of the Moon"];
  var NOMI_FESTA_IT = {
    "Midwinter": "Tramidinverno", "Greengrass": "Verdeprato", "Midsummer": "Mezzestate",
    "Highharvestide": "Alto Raccolto", "Feast of the Moon": "Festa della Luna"
  };
  /* stato campagna: mese 0-11, giorno 1-30, anno Dal Rejazionato */
  var cal = { mese: 0, giorno: 1, anno: 1496 };
  try {
    var salvato = JSON.parse(localStorage.getItem("gdr-cal") || "null");
    if (salvato && typeof salvato.mese === "number") cal = salvato;
  } catch (e) {}

  /* P6: corrispondenza col calendario reale (30 gg per mese -> arrotondata) */
  var EQ_REALE = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

  function isShieldmeet(anno) { return anno % 4 === 0; }
  function totaleGiorni(anno) { return 360 + 5 + (isShieldmeet(anno) ? 1 : 0); }
  function dataAssoluta(c) { return (c.anno - 1) * totaleGiorni(c.anno) + c.mese * 30 + c.giorno - 1; }

  function esFesta(c) {
    /* le 5 feste seguono i mesi: dopo Hammer, Tarsakh, Flamerule, Eleint, Uktar */
    var dopoFesta = { 0: "Midwinter", 3: "Greengrass", 6: "Midsummer", 8: "Highharvestide", 10: "Feast of the Moon" };
    if (c.giorno === 31 && dopoFesta[c.mese] !== undefined && !c.fuori) return dopoFesta[c.mese];
    return null;
  }

  function renderCal() {
    var griglia = $("cal-grid");
    if (!griglia) return;
    var mese = MESI[cal.mese] || { name: "Hammer" };
    var eq = cal.mese >= 0 && cal.mese < 12 ? "  —  equivale a " + EQ_REALE[cal.mese] : "";
    $("cal-mese").textContent = mese.name + (mese.festival_after ? " ‹" + mese.festival_after + "›" : "") + eq;
    var celle = "";
    var g;
    for (g = 1; g <= 30; g++) {
      var cls = "cal-cella" + (g === cal.giorno ? " oggi" : "");
      celle += '<div class="' + cls + '" data-g="' + g + '" role="gridcell" tabindex="0">' + g + "</div>";
    }
    griglia.innerHTML = celle;
    /* la festiva del mese (se il giorno e' 31 o cliccata) */
    var fest = esFesta(cal);
    var nf = $("cal-fest");
    if (fest) {
      nf.innerHTML = "☉ <b>" + esc(NOMI_FESTA_IT[fest] || fest) + "</b> — " + esc(fest) + ": giorno fuori dal mese.";
      nf.style.display = "block";
    } else if (mese.festival_after) {
      nf.innerHTML = "☉ Festività " + esc(NOMI_FESTA_IT[mese.festival_after] || mese.festival_after) + " al giorno 31 (fuori dal mese).";
      nf.style.display = "block";
    } else { nf.style.display = "none"; }
    $("cal-anno-in").value = cal.anno;
    try { localStorage.setItem("gdr-cal", JSON.stringify(cal)); } catch (e2) {}
    /* fase lunare segue il giorno assoluto di campagna */
    renderLuna(dataAssoluta(cal));
    /* punto L: lore del mese + festivita' dal file calendar-lore.json */
    renderCalLore();
    /* punto M: il meteo narrativo segue il giorno selezionato */
    renderMeteoGiorno();
  }

  var CAL_LORE = null;
  function calLore() { return CAL_LORE || {}; }
  function loadCalLore() {
    if (CAL_LORE || !document.getElementById("cal-lore")) return;
    fetch("../data/calendar-lore.json").then(function (r) { return r.json(); })
      .then(function (j) { CAL_LORE = j || {}; renderCalLore(); })
      .catch(function () { CAL_LORE = {}; });
  }
  function renderCalLore() {
    var box = document.getElementById("cal-lore");
    if (!box) return;
    var L = calLore();
    var mese = MESI[cal.mese] || {};
    var m = (L.mesi || {})[mese.name] || {};
    var fest = mese.festival_after ? (L.festivita || {})[mese.festival_after] : null;
    var html = "";
    if (m.tit) {
      html += '<h4 class="cl-tit">' + esc(m.tit) + ' <span class="cl-stag">' + esc(m.stagione || "") + "</span></h4>" +
              '<p class="cl-txt">' + esc(m.txt || "") + "</p>";
    }
    if (fest) {
      html += '<div class="cl-fest"><b>' + esc(fest.nome_it || mese.festival_after) + "</b> — " + esc(fest.txt || "") + "</div>";
    }
    var festGiorno = esFesta(cal);
    if (festGiorno) {
      var f2 = (L.festivita || {})[festGiorno];
      if (f2) html = '<div class="cl-fest cl-fest-oggi"><b>' + esc(f2.nome_it || festGiorno) + '</b> (oggi, giorno 31) — ' + esc(f2.txt || "") + "</div>" + html;
    }
    box.innerHTML = html || "";
  }

  function initCal() {
    if (!$("cal-grid")) return;
    $("cal-grid").addEventListener("click", function (ev) {
      var c = ev.target.closest ? ev.target.closest("[data-g]") : null;
      if (!c) return;
      cal.giorno = parseInt(c.getAttribute("data-g"), 10);
      renderCal();
    });
    $("cal-prev").addEventListener("click", function () {
      cal.mese--; if (cal.mese < 0) { cal.mese = 11; cal.anno--; } cal.giorno = 1; renderCal();
    });
    $("cal-next").addEventListener("click", function () {
      cal.mese++; if (cal.mese > 11) { cal.mese = 0; cal.anno++; } cal.giorno = 1; renderCal();
    });
    $("cal-anno-in").addEventListener("change", function () {
      cal.anno = Math.max(1, Math.min(9999, parseInt(this.value, 10) || 1496));
      renderCal();
    });
    /* pulsante festivita': cliccando la nota si va al giorno 31 */
    $("cal-fest").addEventListener("click", function () {
      var mese = MESI[cal.mese] || {};
      if (mese.festival_after) { cal.giorno = 31; cal.fuori = true; renderCal(); }
    });
    renderCal();
    loadCalLore();
  }

  /* ================= SELUNE (fase lunare SVG) ================= */
  var FASI = [
    ["Luna nuova", "Selûne velata: gli affari dei licantropi sono tesi."],
    ["Crescente a falcetto", "Il primo chiarore: le carovane partono di notte."],
    ["Primo quarto", "Mezza Signora: le sentinelle raddoppiano."],
    ["Gibbosa crescente", "Chiarore forte: buoni auspici per i viaggi."],
    ["Luna piena", "Selûne piena: la notte dei riti e dei licanantropi."],
    ["Gibbosa calante", "La Signora declina: le lanterne tornano necessarie."],
    ["Ultimo quarto", "Mezza Signora scura: i rabdomanti vegliano."],
    ["Calante a falcetto", "Ultima falce: il buio prepara il ciclo nuovo."]
  ];

  function renderLuna(giornoAssoluto) {
    var svg = $("luna-svg"), faseEl = $("luna-fase"), det = $("luna-det"), fill = $("luna-fill");
    if (!svg) return;
    var ciclo = ((giornoAssoluto % 30) + 30) % 30; /* 0..29, 0 = nuova */
    var idx = Math.floor(ciclo / 30 * 8) % 8;
    var fase = FASI[idx];
    var illum = idx === 0 ? 0 : (idx === 4 ? 100 : Math.round(Math.abs(Math.sin((ciclo / 30) * Math.PI)) * 100));
    /* SVG: disco scuro + disco illuminante mascherato per fase (semplificato a 8 fasi) */
    var path = {
      0: "", 4: '<circle cx="55" cy="55" r="42" fill="#e8d9a0"/>',
      1: '<path d="M55 13a42 42 0 0 1 0 84z" fill="#e8d9a0"/>',
      2: '<path d="M55 13a42 42 0 0 1 0 84A55 55 0 0 0 55 13z" fill="#e8d9a0"/>',
      3: '<path d="M55 13a42 42 0 0 1 0 84A55 55 0 0 1 55 13z" fill="#e8d9a0"/>',
      5: '<path d="M55 13a42 42 0 0 0 0 84z" fill="#e8d9a0"/>',
      6: '<path d="M55 13a42 42 0 0 0 0 84A55 55 0 0 0 55 13z" fill="#e8d9a0"/>',
      7: '<path d="M55 13a42 42 0 0 0 0 84A55 55 0 0 1 55 13z" fill="#e8d9a0"/>'
    }[idx] || "";
    svg.innerHTML =
      '<circle cx="55" cy="55" r="42" fill="#1c1a24" stroke="rgba(201,162,39,.5)" stroke-width="1.5"/>' + path +
      '<circle cx="55" cy="55" r="42" fill="none" stroke="rgba(201,162,39,.35)" stroke-width="1"/>';
    faseEl.textContent = fase[0];
    det.textContent = "Giorno " + (ciclo + 1) + " del ciclo · " + illum + "% illuminata. " + fase[1];
    fill.style.width = illum + "%";
    /* P6: per i master — quando arriva la prossima luna piena e la nuova */
    var pl = $("luna-prossima");
    if (pl) {
      var aPiena = (4 * 30 / 8 - ciclo + 30) % 30;   /* fase 4 = piena */
      var aNuova = (30 - ciclo) % 30;
      pl.textContent = "Prossima luna piena tra " + (aPiena === 0 ? "STANOTTE" : aPiena + " gg") +
        " · luna nuova tra " + (aNuova === 0 ? "STANOTTE" : aNuova + " gg") +
        " (licantropi: D20 fortuna in forma a luna piena).";
    }
  }

  /* ================= METEO NARRATIVO ================= */
  var METEO = {
    inverno: [
      ["Neve fitta", "La neve chiude i passi di montagna: le carve valgono il doppio."],
      ["Gelo pungente", "Il freddo rode le dita: le prove di resistenza al freddo sono a svantaggio."],
      ["Cielo piomboso", "Nuvole basse e silenzio: i lupi si fanno sentire."],
      ["Bufera bianca", "Visibilità ridotta a pochi passi: orientarsi è una prova sopravvivenza CD 13."],
      ["Sole di ghiaccio", "Cielo terso e gelo secco: le orme restano impresse."]
    ],
    primavera: [
      ["Pioggia lieve", "Pioviggine costante: i sentieri si ammorbidiscono."],
      ["Fioritura", "Il verde esplode: provviste raccolte valgono il doppio."],
      ["Acquazzone improvviso", "Il cielo si scarica in un'ora: i guadi si gonfiano."],
      ["Nebbia mattutina", "La nebbia resta fino a terza: imboscate più facili."],
      ["Giorno sereno", "Aria limpida: spedizioni veloci e moral alto."]
    ],
    estate: [
      ["Afa opprimente", "Il caldo pesa: marcia forzata a metà velocità a mezzogiorno."],
      ["Tempesta estiva", "Tuoni e fulmini: volare è pericoloso, i fuochi rischiosi."],
      ["Cielo ardente", "Sole a picco: acqua doppia per chi viaggia."],
      ["Brezza secca", "Vento caldo dal sud: polvere e sete."],
      ["Notte stellata", "Giorni caldi, notti clarissime: Selûne si ammira."]
    ],
    autunno: [
      ["Pioggia battente", "Scrosci orizzontali: arco e mira svantaggiati all'aperto."],
      ["Nebbia delle messi", "La nebbia sale dai campi: stregonerie e voci strane."],
      ["Vento di raccolto", "Il vento porta foglie e voci: buono per il commercio."],
      ["Primo gelo", "La brina sposa le strutture: scivolare è facile."],
      ["Cielo d'ambra", "Luce dorata e mite: ultimo buon periodo per viaggiare."]
    ]
  };
  var stag = "inverno";

  /* PRNG deterministico dal giorno assoluto: stesso giorno = stesso meteo (punto M) */
  function seededRand(seed) {
    var x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  }
  function renderMeteoGiorno() {
    var out = $("wx-out");
    if (!out) return;
    var giorno = dataAssoluta(cal);
    var rnd = seededRand(giorno * 7 + cal.mese);
    var tab = METEO[stag] || METEO.inverno;
    var tiro = Math.floor(rnd * tab.length) + 1;
    var riga = tab[tiro - 1];
    var vento = ["brezza leggera", "vento costante", "raffiche forti", "calma di vetro"][Math.floor(seededRand(giorno * 13) * 4)];
    var temp = ({ inverno: [-8, 4], primavera: [8, 20], estate: [22, 38], autunno: [5, 18] }[stag] || [10, 20]);
    var tmin = temp[0] + Math.floor(seededRand(giorno * 17) * (temp[1] - temp[0]));
    var impatti = {
      inverno: "Prova di sopravvivenza CD 12 per campeggiare all'aperto.",
      primavera: "I guadi sono attraversabili con prova di Atletica CD 10.",
      estate: "Acqua doppia per chi marcia sotto il sole di mezzogiorno.",
      autunno: "Percezione (vista) a svantaggio nelle ore di nebbia."
    };
    out.innerHTML =
      '<div class="wx-titolo">' + esc(riga[0]) + "</div>" +
      '<div class="wx-desc">' + esc(riga[1]) + "</div>" +
      '<div class="wx-det"><span>' + tmin + "°C · " + esc(vento) + "</span><span>" + esc(impatti[stag] || "") + "</span></div>" +
      '<div class="wx-tiro">giorno ' + (cal.giorno > 30 ? "festivo" : cal.giorno) + " di " + esc((MESI[cal.mese] || {}).name || "?") + " · stagione: " + esc(stag) + " · tiro d" + tab.length + " → " + tiro + "</div>";
    out.style.animation = "none"; void out.offsetWidth; out.style.animation = "oracleFade .4s ease";
  }
  function tiraMeteo() { renderMeteoGiorno(); }

  function initMeteo() {
    if (!$("wx-out")) return;
    $("wx-stagioni").addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest("[data-s]") : null;
      if (!b) return;
      stag = b.getAttribute("data-s");
      Array.prototype.forEach.call($("wx-stagioni").children, function (x) { x.classList.toggle("on", x === b); });
      tiraMeteo();
    });
    tiraMeteo();
  }

  /* ================= OROLOGIO DI FAERUN ================= */
  var CAMpane = [
    [0, "Mezzanotte — la veglia dei Ladri dell'Ombra comincia."],
    [3, "Piccole ore — la città dorme, le guardie gemono."],
    [6, "Alba — le campane del mattino aprono i mercati."],
    [9, "Mattino — il terzo della giornata: botteghe aperte."],
    [12, "Mezzogiorno — il sole al culmine: pausa pasto."],
    [15, "Pomeriggio — l'ombra si allunga verso est."],
    [18, "Tramonto — le lanterne si accendono una a una."],
    [21, "Sera — le taverne riempiono di storie e taverne urlano canzoni."]
  ];
  var minuti = -1; /* -1 = sincronizzato col PC (punto N) */
  var autoTimer = null;

  function oraPC() {
    var n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }
  function campana(h) {
    var scelta = CAMpane[0];
    CAMpane.forEach(function (c) { if (h >= c[0]) scelta = c; });
    return scelta[1];
  }
  function renderOra() {
    if (!$("ora-big")) return;
    var h = Math.floor(minuti / 60) % 24, m = minuti % 60;
    $("ora-big").textContent = (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
    var extra = "";
    if (h >= 22 || h < 6) extra = " · Notte: svantaggio a Percezione (vista) fuori dalle luci.";
    else if (h >= 18) extra = " · Le lanterne si accendono: i ladri si svegliano.";
    else if (h >= 12 && h < 14) extra = " · Ogni taverna serve il pasto caldo.";
    $("ora-campana").textContent = campana(h) + extra;
  }
  function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    var b = $("ora-auto");
    if (b) { b.textContent = "Tempo reale ×1"; b.classList.remove("on"); }
  }
  function initOra() {
    if (!$("ora-big")) return;
    minuti = oraPC(); /* punto N: parte sincronizzato con l'orologio del PC */
    renderOra();
    $("ora-plus1").addEventListener("click", function () { stopAuto(); minuti = (minuti + 60) % 1440; renderOra(); });
    $("ora-plus8").addEventListener("click", function () { stopAuto(); minuti = (minuti + 480) % 1440; renderOra(); });
    $("ora-reset").addEventListener("click", function () { stopAuto(); minuti = oraPC(); renderOra(); });
    var btn = $("ora-auto");
    if (btn) btn.addEventListener("click", function () {
      if (autoTimer) { stopAuto(); return; }
      autoTimer = setInterval(function () { minuti = (minuti + 5) % 1440; renderOra(); }, 2500); /* 1 game-ora ogni 30s */
      btn.textContent = "Flusso ×12 (attivo)"; btn.classList.add("on");
    });
  }

  function boot() {
    initCal();
    initMeteo();
    initOra();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

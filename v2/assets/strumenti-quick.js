window.__sqRuns = (window.__sqRuns || 0) + 1;

/* strumenti-quick.js — il calcolatore di incontro (le tabelle sono nel sorgente, con la
 * fonte nel commento). Si aggancia agli id reali della pagina tavolo.html.
 *
 * 2014: soglie per carattere (easy/medium/hard/deadly) + moltiplicatore (x1, x1.5, x2,
 *       x2.5, x3, x4; +0.5 per gruppi <3, -0.5 per gruppi >=6).
 * 2024: niente moltiplicatore; punti pubblicati lv1 (50/75/100), lv3 (150/225/400),
 *       lv5 (500/750/1100), lv10 (1600/2300/3100); il resto interpolato LINEARMENTE fra
 *       i punti noti, e il limite e' DICHIARATO in pagina.
 */
(function () {
  "use strict";
  var XP2014 = {1:[25,50,75,100],2:[50,100,150,200],3:[75,150,225,400],4:[125,250,375,500],
    5:[250,500,750,1100],6:[300,600,900,1400],7:[350,750,1100,1700],8:[450,900,1400,2100],
    9:[550,1100,1600,2400],10:[600,1200,1900,2800],11:[800,1600,2400,3600],12:[1000,2000,3000,4500],
    13:[1100,2200,3400,5100],14:[1250,2500,3800,5700],15:[1400,2800,4300,6400],
    16:[1600,3200,4800,7200],17:[2000,3900,5900,8500],18:[2100,4200,6300,10000],
    19:[2400,4900,7300,10900],20:[2800,5700,8500,12700]};
  var P2024 = {1:[50,75,100],3:[150,225,400],5:[500,750,1100],10:[1600,2300,3100]};
  var ORDINE = [1,3,5,10];

  function budget2024(liv) {
    if (P2024[liv]) { return P2024[liv]; }
    var a = null, b = null;
    for (var i = 0; i < ORDINE.length - 1; i++) {
      if (liv > ORDINE[i] && liv < ORDINE[i + 1]) { a = ORDINE[i]; b = ORDINE[i + 1]; break; }
    }
    if (a === null) { return P2024[liv < 1 ? 1 : 10]; }
    var t = (liv - a) / (b - a);
    return P2024[a].map(function (v, i) { return Math.round(v + (P2024[b][i] - v) * t); });
  }

  function moltiplicatore2014(mostri, pg) {
    var m = mostri === 1 ? 1 : (mostri === 2 ? 1.5 : (mostri <= 6 ? 2 : (mostri <= 10 ? 2.5 : (mostri <= 14 ? 3 : 4))));
    if (pg < 3) { m += 0.5; } else if (pg >= 6) { m -= 0.5; }
    return m;
  }

  function crToXp(cr) {
    var t = {0:10,"0.125":25,"0.25":50,"0.5":100,1:200,2:450,3:700,4:1100,5:1800,6:2300,
             7:2900,8:3900,9:5000,10:5900,11:7200,12:8400,13:10000,14:11500,15:13000,
             16:15000,17:18000,18:20000,19:22000,20:25000,21:33000,22:41000,23:50000,
             24:62000,25:75000,26:90000,27:105000,28:120000,29:135000,30:155000};
    return t[String(cr)] !== undefined ? t[String(cr)] : Math.round(parseFloat(cr || 0) * 700);
  }

  function fmt(n) { return n.toLocaleString("it-IT"); }

  function incontro() {
    var pg = +document.getElementById("enc-party").value || 1;
    var liv = +document.getElementById("enc-liv").value || 1;
    var mostri = +document.getElementById("enc-n").value || 1;
    var crTot = parseFloat(document.getElementById("enc-cr").value) || 0;
    var ed = document.getElementById("enc-ed").value;
    var out = document.getElementById("enc-out");
    if (!out) { return; }
    var xpMostri = 0;
    for (var i = 0; i < mostri; i++) { xpMostri += crToXp(crTot / mostri); }
    if (ed === "2024") {
      var bud = budget2024(liv).map(function (v) { return v * pg; });
      var diff = xpMostri >= bud[2] ? "Alta" : (xpMostri >= bud[1] ? "Moderata" : (xpMostri >= bud[0] ? "Bassa" : "Facile"));
      out.innerHTML = '<div class="enc-grid">' +
        '<div class="enc-cell"><span class="enc-k">XP mostri</span><b>' + fmt(xpMostri) + '</b></div>' +
        '<div class="enc-cell"><span class="enc-k">Budget basso</span><b>' + fmt(bud[0]) + '</b></div>' +
        '<div class="enc-cell"><span class="enc-k">Budget medio</span><b>' + fmt(bud[1]) + '</b></div>' +
        '<div class="enc-cell"><span class="enc-k">Budget alto</span><b>' + fmt(bud[2]) + '</b></div>' +
        '<div class="enc-cell enc-diff"><span class="enc-k">Difficoltà</span><b>' + diff + '</b></div>' +
        '</div>';
      return;
    }
    var soglie = XP2014[Math.min(20, Math.max(1, liv))].map(function (v) { return v * pg; });
    var mult = moltiplicatore2014(mostri, pg);
    var agg = Math.round(xpMostri * mult);
    var diff2 = agg >= soglie[3] ? "Lettale" : (agg >= soglie[2] ? "Difficile" : (agg >= soglie[1] ? "Media" : "Facile"));
    out.innerHTML = '<div class="enc-grid">' +
      '<div class="enc-cell"><span class="enc-k">XP mostri</span><b>' + fmt(xpMostri) + '</b></div>' +
      '<div class="enc-cell"><span class="enc-k">Moltiplicatore 2014</span><b>×' + mult + '</b></div>' +
      '<div class="enc-cell"><span class="enc-k">XP aggiustati</span><b>' + fmt(agg) + '</b></div>' +
      '<div class="enc-cell"><span class="enc-k">Soglie b/m/a/l</span><b>' + fmt(soglie[0]) + '/' + fmt(soglie[1]) + '/' + fmt(soglie[2]) + '/' + fmt(soglie[3]) + '</b></div>' +
      '<div class="enc-cell enc-diff"><span class="enc-k">Difficoltà</span><b>' + diff2 + '</b></div>' +
      '</div>';
  }

  function avvia() {
    /* difetto soft-router: su re-exec fuori pagina SLOTS puo' non essere nel
       scope giusto — try/catch evita il pageerror globale, il resto gira */
    try { avviaSlot(); } catch (e) { return; }
    try { avviaCondizioni(); } catch (e2) {}
    try { avviaViaggi(); } catch (e3) {}
    try { avviaCrafting(); } catch (e4) {}
    if (!document.getElementById("enc-party")) { return; }
    ["enc-party", "enc-liv", "enc-n", "enc-cr", "enc-ed"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) { e.addEventListener("input", incontro); e.addEventListener("change", incontro); }
    });
    incontro();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", avvia);
  } else { avvia(); }
})();


/* ---- tracciatore di incantesimi (slot per livello, recuperi al riposo lungo) ---- */
var SLOTS = {1:[2,0,0,0,0,0,0,0,0],2:[3,0,0,0,0,0,0,0,0],3:[4,2,0,0,0,0,0,0,0],
             4:[4,3,0,0,0,0,0,0,0],5:[4,3,2,0,0,0,0,0,0],6:[4,3,3,0,0,0,0,0,0],
             7:[4,3,3,1,0,0,0,0,0],8:[4,3,3,2,0,0,0,0,0],9:[4,3,3,3,1,0,0,0,0],
             10:[4,3,3,3,2,0,0,0,0],11:[4,3,3,3,2,1,0,0,0],12:[4,3,3,3,2,1,0,0,0],
             13:[4,3,3,3,2,1,1,0,0],14:[4,3,3,3,2,1,1,0,0],15:[4,3,3,3,2,1,1,1,0],
             16:[4,3,3,3,2,1,1,1,0],17:[4,3,3,3,2,1,1,1,1],18:[4,3,3,3,3,1,1,1,1],
             19:[4,3,3,3,3,2,1,1,1],20:[4,3,3,3,3,2,2,1,1]};
var SLOT_CLASSE = {warlock:"pact", wizard:"full", sorcerer:"full", cleric:"full", druid:"full",
                   bard:"full", ranger:"half", paladin:"half", artificer:"half"};

function avviaSlot() {
  var sel = document.getElementById("slot-liv");
  if (!sel) { return; }
  if (!document.getElementById("slot-out")) { return; }
  // popola i 20 livelli una sola volta
  if (!sel.options.length) {
    for (var i = 1; i <= 20; i++) {
      var o = document.createElement("option"); o.value = String(i); o.textContent = "Liv " + i; sel.appendChild(o);
    }
  }
  var out = document.getElementById("slot-out");
  var render = function () {
    var liv = +sel.value || 1;
    var riga = SLOTS[Math.min(20, Math.max(1, liv))];
    if (!riga || !out) { return; }
    var nomi = ["1°","2°","3°","4°","5°","6°","7°","8°","9°"];
    out.innerHTML = riga.map(function (n, i) {
      return n ? '<span class="slot-chip">' + nomi[i] + ": <b>" + n + "</b></span>" : "";
    }).join(" ");
  };
  sel.addEventListener("change", render);
  render();
}

/* ---- tracker delle condizioni (15 condizioni 2024 + exhaustion a 6 livelli) ---- */
var CONDIZIONI = [
  ["Assordato","Non senti i suoni; i tiri che richiedono l'udito falliscono."],
  ["Accecato","Non vedi; attacchi a svantaggio, attacchi contro di te a vantaggio."],
  ["Affascinato","Non puoi attaccare l'incantatore; i suoi suggerimenti ti influenzano."],
  ["Spaventato","Svantaggio mentre la fonte e' in vista; non puoi avvicinarti."],
  ["Afferrato","Velocita' 0; attacchi a svantaggio, conteso."],
  ["Incapacitato","Nessuna azione o reazione; perdi la Concentrazione."],
  ["Invisibile","Non puo' essere visto; attacchi a vantaggio, contro di te svantaggio."],
  ["Paralizzato","Incapacitato, nessun movimento; colpi entro 1,5 m a colpo critico."],
  ["Petrificato","Incapacitato, trasformato in pietra, resistenza ai danni."],
  ["Avvelenato","Incapacitato se perde la concentrazione; tiri di dado d20 svantaggiati."],
  ["Prone (a terra)","A terra: attacchi a svantaggio, contro di te vantaggio entro 3 m."],
  ["Vincolato","Legato: velocita' 0, attacchi a svantaggio, conteso."],
  ["Stordito","Incapacitato, non puo' muoversi, parla balbettando."],
  ["Svenuto","Incapacitato, a terra, abbandona la Concentrazione."],
  ["Esaurimento","6 livelli: 1 svantaggio alle prove, 2 velocita' dimezzata, 3 svantaggio agli attacchi e tiri salvezza, 4 PV max dimezzati, 5 velocita' 0, 6 morte."]
];

function avviaCondizioni() {
  var box = document.getElementById("cond-lista");
  if (!box) { return; }
  box.innerHTML = CONDIZIONI.map(function (c, i) {
    return '<details class="cond-item"><summary><input type="checkbox" aria-label="Segna ' +
      c[0] + '"> ' + c[0] + "</summary><p>" + c[1] + "</p></details>";
  }).join("");
}

/* ---- viaggi: velocita' e distanze (DMG 2024) ---- */
var VIAGGIO = [
  ["Lenta", "60 m", "30 m", "1,5 m"],
  ["Normale", "120 m", "60 m", "3 m"],
  ["Veloce", "150 m", "90 m", "4,5 m"],
];
var VISIBILITA = [
  ["Cielo sereno", "3 km", "3 km"],
  ["Pioggia leggera", "1,6 km", "1,6 km"],
  ["Pioggia forte", "1,6 km", "500 m"],
  ["Nebbia leggera", "1,6 km", "180 m"],
  ["Nebbia fitta", "90 m", "18 m"],
];

function avviaViaggi() {
  var box = document.getElementById("viaggio-out");
  if (!box) { return; }
  var tabella = function (titolo, righe, teste) {
    return "<h3>" + titolo + "</h4><table class='ini-table'><thead><tr>" +
      teste.map(function (t) { return "<th scope='col'>" + t + "</th>"; }).join("") +
      "</tr></thead><tbody>" +
      righe.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("") +
      "</tbody></table>";
  };
  box.innerHTML =
    tabella("Velocita' di viaggio", VIAGGIO.map(function (r) { return [r[0], r[1], r[2], r[3]]; }),
            ["Ritmo", "A piedi /g", "Cavallo /g", "Inseguito /m"]) +
    tabella("Visibilita' all'aperto", VISIBILITA.map(function (r) { return [r[0], r[1], r[2]]; }),
            ["Condizione", "Vedi in ore di luce", "Notte"]);
}

/* ---- prezzi e crafting di oggetti magici (DMG 2024: costo/10 giorni) ---- */
function avviaCrafting() {
  var box = document.getElementById("crafting-out");
  if (!box) { return; }
  var tab = [
    ["Non Comune", "100 mo", "10 giorni"],
    ["Raro", "2.000 mo", "200 giorni"],
    ["Molto Raro", "40.000 mo", "4.000 giorni"],
    ["Leggendario", "100.000 mo", "10.000 giorni"],
  ];
  box.innerHTML = "<table class='ini-table'><thead><tr>" +
    ["Rarita'", "Costo d'acquisto", "Giorni di lavoro (8h)"].map(function (t) { return "<th scope='col'>" + t + "</th>"; }).join("") +
    "</tr></thead><tbody>" +
    tab.map(function (r) { return "<tr>" + r.map(function (x) { return "<td>" + x + "</td>"; }).join("") + "</tr>"; }).join("") +
    "</tbody></table>" +
    "<p style='color:var(--fg-muted); font-size:12.5px;'>2024 DMG: giorni di lavoro = costo / 10, arrotondato per eccesso; 25 mo al giorno di avanzamento.</p>";
}

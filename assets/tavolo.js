/* tavolo.js — strumenti da tavolo utilizzabili "on the fly" durante la partita.
 *
 * Richiesta dell'operatore: la sezione dei dadi va in una pagina sua, insieme a
 * TUTTI gli strumenti utili al tavolo. Qui ci sono:
 *   1. iniziativa      — ordine di combattimento con tiri reali d20+mod, turni e round
 *   2. tesoro casuale  — monete per fascia di livello + un oggetto magico ESTRATTO dal
 *                        database del sito (non da una lista inventata)
 *   3. nomi            — generatore per cultura (sillabe dichiarate, nomi generati)
 *   4. PNG istantaneo  — nome + tratto + obiettivo + segreto
 *   5. oracolo sì/no   — decisioni guidate per il DM o per il gioco in solitaria
 *   6. contatore turni — round e timer di turno
 *
 * Tutto è client-side e funziona anche senza rete (l'unica cosa che usa la rete è
 * l'elenco degli oggetti, che si scarica dal database locale del sito).
 */
(function () {
  "use strict";

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function d(n) { return 1 + Math.floor(Math.random() * n); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ============================ 1. INIZIATIVA ============================ */
  var iniziativa = [];
  var turno = 0;
  var round = 1;

  function renderIniziativa() {
    var box = el("ini-list");
    if (!box) return;
    if (!iniziativa.length) {
      box.innerHTML = '<p class="tv-meta">Nessun combattente: aggiungi i partecipanti e tira l\'iniziativa.</p>';
      return;
    }
    box.innerHTML = iniziativa.map(function (c, i) {
      var attivo = (i === turno % iniziativa.length);
      return '<li class="ini-row' + (attivo ? " att" : "") + '">' +
        '<span class="ini-num">' + c.tot + '</span>' +
        '<span class="ini-name">' + esc(c.nome) + '</span>' +
        (c.mod ? '<span class="ini-mod">' + (c.mod > 0 ? "+" : "") + c.mod + '</span>' : "") +
        '<span class="ini-dado" title="tiro del d20">d20: ' + c.dado + '</span>' +
        '<button type="button" class="ini-del" data-i="' + i + '" aria-label="Rimuovi ' + esc(c.nome) + '">&times;</button>' +
        '</li>';
    }).join("");
    var r = el("ini-round");
    if (r) r.textContent = "Round " + round + " · turno " + ((turno % iniziativa.length) + 1) + " di " + iniziativa.length;
  }

  function addCombattente(nome, mod, dadoForzato) {
    if (!nome) return;
    var dado = dadoForzato != null ? dadoForzato : d(20);
    iniziativa.push({ nome: nome, mod: mod, dado: dado, tot: dado + mod });
    iniziativa.sort(function (a, b) { return b.tot - a.tot; });
    renderIniziativa();
  }

  function initIniziativa() {
    var form = el("ini-add");
    if (!form) return;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var nome = (el("ini-name").value || "").trim();
      var mod = parseInt(el("ini-mod").value, 10) || 0;
      if (!nome) return;
      addCombattente(nome, mod);
      el("ini-name").value = "";
      el("ini-mod").value = "0";
    });
    var next = el("ini-next");
    if (next) next.addEventListener("click", function () {
      if (!iniziativa.length) return;
      turno++;
      if (turno % iniziativa.length === 0) round++;
      renderIniziativa();
    });
    var reset = el("ini-reset");
    if (reset) reset.addEventListener("click", function () {
      iniziativa = []; turno = 0; round = 1; renderIniziativa();
    });
    var rollAll = el("ini-rollall");
    if (rollAll) rollAll.addEventListener("click", function () {
      if (!iniziativa.length) return;
      iniziativa.forEach(function (c) { c.dado = d(20); c.tot = c.dado + c.mod; });
      iniziativa.sort(function (a, b) { return b.tot - a.tot; });
      turno = 0;
      renderIniziativa();
    });
    var list = el("ini-list");
    if (list) list.addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest(".ini-del") : null;
      if (!b) return;
      iniziativa.splice(parseInt(b.getAttribute("data-i"), 10), 1);
      if (turno >= iniziativa.length) turno = 0;
      renderIniziativa();
    });
    /* i partecipanti più comuni, per non digitare ogni volta */
    var quick = el("ini-quick");
    if (quick) quick.addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest("[data-preset]") : null;
      if (!b) return;
      addCombattente(b.getAttribute("data-preset"), parseInt(b.getAttribute("data-mod") || "0", 10));
    });
    renderIniziativa();
  }

  /* ============================ 2. TESORO ============================ */
  var oggetti = null;

  function caricaOggetti(cb) {
    if (oggetti) { cb(); return; }
    var x = new XMLHttpRequest();
    x.open("GET", "data/lookup-index.json", true);
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      try {
        var idx = JSON.parse(x.responseText);
        oggetti = (idx.entries || []).filter(function (e) { return e.t === "item" && !e.sup; });
      } catch (e) { oggetti = []; }
      cb();
    };
    x.onerror = function () { oggetti = []; cb(); };
    x.send();
  }

  /* Fasce di tesoro semplificate (dichiarate: non sono le tabelle ufficiali del DMG,
     sono una riduzione pratica per tirare al volo). */
  var FASCE = {
    "1-4":   { mo: [3, 2, 6, 2], label: "livelli 1-4",   oggetto: 0.25 },
    "5-10":  { mo: [5, 4, 10, 3], label: "livelli 5-10", oggetto: 0.55 },
    "11-16": { mo: [9, 6, 12, 4], label: "livelli 11-16", oggetto: 0.8 },
    "17+":   { mo: [15, 8, 20, 8], label: "livelli 17+", oggetto: 1.0 },
  };

    function tiraTesoro() {
    var sel = el("tre-tier");
    var fascia = FASCE[(sel && sel.value) || "1-4"];
    var mo = (d(6) * fascia.mo[0]) + (d(6) * fascia.mo[1]);          // oro
    var ma = (d(6) * 10) + (d(6) * fascia.mo[2]);                     // argento
    var mr = (d(6) * 10) + (d(6) * fascia.mo[3]);                     // rame
    var out = el("tre-out");
    var itemHtml = '<p class="tv-meta">Nessun oggetto magico in questo tesoro.</p>';
    if (Math.random() < fascia.oggetto) {
      if (!oggetti || !oggetti.length) caricaOggetti(function () { });
      if (oggetti && oggetti.length) {
        var o = pick(oggetti);
        var RAR = { common: "comune", uncommon: "non comune", rare: "raro",
                    "very rare": "molto raro", legendary: "leggendario" };
        var rar = RAR[(o.r || "").toString().toLowerCase()] || (o.r || "");
        itemHtml = '<h3 class="tre-item-name">' + esc(o.n) + '</h3>' +
          '<p class="tre-item-kind">Rarit&agrave;: <em>' + esc(rar || "sconosciuta") +
          '</em> &middot; Fonte: ' + esc(o.s || "?") + '</p>' +
          '<p class="tre-item-desc">La scheda completa con tutte le propriet&agrave; e la descrizione &egrave; nel lookup live.</p>' +
          '<a class="tre-item-link" href="cerca.html?q=' + encodeURIComponent(o.n) +
          '&cat=item">Apri la scheda completa &rarr;</a>';
      }
    }
    out.innerHTML =
      '<div class="tre-2col">' +
        '<div class="tre-col">' +
          '<h4 class="tre-col-title">Monete</h4>' +
          '<div class="tre-coins">' +
            '<span class="tre-coin"><strong>' + mo + '</strong> mo</span>' +
            '<span class="tre-coin"><strong>' + ma + '</strong> ma</span>' +
            '<span class="tre-coin"><strong>' + mr + '</strong> mr</span>' +
          '</div>' +
          '<div class="tre-total">Fascia: ' + esc(fascia.label) + '</div>' +
        '</div>' +
        '<div class="tre-col">' +
          '<h4 class="tre-col-title">Oggetto magico</h4>' +
          itemHtml +
        '</div>' +
      '</div>';
  }

  function initTesoro() {
    var b = el("tre-roll");
    if (!b) return;
    caricaOggetti(function () { });
    b.addEventListener("click", tiraTesoro);
  }

  /* ============================ 3. NOMI ============================ */
  var NOMI = {
    "Umano del Nord": { pre: ["Ald", "Bran", "Cor", "Dag", "Eir", "Fal", "Gun", "Har", "Ivar", "Ket", "Lar", "Mor", "Rag", "Sig", "Thor", "Ulf"],
                        suf: ["ric", "dan", "gar", "mund", "vald", "nir", "stein", "bjorn", "hild", "wyn"] },
    "Elfo":           { pre: ["Ael", "Cael", "Eil", "Fae", "Ith", "Lia", "Myth", "Nae", "Riel", "Syl", "Thal", "Vae"],
                        suf: ["riel", "thien", "wen", "las", "dor", "mira", "ael", "nor", "ion", "sha"] },
    "Nano":           { pre: ["Bal", "Dain", "Grim", "Kaz", "Mor", "Nur", "Ors", "Thra", "Ul", "Vond"],
                        suf: ["din", "grim", "lok", "mek", "run", "stok", "thar", "vein", "dur", "ak"] },
    "Halfling":       { pre: ["Bil", "Cor", "Dro", "Fen", "Gil", "Mal", "Per", "Ros", "Tom", "Wil"],
                        suf: ["bo", "do", "frey", "go", "ly", "ric", "sey", "ton", "wick", "ny"] },
    "Orco":           { pre: ["Gor", "Krag", "Mog", "Nar", "Ruk", "Sha", "Thak", "Urg", "Zag", "Bru"],
                        suf: ["ash", "gar", "kull", "nak", "rosh", "tak", "ugh", "zog", "marr", "drek"] },
    "Draconico":      { pre: ["Ar", "Bal", "Cyn", "Dra", "Esh", "Gor", "Kep", "Mor", "Rho", "Sar", "Vex", "Zar"],
                        suf: ["jahan", "sar", "ith", "ax", "oth", "arion", "esh", "urus", "yn", "ath"] },
  };

  function generaNome(cultura) {
    var t = NOMI[cultura] || NOMI["Umano del Nord"];
    return pick(t.pre) + pick(t.suf);
  }

  function initNomi() {
    var b = el("nom-roll");
    if (!b) return;
    b.addEventListener("click", function () {
      var sel = el("nom-culture");
      var out = el("nom-out");
      var cultura = (sel && sel.value) || "Umano del Nord";
      var nomi = [];
      for (var i = 0; i < 6; i++) nomi.push(generaNome(cultura));
      out.innerHTML = '<p class="tv-names">' + nomi.map(esc).join(" &middot; ") + "</p>" +
        '<p class="tv-meta">Nomi generati per sillabe (cultura: ' + esc(cultura) +
        ") &mdash; sono spunti, non nomi canonici.</p>";
    });
    var sel = el("nom-culture");
    if (sel) sel.innerHTML = Object.keys(NOMI).map(function (k) {
      return '<option value="' + esc(k) + '">' + esc(k) + "</option>";
    }).join("");
  }

  /* ============================ 4. PNG ISTANTANEO ============================ */
  var TRATTI = ["parla troppo forte", "non guarda mai negli occhi", "colleziona denti di mostro",
    "canticchia sempre la stessa ballata", "si scusa continuamente", "offre da bere a tutti",
    "annota ogni cosa su un taccuino", "ha paura dei cavalli", "crede nei presagi",
    "mangia aglio crudo", "non dice mai il proprio nome", "dorme con l'armatura"];
  var OBIETTIVI = ["pagare un debito di gioco", "trovare un fratello scomparso", "comprare una nave",
    "vendicare un torto", "diventare consigliere del duca", "recuperare un cimelio di famiglia",
    "aprire una taverna", "scoprire chi lo ha tradito", "guarire da una maledizione", "entrare in una gilda"];
  var SEGRETI = ["è una spia di una casata rivale", "ha ucciso senza volere, anni fa",
    "deve denaro a una banda", "è l'erede di un casato caduto", "conosce un passaggio segreto in città",
    "ha stretto un patto con un immondo", "ruba ai nobili per darlo ai poveri", "fugge da un matrimonio",
    "sa dove è nascosto un tesoro", "non è chi dice di essere"];

  function initPng() {
    var b = el("npc-roll");
    if (!b) return;
    b.addEventListener("click", function () {
      var sel = el("nom-culture");
      var cultura = (sel && sel.value) || "Umano del Nord";
      var out = el("npc-out");
      out.innerHTML =
        '<p class="tv-npc-name">' + esc(generaNome(cultura)) + "</p>" +
        '<ul class="tv-npc-list">' +
        "<li><strong>Tratto:</strong> " + esc(pick(TRATTI)) + "</li>" +
        "<li><strong>Obiettivo:</strong> " + esc(pick(OBIETTIVI)) + "</li>" +
        "<li><strong>Segreto:</strong> " + esc(pick(SEGRETI)) + "</li>" +
        "</ul>" +
        '<p class="tv-meta">Combinazione casuale da tre tabelle brevi: adatta al bisogno.</p>';
    });
  }

  /* ============================ 5. ORACOLO ============================ */
  var PROB = { "Quasi certo": 0.9, "Probabile": 0.7, "Incerto": 0.5, "Improbabile": 0.3, "Quasi impossibile": 0.1 };
  /* La storia delle risposte e' solo di sessione (ricaricare la pagina la azzera:
     e' coerenza narrativa per la seduta, non un archivio). Il testo dell'utente
     viene ESCAPATO alla registrazione: finisce poi in innerHTML. */
  var _storia = [];
  function storia() { return _storia.slice(0, 5); }
  function registra(s) { _storia.unshift(s); if (_storia.length > 5) _storia.pop(); }

  function initOracolo() {
    var b = el("ora-ask");
    if (!b) return;
    var sel = el("ora-prob");
    if (sel) sel.innerHTML = Object.keys(PROB).map(function (k) {
      return '<option value="' + k + '"' + (k === "Incerto" ? " selected" : "") + ">" + k + "</option>";
    }).join("");
    b.addEventListener("click", function () {
      var q = (el("ora-q").value || "").trim();
      var p = PROB[(sel && sel.value) || "Incerto"] || 0.5;
      var dado = d(100);
      var si = dado <= Math.round(p * 100);
      /* Estremi del destino: tiro quasi perfetto o quasi disastroso porta una
         conseguenza aggiuntiva (il classico "sì, e..." / "no, e..."). */
      var tono = "";
      if (dado <= 5) tono = si ? " — <em>e con conseguenze oltre il previsto.</em>"
                               : " — <em>e la situazione precipita subito.</em>";
      else if (dado >= 96) tono = si ? " — <em>ma il prezzo è più alto del dovuto.</em>"
                                     : " — <em>ma resta un'apertura inattesa.</em>";
      else {
        var d20s = d(20);
        if (d20s >= 18) tono = si ? " — <em>e subito.</em>" : " — <em>ma svela qualcosa.</em>";
        else if (d20s <= 3) tono = si ? " — <em>ma a un costo.</em>" : " — <em>e peggiora.</em>";
      }
      el("ora-out").innerHTML =
        '<p class="ora-esito ' + (si ? "si" : "no") + '">' + (si ? "SÌ" : "NO") + tono + "</p>" +
        (q ? '<p class="tv-meta">Domanda: ' + esc(q) + "</p>" : "") +
        '<p class="tv-meta">Probabilità dichiarata ' + Math.round(p * 100) + "% &mdash; tiro percentuale: " + dado + ".</p>" +
        '<div class="tv-meta" id="ora-storia"><strong>Ultimi oracoli:</strong><ul>' +
        (storia().map(function (s) { return "<li>" + s + "</li>"; }).join("")) + "</ul></div>";
      registra((si ? "SÌ" : "NO") + (q ? " — " + esc(q) : "") + " [" + Math.round(p * 100) + "% → " + dado + "]");
    });
  }

  /* ============================ 6. ROUND E TIMER ============================ */
  var timer = null, secondi = 0;

  function initTimer() {
    var start = el("tim-start"), stop = el("tim-stop"), reset = el("tim-reset");
    if (!start) return;
    var mostra = function () {
      var m = Math.floor(secondi / 60), s = secondi % 60;
      el("tim-out").textContent = m + ":" + (s < 10 ? "0" : "") + s;
    };
    start.addEventListener("click", function () {
      if (timer) return;
      timer = setInterval(function () { secondi++; mostra(); }, 1000);
    });
    stop.addEventListener("click", function () {
      if (timer) { clearInterval(timer); timer = null; }
    });
    reset.addEventListener("click", function () {
      if (timer) { clearInterval(timer); timer = null; }
      secondi = 0; mostra();
    });
    mostra();
  }

  /* ==================== 7. ROUND E TRACCIA EFFETTI (2026-10-12) ====================
     Cosa aggiunge rispetto al solo cronometro: il combattimento vive in ROUND, non in
     minuti. Un contatore di round, un traccia-effetti con countdown che scende a ogni
     round e rimuove l'effetto scaduto. Il timer resta per chi lo vuole. */
  var round = 0, effetti = [];

  function initRoundi() {
    var piu = el("rnd-plus"), az = el("rnd-reset");
    if (!piu) return;
    var nome = el("eff-nome"), giri = el("eff-giri"), add = el("eff-add"), lista = el("eff-list");
    var disegna = function () {
      el("rnd-out2").textContent = "Round " + round;
      var righe = effetti.map(function (e, i) {
        var rimasto = e.giri - (round - e.inizio);
        return "<li>" + esc(e.nome) + " — <strong>" + (rimasto > 0 ? rimasto + " round" : "SCADUTO")
          + "</strong> <button type=\"button\" class=\"tv-mini\" data-eff=\"" + i
          + "\" aria-label=\"Rimuovi effetto\">×</button></li>";
      }).join("");
      lista.innerHTML = righe ? "<ul>" + righe + "</ul>" : '<p class="tv-meta">Nessun effetto attivo.</p>';
      // gli effetti scaduti escono alla fine del round corrente, non prima
      effetti.forEach(function (e, i) { if (round - e.inizio >= e.giri && e.giri > 0) e.fuori = true; });
      Array.prototype.forEach.call(lista.querySelectorAll("button[data-eff]"), function (b) {
        b.addEventListener("click", function () { effetti.splice(Number(b.getAttribute("data-eff")), 1); disegna(); });
      });
    };
    piu.addEventListener("click", function () { round++; disegna(); });
    az.addEventListener("click", function () { round = 0; effetti.length = 0; disegna(); });
    add.addEventListener("click", function () {
      var n = (nome.value || "").trim(), g = parseInt(giri.value, 10);
      if (!n || !(g > 0)) return;
      effetti.push({ nome: n, giri: g, inizio: round });
      nome.value = ""; giri.value = "";
      disegna();
    });
    disegna();
  }

  function boot() {
    if (!el("tavolo-app")) return;
    initIniziativa();
    initTesoro();
    initNomi();
    initPng();
    initOracolo();
    initTimer();
    initRoundi();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

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
    x.open("GET", "../data/lookup-index.json", true);
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

  /* ============================ 5. ORACOLO DEL DESTINO (punto J) ============================
     Tre modalita': Sì/No con intensita' (matrice 2x5), Scelta multipla (dN su opzioni),
     Autore (chi/che cosa causa l'evento). Slider di probabilita' fine, complicazioni sui
     tiri estremi, Destinoguide (pendolo: la risposta sposta la prossima probabilita'). */
  var PROB = { "Quasi certo": 0.9, "Probabile": 0.7, "Incerto": 0.5, "Improbabile": 0.3, "Quasi impossibile": 0.1, "Slider fine": -1 };
  var INTENSITA_SI = ["decisamente, e subito", "con entusiasmo del destino", "sì", "sì, ma a un costo", "sì, ma in modo strano"];
  var INTENSITA_NO = ["assolutamente no", "no, e la situazione peggiora", "no", "no, ma si apre un'altra strada", "no, però qualcosa si muove"];
  var COMPLICAZIONI = ["una terza parte interferisce", "il tempo stringe oltre il previsto", "una risorsa si rivela difettosa", "un errore del passato riaffiora", "l'ambiente si volta contro i presenti", "un'informazione era falsa", "qualcuno ha visto tutto", "l'obiettivo si sposta altrove", "un'obbligazione si fa sentire", "la cosa attira attenzione indesiderata", "un test fisico improvviso", "una promessa va onorata ora"];
  var AUTORI = ["un venditore ambiguo", "una guardia annoiata", "un bambino curioso", "un ex socio creduto morto", "una sacerdotessa in viaggio", "il capo della gilda locale", "un mercante straniero", "un mendicante che vede tutto", "il proprietario della taverna", "un mago in pensione", "una coppia di gemelli truffatori", "il scrubby io del vecchio registro", "una nobildonna in fuga", "lo stalliere che sente tutto", "un aruspice di passaggio", "il custode del cimitero", "una compagnia teatrale", "il perito delle tasse", "un nano spendaccione", "la figlia del console"];
  var AUTORI_COSA = ["una lettera smarrita", "un rumoroso carico di botti", "una festa improvisa", "una zona di Palude stanchezza", "un animale scappato", "una rissa tra gilde", "un incantesimo andato storto", "un'asta segreta", "una processione religiosa", "un crollo in un vicolo", "un bando di cercatori", "una voce di tesoro"];
  var _pendolo = 0; /* -1..1: la Destinoguide sposta la probabilita' */

  var _storia = [];
  function storia() { return _storia.slice(0, 5); }
  function registra(s) { _storia.unshift(s); if (_storia.length > 5) _storia.pop(); }

  function initOracolo() {
    var b = el("ora-ask");
    if (!b) return;
    var sel = el("ora-prob"), slider = el("ora-slider"), pct = el("ora-pct"), row = el("ora-prob-row");
    if (sel) sel.innerHTML = Object.keys(PROB).map(function (k) {
      return '<option value="' + k + '"' + (k === "Incerto" ? " selected" : "") + ">" + k + "</option>";
    }).join("");
    /* slider fine: si attiva su "Slider fine" */
    function syncSlider() {
      var isSlider = sel && sel.value === "Slider fine";
      if (slider) slider.style.display = isSlider ? "inline-block" : "none";
      if (pct) pct.textContent = (isSlider && slider ? slider.value : Math.round((PROB[sel && sel.value] || 0.5) * 100)) + "%";
      if (row) row.style.display = "flex";
    }
    if (sel) sel.addEventListener("change", syncSlider);
    if (slider) slider.addEventListener("input", function () { if (pct) pct.textContent = slider.value + "%"; });
    syncSlider();
    /* tab di modalita' */
    var mode = "syno";
    Array.prototype.forEach.call(document.querySelectorAll(".ora-tab"), function (tab) {
      tab.addEventListener("click", function () {
        mode = tab.getAttribute("data-om");
        Array.prototype.forEach.call(document.querySelectorAll(".ora-tab"), function (x) { x.classList.toggle("on", x === tab); });
        var opt = el("ora-opt"), q = el("ora-q");
        if (opt) opt.style.display = mode === "scelta" ? "block" : "none";
        if (q) q.style.display = mode === "scelta" ? "none" : "block";
        if (row) row.style.display = mode === "syno" ? "flex" : "none";
      });
    });

    function probCorrente() {
      var v = PROB[sel && sel.value] || 0.5;
      if (v === -1) v = (parseInt(slider && slider.value, 10) || 50) / 100;
      v += _pendolo * 0.1; /* Destinoguide: il pendolo sposta di +-10% */
      return Math.max(0.05, Math.min(0.95, v));
    }

    b.addEventListener("click", function () {
      var q = (el("ora-q") || {}).value || "";
      var out = el("ora-out");
      if (!out) return;
      var html = "", log = "";
      var p = probCorrente();
      var dado = d(100);

      if (mode === "scelta") {
        var opts = ((el("ora-opt") || {}).value || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
        if (opts.length < 2) { out.innerHTML = '<p class="tv-meta">Inserisci almeno 2 opzioni separate da virgola.</p>'; return; }
        var idx = Math.floor(Math.random() * opts.length);
        html = '<p class="ora-esito si" style="font-size:30px;">' + esc(opts[idx]) + "</p>" +
          '<p class="tv-meta">d' + opts.length + " → " + (idx + 1) + " su " + opts.length + " opzioni.</p>";
        log = "Scelta: " + opts[idx];
      } else if (mode === "autore") {
        var chi = pick(AUTORI), cosa = pick(AUTORI_COSA);
        html = '<p class="ora-esito si" style="font-size:26px;">' + esc(chi) + "</p>" +
          '<p class="tv-meta">...attraverso: ' + esc(cosa) + "</p>" +
          '<p class="tv-meta">d20 → ' + d(20) + " (autore) · d20 → " + d(20) + " (mezzo)</p>";
        log = "Autore: " + chi;
      } else {
        var si = dado <= Math.round(p * 100);
        var tono, cls = si ? "si" : "no";
        if (dado <= 5) {
          tono = (si ? "SÌ, e decisamente — " : "NO, e precipita — ") + pick(COMPLICAZIONI);
          cls = si ? "si" : "no";
        } else if (dado >= 96) {
          tono = (si ? "SÌ, ma — " : "NO, però — ") + pick(COMPLICAZIONI);
        } else {
          var scala = si ? INTENSITA_SI : INTENSITA_NO;
          var i2 = Math.min(4, Math.floor(Math.abs(dado - Math.round(p * 100)) / 20));
          tono = scala[si ? i2 : 4 - i2];
        }
        var esitoGrande = String(tono).split(" — ")[0];
        var resto2 = tono.indexOf(" — ") !== -1 ? tono.slice(tono.indexOf(" — ") + 3) : "";
        html = '<p class="ora-esito ' + cls + '">' + esc(esitoGrande) +
          (resto2 ? "<em>" + esc(resto2) + "</em>" : "") + "</p>" +
          (q ? '<p class="tv-meta">Domanda: ' + esc(q) + "</p>" : "") +
          '<p class="tv-meta">Probabilità ' + Math.round(p * 100) + "% — d100: " + dado + "</p>";
        log = (si ? "SÌ" : "NO") + (q ? " — " + q : "") + " [" + Math.round(p * 100) + "% → " + dado + "]";
      }

      /* Destinoguide: pendolo */
      var pend = el("ora-pendolo");
      if (pend && pend.checked) {
        _pendolo = dado >= 90 ? 1 : (dado <= 10 ? -1 : Math.max(-1, Math.min(1, _pendolo + (dado % 2 === 0 ? 0.5 : -0.5))));
        html += '<p class="tv-meta">Pendolo: ' + (_pendolo > 0 ? "il destino favorisce il sì (+" : "il destino favorisce il no (−") + Math.round(Math.abs(_pendolo) * 10) + "%)</p>";
      }
      var storiaHtml = '<div class="tv-meta" id="ora-storia"><strong>Ultimi oracoli:</strong><ul>' +
        (storia().map(function (s2) { return "<li>" + s2 + "</li>"; }).join("")) + "</ul></div>";
      out.innerHTML = html + storiaHtml;
      registra(log);
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
    /* generatore profondo (npc-deep.js) sostituisce initNomi/initPng */
    initOracolo();
    initTimer();
    initRoundi();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

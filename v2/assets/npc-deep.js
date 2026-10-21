/* npc-deep.js — generatore profondo di nomi e PNG (punto 8, 2026-10-19).
 *
 * Diverso dal generatore base: composizione a strati su TABELLE SEPARATE
 * (prefissi/radici/suffissi per 12 culture + epiteti), PNG composto da 8
 * dimensioni indipendenti (identita', tratto, ideale, legame, difetto, segreto,
 * occupazione, gancio) e rigenerazione PER CAMPO: cliccando un campo si
 * ritira solo quello, il resto resta coerente. Copia scheda negli appunti.
 * Zero rete; tabelle locali dichiarate nel sorgente.
 */
(function () {
  "use strict";
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;" }[c];
    });
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* ============ NOMI: composizione a strati per 12 culture ============ */
  var NOMI = {
    "Umano del Nord": { pre: ["Ald", "Bran", "Cor", "Dag", "Eir", "Fal", "Gun", "Har", "Ivar", "Ket", "Lar", "Mor", "Rag", "Sig", "Thor", "Ulf", "Vald", "Yor"], suf: ["ric", "dan", "gar", "mund", "vald", "nir", "stein", "bjorn", "hild", "wyn", "mar", "frid"] },
    "Umano del Sud": { pre: ["Alon", "Bel", "Cass", "Dan", "Enzo", "Fer", "Gil", "Lio", "Mar", "Ner", "Os", "Piet", "Rin", "Ser", "Tom"], suf: ["ando", "ello", "ino", "etto", "ardo", "sia", "ella", "ina", "uccio", "ano"] },
    "Elfo": { pre: ["Ael", "Cael", "Eil", "Fae", "Ith", "Lia", "Myth", "Nae", "Riel", "Syl", "Thal", "Vae", "Yll", "Eryn"], suf: ["riel", "thien", "wen", "las", "dor", "mira", "ael", "nor", "ion", "sha", "ven", "quiel"] },
    "Nano": { pre: ["Bal", "Dain", "Grim", "Kaz", "Mor", "Nur", "Ors", "Thra", "Ul", "Vond", "Brog", "Khaz"], suf: ["din", "grim", "lok", "mek", "run", "stok", "thar", "vein", "dur", "ak", "gorn", "mli"] },
    "Halfling": { pre: ["Bil", "Cor", "Dro", "Fen", "Gil", "Mal", "Per", "Ros", "Tom", "Wil", "Mer", "Odo"], suf: ["bo", "do", "frey", "go", "ly", "ric", "sey", "ton", "wick", "ny", "bracefoot", "underbough"] },
    "Gnome": { pre: ["Bim", "Dim", "Fiz", "Glim", "Jub", "Nim", "Orr", "Pip", "Quib", "Wren", "Zook", "Fenwick"], suf: ["ble", "wick", "zin", "der", "noop", "gle", "sparkle", "gearloose", "fireforge", "tink"] },
    "Orco": { pre: ["Gor", "Krag", "Mog", "Nar", "Ruk", "Sha", "Thak", "Urg", "Zag", "Bru", "Vrak", "Omm"], suf: ["ash", "gar", "kull", "nak", "rosh", "tak", "ugh", "zog", "marr", "drek", "gorim", "thak"] },
    "Draconico": { pre: ["Ar", "Bal", "Cyn", "Dra", "Esh", "Gor", "Kep", "Mor", "Rho", "Sar", "Vex", "Zar", "Kriv", "Tor"], suf: ["jahan", "sar", "ith", "ax", "oth", "arion", "esh", "urus", "yn", "ath", "inn", "kish"] },
    "Tiefling": { pre: ["Akmenos", "Damakos", "Ekemon", "Kairon", "Leucis", "Melech", "Mordai", "Nemeia", "Orianna", "Skamos", "Therai", "Mordred"], suf: ["", "il", "eth", "ais", "oth", "ys", "ith", "ael"] },
    "Mezzelfo": { pre: ["Aran", "Beren", "Cael", "Dorian", "Erevan", "Kaeda", "Lora", "Milo", "Nyra", "Sabel", "Theron", "Vesper"], suf: ["wyn", "dove", "song", "duskwalker", "morningstar", "hart", "weave"] },
    "Golia": { pre: ["Aukan", "Eglath", "Gauthak", "Keothi", "Lo-kag", "Maveith", "Nalla", "Orilo", "Paavu", "Thotham", "Vunakh"], suf: ["", "-kala", "-goliath", "-manthi"] },
    "Forestiero (Arcano)": { pre: ["Qel", "Vhor", "Zaen", "Ilyr", "Ossian", "Phaed", "Kaelis", "Umbrix", "Nyx", "Solvane"], suf: ["thar", "is", "wyn", "os", "ion", "aeth", "mir"] }
  };
  var EPITETI = ["il Saggio", "il Taciturno", "la Pirite", "Bracciofermo", "il Naufrago", "delle Nove Chiavi", "il Mezzo-Bruciato", "la Quiete", "Scudo di Roccia", "il Cacciatore di Bugie", "della Terza Campana", "il Senza-Nome", "la Valigia", "Piedilesto", "il Vecchio Corvo", "Tre-cicatrici", "della Lanterna Grigia", "l'Ultimo Baldo"];

  function generaNome(cultura, conEpiteto) {
    var t = NOMI[cultura] || NOMI["Umano del Nord"];
    var n = pick(t.pre) + pick(t.suf);
    if (conEpiteto && Math.random() < 0.55) n += " " + pick(EPITETI);
    return n;
  }

  /* ============ PNG: 8 dimensioni indipendenti ============ */
  var T = {
    razza: ["umano", "elfo", "nano", "halfling", "gnomo", "mezzorco", "mezzelfo", "tiefling", "dragonide", "goliath", "orco", "golem animato"],
    eta: ["giovane", "adulto", "maturo", "canuto", "dall'età indefinibile", "sorprendentemente anziano"],
    occupazione: ["oste", "carraio", "sarto", "cacciatore di taglie", "copista", "fabbro", "pescatore", "giardiniere del tempio", "contrabbandiere", "avvocato", "stalliere", "cartografo", "guardia in congedo", "taumaturgo itinerante", "fioraia", "apprendista alchimista", "maestro d'armi", "sale-custode", "aruspice", "barbiere-chirurgo"],
    tratto: ["parla troppo forte", "non guarda mai negli occhi", "colleziona denti di mostro", "canticchia sempre la stessa ballata", "si scusa continuamente", "offre da bere a tutti", "annota ogni cosa su un taccuino", "ha paura dei cavalli", "crede nei presagi", "mangia aglio crudo", "non dice mai il proprio nome", "dorme con l'armatura", "rifinisce ogni frase con una metafora sulla marea", "porta sempre monete di tre regni diverse", "pulizia ossessiva delle mani", "racconta barbe inventive sui suoi viaggi", "si rivolge a tutti come «capitano»", "rilegge la stessa lettera ogni sera"],
    ideale: ["la libertà prima del pane", "l'ordine salverà la città", "la gentilezza è una disciplina", "il sapere appartiene a tutti", "la famiglia è l'unico regno", "la natura non perdona ma insegna", "chi paga decide", "nessun dio merita ginocchia", "il valore si misura a colloquio", "le regole sono per chi ha qualcosa da perdere"],
    legame: ["una sorella nei Guanti Grigi", "il vecchio maestro sepellito a Rybar", "una debitoria per 200 monete d'oro", "il caneto che eredita alla nonna", "la locanda che sta per fallire", "un figlio che non conosce", "l'ordine dei which-hunters che lo cerca", "la barca lasciata in pegno", "un giuramento al Tempio della Luna", "il giardino di erbe della madre"],
    difetto: ["non sa dire di no a un buon piano", "gioca d'azzardo anche il pane", "menzogna compulsiva su dettagli inutili", "orgoglio ferito: mai ammettere un errore", "terrore dei tunnel stretti", "confonde coraggio con testardaggine", "sospetta sempre il peggio del vicino", "beve quando parla di famiglia", "ruba piccoli oggetti senza volere", "discute i termini anche col dragone"],
    segreto: ["è una spia di una casata rivale", "ha ucciso senza volere, anni fa", "deve denaro a una banda", "è l'erede di un casato caduto", "conosce un passaggio segreto in città", "ha stretto un patto con un immondo", "ruba ai nobili per darlo ai poveri", "fugge da un matrimonio", "sa dove è nascosto un tesoro", "non è chi dice di essere", "serve un drago in nome", "ha visto il volto del suo dio, e non gli è piaciuto"],
    obiettivo: ["pagare un debito di gioco", "trovare un fratello scomparso", "comprare una nave", "vendicare un torto", "diventare consigliere del duca", "recuperare un cimelio di famiglia", "aprire una taverna", "scoprire chi lo ha tradito", "guarire da una maledizione", "entrare in una gilda", "comprarsi il funerale che merita", "imparare a leggere"],
    gancio: ["chiede ai PG di scortare un carro «del tutto innocuo»", "offre il doppio per una richiesta inspiegabile", "riconosce in un PG il ritratto su un manifesto di ricercato", "ha bisogno di testimoni per un matrimonio impossibile", "vende una mappa vera al 60% del prezzo, senza domande", "chiede di consegnare una lettera chiusa a un nome falso", "supplica di comprare il suo ultimo oggetto magico", "aspetta un socio che non arriverà mai", "prende appunti su ciò che i PG mostrano di sapere", "ha visto i PG entrare dalla finestra sbagliata"]
  };
  var CAMPI = [
    ["occupazione", "Occupazione"], ["tratto", "Tratto"], ["ideale", "Ideale"],
    ["legame", "Legame"], ["difetto", "Difetto"], ["segreto", "Segreto"],
    ["obiettivo", "Obiettivo"], ["gancio", "Gancio di trama"]
  ];

  var stato = { cultura: "Umano del Nord", nome: "", epiteto: true, razza: "", tono: "qualsiasi", dati: {} };

  function nuovoPng() {
    stato.epiteto = stato.tono === "nobile" ? true : (stato.tono === "comune" ? Math.random() < 0.35 : Math.random() < 0.5);
    stato.nome = generaNome(stato.cultura, stato.epiteto);
    var razza = stato.razza || pick(T.razza);
    var occup = stato.tono === "noble" ? pick(T.occupazione) : pick(T.occupazione);
    stato.dati = {
      razza: razza, eta: pick(T.eta), occupazione: occup,
      tratto: pick(T.tratto), ideale: pick(T.ideale), legame: pick(T.legame),
      difetto: pick(T.difetto), segreto: pick(T.segreto),
      obiettivo: pick(T.obiettivo), gancio: pick(T.gancio)
    };
  }
  function rigeneraCampo(k) { stato.dati[k] = pick(T[k]); }

  function renderNomi() {
    var box = el("nom-out");
    if (!box) return;
    var nomi = [], guardia = 0;
    while (nomi.length < 8 && guardia++ < 60) { var n = generaNome(stato.cultura, false); if (nomi.indexOf(n) === -1) nomi.push(n); }
    box.innerHTML = '<p class="tv-names">' + nomi.map(esc).join(" · ") + "</p>" +
      '<p class="tv-meta">Sillabari per cultura (' + esc(stato.cultura) + ") — clicca di nuovo per un'altra corte di nomi.</p>";
  }

  function renderPng() {
    var box = el("npc-out");
    if (!box) return;
    var d = stato.dati;
    var righe = CAMPI.map(function (c) {
      var k = c[0], lbl = c[1];
      return '<div class="npc-riga" data-k="' + k + '" title="Clicca per ritirare solo questo campo">' +
        '<span class="npc-lbl">' + lbl + '</span><span class="npc-val">' + esc(d[k]) + '</span>' +
        '<span class="npc-dice" aria-hidden="true">⟳</span></div>';
    }).join("");
    box.innerHTML =
      '<div class="npc-card">' +
      '<div class="npc-head"><span class="npc-nome">' + esc(stato.nome) + '</span>' +
      '<span class="npc-identita">' + esc(d.razza) + ", " + esc(d.eta) + " · " + esc(d.occupazione) + "</span></div>" +
      '<div class="npc-righe">' + righe + "</div>" +
      '<div class="npc-azioni">' +
      '<button type="button" id="npc-nome-new" class="tv-mini">Nuovo nome</button>' +
      '<button type="button" id="npc-copy" class="tv-mini">Copia scheda</button>' +
      '<span class="npc-copied" id="npc-copied"></span></div>' +
      "</div>";
  }

  function bindPng() {
    var box = el("npc-out");
    if (!box) return;
    box.addEventListener("click", function (ev) {
      var riga = ev.target.closest ? ev.target.closest(".npc-riga") : null;
      if (riga) { rigeneraCampo(riga.getAttribute("data-k")); renderPng(); return; }
      if (ev.target.id === "npc-nome-new") { stato.nome = generaNome(stato.cultura, stato.epiteto); renderPng(); return; }
      if (ev.target.id === "npc-copy") {
        var d = stato.dati;
        var testo = stato.nome + " (" + d.razza + ", " + d.eta + " — " + d.occupazione + ")\n" +
          CAMPI.map(function (c) { return c[1] + ": " + d[c[0]]; }).join("\n");
        copia(testo).then(function () {
          var es = el("npc-copied");
          if (es) { es.textContent = "copiata"; setTimeout(function () { es.textContent = ""; }, 1500); }
        });
      }
    });
  }

  function copia(testo) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(testo);
    return new Promise(function (res) {
      var ta = document.createElement("textarea");
      ta.value = testo; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta); res();
    });
  }

  function initDeep() {
    var sel = el("nom-culture");
    if (!sel) return;
    sel.innerHTML = Object.keys(NOMI).map(function (k) {
      return '<option value="' + esc(k) + '">' + esc(k) + "</option>";
    }).join("");
    /* controllo: se tavolo-app ha gia' popolato, mantengo le sue voci? No: qui 12 culture */
    sel.value = stato.cultura;
    sel.addEventListener("change", function () { stato.cultura = sel.value; });
    var rz = el("npc-razza");
    if (rz) {
      rz.innerHTML = '<option value="">casuale</option>' + T.razza.map(function (r) {
        return '<option value="' + esc(r) + '">' + esc(r) + "</option>";
      }).join("");
      rz.addEventListener("change", function () { stato.razza = rz.value; });
    }
    var tn = el("npc-tono");
    if (tn) tn.addEventListener("change", function () { stato.tono = tn.value; });
    el("nom-roll").addEventListener("click", function () { stato.cultura = sel.value; renderNomi(); });
    el("npc-roll").addEventListener("click", function () {
      stato.cultura = sel.value;
      nuovoPng(); renderPng();
    });
    bindPng();
    renderNomi();
    nuovoPng(); renderPng();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initDeep);
  else initDeep();
})();

/* i18n-auto.js — traduzione AUTOMATICA dell'intero sito, con scelta della lingua.
 *
 * PERCHÉ SUI NODI DI TESTO E NON SUGLI ELEMENTI
 *   La prima versione traduceva solo gli elementi "foglia" (quelli che contengono
 *   SOLO testo). Restavano fuori i testi che stanno dentro elementi misti, per
 *   esempio il valore dopo un'etichetta: `<div><strong>PF</strong> 150 (20d10 + 40)</div>`
 *   — il «150 (20d10 + 40)» non veniva mai tradotto. È il motivo per cui l'operatore
 *   vedeva la traduzione applicata "non a tutto il testo".
 *   Ora si percorrono i NODI DI TESTO: si sostituisce `nodeValue`, quindi la
 *   struttura HTML (link, grassetti, icone) resta intatta e ogni frammento di
 *   testo visibile viene coperto.
 *
 * COME SI USA (richiesta dell'operatore: un comando solo, tutto il sito)
 *   · si sceglie la lingua dal menu nella navigazione: la scelta è salvata;
 *   · da quel momento OGNI pagina traduce da sola tutto il testo al caricamento;
 *   · i risultati sono in cache per (lingua, testo): la seconda visita è immediata.
 *
 * COSA VIENE TRADOTTO
 *   · lingua = italiano → i testi marcati lang="en" (fonti 5e.tools, wiki) e il
 *     testo dinamico delle schede;
 *   · lingua = inglese  → la prosa italiana, non i blocchi già in inglese;
 *   · altra lingua      → tutto.
 *
 * MOTORE (limiti misurati prima di scrivere il codice)
 *   · translate.googleapis.com (client=gtx): qualsiasi lingua, CORS aperto,
 *     nessun tetto di 500 caratteri;
 *   · l'endpoint traduce UN SOLO testo per richiesta (verificato), quindi i testi
 *     vengono concatenati con un separatore che sopravvive alla traduzione, con
 *     ripiego testo-per-testo se la divisione non torna esatta.
 */
(function () {
  "use strict";

  var API = "/api/translate"   // stessa origine: il server inoltra, niente CORS;
  var SEP = "\n[|]\n";
  var MAXQ = 1600;
  var CACHE_PREFIX = "dndhub_tr_";
  var SRC_LANG = "it";

  var LANGS = [
    ["it", "Italiano"], ["en", "English"], ["de", "Deutsch"], ["fr", "Français"],
    ["es", "Español"], ["pt", "Português"], ["nl", "Nederlands"], ["sv", "Svenska"],
    ["da", "Dansk"], ["no", "Norsk"], ["fi", "Suomi"], ["pl", "Polski"],
    ["cs", "Čeština"], ["hu", "Magyar"], ["ro", "Română"], ["el", "Ελληνικά"],
    ["ru", "Русский"], ["uk", "Українська"], ["tr", "Türkçe"], ["ar", "العربية"],
    ["he", "עברית"], ["hi", "हिन्दी"], ["ja", "日本語"], ["ko", "한국어"],
    ["zh-CN", "中文"], ["th", "ไทย"], ["vi", "Tiếng Việt"], ["id", "Bahasa Indonesia"],
  ];

  var state = { lang: "it", running: false, done: 0, total: 0, failed: 0, fromBundle: 0 };
  var originals = new Map();          // nodo -> testo originale (per il ripristino)
  var pendingWork = false;            // contenuto cambiato durante una passata
  var bundle = null;                  // mappa {testo originale: traduzione} dal backend
  var bundleLang = null;              // lingua del bundle caricato

  /* ---------- BUNDLE PRE-CALCOLATO (lato backend) ----------
   * Le traduzioni del testo del sito sono calcolate una volta sola dal costruttore
   * (`tools/build_translations.py`) e servite come `data/i18n/<lingua>.json`. Qui si
   * scarica quel file — UNA richiesta, comprimibile — e si applicano le traduzioni
   * senza chiamare alcun servizio: cambiare pagina non costa nulla e non c'è attesa.
   * Solo i testi assenti dal bundle (contenuti dinamici delle schede) passano dal
   * motore in linea, come prima. */
  function loadBundle(lang, cb) {
    // La lingua SORGENTE non ha bundle: chiederlo produrrebbe un 404 inutile in console.
    if (lang === SRC_LANG) { bundle = null; bundleLang = lang; cb(); return; }
    if (bundleLang === lang) { cb(); return; }
    bundle = null;
    bundleLang = null;
    var x = new XMLHttpRequest();
    x.open("GET", "data/i18n/" + encodeURIComponent(lang) + ".json", true);
    x.timeout = 12000;
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      if (x.status === 200) {
        try {
          var d = JSON.parse(x.responseText);
          bundle = d.strings || {};
          bundleLang = d.lang || lang;
        } catch (e) { bundle = null; }
      }
      cb();
    };
    x.ontimeout = function () { cb(); };
    x.onerror = function () { cb(); };
    x.send();
  }

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; }
    return h.toString(36);
  }
  function cacheGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function cacheSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* quota piena */ } }

  function loadLang() {
    try {
      var v = localStorage.getItem("dndhub_lang");
      if (v === SRC_LANG || LANGS.some(function (l) { return l[0] === v; })) state.lang = v;
    } catch (e) { /* storage negato */ }
  }
  function saveLang(v) { try { localStorage.setItem("dndhub_lang", v); } catch (e) {} }

  /* ---------- selezione dei nodi di testo ---------- */
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, TEXTAREA: 1, NOSCRIPT: 1, SVG: 1, OPTION: 1 };

  function nodeTranslatable(node) {
    var p = node.parentElement;
    if (!p || SKIP_TAGS[p.tagName]) return false;
    if (p.closest("[data-no-tr]")) return false;
    if (p.isContentEditable) return false;
    var t = node.nodeValue;
    if (!t) return false;
    var core = t.trim();
    if (core.length < 2) return false;
    if (!/[A-Za-zÀ-ÿĀ-žА-яΑ-ω]/.test(core)) return false;      // numeri/simboli: niente da tradurre
    if (/^[\d\s.,:%()+\-/]+$/.test(core)) return false;         // solo cifre e punteggiatura
    return true;
  }

  function inSourceEn(node) {
    /* Il testo di fonte inglese è quello racchiuso nei blocchi marcati [lang="en"] del
       CONTENUTO. L'elemento radice va però escluso: questo motore scrive `lang` su
       <html> quando applica una lingua, quindi includendolo ogni nodo risulterebbe
       "già inglese" e in inglese non si tradurrebbe più nulla (misurato: 0 nodi
       raccolti su 2.199, contro 488 su 3.299 in tedesco). */
    var p = node.parentElement;
    if (!p || !p.closest) return false;
    var t = p.closest('[lang="en"]');
    return !!(t && t !== document.documentElement);
  }

  function shouldTranslate(node) {
    var src = inSourceEn(node);
    if (state.lang === SRC_LANG) return src;
    if (state.lang === "en") return !src;
    return true;
  }

  /* Tutti i nodi di testo del documento che vanno tradotti. */
  function collect() {
    var out = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    var n;
    while ((n = walker.nextNode())) {
      if (nodeTranslatable(n) && shouldTranslate(n)) out.push(n);
    }
    return out;
  }

  /* ---------- motore ---------- */
  function callGtx(text, target, cb, err) {
    var url = API + "?client=gtx&sl=auto&tl=" + encodeURIComponent(target) +
      "&dt=t&q=" + encodeURIComponent(text);
    var x = new XMLHttpRequest();
    x.open("GET", url, true);
    x.timeout = 15000;
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      if (x.status !== 200) { err("http " + x.status); return; }
      try {
        var d = JSON.parse(x.responseText);
        var s = "";
        if (d && d[0]) for (var i = 0; i < d[0].length; i++) if (d[0][i] && d[0][i][0]) s += d[0][i][0];
        if (!s) { err("vuoto"); return; }
        cb(s);
      } catch (e) { err("parse"); }
    };
    x.ontimeout = function () { err("timeout"); };
    x.onerror = function () { err("rete"); };
    x.send();
  }

  /* Applica la traduzione a un nodo, conservando il testo originale in memoria. */
  function applyNode(node, translated) {
    if (translated == null) return;
    if (!originals.has(node)) originals.set(node, node.nodeValue);
    /* conserva gli spazi ai bordi: senza, parole adiacenti si incollano */
    var lead = /^\s/.test(node.nodeValue) ? " " : "";
    var trail = /\s$/.test(node.nodeValue) ? " " : "";
    node.nodeValue = lead + translated.trim() + trail;
  }

  function translateNodes(nodes, target, progress, finish) {
    var queue = nodes.slice();
    state.total = queue.length;
    state.done = 0;
    state.failed = 0;

    function one(node, next) {
      var txt = node.nodeValue.trim();
      var k = CACHE_PREFIX + target + "_" + hash(txt);
      var hit = cacheGet(k);
      if (hit) { applyNode(node, hit); state.done++; progress(); next(); return; }
      callGtx(txt, target, function (res) {
        cacheSet(k, res);
        applyNode(node, res);
        state.done++;
        mtRegistraSuccesso();
        progress();
        next();
      }, function () {
        state.failed++;
        mtRegistraErrore();
        progress();
        next();
      });
    }

    function step() {
      /* interruttore: se il servizio ha rifiutato troppe volte si smette di chiamarlo
         (il testo già tradotto dal bundle resta al suo posto). */
      if (mtBloccato) { finish(); return; }
      if (!queue.length) { finish(); return; }
      /* lotto concatenato */
      var batch = [], len = 0;
      while (queue.length) {
        var t = queue[0].nodeValue.trim();
        if (batch.length && len + t.length + SEP.length > MAXQ) break;
        batch.push(queue.shift());
        len += t.length + SEP.length;
      }
      if (batch.length === 1) { one(batch[0], step); return; }
      var joined = batch.map(function (n) { return n.nodeValue.trim(); }).join(SEP);
      callGtx(joined, target, function (res) {
        var parts = res.split(SEP);
        if (parts.length === batch.length) {
          for (var i = 0; i < batch.length; i++) applyNode(batch[i], parts[i]);
          state.done += batch.length;
          progress();
          step();
        } else {
          /* divisione non affidabile: si rifà uno per uno (mai attribuire a caso) */
          queue = batch.concat(queue);
          one(queue.shift(), step);
        }
      }, function () {
        queue = batch.concat(queue);
        one(queue.shift(), step);
      });
    }
    step();
  }

  function progress() {
    var bar = el("tr-progress");
    if (!bar) return;
    var finiti = state.done + state.failed;
    if (state.total && finiti < state.total) {
      bar.hidden = false;
      bar.textContent = "traduzione " + finiti + "/" + state.total +
        (state.failed ? " (" + state.failed + " non tradotti)" : "");
    } else {
      bar.textContent = state.failed
        ? "tradotto in parte: " + state.done + " testi, " + state.failed + " mancanti"
        : "traduzione completata (" + state.done + " testi)";
      setTimeout(function () { bar.hidden = true; }, 4000);
    }
  }

  /* ---------- INTERRUTTORE DI SICUREZZA ----------
   * Se il servizio in linea rifiuta (verificato: HTTP 429 dopo molte richieste ravvicinate),
   * continuare a chiamarlo tiene la pagina occupata inutilmente. Dopo N errori
   * consecutivi si smette, si lascia il testo originale e lo si dichiara all'utente. */
  var MT_MAX_ERRORI = 3;
  var mtErroriConsecutivi = 0;
  var mtBloccato = false;

  function mtRegistraErrore() {
    mtErroriConsecutivi++;
    if (mtErroriConsecutivi >= MT_MAX_ERRORI && !mtBloccato) {
      mtBloccato = true;
      var bar = el("tr-progress");
      if (bar) {
        bar.hidden = false;
        bar.textContent = "servizio di traduzione non disponibile: testo originale mantenuto" +
          (bundle ? " (il testo già pre-calcolato resta tradotto)" : "");
      }
    }
  }
  function mtRegistraSuccesso() { mtErroriConsecutivi = 0; }

  function translateNow() {
    if (state.running) return;
    loadBundle(state.lang, function () {
      var nodes = collect();
      if (!nodes.length) {
        var b0 = el("tr-progress");
        if (b0) { b0.hidden = false; b0.textContent = "niente da tradurre in questa pagina";
                  setTimeout(function () { b0.hidden = true; }, 2500); }
        return;
      }
      /* 1. testi già tradotti nel backend: si applicano subito, senza rete. */
      var resto = [];
      var istantanei = 0;
      if (bundle) {
        for (var i = 0; i < nodes.length; i++) {
          /* La chiave va normalizzata ESATTAMENTE come nell'estrazione: `\s+` → spazio
             e trim. Il solo trim() non basta: un paragrafo che nel sorgente va a capo
             (`… con i\n`) non trovava mai la chiave, e il testo ricadeva sul motore in
             linea — che, se limitato, lasciava la pagina in italiano. Le etichette
             brevi funzionavano, per questo il difetto sembrava parziale. */
          var orig = (nodes[i].nodeValue || "").replace(/\s+/g, " ").trim();
          if (Object.prototype.hasOwnProperty.call(bundle, orig)) {
            applyNode(nodes[i], bundle[orig]);
            istantanei++;
          } else {
            resto.push(nodes[i]);
          }
        }
      } else {
        resto = nodes;
      }
      state.fromBundle = istantanei;   // testi applicati dal bundle (senza rete)
      if (istantanei) {
        var bar0 = el("tr-progress");
        if (bar0) {
          bar0.hidden = false;
          bar0.textContent = istantanei + " testi dal bundle pre-calcolato" +
            (resto.length ? " · " + resto.length + " dal motore in linea\u2026" : "");
        }
      }
      /* 2. il resto (contenuti dinamici non ancora pre-calcolati) passa dal motore,
            a meno che l'interruttore non sia scattato. */
      if (!resto.length || mtBloccato) {
        document.documentElement.setAttribute("lang", state.lang);
        state.done = istantanei;
        state.failed = 0;
        state.total = istantanei;
        progress();
        return;
      }
      state.running = true;
      translateNodes(resto, state.lang, progress, function () {
        state.running = false;
        progress();
        document.documentElement.setAttribute("lang", state.lang);
        if (pendingWork) { pendingWork = false; setTimeout(translateNow, 250); }
      });
    });
  }

  function restore() {
    originals.forEach(function (txt, node) {
      try { node.nodeValue = txt; } catch (e) { /* nodo rimosso dal DOM */ }
    });
    originals.clear();
    /* le traduzioni dell'altro runtime (etichette it/en) vengono anch'esse ripristinate */
    document.querySelectorAll("[data-tr-done]").forEach(function (e) {
      var o = e.getAttribute("data-tr-orig");
      if (o != null) e.textContent = o;
      e.removeAttribute("data-tr-done");
      e.removeAttribute("data-tr-orig");
    });
  }

  function setLang(code, opts) {
    state.lang = code;
    saveLang(code);
    document.documentElement.setAttribute("lang", code);
    restore();
    markMenu();
    if (code === "it" || code === "en") {
      if (typeof window.setLang === "function") { try { window.setLang(code); } catch (e) {} }
    }
    if (!opts || !opts.silent) translateNow();
  }

  function markMenu() {
    var sel = el("tr-lang");
    if (sel) sel.value = state.lang;
    // il menu della pagina rispecchia il bottone: stesso valore, nessuna
    // modifica alla logica di traduzione.
    var b = el("tr-lang-btn");
    if (b && sel && sel.options && sel.selectedIndex >= 0) {
      b.textContent = sel.options[sel.selectedIndex].textContent;
    }
    var box = el("tr-lang-wrap");
    if (box) box.classList.toggle("tr-active", state.lang !== SRC_LANG);
  }

  function buildMenu() {
    var sel = el("tr-lang");
    if (!sel) return;
    sel.innerHTML = LANGS.map(function (l) {
      return '<option value="' + esc(l[0]) + '"' + (l[0] === state.lang ? " selected" : "") +
        ">" + esc(l[1]) + "</option>";
    }).join("");
    sel.addEventListener("change", function () { setLang(sel.value); });
    var r = el("tr-restore");
    if (r) r.addEventListener("click", function () {
      restore();
      setLang(SRC_LANG, { silent: true });
      if (typeof window.setLang === "function") { try { window.setLang("it"); } catch (e) {} }
    });
  }

  /* Le schede del lookup si disegnano dopo il caricamento: si ritraduce quando il
     contenuto cambia, con una pausa per non lavorare a metà render. */
  function watch() {
    if (!window.MutationObserver) return;
    var zone = document.getElementById("stat-core-zone") || document.querySelector("main");
    if (!zone) return;
    var t = null;
    var obs = new MutationObserver(function (muts) {
      if (state.lang === SRC_LANG) return;
      /* solo mutazioni con nodi NUOVI: le nostre stesse sostituzioni di testo non
         generano addedNodes, quindi non si riattiva da sola */
      var rilevante = muts.some(function (m) { return m.addedNodes && m.addedNodes.length; });
      if (!rilevante) return;
      if (t) clearTimeout(t);
      t = setTimeout(function () {
        if (state.running) { pendingWork = true; return; }   // non si perde l'aggiornamento
        translateNow();
      }, 700);
    });
    obs.observe(zone, { childList: true, subtree: true });
  }

  function boot() {
    loadLang();
    buildMenu();
    markMenu();
    if (state.lang !== SRC_LANG) setTimeout(translateNow, 150);
    watch();
  }

  state.applied = function () { return (state.fromBundle || 0) + (state.done || 0); };
  window.dndTr = { setLang: setLang, translateNow: translateNow, restore: restore, state: state };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

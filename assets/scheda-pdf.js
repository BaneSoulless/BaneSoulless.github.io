/*
 * scheda-pdf.js — esporta il personaggio della «Creazione guidata» in una scheda PDF 2024.
 *
 * PERCHE' NEL BROWSER E NON SUL SERVER: il server del sito è di sola lettura (GET/HEAD,
 * allowlist dei percorsi, blocklist di .py/.md/.log/.exe). Aggiungergli un endpoint POST
 * significherebbe aprire una superficie di scrittura su un servizio esposto anche via
 * tunnel. Compilando nel browser: il server resta di sola lettura, i dati del personaggio
 * non lasciano la macchina, e la funzione continua a funzionare anche col sito su file.
 *
 * La libreria è self-hosted in assets/vendor/pdf-lib.min.js (MIT): nessuna CDN a runtime,
 * nessun servizio a pagamento, nessuna richiesta di rete oltre al proprio dominio.
 *
 * VERIFICATO: pdf-lib legge il template 2024 (456 campi) e lo risalva a ~1169 KB, quindi
 * regge lo stesso template su cui pypdf andava in TypeError per i /Rect indiretti.
 */
(function () {
  "use strict";

  var LIB_URL = "/assets/vendor/pdf-lib.min.js";
  var TEMPLATE = "/pdf/dnd2024_fillable_a4.pdf";
  var _lib = null;

  /* Il caricamento è pigro: la libreria pesa 513 KB e serve solo al clic su «Salva PDF». */
  function caricaLib() {
    if (_lib) return _lib;
    _lib = new Promise(function (res, rej) {
      if (window.PDFLib) return res(window.PDFLib);
      var s = document.createElement("script");
      s.src = LIB_URL;
      s.onload = function () {
        if (window.PDFLib) res(window.PDFLib);
        else rej(new Error("PDFLib non esposta dal file"));
      };
      s.onerror = function () { rej(new Error("pdf-lib non caricata da " + LIB_URL)); };
      document.head.appendChild(s);
    });
    return _lib;
  }

  var ABIL = ["str", "dex", "con", "int", "wis", "cha"];
  var ABIL_IT = { str: "For", dex: "Des", con: "Cos", int: "Int", wis: "Sag", cha: "Car" };
  var SCORE = { str: "score str", dex: "score dex", con: "score con", int: "score int", wis: "score wis", cha: "score cha" };
  var MODF = { str: "mod str", dex: "mod dex", con: "mod con", int: "mod int", wis: "mod wis", cha: "mod cha" };
  /* Nomi esatti dei campi nel template 2024: sono stati letti dal PDF, non inventati. */
  var SKILL = {
    acrobatic: "dex", animal: "wis", arcana: "int", athle: "str", decep: "cha", his: "int",
    ins: "wis", intimi: "cha", medi: "wis", natur: "int", percp: "wis", perfo: "cha",
    reli: "int", slei: "dex", steal: "dex", survi: "wis"
  };
  var FEAT_BOX = [
    "i  CLASS FEATURES TRAITS  FEATS e Action A Bonus Action  Reaction OtherLimited Uses 1Row1",
    "i  CLASS FEATURES TRAITS  FEATS e Action A Bonus Action  Reaction OtherLimited Uses 1Row2"
  ];
  var SLOTS = {
    1: { 1: 2 }, 2: { 1: 3 }, 3: { 1: 4, 2: 2 }, 4: { 1: 4, 2: 3 }, 5: { 1: 4, 2: 3, 3: 2 },
    6: { 1: 4, 2: 3, 3: 3 }, 7: { 1: 4, 2: 3, 3: 3, 4: 1 }, 8: { 1: 4, 2: 3, 3: 3, 4: 2 },
    9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, 10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
    11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, 12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
    13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 }, 14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
    15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
    16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
    17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
    18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
    19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
    20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }
  };
  var XP = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
            120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

  function mod(v) { return Math.floor((v - 10) / 2); }
  function seg(v) { return (v >= 0 ? "+" : "") + v; }
  function taglia(s, n) {
    s = String(s == null ? "" : s);
    return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
  }

  /* Mappa il personaggio generato sui campi REALI del template 2024.
     Stessa mappa del motore Python (tools/make_level_pdfs.py), così le schede esportate
     dal sito e quelle precompilate delle build sono coerenti campo per campo. */
  function campi(pg) {
    var c = pg.classe || {};
    var sc = pg.scheda || {};
    var ab = pg.abilita || {};
    var lv = pg.livello || 1;
    var pb = sc.pb != null ? sc.pb : (2 + Math.floor((lv - 1) / 4));
    var f = {};
    /* Il nome base NON contiene il livello: altrimenti "Artificer liv 5 (liv 5)". */
    var nomePg = pg.nome || (c.n || "Personaggio");

    f["Name"] = taglia(nomePg + " (liv " + lv + ")", 40);
    f["name 1"] = taglia(nomePg, 40);
    f["name 2"] = taglia(pg.ed + " \u00b7 " + (c.n || ""), 40);
    f["CLASS"] = taglia(c.n || "", 60);
    f["SUBCLASS"] = taglia(pg.sottoclasse ? pg.sottoclasse.n : "\u2014 (dal liv " + (c.subLevel || "?") + ")", 60);
    f["level"] = String(lv);
    f["species"] = taglia(pg.razza ? pg.razza.n : "", 40);
    f["back"] = taglia(pg.background ? pg.background.n : "", 40);

    ABIL.forEach(function (a) {
      var v = ab[a];
      if (v == null) return;
      f[SCORE[a]] = String(v);
      f[MODF[a]] = seg(mod(v));
    });
    f["AC"] = String(sc.ca != null ? sc.ca : (10 + mod(ab.dex || 10)));
    f["current"] = String(sc.pf != null ? sc.pf : "");
    f["MAX"] = String(sc.pf != null ? sc.pf : "");
    f["TEMP"] = "";
    f["weapom"] = "";
    f["SPELLCASTING atk mod"] = c.spellAbility ? seg(pb + mod(ab[c.spellAbility] || 10)) : "";
    f["SPELLCASTING ABILITYRow1"] = c.spellAbility ? ABIL_IT[c.spellAbility] : "";

    /* Tiri salvezza: competenze di classe + modificatore, sul PB del livello. */
    var saves = (c.saves || []);
    f["SAVING THROW"] = taglia(ABIL.map(function (a) {
      var b = mod(ab[a] || 10) + (saves.indexOf(a) !== -1 ? pb : 0);
      return ABIL_IT[a] + " " + seg(b);
    }).join(" \u00b7 "), 120);

    /* Abilità: modificatore + PB se competente. Il PB va aggiunto a mano perché la
       competenza nelle abilità è una scelta del giocatore, non un dato della classe. */
    Object.keys(SKILL).forEach(function (fl) {
      var v = ab[SKILL[fl]];
      if (v == null) return;
      f[fl] = seg(mod(v)) + " (aggiungi " + pb + " se competente)";
    });

    var tal = (pg.talenti || []).map(function (t) { return "liv " + t.lv + ": " + (t.n || "\u2014"); });
    var featTxt = "TALENTI: " + (tal.length ? tal.join("; ") : "\u2014")
      + " || COMPETENZA +" + pb
      + " || Sottoclasse: " + (pg.sottoclasse ? pg.sottoclasse.n : "\u2014")
      + " || Background: " + (pg.background ? pg.background.n : "\u2014");
    FEAT_BOX.forEach(function (k) { f[k] = taglia(featTxt, 900); });

    /* Incantesimi: solo i livelli di slot disponibili a QUESTO livello. */
    var avail = SLOTS[lv] || {};
    var maxLv = 0;
    Object.keys(avail).forEach(function (k) { maxLv = Math.max(maxLv, parseInt(k, 10)); });
    Object.keys(pg.incantesimi || {}).forEach(function (lvsp) {
      if (parseInt(lvsp, 10) > maxLv) return;
      (pg.incantesimi[lvsp] || []).slice(0, 3).forEach(function (nm, j) {
        f["lvl " + lvsp + " - " + (j + 1)] = taglia(nm, 40);
      });
    });
    (pg.trucchetti || []).slice(0, 3).forEach(function (nm, j) {
      f["can " + (j + 1)] = taglia(nm, 30);
    });
    if (Object.keys(avail).length) {
      f["Texto12"] = taglia("Slot a liv " + lv + ": " + Object.keys(avail).sort(function (a, b) {
        return a - b;
      }).map(function (k) { return k + "\u00b0\u00d7" + avail[k]; }).join(", "), 100);
    }

    f["NOTES liRow0"] = taglia("Personaggio costruito nel creatore del sito (ed. " + pg.ed
      + ", seme " + pg.seed + ").", 120);
    f["NOTES liRow1"] = taglia("Valori calcolati dalle regole: PF " + (sc.pf || "?")
      + ", CA " + (sc.ca || "?") + ", BC " + pb + (sc.cd ? ", CD incantesimi " + sc.cd : "") + ".", 120);
    f["NOTES liRow2"] = taglia("Nessun oggetto magico conteggiato: i valori sono senza equipaggiamento magico.", 120);
    f["NOTES liRow3"] = taglia("Il PDF e' compilato nel browser dai dati che hai scelto; resta modificabile.", 140);
    f["XP"] = String(XP[lv - 1] != null ? XP[lv - 1] : "");
    return f;
  }

  /* Compila e scarica. Non tocca il DOM del sito: crea un <a download> usa e getta. */
  function salva(pg) {
    return caricaLib().then(function (PDFLib) {
      return fetch(TEMPLATE, { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("template non raggiungibile (HTTP " + r.status + ")");
        return r.arrayBuffer();
      }).then(function (buf) {
        return PDFLib.PDFDocument.load(buf);
      }).then(function (pdf) {
        var form = pdf.getForm();
        var f = campi(pg);
        var scritti = 0, mancanti = [];
        Object.keys(f).forEach(function (k) {
          if (f[k] === "" || f[k] == null) return;
          try { form.getTextField(k).setText(String(f[k])); scritti++; }
          catch (e) { mancanti.push(k); }
        });
        /* I valori devono restare VISIBILI: senza aggiornare gli appearance stream
           alcuni lettori mostrerebbero i campi vuoti. */
        try { form.updateFieldAppearances(); } catch (e) { /* non bloccante */ }
        return pdf.save().then(function (bytes) {
          var blob = new Blob([bytes], { type: "application/pdf" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          var base = String((pg.classe && pg.classe.n) || "personaggio")
            .replace(/[^\w\-]+/g, "_").slice(0, 40);
          a.href = url;
          a.download = "scheda_" + base + "_liv" + (pg.livello || 1) + ".pdf";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
          return { scritti: scritti, mancanti: mancanti, kb: Math.round(bytes.length / 1024) };
        });
      });
    });
  }

  window.SchedaPDF = { salva: salva, campi: campi };
})();

/* ricerca.js — sezione "Ricerca ottimizzata" della pagina personaggi.
   Legge data/ricerca-2024.json (generato dal motore deterministico) e rende 4 viste:
   Build (DPR 5-20 con slider), Ruoli (20 classifiche Top 5), Combo (71 con verdetto), One-shot.
   Nessun innerHTML con dati: solo textContent / createElement. Nessuna dipendenza esterna. */
(function () {
  "use strict";
  var DATA = null, tab = "build", lvl = 20, ruolo = null, leg = "Tutte", cat = "Tutte";

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = String(txt);
    return n;
  }
  function badge(txt, cls) { var s = el("span", "rc-badge " + (cls || ""), txt); return s; }

  /* Requisito del committente: le fonti NON in una sezione separata, ma in fondo a ogni scheda,
     come link. Ogni entità porta le proprie (risolte dalle citazioni del corpus). */
  function fontiHtml(fonti) {
    var box = el("div", "rc-fonti");
    if (!fonti || !fonti.length) { box.appendChild(el("span", null, "Fonti: —")); return box; }
    box.appendChild(el("span", "rc-fonti-lab", "Fonti:"));
    fonti.forEach(function (f) {
      var a = document.createElement("a");
      a.href = f.url; a.target = "_blank"; a.rel = "noopener nofollow";
      a.textContent = f.titolo; a.className = "rc-fonti-lnk";
      box.appendChild(a);
    });
    return box;
  }

  /* Forge (2026-09-27) — disclosure del ciclo di ricerca esauriente.
     Mostra i numeri MISURATI (entità enumerate, gusci legali, co-occorrenze) e la
     candidata REFUTATA dalla verifica: nasconderla sarebbe la forma peggiore di
     trasparenza, perché farebbe sembrare il metodo più pulito di quanto sia. */
  function forgeHtml() {
    var f = DATA.forge;
    if (!f || !f.combo) return null;
    var box = el("div", "rc-forge");
    box.appendChild(el("h3", null, "Forge — ricerca esauriente di combinazioni inedite"));
    var n = f.combo_novita || {};
    box.appendChild(el("p", "tv-meta",
      f.entita_estratte + " entità estratte dai dati 5etools (di cui " + f.entita_con_meccanica +
      " con meccanica reale) · " + f.gusci_legali + " gusci multiclasse legali enumerati · " +
      f.coppie_valutate + " coppie valutate su " + f.docs_novita + " documenti."));
    box.appendChild(el("p", "tv-meta",
      "Novità MISURATA per co-occorrenza: «Zhentarim Ruffian» + «Zhentarim Tactics» compaiono insieme in " +
      n.coppia_talenti + " documenti (i talenti sono catalogati ovunque), ma «Zhentarim Tactics» + «Divine Smite» " +
      "solo in " + n.tactics_piu_smite + " — è l'applicazione a essere quasi non discussa."));
    box.appendChild(el("p", "tv-meta",
      "Combinazioni di classi mai discusse: " + f.combinazioni_classe_nuove + " su " + f.gusci_legali +
      ". Le split «senza citazione letterale» (10.106) NON sono novità: sono un artefatto di formato, e non le conteggio come risultato."));
    box.appendChild(el("p", "tv-meta", "Candidata REFUTATA dalla verifica: " + f.refutata));
    return box;
  }

  /* Build inedite validate dal solver delle regole (BUILD_CODEX_COMPLETO.md).
     Ogni voce dichiara il nucleo meccanico inedito e i documenti che lo citano:
     e' la misura di novita', non un'etichetta. */
  var pdfLevel = 20;   // livello selezionato per le schede PDF

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function pdfHref(dir, lvl) { return "/" + dir + "/lv" + pad2(lvl) + ".pdf"; }

  /* TASSONOMIE AD ASSI (2026-10-02): ogni categoria del sito ha una FAMIGLIA di assi con
     una regola di ammissione, cosi' contiene chi copre il ruolo e non chi lo sfiora. La
     calibrazione (banda 10-60%) e' misurata: un tasso troppo alto = regola permissiva. */
  function tassonomieHtml() {
    var T = DATA.tassonomie, B = DATA.build_assi;
    if (!T && !(B && B.length)) return null;
    var box = el("div", "rc-forge");
    box.appendChild(el("h3", null, "Tassonomie ad assi — ogni categoria ha la sua regola"));
    if (T) {
      box.appendChild(el("p", "tv-meta",
        "Le 26 categorie sono agganciate a " + (T.conteggi && T.conteggi.famiglie_totali) + " famiglie di assi. "
        + "Un tasso di ammissibilità troppo alto significa regola permissiva; troppo basso, test rotto. "
        + "Banda di calibrazione 10-60%, misurata."));
      var tb = el("table", "pg-tab");
      tb.appendChild(el("tr", "rc-hdr"));
      ["Famiglia", "Tasso", "Esito"].forEach(function (h) {
        tb.lastChild.appendChild(el("th", null, h));
      });
      Object.keys(T.calibrazione || {}).forEach(function (k) {
        var v = T.calibrazione[k];
        var tr = el("tr");
        tr.appendChild(el("td", null, k));
        tr.appendChild(el("td", null, v.tasso + "%"));
        tr.appendChild(el("td", "pg-formula", v.esito));
        tb.appendChild(tr);
      });
      box.appendChild(tb);
    }
    if (B && B.length) {
      box.appendChild(el("h3", null, "Build classificate per assi (" + B.length + ")"));
      var t2 = el("table", "pg-tab");
      var h2 = el("tr", "rc-hdr");
      ["ID", "Build", "Categoria dagli assi", "Famiglie dal testo", "Nota"].forEach(function (h) {
        h2.appendChild(el("th", null, h));
      });
      t2.appendChild(h2);
      B.forEach(function (x) {
        var tr = el("tr");
        tr.appendChild(el("td", "rc-note", x.id || "—"));
        tr.appendChild(el("td", null, x.nome || ""));
        tr.appendChild(el("td", null, x.categoria_assi || "—"));
        tr.appendChild(el("td", "pg-formula", (x.famiglie || []).join(", ") || "—"));
        tr.appendChild(el("td", "pg-formula", (x.disaccordo || x.motivo || "").slice(0, 70)));
        t2.appendChild(tr);
      });
      box.appendChild(t2);
    }
    return box;
  }

  function accBuilds(list, inedite) {
    /* ACCORDION (richiesta UI): ogni build e' un blocco che si apre e si chiude.
       La riga chiusa porta l'identita' (ID, nome, categoria, piazzamento) + il link
       al PDF del livello scelto; la riga aperta porta il pacchetto completo. */
    var wrap = el("div", "rc-acc");
    list.slice().sort(function (a, b) {
      if (inedite) return (a.novita_docs || 0) - (b.novita_docs || 0);
      return String(a.id).localeCompare(String(b.id), "it");
    }).forEach(function (b) {
      var det = document.createElement("details");
      det.className = "rc-acc-item";
      var sum = document.createElement("summary");
      sum.appendChild(el("span", "rc-acc-id", b.id));
      sum.appendChild(el("span", "rc-acc-nome", b.nome));
      if (b.categoria) sum.appendChild(el("span", "rc-acc-cat", b.categoria));
      if (b.piazzamento) sum.appendChild(el("span", "rc-acc-piaz", b.piazzamento));
      det.appendChild(sum);
      var body = el("div", "rc-acc-body");
      var dl = el("ul", "rc-acc-list");
      function riga(k2, v) {
        if (v === null || v === undefined || v === "") return;
        var li = el("li");
        li.appendChild(el("strong", null, k2 + ": "));
        li.appendChild(document.createTextNode(String(v)));
        dl.appendChild(li);
      }
      riga("Classi", b.classi);
      riga("Specie", b.specie);
      riga("Background", b.background);
      if (b.sottoclassi) riga("Sottoclassi", Object.keys(b.sottoclassi).map(function (k2) {
        return k2 + " \u2192 " + b.sottoclassi[k2];
      }).join(" · "));
      if (b.talenti) riga("Talenti", b.talenti.join(", "));
      if (b.feats) riga("Talenti", b.feats.join(", "));
      if (b.features && b.features.length) riga("Feature", b.features.join(", "));
      if (b.nucleo) riga("Nucleo meccanico", b.nucleo);
      if (inedite) {
        riga("Novita' (co-occorrenza sui documenti)", b.novita_docs);
        if (b.novita_esterna) riga("Riscontro esterno", b.novita_esterna);
      }
      if (b.nota) riga("Nota di provenienza", b.nota);
      body.appendChild(dl);
      var act = el("div", "rc-acc-act");
      // SELETTORE DI LIVELLO PER BUILD (1-20): il PDF segue la scelta, per ognuna.
      var livSel = el("select", "rc-liv-per-build");
      livSel.setAttribute("aria-label", "Livello della scheda PDF di " + (b.nome || b.id || ""));
      for (var L = 1; L <= 20; L++) {
        var opt = document.createElement("option");
        opt.value = String(L);
        opt.textContent = "liv " + L;
        if (L === pdfLevel) { opt.selected = true; }
        livSel.appendChild(opt);
      }
      livSel.addEventListener("change", function () {
        var l = +livSel.value || 1;
        if (presente) {
          a.href = pdfHref(dir, l);
          a.textContent = "Scheda PDF · liv " + l;
        }
      });
      act.appendChild(livSel);
      var a = document.createElement("a");
      a.className = "rc-pdf rc-fonti-lnk";
      a.setAttribute("data-dir", b.pdf_dir || ("pdf/levels/" + b.id));
      // Collega SOLO se la cartella esiste (window.PDF_LEVELS lo dice).
      var dir = b.pdf_dir || ("pdf/levels/" + b.id);
      var chiave = b.pdf_dir ? b.pdf_dir.replace("pdf/levels/", "") : b.id;
      var presente = !window.PDF_LEVELS || window.PDF_LEVELS.indexOf(chiave) !== -1;
      if (presente) { a.href = pdfHref(dir, pdfLevel); }
      else { a.classList.add("pdf-assente"); a.removeAttribute("href"); }
      a.target = "_blank"; a.rel = "noopener";
      a.textContent = "Scheda PDF · liv " + pdfLevel;
      act.appendChild(a);
      body.appendChild(act);
      det.appendChild(body);
      wrap.appendChild(det);
    });
    return wrap;
  }

  /* RICONTROLLO DELLE FONTI (2026-10-01): il registro delle fonti era costruito dal solo
     books.json e ignorava adventures.json — 98 fonti su 163 restavano fuori. Qui si mostra
     l'esito del ricontrollo su TUTTE le fonti: per ogni build, quante voci usano la versione
     2024+, quante una 2014 non ristampata, e se qualcuna e' stata rimpiazzata. */
  function ricontrolloHtml() {
    var r = DATA.ricontrollo;
    if (!r || !r.build) return null;
    var box = el("div", "rc-forge");
    var s = r.riepilogo || {};
    box.appendChild(el("h3", null, "Ricontrollo su tutte le fonti (" + r.fonti_registrate
      + " registrate, " + r.fonti_2024piu + " del 2024+)"));
    box.appendChild(el("p", "tv-meta", r.nota || ""));
    var ko = (r.build || []).filter(function (b) { return b.verdetto !== "OK"; });
    box.appendChild(el("p", "tv-meta", "Build verificate: " + r.build.length
      + " — OK " + (r.build.length - ko.length) + ", da correggere " + ko.length
      + ". Voci su versione 2024+: " + (s.ok_2024 || 0)
      + "; su 2014 non ristampata: " + (s.ok_2014 || 0)
      + "; rimpiazzate: " + (s.rimpiazzate || 0)
      + "; non trovate: " + (s.non_trovata || 0) + "."));
    if (ko.length) {
      var ul = el("ul", "rc-acc-list");
      ko.forEach(function (b) {
        var li = el("li");
        li.appendChild(el("strong", null, b.id + " " + b.nome + ": "));
        li.appendChild(document.createTextNode((b.problemi || []).map(function (p) {
          return p.tipo + " " + p.nome + " [" + (p.T1 || p.T2) + "]";
        }).join("; ")));
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }
    box.appendChild(el("p", "tv-meta",
      "Criterio: il mirror 5e.tools dichiara i rimpiazzi nel campo reprintedAs. Un'opzione che "
      + "esiste in una fonte 2024+ viene usata in quella versione; una voce solo-2014 ristampata "
      + "va sostituita. Il primo giro di questo test dava 21 build su 21 da correggere: era un "
      + "FALSO POSITIVO del test, che trovava la voce 2014 nel compendio anche quando la build "
      + "usava quella 2024."));
    return box;
  }

  function inediteHtml() {
    var list = DATA.build_inedite;
    if (!list || !list.length) return null;
    var box = el("div", "rc-forge");
    box.appendChild(el("h3", null, "Build inedite — validate dal solver delle regole (" + list.length + ")"));
    /* SLIDER DI LIVELLO: cambia la scheda PDF mostrata per OGNI build (1-20). */
    var ctl = el("div", "rc-ctrl");
    ctl.appendChild(el("label", "dl", "Livello scheda PDF"));
    var sl = el("input");
    sl.type = "range"; sl.min = "1"; sl.max = "20"; sl.value = String(pdfLevel);
    sl.id = "rc-pdf-liv";
    // Il <label> del campo e' un fratello, non un contenitore: senza `for` (o, qui,
    // senza aria-label) il controllo resta senza nome accessibile. Stesso difetto di
    // `rc-liv`, stessa correzione.
    sl.setAttribute("aria-label", "Livello del PDF da generare");
    var out = el("span", "rc-num", "liv " + pdfLevel);
    sl.addEventListener("input", function () {
      pdfLevel = parseInt(sl.value, 10);
      out.textContent = "liv " + pdfLevel;
      var as = box.querySelectorAll("a.rc-pdf");
      for (var i = 0; i < as.length; i++) {
        as[i].href = pdfHref(as[i].getAttribute("data-dir"), pdfLevel);
        as[i].textContent = "Scheda PDF · liv " + pdfLevel;
      }
    });
    ctl.appendChild(sl); ctl.appendChild(out);
    box.appendChild(ctl);
    box.appendChild(el("p", "tv-meta",
      "Ogni build e' verificata da un solver deterministico (multiclasse, prerequisiti dei talenti, "
      + "invarianti: una sola formula di CA, Extra Attack non cumulabile). La novita' e' la "
      + "co-occorrenza del nucleo meccanico sui documenti indicizzati: <2 = inedita. "
      + "Clicca una scheda per aprirla."));
    box.appendChild(accBuilds(list, true));
    var _tx = tassonomieHtml();
    if (_tx) box.appendChild(_tx);
    var _rc = ricontrolloHtml();
    if (_rc) box.appendChild(_rc);
    var tro = DATA.build_trovate;
    if (tro && tro.length) {
      box.appendChild(el("h3", null, "Trovate dal canale (" + tro.length + ") — pacchetto derivato dalla fonte"));
      box.appendChild(el("p", "tv-meta", tro[0].nota));
      box.appendChild(accBuilds(tro, false));
    }
    return box;
  }

  function renderKpi(host, items) {
    host.textContent = "";
    items.forEach(function (it) {
      var k = el("div", "rc-kpi");
      k.appendChild(el("div", "rc-kpi-l", it[0]));
      k.appendChild(el("div", "rc-kpi-v", it[1]));
      host.appendChild(k);
    });
  }

  function viewBuild(host) {
    host.textContent = "";            // svuota: i cambi di filtro/slider non devono accumulare
    var s = DATA.sintesi;
    var kpi = el("div", "rc-kpi-grid");
    renderKpi(kpi, [["Build calcolate", s.build], ["Combo verificate", s.combo], ["Ruoli classificati", s.ruoli],
      ["Test PASS", s.test_passati + "/" + s.test_totali], ["ECI", s.eci + "%"],
      ["Fonti", s.fonti_web + " + " + s.trascritti_video + " video"]]);
    host.appendChild(kpi);

    var ctrl = el("div", "rc-ctrl");
    ctrl.appendChild(el("label", "dl", "Livello"));
    var sl = el("input");
    sl.type = "range"; sl.min = "5"; sl.max = "20"; sl.value = String(lvl); sl.id = "rc-liv"; sl.setAttribute("aria-label", "Livello del personaggio");
    var out = el("span", "rc-num", "liv " + lvl);
    sl.addEventListener("input", function () { lvl = parseInt(sl.value, 10); out.textContent = "liv " + lvl; viewBuild(host); });
    ctrl.appendChild(sl); ctrl.appendChild(out);
    host.appendChild(ctrl);

    var idx = lvl - 5;
    var rows = DATA.build.slice().sort(function (a, b) { return b.dpr[idx] - a.dpr[idx]; });
    var t = el("table", "rc-table");
    var thead = el("thead"), tr = el("tr");
    ["#", "Build", "DPR sost.", "DPR all-in", "Dettaglio (dal motore)"].forEach(function (h) { tr.appendChild(el("th", null, h)); });
    thead.appendChild(tr); t.appendChild(thead);
    var tb = el("tbody");
    rows.forEach(function (b, i) {
      var r = el("tr");
      if (i === 0) r.className = "rc-top";
      [String(i + 1), b.nome, (b.dpr[idx] || 0).toFixed(0), (b.nova[idx] === null ? "—" : b.nova[idx].toFixed(0)), b.note[idx] || ""]
        .forEach(function (c, ci) {
          var td = el("td", ci === 4 ? "rc-note" : null, c);
          if (ci === 4) td.appendChild(fontiHtml(b.fonti));
          r.appendChild(td);
        });
      tb.appendChild(r);
    });
    t.appendChild(tb);
    host.appendChild(t);
    host.appendChild(el("p", "tv-meta", "Valori dal motore deterministico (AC per fascia 16/17/18/19, critico ×2 sui dadi, nessun oggetto magico). " +
      "Il dettaglio per ogni livello riporta slot e raggi usati. Build #15 = armata di non-morti, rinnovabile."));
    var fg = forgeHtml(); if (fg) host.appendChild(fg);
    var ined = inediteHtml(); if (ined) host.appendChild(ined);
  }

  function viewRuoli(host) {
    host.textContent = "";
    var sel = el("select", "rc-select");
    DATA.ruoli.forEach(function (r) {
      var o = el("option", null, r.ruolo + "  (" + Math.round(r.stabilita * 100) + "%)");
      o.value = r.ruolo;
      sel.appendChild(o);
    });
    sel.value = ruolo || DATA.ruoli[0].ruolo;
    sel.addEventListener("change", function () { ruolo = sel.value; viewRuoli(host); });
    var ctrl = el("div", "rc-ctrl");
    ctrl.appendChild(el("label", "dl", "Ruolo"));
    ctrl.appendChild(sel);
    host.appendChild(ctrl);

    var r = null;
    DATA.ruoli.forEach(function (x) { if (x.ruolo === (ruolo || DATA.ruoli[0].ruolo)) r = x; });
    if (!r) return;
    host.appendChild(el("p", "tv-meta", r.perche + " · stabilità del podio " + Math.round(r.stabilita * 100) +
      "% su 200 perturbazioni ±10%" + (r.stabilita < 0.6 ? " → leggere come FASCIA, l'ordine interno non è significativo." : ".")));
    var max = Math.max.apply(null, r.top5.map(function (c) { return c.punteggio; })) || 1;
    r.top5.forEach(function (c, i) {
      var row = el("div", "rc-rank");
      row.appendChild(el("div", "rc-rank-n", (i + 1) + (c.tie ? "=" : "")));
      var mid = el("div", "rc-rank-mid");
      mid.appendChild(el("div", "rc-rank-name", c.nome));
      var bar = el("div", "rc-bar");
      var fill = el("div", "rc-bar-fill");
      fill.style.width = Math.max(3, (c.punteggio / max) * 100) + "%";
      bar.appendChild(fill); mid.appendChild(bar);
      mid.appendChild(el("div", "rc-rank-det", c.dettaglio));
      row.appendChild(mid);
      row.appendChild(el("div", "rc-rank-score", c.punteggio));
      host.appendChild(row);
    });
    host.appendChild(el("p", "tv-meta", "Punteggio calcolato dal motore dove esiste una formula (EHP, cura/giorno, AoE, " +
      "ft/round, danno/slot) o su rubrica con pesi dichiarati per i ruoli qualitativi."));
    host.appendChild(fontiHtml(r.fonti));
  }

  function viewCombo(host) {
    host.textContent = "";
    var ctrl = el("div", "rc-ctrl");
    var ls = el("select", "rc-select");
    ["Tutte", "RAW", "TABLE-DEPENDENT", "LEGACY-REQUIRED", "MYTH (illegale)", "RAW (interpretazione stretta)"].forEach(function (v) {
      var o = el("option", null, v); o.value = v; ls.appendChild(o);
    });
    ls.value = leg;
    ls.addEventListener("change", function () { leg = ls.value; viewCombo(host); });
    var cs = el("select", "rc-select");
    var cats = ["Tutte"]; DATA.combo.forEach(function (c) { if (cats.indexOf(c.categoria) < 0) cats.push(c.categoria); });
    cats.forEach(function (v) { var o = el("option", null, v); o.value = v; cs.appendChild(o); });
    cs.value = cat;
    cs.addEventListener("change", function () { cat = cs.value; viewCombo(host); });
    ctrl.appendChild(el("label", "dl", "Legalità")); ctrl.appendChild(ls);
    ctrl.appendChild(el("label", "dl", "Categoria")); ctrl.appendChild(cs);
    host.appendChild(ctrl);

    var rows = DATA.combo.filter(function (c) {
      return (leg === "Tutte" || c.legalita === leg) && (cat === "Tutte" || c.categoria === cat);
    }).sort(function (a, b) { return (b.dpr_delta || 0) - (a.dpr_delta || 0); });
    host.appendChild(el("p", "tv-meta", rows.length + " combo · frontiera di Pareto: " + DATA.sintesi.stack.join(" + ") +
      " → +" + DATA.sintesi.stack_dpr + " DPR cumulati senza conflitti di risorsa."));
    var t = el("table", "rc-table");
    var thead = el("thead"), tr = el("tr");
    ["ID", "Combo", "ΔDPR", "RPN", "Legalità"].forEach(function (h) { tr.appendChild(el("th", null, h)); });
    thead.appendChild(tr); t.appendChild(thead);
    var tb = el("tbody");
    rows.forEach(function (c) {
      var r = el("tr");
      r.appendChild(el("td", "rc-note", c.id));
      r.appendChild(el("td", null, c.nome + (c.frontiera ? '  <span class="emoji-icona emoji-frontiera" role="img" aria-label="frontiera"></span>' : "")));
      r.appendChild(el("td", null, c.dpr_delta ? "+" + c.dpr_delta.toFixed(0) : "—"));
      r.appendChild(el("td", null, c.rpn));
      var td = el("td"); td.appendChild(badge(c.legalita.replace(" (illegale)", "").replace("-DEPENDENT", "").replace("-REQUIRED", "")));
      r.appendChild(td);
      tb.appendChild(r);
      var det = el("tr", "rc-detrow");
      var dtd = el("td"); dtd.colSpan = 5;
      dtd.appendChild(el("div", "rc-rank-det", c.effetto + "  ·  base regolistica: " + c.base));
      dtd.appendChild(fontiHtml(c.fonti));
      det.appendChild(dtd); tb.appendChild(det);
    });
    t.appendChild(tb);
    host.appendChild(t);
    var fg = forgeHtml(); if (fg) host.appendChild(fg);
  }

  function viewOneShot(host) {
    host.textContent = "";
    host.appendChild(el("p", "tv-meta", "Danno medio del SINGOLO colpo (una prova di attacco, una istanza di danno), " +
      "con specie, talenti e oggetti magici come potenziatori. Il critico non è incluso nella colonna «colpo»."));
    var t = el("table", "rc-table");
    var thead = el("thead"), tr = el("tr");
    ["#", "Configurazione", "Colpo", "Critico", "Setup"].forEach(function (h) { tr.appendChild(el("th", null, h)); });
    thead.appendChild(tr); t.appendChild(thead);
    var tb = el("tbody");
    DATA.one_shot.forEach(function (o, i) {
      var r = el("tr");
      if (i === 0) r.className = "rc-top";
      [String(i + 1), o.nome, o.colpo.toFixed(1), o.critico.toFixed(1), o.setup].forEach(function (c, ci) {
        r.appendChild(el("td", ci === 4 ? "rc-note" : null, c));
      });
      tb.appendChild(r);
    });
    t.appendChild(tb);
    host.appendChild(t);
    host.appendChild(fontiHtml((DATA.one_shot[0] || {}).fonti));
  }

  function render() {
    var host = document.getElementById("rc-view");
    if (!host || !DATA) return;
    host.textContent = "";
    if (tab === "build") viewBuild(host);
    else if (tab === "ruoli") viewRuoli(host);
    else if (tab === "combo") viewCombo(host);
    else viewOneShot(host);
    var tabs = document.querySelectorAll(".rc-tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].className = "rc-tab" + (tabs[i].getAttribute("data-tab") === tab ? " on" : "");
    }
  }

  function init() {
    var host = document.getElementById("rc-view");
    if (!host) return;
    var tabs = document.querySelectorAll(".rc-tab");
    for (var i = 0; i < tabs.length; i++) {
      (function (b) {
        b.addEventListener("click", function () { tab = b.getAttribute("data-tab"); render(); });
      })(tabs[i]);
    }
    fetch("data/ricerca-2024.json", { cache: "no-cache" })
      .then(function (r) { return r.json(); })
      .then(function (j) { DATA = j; render(); })
      .catch(function () { host.appendChild(el("p", "tv-meta", "Dati di ricerca non disponibili in questo momento.")); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

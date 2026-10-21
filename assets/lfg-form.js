/* ==========================================================================
   lfg-form.js — Candidatura per sessioni (LFG), 100% client-side e offline.
   Inlinato in lfg.html da build_site.py/build_lfg().

   Nessun backend: i dati restano nel browser (localStorage) e l'utente può
   copiare il riepilogo o aprirlo nel proprio client di posta. Sicurezza: i valori
   inseriti NON vanno mai in innerHTML — il riepilogo usa textContent e un
   escaping esplicito dove serve markup.
   ========================================================================== */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var KEY = "lfg_submissions_v1";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readSaved() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]") || []; } catch (e) { return []; }
  }
  function writeSaved(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 5))); } catch (e) { /* storage negato */ }
  }

  function checkedValues(name) {
    return Array.prototype.slice.call(document.querySelectorAll('input[name="' + name + '"]:checked'))
      .map(function (el) { return el.value; });
  }

  function val(id) {
    var el = $(id);
    return el ? String(el.value || "").trim() : "";
  }

  function collect() {
    var inPresenza = (document.querySelector('input[name="formato"]:checked') || {}).value === "presenza";
    return {
      nome: val("lfg-nome"),
      contatto: val("lfg-contatto"),
      esperienza: val("lfg-esperienza"),
      ruolo: val("lfg-ruolo"),
      sistemi: checkedValues("sistemi"),
      frequenza: val("lfg-frequenza"),
      formato: (document.querySelector('input[name="formato"]:checked') || {}).value || "",
      citta: val("lfg-citta"),
      note: val("lfg-note"),
      consenso: !!(document.querySelector("#lfg-consenso") || {}).checked,
      quando: new Date().toLocaleString("it-IT"),
      richiedeCitta: inPresenza
    };
  }

  function validate(d) {
    var errs = [];
    if (d.nome.length < 2 || d.nome.length > 40) errs.push(["lfg-nome", "Inserisci un nome o handle (2-40 caratteri)."]);
    var c = d.contatto;
    var isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c);
    var isDiscord = /^[A-Za-z0-9._#-]{3,40}$/.test(c);
    if (!isEmail && !isDiscord) errs.push(["lfg-contatto", "Serve un'email valida oppure un handle Discord (es. nome#1234)."]);
    if (!d.esperienza) errs.push(["lfg-esperienza", "Seleziona il tuo livello di esperienza."]);
    if (!d.ruolo) errs.push(["lfg-ruolo", "Indica se giochi, masteri o entrambi."]);
    if (!d.sistemi.length) errs.push(["lfg-sistemi", "Scegli almeno un sistema di gioco."]);
    if (!d.frequenza) errs.push(["lfg-frequenza", "Indica la frequenza che cerchi."]);
    if (!d.formato) errs.push(["lfg-formato", "Indica online, in presenza o entrambi."]);
    if (d.richiedeCitta && d.citta.length < 2) errs.push(["lfg-citta", "Per le sessioni in presenza serve la città o la zona."]);
    if (!d.consenso) errs.push(["lfg-consenso", "Conferma di aver letto l'informativa sui dati."]);
    if (d.note.length > 600) errs.push(["lfg-note", "Le note non possono superare 600 caratteri."]);
    return errs;
  }

  function clearErrors() {
    document.querySelectorAll(".at-error").forEach(function (e) { e.textContent = ""; });
    document.querySelectorAll("[aria-invalid]").forEach(function (e) { e.removeAttribute("aria-invalid"); });
    var box = $("lfg-errors");
    if (box) { box.hidden = true; box.innerHTML = ""; }
  }

  function showErrors(errs) {
    var box = $("lfg-errors");
    errs.forEach(function (pair) {
      var id = pair[0], msg = pair[1];
      var field = $(id);
      var slot = document.querySelector('.at-error[data-for="' + id + '"]');
      if (slot) slot.textContent = msg;
      if (field) {
        var target = (field.type === "checkbox" || field.type === "radio") ? field : field;
        if (target.setAttribute) target.setAttribute("aria-invalid", "true");
      }
    });
    if (box) {
      box.hidden = false;
      box.innerHTML = "<strong>" + errs.length + " campi da correggere</strong><ul>" +
        errs.map(function (p) { return "<li>" + esc(p[1]) + "</li>"; }).join("") + "</ul>";
    }
    var first = errs[0] && $(errs[0][0]);
    if (first && first.focus) first.focus();
  }

  function summaryText(d) {
    return [
      "Candidatura sessione D&D (LFG)",
      "Nome: " + d.nome,
      "Contatto: " + d.contatto,
      "Esperienza: " + d.esperienza,
      "Ruolo: " + d.ruolo,
      "Sistemi: " + d.sistemi.join(", "),
      "Frequenza: " + d.frequenza,
      "Formato: " + (d.formato === "presenza" ? "In presenza" : (d.formato === "online" ? "Online" : "Entrambi")),
      d.citta ? "Città/zona: " + d.citta : "",
      d.note ? "Note: " + d.note : "",
      "Salvata il: " + d.quando
    ].filter(Boolean).join("\n");
  }

  function renderSaved() {
    var box = $("lfg-saved");
    if (!box) return;
    var list = readSaved();
    if (!list.length) { box.textContent = "Nessuna candidatura salvata in questo browser."; return; }
    box.innerHTML = "<strong>Candidature salvate in questo browser (" + list.length + ")</strong><ul>" +
      list.map(function (s, i) {
        return '<li><span>' + esc(s.nome) + " — " + esc(s.ruolo || "") + " · " + esc(s.quando) +
          '</span><button type="button" class="btn" data-del="' + i + '">Elimina</button></li>';
      }).join("") + "</ul>";
    box.querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        var l = readSaved();
        l.splice(parseInt(b.dataset.del, 10), 1);
        writeSaved(l);
        renderSaved();
      });
    });
  }

  function init() {
    var form = $("lfg-form");
    if (!form) return;

    // "in presenza" rende obbligatoria la città
    var radios = document.querySelectorAll('input[name="formato"]');
    Array.prototype.forEach.call(radios, function (r) {
      r.addEventListener("change", function () {
        var req = (document.querySelector('input[name="formato"]:checked') || {}).value === "presenza";
        var hint = $("lfg-citta-hint");
        var star = document.querySelector('[data-req-for="lfg-citta"]');
        if (hint) hint.textContent = req ? "obbligatoria per le sessioni in presenza" : "facoltativa";
        if (star) star.textContent = req ? "*" : "";
      });
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      clearErrors();
      var d = collect();
      var errs = validate(d);
      if (errs.length) { showErrors(errs); return; }
      var list = readSaved();
      list.unshift(d);
      writeSaved(list);
      renderSaved();
      var out = $("lfg-out");
      if (out) {
        out.hidden = false;
        var pre = document.createElement("pre");
        pre.textContent = summaryText(d);   // textContent: nessun markup dall'input utente
        out.innerHTML = "<h4>Candidatura salvata</h4>";
        out.appendChild(pre);
      }
      var ok = $("lfg-ok");
      if (ok) { ok.hidden = false; ok.textContent = "Candidatura salvata in questo browser. Copiala o inviala via email."; }
    });

    var copy = $("lfg-copy");
    if (copy) copy.addEventListener("click", function () {
      var d = collect();
      var errs = validate(d);
      if (errs.length) { showErrors(errs); return; }
      var text = summaryText(d);
      var done = function () { var ok = $("lfg-ok"); if (ok) { ok.hidden = false; ok.textContent = "Riepilogo copiato negli appunti."; } };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
      } else { fallbackCopy(text, done); }
    });

    var mail = $("lfg-mail");
    if (mail) mail.addEventListener("click", function () {
      var d = collect();
      var errs = validate(d);
      if (errs.length) { showErrors(errs); return; }
      var subject = encodeURIComponent("Candidatura sessione D&D (LFG) — " + d.nome);
      var body = encodeURIComponent(summaryText(d));
      window.location.href = "mailto:?subject=" + subject + "&body=" + body;
    });

    var reset = $("lfg-reset");
    if (reset) reset.addEventListener("click", function () {
      form.reset(); clearErrors(); renderSaved();
      var out = $("lfg-out"); if (out) { out.hidden = true; out.innerHTML = ""; }
      var ok = $("lfg-ok"); if (ok) ok.hidden = true;
    });

    renderSaved();
  }

  function fallbackCopy(text, cb) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.left = "-9999px";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      cb();
    } catch (e) { /* copia non disponibile: il riepilogo resta visibile */ }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

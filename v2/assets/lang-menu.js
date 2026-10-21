/* lang-menu.js — menu della lingua disegnato NELLA PAGINA.
 *
 * Perche' esiste: un <select> apre una tendina disegnata dal sistema operativo, fuori
 * dal DOM; a schermo intero puo' comparire fuori dalla finestra, e nessun test della
 * pagina puo' rilevarlo. Qui il menu e' un elemento della pagina: resta dentro per
 * costruzione.
 *
 * Come: il <select> originale resta nel DOM e continua a funzionare (il motore di
 * traduzione lo popola e ne ascolta il `change`), ma viene nascosto. Questo menu ne
 * rispecchia le opzioni e, al clic, scrive il valore e genera `change`: il motore
 * riceve cio' che riceveva prima.
 */
(function () {
  "use strict";

  function el(id) { return document.getElementById(id); }

  function avvia() {
    var sel = el("tr-lang");
    var box = el("tr-lang-wrap");
    if (!sel || !box || el("tr-lang-btn")) return;

    // Il motore popola le opzioni al suo init: si attende che ci siano.
    if (!sel.options || sel.options.length < 2) { return setTimeout(avvia, 120); }

    // Il controllo nativo esce dal percorso di Tab: la tastiera la gestisce
    // questo menu, e due controlli per la stessa cosa confondono chi naviga.
    sel.tabIndex = -1;
    sel.setAttribute("aria-hidden", "true");

    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "tr-lang-btn";
    btn.className = "tr-lang-btn";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Lingua / Language");

    var pannello = document.createElement("ul");
    pannello.id = "tr-lang-list";
    pannello.className = "tr-lang-list";
    pannello.setAttribute("role", "listbox");
    pannello.setAttribute("aria-label", "Lingua / Language");
    pannello.hidden = true;

    function etichettaCorrente() {
      var i = sel.selectedIndex >= 0 ? sel.selectedIndex : 0;
      var o = sel.options[i];
      return o ? o.textContent : "Italiano";
    }

    function sincronizza() {
      btn.textContent = etichettaCorrente();
      Array.prototype.forEach.call(pannello.children, function (li) {
        li.setAttribute("aria-selected", li.dataset.code === sel.value ? "true" : "false");
        li.classList.toggle("sel", li.dataset.code === sel.value);
      });
    }

    Array.prototype.forEach.call(sel.options, function (o) {
      var li = document.createElement("li");
      li.setAttribute("role", "option");
      li.dataset.code = o.value;
      li.textContent = o.textContent;
      li.tabIndex = -1;
      li.addEventListener("click", function () { scegli(o.value); });
      pannello.appendChild(li);
    });

    function scegli(codice) {
      sel.value = codice;
      // l'evento che il motore di traduzione gia' ascolta
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      chiudi();
      btn.focus();
    }

    function apri() {
      pannello.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      document.addEventListener("keydown", tastiera);
      document.addEventListener("click", fuori, true);
      sincronizza();
    }

    function chiudi() {
      pannello.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      document.removeEventListener("keydown", tastiera);
      document.removeEventListener("click", fuori, true);
    }

    function fuori(ev) { if (!box.contains(ev.target)) { chiudi(); } }

    function tastiera(ev) {
      var voci = Array.prototype.slice.call(pannello.children);
      var i = voci.indexOf(document.activeElement);
      if (ev.key === "Escape") { chiudi(); btn.focus(); }
      else if (ev.key === "ArrowDown") { ev.preventDefault(); (voci[i + 1] || voci[0]).focus(); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); (voci[i - 1] || voci[voci.length - 1]).focus(); }
      else if (ev.key === "Enter" || ev.key === " ") {
        if (i >= 0) { ev.preventDefault(); scegli(voci[i].dataset.code); }
        else { ev.preventDefault(); apri(); voci[0].focus(); }
      }
    }

    btn.addEventListener("click", function () { pannello.hidden ? apri() : chiudi(); });
    btn.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown" || ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault(); apri();
        if (pannello.children[0]) { pannello.children[0].focus(); }
      }
    });

    box.appendChild(btn);
    box.appendChild(pannello);
    sincronizza();

    // Il motore cambia la lingua anche da altrove (pulsante IT, avvio): si segue.
    ["change", "input"].forEach(function (t) { sel.addEventListener(t, sincronizza); });
    var osserva = function () { sincronizza(); setTimeout(osserva, 1500); };
    setTimeout(osserva, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", avvia);
  } else {
    avvia();
  }
})();

/* nav-menu.js — pannello di navigazione SENZA spostare i nodi.
 *
 * LEZIONE (misurata con l'OCR di una mia schermata): la versione precedente spostava
 * `.nav-links` DENTRO un pannello `hidden`. Sopra la soglia il pulsante e' nascosto,
 * quindi il pannello non si apriva mai e i link restavano invisibili a qualunque
 * larghezza — l'header appariva vuoto.
 * Qui non si sposta nulla: il pulsante commuta una CLASSE sul contenitore e il CSS
 * dispone i link. Nessuno stato nascosto puo' nasconderli.
 */
(function () {
  "use strict";
  function el(id) { return document.getElementById(id); }

  function avvia() {
    var nav = document.querySelector('header nav') || document.querySelector('nav');
    if (!nav || el('nav-toggle')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'nav-toggle';
    btn.className = 'nav-toggle';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'nav-links');
    btn.setAttribute('aria-label', 'Apri il menu di navigazione');
    // innerHTML con LETTERALE COSTANTE (tre barre): nessun dato utente, niente XSS.
    btn.innerHTML = '<span class="nav-toggle-bar"></span>' +
                    '<span class="nav-toggle-bar"></span>' +
                    '<span class="nav-toggle-bar"></span>';

    var lista = document.querySelector('.nav-links');
    if (lista && !lista.id) { lista.id = 'nav-links'; }

    nav.classList.add('nav-pronta');
    nav.insertBefore(btn, nav.firstChild);

    function apri() {
      nav.classList.add('nav-open');
      btn.setAttribute('aria-expanded', 'true');
      document.addEventListener('keydown', tasti);
      document.addEventListener('click', fuori, true);
    }
    function chiudi() {
      nav.classList.remove('nav-open');
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', tasti);
      document.removeEventListener('click', fuori, true);
    }
    function fuori(ev) { if (!nav.contains(ev.target)) { chiudi(); } }
    function tasti(ev) { if (ev.key === 'Escape') { chiudi(); btn.focus(); } }

    btn.addEventListener('click', function () {
      nav.classList.contains('nav-open') ? chiudi() : apri();
    });

    // Se la finestra si allarga oltre la soglia, il pannello si chiude: i link sono
    // in riga e non serve piu' lo stato aperto.
    var mq = window.matchMedia('(min-width: 1101px)');
    var adatta = function () { if (mq.matches) { chiudi(); } };
    if (mq.addEventListener) { mq.addEventListener('change', adatta); }
    else if (mq.addListener) { mq.addListener(adatta); }
    adatta();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', avvia);
  } else {
    avvia();
  }
})();

# -*- coding: utf-8 -*-
"""wiki_fr.py — arricchimento dalle descrizioni di Forgotten Realms Wiki.

CONTRATTO VERIFICATO (non presunto)
  Endpoint : https://forgottenrealms.fandom.com/api.php
  Estrazione: action=parse&page=<titolo>&prop=wikitext&format=json&origin=*
    * `origin=*` è OBBLIGATORIO per il CORS anonimo: senza, il browser blocca la
      risposta. Verificato: HTTP 200 con `Access-Control-Allow-Origin: *`.
    * `api/v1/Articles/Details` risponde 403: non usabile.
    * `prop=extracts` (TextExtracts) restituisce un estratto VUOTO: non usabile.
    * `section=0` è il template dell'infobox (25 caratteri utili): non usabile.
  Quindi si scarica il wikitext completo (14 KB per Aboleth) e lo si ripulisce.

LIMITI DICHIARATI
  * I valori dentro i template (`{{SI|120|ft}}`) vengono rimossi: nella prosa può
    restare una lacuna del tipo «reaching in length and weighing up to ,».
    Preferibile a inventare un numero.
  * La licenza è CC BY-SA 3.0: l'attribuzione e il link all'articolo sono
    OBBLIGATORI e sono resi nel blocco, non solo nel codice.
  * La ricerca è per nome dell'entità: voci assenti o disambiguate non vengono
    indovinate, si dichiara «voce non disponibile».
"""
from __future__ import annotations

import json

API = "https://forgottenrealms.fandom.com/api.php"
ARTICLE_URL = "https://forgottenrealms.fandom.com/wiki/"

# Massimo di caratteri di prosa mostrati: la voce completa resta linkata.
MAX_CHARS = 1600

WIKI_JS = r"""
  /* ---------- ARRICCHIMENTO DA FORGOTTEN REALMS WIKI (CC BY-SA 3.0) ----------
   * Azione esplicita: una chiamata di rete per scheda, non un caricamento
   * automatico di tutte le voci. Risultato in cache in localStorage.
   * `origin=*` è necessario per il CORS anonimo di MediaWiki. */
  var WIKI_API = "https://forgottenrealms.fandom.com/api.php";
  var WIKI_URL = "https://forgottenrealms.fandom.com/wiki/";
  var WIKI_MAX = 1600;

  function wikiClean(t) {
    var s = String(t);
    s = s.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "").replace(/<ref[^>]*\/>/g, "");
    for (var i = 0; i < 4; i++) { s = s.replace(/\{\{[^{}]*\}\}/g, ""); }   // template
    s = s.replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, "");
    s = s.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1");                      // [[link|testo]]
    s = s.replace(/\[\[([^\]]*)\]\]/g, "$1");
    s = s.replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1");
    s = s.replace(/\[https?:\/\/\S+\]/g, "");
    s = s.replace(/'{2,3}/g, "");
    s = s.replace(/^=+\s*(.*?)\s*=+\s*$/gm, "$1");                          // intestazioni
    s = s.replace(/<[^>]+>/g, "");
    s = s.replace(/^\s*[|;].*$/gm, "");                                     // righe parametro
    s = s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
    return s.trim();
  }

  function wikiCacheKey(n) { return "dndhub_wiki_" + String(n).toLowerCase().replace(/[^a-z0-9]/g, "_"); }

  /* Scarica e ripulisce la voce. onOk({testo, sezioni, url}) oppure onErr(motivo). */
  function wikiFetch(name, onOk, onErr) {
    var key = wikiCacheKey(name);
    var hit = null;
    try { hit = localStorage.getItem(key); } catch (e) {}
    if (hit) {
      try { var o = JSON.parse(hit); onOk(o); return; } catch (e) { /* cache corrotta */ }
    }
    var u = WIKI_API + "?action=parse&page=" + encodeURIComponent(name) +
            "&prop=wikitext|sections&format=json&origin=*";
    fetch(u).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.parse) {
        var code = (d && d.error && d.error.code) || "";
        onErr(code === "missingtitle" ? "missing" : "error");
        return;
      }
      var testo = wikiClean(d.parse.wikitext && d.parse.wikitext["*"] ? d.parse.wikitext["*"] : "");
      var sezioni = (d.parse.sections || []).map(function (s) { return s.line; }).slice(0, 12);
      var out = { testo: testo.slice(0, WIKI_MAX), sezioni: sezioni, url: WIKI_URL + encodeURIComponent(name.replace(/ /g, "_")) };
      try { localStorage.setItem(key, JSON.stringify(out)); } catch (e) {}
      onOk(out);
    }).catch(function () { onErr("network"); });
  }

  /* Blocco wiki nella scheda: pulsante esplicito + contenitore + attribuzione. */
  function wikiBlock(e) {
    var nome = (e && e.n) ? e.n : "";
    if (!nome) return "";
    return '<div class="wiki-sec" data-wiki="' + escHtml(nome) + '">' +
      '<button type="button" class="wiki-btn" aria-expanded="false">' + L('wikiButton') + '</button>' +
      '<div class="wiki-out" hidden></div>' +
      '</div>';
  }

  document.addEventListener("click", function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest(".wiki-btn") : null;
    if (!btn) return;
    var sec = btn.closest(".wiki-sec");
    var nome = sec ? sec.getAttribute("data-wiki") : "";
    var out = sec ? sec.querySelector(".wiki-out") : null;
    if (!nome || !out) return;
    if (!out.hidden) {
      out.hidden = true;
      btn.textContent = L('wikiButton');
      btn.setAttribute("aria-expanded", "false");
      return;
    }
    btn.disabled = true;
    btn.textContent = L('loading');
    wikiFetch(nome,
      function (d) {
        var body = d.testo ? escHtml(d.testo) : "";
        // La voce è in inglese: si offre la stessa traduzione su richiesta usata per i
        // blocchi della fonte, riusando la macchina MT (convenzione id <uid>-src/-out).
        var mtW = "wiki" + Math.random().toString(36).slice(2, 9);
        out.innerHTML = '<h4 class="wiki-title">' + escHtml(nome) + ' — Forgotten Realms Wiki</h4>' +
          '<div class="mt-bar"><button type="button" class="mt-btn" data-mt="' + mtW +
          '" aria-expanded="false">' + L('translateIt') + '</button>' +
          '<span class="mt-note" id="' + mtW + '-note" hidden>' + L('autoTranslation') +
          ' &mdash; MyMemory, non verificata</span></div>' +
          '<div class="mt-out" id="' + mtW + '-out" hidden></div>' +
          '<p class="wiki-text" id="' + mtW + '-src">' + body.replace(/\n\n/g, "</p><p class=\"wiki-text\">") + '</p>' +
          '<p class="wiki-meta">' + L('wikiLicense') + ' &mdash; ' +
          '<a href="' + escHtml(d.url) + '" target="_blank" rel="noopener nofollow">' +
          L('wikiOpen') + '</a></p>';
        out.hidden = false;
        btn.disabled = false;
        btn.textContent = L('wikiHide');
        btn.setAttribute("aria-expanded", "true");
      },
      function (motivo) {
        btn.disabled = false;
        btn.textContent = L('wikiButton');
        var msg = (motivo === "missing") ? L('wikiMissing') : L('wikiError');
        out.innerHTML = '<p class="wiki-meta">' + escHtml(msg) + '</p>';
        out.hidden = false;
      }
    );
  });
"""


def js() -> str:
    """Runtime del blocco wiki, iniettato nello script condiviso."""
    return WIKI_JS

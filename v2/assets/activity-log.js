/* activity-log.js — logger diagnostico del sito (punto 0).
 * Registra: pageview, navigazioni soft, click su elementi interattivi, errori JS,
 * richieste fallite/4xx-5xx. Buffer circolare 600 voci in localStorage (gdr-log).
 * Lettura: window.GDRLog.dump() in console, oppure pannello con Ctrl+Alt+L
 * e bottone "Log debug" nel footer. Nessuna rete: tutto locale. */
(function () {

  "use strict";
  var MAX = 600;
  var buf = [];
  try { buf = JSON.parse(localStorage.getItem("gdr-log") || "[]"); } catch (e) { buf = []; }

  function log(kind, detail) {
    var e = { t: new Date().toISOString(), page: location.pathname.split("/").pop() || "/", kind: kind, d: detail || "" };
    e.d = String(e.d).slice(0, 300);
    buf.push(e);
    if (buf.length > MAX) buf = buf.slice(-MAX);
    try { localStorage.setItem("gdr-log", JSON.stringify(buf)); } catch (e2) {}
  }

  window.GDRLog = {
    log: log,
    dump: function () { return JSON.stringify(buf.slice(-200), null, 1); },
    clear: function () { buf = []; try { localStorage.removeItem("gdr-log"); } catch (e) {} log("log-clear", ""); }
  };

  /* errori JS */
  window.addEventListener("error", function (ev) {
    log("js-error", (ev.message || "") + " @ " + (ev.filename || "").split("/").pop() + ":" + (ev.lineno || ""));
  });
  window.addEventListener("unhandledrejection", function (ev) {
    log("promise-reject", String(ev.reason || "").slice(0, 200));
  });
  /* richieste fallite o >= 400 */
  var _of = window.fetch;
  if (_of) {
    window.fetch = function () {
      var url = String(arguments[0] && arguments[0].url || arguments[0] || "");
      return _of.apply(this, arguments).then(function (r) {
        if (r.status >= 400) log("http-" + r.status, url.slice(-120));
        return r;
      }, function (err) {
        log("fetch-fail", url.slice(-120) + " :: " + String(err && err.message || err).slice(0, 100));
        throw err;
      });
    };
  }
  /* pageview (anche soft-nav) */
  var lastPath = null;
  function pv() {
    var p = location.pathname.split("/").pop() || "/";
    if (p !== lastPath) { log("pageview", p + (location.search || "")); lastPath = p; }
  }
  pv();
  setInterval(pv, 400);
  /* click su elementi interattivi (delegato) */
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest && ev.target.closest("a,button,select,input,summary,.chip,.dice-btn,.cb-row,.ora-tab,.filter-chip,.tv-chip");
    if (!t) return;
    var label = (t.textContent || t.getAttribute("aria-label") || t.id || t.tagName || "").trim().slice(0, 60);
    log("click", "<" + t.tagName.toLowerCase() + (t.className ? "." + String(t.className).split(" ")[0] : "") + "> " + label);
  }, true);

  /* pannello: Ctrl+Alt+L o bottone footer */
  function panel() {
    var old = document.getElementById("gdr-log-panel");
    if (old) { old.remove(); return; }
    var d = document.createElement("div");
    d.id = "gdr-log-panel";
    d.style.cssText = "position:fixed;inset:4% 4%;z-index:99999;background:#12141a;border:1px solid rgba(201,162,39,.5);" +
      "border-radius:14px;padding:16px;color:#ece7dd;font:12px/1.5 monospace;overflow:auto;box-shadow:0 18px 60px rgba(0,0,0,.7);";
    var head = document.createElement("div");head.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;";head.innerHTML = "<b style=color:#c9a227>Log di debug (ultime " + Math.min(buf.length, 200) + " voci)</b>";var pre = document.createElement("pre");pre.style.cssText = "white-space:pre-wrap;margin:0;";pre.textContent = window.GDRLog.dump();d.appendChild(head); d.appendChild(pre);head.appendChild(d.querySelector("#gdr-log-dl")); head.appendChild(d.querySelector("#gdr-log-cl")); head.appendChild(d.querySelector("#gdr-log-xx"));
    document.body.appendChild(d);
    d.querySelector("#gdr-log-xx").onclick = function () { d.remove(); };
    d.querySelector("#gdr-log-cl").onclick = function () { window.GDRLog.clear(); d.remove(); panel(); };
    d.querySelector("#gdr-log-dl").onclick = function () {
      var blob = new Blob([JSON.stringify(buf, null, 1)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "gdr-debug-log.json";
      a.click();
    };
  }
  document.addEventListener("keydown", function (ev) {
    if (ev.ctrlKey && ev.altKey && (ev.key === "L" || ev.key === "l")) { ev.preventDefault(); panel(); }
  });
  function addFooterBtn() {
    var f = document.querySelector("footer");
    if (!f || document.getElementById("gdr-log-btn")) return;
    var b = document.createElement("button");
    b.id = "gdr-log-btn";
    b.textContent = "Log debug";
    b.style.cssText = "background:none;border:1px solid rgba(201,162,39,.35);color:#9aa1ab;border-radius:8px;padding:3px 10px;font:11px Georgia,serif;cursor:pointer;margin-left:10px;";
    b.onclick = panel;
    f.appendChild(b);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addFooterBtn);
  else addFooterBtn();
})();

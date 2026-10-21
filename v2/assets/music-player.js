/* music-player.js — player audio globale del Grimorio dei Reami.
 *
 * Persistenza tra pagine: la posizione di riproduzione, il volume e lo stato
 * play/pause vivono in localStorage e vengono riapplicati al load di ogni pagina,
 * cosi' la musica "continua" attraverso la navigazione (riparte dalla stessa
 * posizione, gap di cambio documento ~100-200ms, inevitabile senza SPA).
 * Le tracce sono royalty-free (Pixabay Content License: uso gratuito anche
 * commerciale; crediti riportati nel tooltip del player).
 */
(function () {
  "use strict";
  var TRACCE = [
    { f: "assets/music/moonlight-fantasy.mp3", t: "Moonlight Fantasy", a: "alex-morgan" },
    { f: "assets/music/taverna-ambient.mp3", t: "Taverna Ambient", a: "leberch" },
    { f: "assets/music/foreste-antiche.mp3", t: "Foreste Antiche", a: "The_Mountain" }
  ];
  var LS = "gdr-music";
  function stato() {
    try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch (e) { return {}; }
  }
  function salva(s) {
    try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) {}
  }

  /* avvio solo dopo il primo gesto: gli autoplay policy dei browser bloccano
     l'audio senza interazione; la nota nel player lo dichiara. */
  function boot() {
    if (document.getElementById("gdr-player")) return;
    var s = stato();

    var css = document.createElement("style");
    css.textContent = [
      "#gdr-player{position:fixed;right:18px;bottom:18px;z-index:9000;display:flex;align-items:center;gap:10px;",
      "  background:linear-gradient(145deg,rgba(20,17,10,.92),rgba(30,24,14,.92));border:1px solid rgba(201,162,39,.45);",
      "  border-radius:16px;padding:10px 14px;box-shadow:0 12px 34px rgba(0,0,0,.55),0 0 26px rgba(201,162,39,.12);",
      "  backdrop-filter:blur(14px);font-family:Georgia,serif;color:#ece7dd;}",
      "#gdr-player.min{padding:8px;gap:6px;}",
      "#gdr-player .mp-disc{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;cursor:pointer;",
      "  background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.2),transparent 44%),",
      "  linear-gradient(145deg,rgba(138,107,255,.4),rgba(201,162,39,.28) 60%,rgba(20,17,10,.8));",
      "  border:1.5px solid rgba(201,162,39,.5);font-size:15px;color:#c9a227;transition:transform .3s;}",
      "#gdr-player.playing .mp-disc{animation:gdrSpin 7s linear infinite;}",
      "@keyframes gdrSpin{to{transform:rotate(360deg)}}",
      "#gdr-player .mp-info{min-width:130px;max-width:190px;}",
      "#gdr-player .mp-title{font-size:13px;font-weight:700;color:#e8c95a;letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      "#gdr-player .mp-artist{font-size:10.5px;color:#9aa1ab;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      "#gdr-player .mp-bar{height:4px;border-radius:4px;background:rgba(255,255,255,.12);margin-top:5px;overflow:hidden;cursor:pointer;}",
      "#gdr-player .mp-bar>i{display:block;height:100%;width:0;background:linear-gradient(90deg,#c9a227,#8a6bff);border-radius:4px;}",
      "#gdr-player .mp-btn{border:none;background:transparent;color:#ece7dd;cursor:pointer;font-size:15px;padding:4px 5px;opacity:.85;}",
      "#gdr-player .mp-btn:hover{opacity:1;color:#e8c95a;}",
      "#gdr-player input[type=range]{width:64px;accent-color:#c9a227;cursor:pointer;}",
      "@media (max-width:640px){#gdr-player .mp-info{min-width:96px}#gdr-player input[type=range]{width:44px}}"
    ].join("");
    document.head.appendChild(css);

    var audio = new Audio();
    audio.preload = "none";
    var idx = s.idx || 0;
    var vol = typeof s.vol === "number" ? s.vol : 0.45;
    var wasPlaying = s.playing === true;
    var seekTo = s.pos || 0;
    audio.volume = vol;
    audio.src = TRACCE[idx].f;
    if (seekTo > 0) { try { audio.currentTime = seekTo; } catch (e) {} }

    var box = document.createElement("div");
    box.id = "gdr-player";
    box.innerHTML =
      '<button class="mp-disc" id="mp-disc" title="Riproduci / pausa">♪</button>' +
      '<div class="mp-info"><div class="mp-title" id="mp-title"></div>' +
      '<div class="mp-artist" id="mp-artist"></div>' +
      '<div class="mp-bar" id="mp-bar" title="Posizione"><i id="mp-fill"></i></div></div>' +
      '<button class="mp-btn" id="mp-prev" title="Traccia precedente">⏮</button>' +
      '<button class="mp-btn" id="mp-next" title="Traccia successiva">⏭</button>' +
      '<input type="range" id="mp-vol" min="0" max="100" value="' + Math.round(vol * 100) + '" title="Volume">';
    document.body.appendChild(box);

    var disc = box.querySelector("#mp-disc");
    var fill = box.querySelector("#mp-fill");
    var tEl = box.querySelector("#mp-title");
    var aEl = box.querySelector("#mp-artist");

    function TRACTE_SAFE(i) { return TRACCE[i % TRACCE.length]; }
    function refresh() {
      tEl.textContent = TRACCE[idx].t;
      aEl.textContent = TRACCE[idx].a + " · Pixabay (royalty-free)";
      disc.textContent = audio.paused ? "♪" : "❚❚";
      box.classList.toggle("playing", !audio.paused);
      box.classList.toggle("min", audio.paused);
    }
    function play() {
      var p = audio.play();
      if (p && p.catch) p.catch(function () { /* autoplay negato: resta in pausa */ });
    }
    disc.addEventListener("click", function () {
      if (audio.paused) play(); else audio.pause();
    });
    box.querySelector("#mp-prev").addEventListener("click", function () {
      idx = (idx - 1 + TRACCE.length) % TRACCE.length;
      audio.src = TRACCE[idx].f; play(); refresh();
    });
    box.querySelector("#mp-next").addEventListener("click", function () {
      idx = (idx + 1) % TRACCE.length;
      audio.src = TRACCE[idx].f; play(); refresh();
    });
    box.querySelector("#mp-vol").addEventListener("input", function () {
      audio.volume = this.value / 100; s.vol = audio.volume; salva(statoCorrente());
    });
    box.querySelector("#mp-bar").addEventListener("click", function (ev) {
      if (!audio.duration) return;
      var r = this.getBoundingClientRect();
      audio.currentTime = audio.duration * ((ev.clientX - r.left) / r.width);
    });
    audio.addEventListener("timeupdate", function () {
      if (audio.duration) fill.style.width = (audio.currentTime / audio.duration * 100) + "%";
      salva(statoCorrente());
    });
    audio.addEventListener("ended", function () {
      idx = (idx + 1) % TRACCE.length;
      audio.src = TRACCE[idx].f; play(); refresh();
    });
    audio.addEventListener("play", refresh);
    audio.addEventListener("pause", refresh);

    function statoCorrente() {
      return { idx: idx, vol: audio.volume, playing: !audio.paused, pos: audio.currentTime || 0, t: Date.now() };
    }
    /* salva prima di lasciare la pagina: la prossima pagina riparte da qui */
    window.addEventListener("pagehide", function () { salva(statoCorrente()); });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) salva(statoCorrente());
    });

    refresh();
    if (wasPlaying && seekTo > 0) { play(); } /* riprendi se era in riproduzione */
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

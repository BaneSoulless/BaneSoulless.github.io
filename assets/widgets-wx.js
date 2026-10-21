/* ==========================================================================
   widgets-wx.js — Meteo dei Signori del Tempo (Open-Meteo + fallback Faerûn)
   + Tavolo dei Dadi. Inlinato in widgets.html da build_site.py/build_widgets().
   Nessuna dipendenza, offline-first, tutti gli accessi al DOM sono guardati.
   Nota sicurezza: gli innerHTML usano SOLO la tabella WMO locale (stringhe
   statiche di questo file) e valori numerici arrotondati provenienti da
   Open-Meteo; nessun dato remoto non numerico entra nel markup. wx.place è
   una delle due costanti "Roma" / "la tua posizione".
   ========================================================================== */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);

  /* ---------------- Dati lore / traduzione meteo ---------------- */
  const WMO = {
    0: ["Cielo sereno", "Il volto di Amaunator splende senza veli su Faerûn."],
    1: ["Prevalentemente sereno", "Poche nubi vagano alte, sospinte dal respiro di Akadi."],
    2: ["Parzialmente nuvoloso", "Nubi e sole si alternano: il cielo non decide."],
    3: ["Coperto", "Un manto grigio copre Faerûn, umore dei Signori del Tempo."],
    45: ["Nebbia", "La nebbia sale dai fossati: chi viaggia va piano."],
    48: ["Nebbia gelida", "Nebbia e brina: le lanterne fanno poca luce."],
    51: ["Pioviggine debole", "Una pioggia sottile bagna le strade di ciottoli."],
    53: ["Pioviggine", "Pioggerella costante: il mantello resta umido."],
    55: ["Pioviggine intensa", "Pioviggine fitta: i sentieri si fanno fangosi."],
    56: ["Pioviggine gelata", "Gocce gelide: attenzione alle assi bagnate."],
    57: ["Pioviggine gelata intensa", "Pioggia che gela al suolo: passo corto e cauto."],
    61: ["Pioggia debole", "Pioggia leggera: buona per le messi, meno per i viaggi."],
    63: ["Pioggia", "Pioggia decisa: i corsi d'acqua si gonfiano."],
    65: ["Pioggia forte", "Pioggia battente: torrenti in piena e strade impraticabili."],
    66: ["Pioggia gelata", "Pioggia che gela: lastre di ghiaccio sui sentieri."],
    67: ["Pioggia gelata forte", "Tempesta di pioggia gelata: pericolo reale."],
    71: ["Neve debole", "Fiocchi radi scendono lenti sulle contrade."],
    73: ["Neve", "Neve costante: il paesaggio si fa bianco."],
    75: ["Neve forte", "Neve abbondante: i passi di montagna si chiudono."],
    77: ["Granelli di neve", "Neve granulosa e pungente sul viso."],
    80: ["Rovesci deboli", "Rovesci brevi e isolati."],
    81: ["Rovesci", "Rovesci frequenti: meglio cercare riparo."],
    82: ["Rovesci violenti", "Rovesci torrenziali improvvisi."],
    85: ["Rovesci di neve", "Rovesci di neve: visibilità ridotta."],
    86: ["Rovesci di neve forti", "Bufere di neve improvvise."],
    95: ["Temporale", "Tuoni sui cieli: Talos mostra il suo volto."],
    96: ["Temporale con grandine", "Temporale e grandine: le messi sono a rischio."],
    99: ["Temporale violento con grandine", "Tempesta furiosa: solo gli stolti restano all'aperto."]
  };
  const ICON = {
    0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 48: "🌫️",
    51: "🌦️", 53: "🌦️", 55: "🌦️", 56: "🌧️", 57: "🌧️",
    61: "🌧️", 63: "🌧️", 65: "🌧️", 66: "🌧️", 67: "🌧️",
    71: "❄️", 73: "❄️", 75: "❄️", 77: "🌨️",
    80: "🌦️", 81: "🌧️", 82: "⛈️", 85: "🌨️", 86: "🌨️",
    95: "⛈️", 96: "⛈️", 99: "⛈️"
  };
  const SEASON_WX = [
    { t: 4, label: "Inverno", codes: [3, 71, 73, 61, 45] },
    { t: 12, label: "Primavera", codes: [2, 61, 80, 3, 51] },
    { t: 24, label: "Estate", codes: [0, 1, 2, 95, 80] },
    { t: 14, label: "Autunno", codes: [3, 61, 63, 51, 45] }
  ];
  const WX_URL = (lat, lon) =>
    "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe%2FRome&forecast_days=3";

  const DAYS_PER_MONTH = 30;
  const DR_OFFSET = -534; // convenzione comune: 2026 -> 1492 DR (approssimazione dichiarata)

  /* ---------------- Data Faerûn (Harptos) ---------------- */
  function faerunDate() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const doy = Math.floor((now - start) / 86400000);
    const idx = (doy - 1) % 365;
    const mi = Math.min(11, Math.floor(idx / DAYS_PER_MONTH));
    const day = (idx % DAYS_PER_MONTH) + 1;
    const seasonIdx = Math.min(3, Math.floor(mi / 3));
    const months = (typeof MONTHS !== "undefined" && MONTHS) ? MONTHS : [];
    const name = months[mi] ? months[mi].name : "Mese " + (mi + 1);
    const fest = months[mi] && months[mi].festival_after ? months[mi].festival_after : null;
    return {
      mi: mi, day: day, name: name, festival: fest, seasonIdx: seasonIdx,
      season: SEASON_WX[seasonIdx].label, doy: doy, dr: now.getFullYear() + DR_OFFSET
    };
  }
  function moonPhase(day) {
    const ph = ["Luna nuova", "Falce crescente", "Primo quarto", "Gibbosa crescente",
                "Luna piena", "Gibbosa calante", "Ultimo quarto", "Falce calante"];
    return ph[Math.floor(((day - 1) % 30) / 30 * 8) % 8];
  }

  /* ---------------- Meteo ---------------- */
  const wx = { days: [], idx: 0, offline: false, place: "Roma", lat: 41.9028, lon: 12.4964, ts: null };

  function describe(code) {
    return WMO[code] || ["Condizioni ignote", "I Signori del Tempo tacciono su questo cielo."];
  }

  function wxFallback() {
    const fd = faerunDate();
    const s = SEASON_WX[fd.seasonIdx];
    let seed = (fd.doy * 2654435761) % 2147483647;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const out = [];
    for (let i = 0; i < 3; i++) {
      const code = s.codes[Math.floor(rnd() * s.codes.length)];
      const base = s.t + Math.round((rnd() - 0.5) * 8);
      out.push({
        label: i === 0 ? "Oggi" : (i === 1 ? "Domani" : "Dopodomani"),
        code: code, tmin: base - 4, tmax: base + 5, tcur: base
      });
    }
    wx.days = out;
    wx.offline = true;
    wx.ts = null;
  }

  async function wxFetch(lat, lon, place) {
    const badge = $("wx-badge");
    if (badge) { badge.textContent = "Aggiornamento…"; badge.className = "wx-badge"; }
    try {
      const r = await fetch(WX_URL(lat, lon), { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      const cur = j.current || {};
      const d = j.daily || {};
      wx.days = [0, 1, 2].map((i) => ({
        label: i === 0 ? "Oggi" : (i === 1 ? "Domani" : "Dopodomani"),
        code: (d.weather_code || [])[i],
        tmin: (d.temperature_2m_min || [])[i],
        tmax: (d.temperature_2m_max || [])[i],
        tcur: i === 0 ? cur.temperature_2m : null
      })).filter((x) => x.code !== undefined && x.code !== null);
      wx.lat = lat; wx.lon = lon; wx.place = place;
      wx.offline = false;
      wx.ts = new Date();
      wx.extra = {
        feel: cur.apparent_temperature, hum: cur.relative_humidity_2m,
        wind: cur.wind_speed_10m, precip: cur.precipitation
      };
      if (badge) { badge.textContent = "dati reali · Open-Meteo"; badge.className = "wx-badge"; }
    } catch (e) {
      wxFallback();
      if (badge) { badge.textContent = "modalità offline (procedurale)"; badge.className = "wx-badge off"; }
    }
    wxRender();
  }

  function wxRender() {
    const box = $("wx-now"), days = $("wx-days"), upd = $("wx-updated");
    if (!box) return;
    if (!wx.days.length) wxFallback();
    const fd = faerunDate();
    const cur = wx.days[wx.idx] || wx.days[0];
    const desc = describe(cur.code);
    const tempTxt = (cur.tcur !== null && cur.tcur !== undefined)
      ? Math.round(cur.tcur) + "°C"
      : Math.round((cur.tmax + cur.tmin) / 2) + "°C";
    const ex = wx.extra;
    box.innerHTML =
      '<div class="wx-head">' +
        '<span class="wx-temp">' + tempTxt + "</span>" +
        '<span style="font-size:30px">' + (ICON[cur.code] || "🌤️") + "</span>" +
        '<span class="wx-desc">' + desc[0] + " · " + wx.place + "</span>" +
      "</div>" +
      '<div class="wx-narr">' + desc[1] + "</div>" +
      '<div class="wx-meta">' + fd.day + " " + fd.name + " — " + fd.season +
        " · " + moonPhase(fd.day) + " · circa " + fd.dr + " DR" +
        (ex && ex.hum !== undefined ? " · umidità " + Math.round(ex.hum) + "%" : "") +
        (ex && ex.wind !== undefined ? " · vento " + Math.round(ex.wind) + " km/h" : "") +
        (fd.festival ? " · festival: " + fd.festival : "") +
      "</div>";
    if (days) {
      days.innerHTML = wx.days.map((d, i) =>
        '<div class="wx-day' + (i === wx.idx ? " act" : "") + '" data-i="' + i + '" role="button" tabindex="0" ' +
        'aria-label="' + d.label + ': ' + describe(d.code)[0] + '">' +
          '<div class="wd-name">' + d.label + "</div>" +
          '<div class="wd-ico">' + (ICON[d.code] || "🌤️") + "</div>" +
          '<div class="wd-t">' + Math.round(d.tmax) + "° / " + Math.round(d.tmin) + "°</div>" +
          '<div class="wd-sub">' + describe(d.code)[0] + "</div>" +
        "</div>"
      ).join("");
      days.querySelectorAll(".wx-day").forEach((el) => {
        const pick = () => { wx.idx = parseInt(el.dataset.i, 10); wxRender(); };
        el.addEventListener("click", pick);
        el.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(); }
        });
      });
    }
    if (upd) {
      upd.textContent = wx.ts
        ? "ultimo aggiornamento " + wx.ts.toLocaleTimeString("it-IT")
        : "previsto dalla stagione Harptos (nessuna rete)";
    }
  }

  function wxInit() {
    if (!$("wx-now")) return;
    const btnR = $("wx-refresh"), btnG = $("wx-geo");
    if (btnR) btnR.addEventListener("click", () => wxFetch(wx.lat, wx.lon, wx.place));
    if (btnG) btnG.addEventListener("click", () => {
      if (!navigator.geolocation) { wxFetch(wx.lat, wx.lon, wx.place); return; }
      btnG.disabled = true;
      navigator.geolocation.getCurrentPosition(
        (p) => { btnG.disabled = false; wxFetch(p.coords.latitude, p.coords.longitude, "la tua posizione"); },
        () => { btnG.disabled = false; wxFetch(wx.lat, wx.lon, wx.place); },
        { timeout: 8000, maximumAge: 600000 }
      );
    });
    wxFallback();   // immediato, offline-first
    wxRender();
    wxFetch(wx.lat, wx.lon, wx.place);  // poi tenta i dati reali
  }

  /* ---------------- Dadi ---------------- */
  const DICE = [4, 6, 8, 10, 12, 20, 100];
  const dice = { sel: 20, log: [] };

  function d(n) { return Math.floor(Math.random() * n) + 1; }

  function diceSyncMode() {
    // Vantaggio/svantaggio è meccanica del d20: su altri dadi la modalità va
    // disabilitata e riportata a "Normale", altrimenti l'etichetta dichiarava
    // "(vantaggio)" su un singolo tiro (difetto P5 dell'audit).
    const mode = $("dice-mode");
    const qty = $("dice-n");
    if (!mode) return;
    if (dice.sel === 20) {
      mode.disabled = false;
      mode.title = "";
      if (qty) qty.disabled = (mode.value !== "n");
    } else {
      mode.value = "n";
      mode.disabled = true;
      mode.title = "Vantaggio e svantaggio si applicano solo al d20";
      if (qty) qty.disabled = false;
    }
  }

  function diceRenderButtons() {
    const g = $("dice-grid");
    if (!g) return;
    g.innerHTML = DICE.map((n) =>
      '<button class="btn dice-btn' + (n === dice.sel ? " act" : "") + '" data-d="' + n + '" ' +
      'aria-label="Seleziona d' + n + '">d' + n + "</button>"
    ).join("");
    g.querySelectorAll(".dice-btn").forEach((b) => b.addEventListener("click", () => {
      dice.sel = parseInt(b.dataset.d, 10);
      diceRenderButtons();
      diceSyncMode();
    }));
  }

  function diceRoll() {
    const out = $("dice-out"), det = $("dice-detail"), logEl = $("dice-log");
    const n = Math.max(1, Math.min(20, parseInt(($("dice-n") || {}).value || "1", 10)));
    const mod = Math.max(-10, Math.min(10, parseInt(($("dice-mod") || {}).value || "0", 10)));
    const mode = ($("dice-mode") || {}).value || "n";
    let rolls = [], kept = 0;
    if (dice.sel === 20 && mode !== "n") {
      const a = d(20), b = d(20);
      rolls = [a, b];
      kept = mode === "adv" ? Math.max(a, b) : Math.min(a, b);
    } else {
      for (let i = 0; i < n; i++) rolls.push(d(dice.sel));
      kept = rolls.reduce((s, x) => s + x, 0);
    }
    const total = kept + mod;
    if (out) {
      out.textContent = total;
      out.classList.add("pop");
      setTimeout(() => out.classList.remove("pop"), 160);
    }
    if (det) {
      const modo = mode === "adv" ? " (vantaggio)" : (mode === "dis" ? " (svantaggio)" : "");
      det.textContent = "d" + dice.sel + modo + ": [" + rolls.join(", ") + "]" +
        (mod ? " " + (mod > 0 ? "+" : "") + mod : "") + " = " + total;
    }
    diceProb();
    const isCrit = dice.sel === 20 && (mode === "n" ? rolls[0] === 20 : kept === 20);
    const isFail = dice.sel === 20 && (mode === "n" ? rolls[0] === 1 : kept === 1);
    const entry = { txt: "d" + dice.sel + " → " + total + (isCrit ? "  critico!" : (isFail ? "  fallimento critico" : "")), crit: isCrit, fail: isFail };
    dice.log.unshift(entry);
    dice.log = dice.log.slice(0, 10);
    if (logEl) {
      logEl.innerHTML = dice.log.map((e) =>
        '<div class="' + (e.crit ? "crit" : (e.fail ? "fail" : "")) + '">' + e.txt + "</div>"
      ).join("");
    }
    return total;
  }


  function diceProb() {
    // Probabilita' esatta di NdM+X (convoluzione discretta, qualsiasi N<=20 M<=100 mod<=10).
    // Output: SVG bar chart + min/max/media/median (stile Anydice, offline, zero rete).
    var det = $("dice-detail");
    var box = $("dice-prob");
    if (!det || !box) return;
    var n = Math.max(1, Math.min(20, parseInt(($("dice-n") || {}).value || "1", 10)));
    var mod = Math.max(-10, Math.min(10, parseInt(($("dice-mod") || {}).value || "0", 10)));
    var m = dice.sel, mode = ($("dice-mode") || {}).value || "n";
    // distribuzione
    var dist = {};
    function bump(v, w) { dist[v] = (dist[v] || 0) + w; }
    if (m === 20 && mode !== "n") {
      // vantaggio / svantaggio: P(max=a) = (2a-1)/400, P(min=b) = (41-2b)/400
      for (var a = 1; a <= 20; a++) bump(a + mod, (2 * a - 1) / 400);
    } else {
      dist[mod] = 1;
      for (var r = 0; r < n; r++) {
        var next = {};
        for (var v in dist) for (var d2 = 1; d2 <= m; d2++) next[+v + d2] = (next[+v + d2] || 0) + dist[v] / m;
        dist = next;
      }
    }
    var vals = Object.keys(dist).map(Number).sort(function (a, b) { return a - b; });
    var lo = vals[0], hi = vals[vals.length - 1];
    var totalW = 0, sumW = 0, cum = 0, median = lo, best = lo, bestW = 0;
    var rows = [];
    for (var vi = 0; vi < vals.length; vi++) {
      var v = vals[vi], w = dist[v];
      totalW += w; sumW += v * w;
      rows.push([v, w]);
    }
    for (var ri = 0; ri < rows.length; ri++) {
      cum += rows[ri][1];
      if (cum >= totalW / 2 && median === lo) median = rows[ri][0];
      if (rows[ri][1] > bestW) { bestW = rows[ri][1]; best = rows[ri][0]; }
    }
    var mean = sumW / totalW;
    var maxW = Math.max.apply(null, rows.map(function (r) { return r[1]; }));
    // SVG bar chart
    var cw = Math.max(24, Math.floor(680 / rows.length));
    var H = 90, pad = 4;
    var bars = rows.map(function (r) {
      var h = Math.max(2, Math.round(r[1] / maxW * (H - 18)));
      var x = Math.round((r[0] - lo) * cw) + pad;
      var pct = (r[1] * 100).toFixed(r[1] * 100 < 1 ? 1 : 0);
      var isPeak = r[0] === best;
      return '<rect x="' + x + '" y="' + (H - 16 - h) + '" width="' + (cw - 2) + '" height="' + h +
        '" rx="2" fill="' + (isPeak ? "var(--gold)" : "rgba(255,255,255,.18)") + '"/>' +
        '<text x="' + (x + (cw - 2) / 2) + '" y="' + (H - 20 - h) + '" fill="var(--fg-muted)" font-size="9" text-anchor="middle">' + pct + '%</text>' +
        '<text x="' + (x + (cw - 2) / 2) + '" y="' + (H - 3) + '" fill="var(--fg-muted)" font-size="9" text-anchor="middle">' + r[0] + '</text>';
    }).join("");
    var label = n + "d" + m + (mod ? (mod > 0 ? "+" : "") + mod : "") + (m === 20 && mode !== "n" ? (mode === "adv" ? " (vant)" : " (svant)") : "");
    box.innerHTML =
      '<p class="dice-prob-title">Probabilit&agrave; &mdash; ' + label + ' (esatta)</p>' +
      '<svg viewBox="0 0 ' + Math.max(rows.length * cw + pad * 2, 200) + ' ' + H + '" role="img" aria-label="Distribuzione di probabilità">' + bars + '</svg>' +
      '<div class="dice-prob-meta">' +
        '<span>Min <strong>' + lo + '</strong></span>' +
        '<span>Max <strong>' + hi + '</strong></span>' +
        '<span>Media <strong>' + mean.toFixed(1) + '</strong></span>' +
        '<span>Mediana <strong>' + median + '</strong></span>' +
        '<span>Pi&ugrave; probabile <strong>' + best + '</strong> (' + (bestW * 100).toFixed(1) + '%)</span>' +
      '</div>';
  }

  function diceInit() {
    if (!$("dice-grid")) return;
    diceRenderButtons();
    const b = $("dice-roll");
    if (b) b.addEventListener("click", diceRoll);
    ["dice-n", "dice-mod", "dice-mode"].forEach(function (id) {
      var e2 = $(id); if (e2) e2.addEventListener("change", diceProb);
    });
    diceProb();
    const mode = $("dice-mode");
    if (mode) mode.addEventListener("change", diceSyncMode);
    diceSyncMode();
  }

  /* ---------------- Boot ---------------- */
  function boot() { wxInit(); diceInit(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

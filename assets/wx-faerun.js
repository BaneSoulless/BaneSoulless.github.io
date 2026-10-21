/* wx-faerun.js — meteo IN GIOCO del Faerûn (Forgotten Realms).
 *
 * DIREZIONE DEL RAGIONAMENTO (richiesta dell'operatore): si parte dalla CITTÀ DEL
 * FAERÛN, si vede il suo meteo in gioco, e la città reale è il mezzo tecnico per
 * ottenerlo. Prima era il contrario (meteo reale → «gemello» di Faerûn).
 *
 * COME SI SCEGLIE LA CITTÀ REALE (volta per volta, non fissa)
 *   1. distanza di profilo:  d = |T_faerûn − T_reale| + 2.5·|W_faerûn − W_reale|
 *      (T = media annua misurata, W = classe di umidità 0–4 sulla stessa scala);
 *   2. si prendono le 4 candidate migliori e si chiedono le condizioni ATTUALI in
 *      UNA sola chiamata (Open-Meteo accetta più coordinate);
 *   3. tra quelle si sceglie la più «tipica della stagione» corrente:
 *      d + 0.6·|T_attuale − (T_media + scarto_stagionale)|.
 *   Ne segue che la città scelta CAMBIA con le condizioni e con la stagione, e
 *   l'affinità mostrata si aggiorna di conseguenza — come richiesto.
 *
 * DATI (tutti verificabili, nessun valore inventato)
 *   data/faerun-cities.json : profilo climatico dei Reami (valutazione dichiarata)
 *   data/real-cities.json   : norme climatiche MISURATE (Open-Meteo Archive 2024)
 *   meteo attuale           : api.open-meteo.com (CC BY 4.0)
 *
 * SENZA RETE: stima stagionale deterministica dal profilo dei Reami, dichiarata
 * come tale nel badge (nessun dato spacciato per osservato).
 */
(function () {
  "use strict";

  var FAERUN_URL = "data/faerun-cities.json";
  var REAL_URL = "data/real-cities.json";
  var API = "https://api.open-meteo.com/v1/forecast";

  /* Codici WMO -> descrizione italiana + simbolo (tabella ufficiale Open-Meteo). */
  var WMO = {
    0: ["Sereno", '<span class="emoji-icona emoji-wx-sereno" role="img" aria-label="Sereno"></span>'], 1: ["Prevalentemente sereno", '<span class="emoji-icona emoji-wx-poco" role="img" aria-label="Prevalentemente sereno"></span>'],
    2: ["Parzialmente nuvoloso", '<span class="emoji-icona emoji-wx-poco" role="img" aria-label="Parzialmente nuvoloso"></span>'], 3: ["Coperto", '<span class="emoji-icona emoji-wx-nuvoloso" role="img" aria-label="Coperto"></span>'],
    45: ["Nebbia", '<span class="emoji-icona emoji-wx-nebbia" role="img" aria-label="Nebbia"></span>'], 48: ["Nebbia gelata", '<span class="emoji-icona emoji-wx-nebbia" role="img" aria-label="Nebbia gelata"></span>'],
    51: ["Pioggerella debole", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Pioggerella debole"></span>'], 53: ["Pioggerella", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Pioggerella"></span>'],
    55: ["Pioggerella intensa", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Pioggerella intensa"></span>'], 56: ["Pioggerella gelata", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Pioggerella gelata"></span>'],
    57: ["Pioggerella gelata intensa", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Pioggerella gelata intensa"></span>'], 61: ["Pioggia debole", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Pioggia debole"></span>'],
    63: ["Pioggia", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Pioggia"></span>'], 65: ["Pioggia forte", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Pioggia forte"></span>'],
    66: ["Pioggia gelata", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Pioggia gelata"></span>'], 67: ["Pioggia gelata forte", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Pioggia gelata forte"></span>'],
    71: ["Neve debole", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Neve debole"></span>'], 73: ["Neve", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Neve"></span>'],
    75: ["Neve forte", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Neve forte"></span>'], 77: ["Granelli di neve", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Granelli di neve"></span>'],
    80: ["Rovesci deboli", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Rovesci deboli"></span>'], 81: ["Rovesci", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Rovesci"></span>'],
    82: ["Rovesci violenti", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Rovesci violenti"></span>'], 85: ["Rovesci di neve", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Rovesci di neve"></span>'],
    86: ["Rovesci di neve forti", '<span class="emoji-icona emoji-wx-pioggia" role="img" aria-label="Rovesci di neve forti"></span>'], 95: ["Temporale", '<span class="emoji-icona emoji-wx-nuvoloso" role="img" aria-label="Temporale"></span>'],
    96: ["Temporale con grandine", '<span class="emoji-icona emoji-wx-nuvoloso" role="img" aria-label="Temporale con grandine"></span>'], 99: ["Temporale con grandine forte", '<span class="emoji-icona emoji-wx-nuvoloso" role="img" aria-label="Temporale con grandine forte"></span>']
  };

  /* Scarti stagionali (°C rispetto alla media annua): servono solo a preferire la
     candidata più rappresentativa della stagione in corso. */
  var SEASON_DELTA = { Inverno: -7, Primavera: -1, Estate: 7, Autunno: -2 };

  /* Descrizioni d'autore per le regioni già documentate; le altre vengono
     descritte dai dati (intervallo di temperatura + classe di umidità). */
  var REGION_PROSE = {
    "Sword Coast North": "Temperato oceanico: estati miti e umide, inverni piovosi con neve sulle Colline; primavera fresca con piogge frequenti.",
    "The North": "Freddo continentale: inverni lunghi e nevosi, estati brevi e fresche; venti gelidi dal Mare Senza Stelle.",
    "Anauroch": "Arido estremo: giorni torridi, notti gelide; tempeste di sabbia stagionali a primavera.",
    "Western Heartlands": "Continuale temperato: quattro stagioni nette, estati calde e umide, inverni freddi con neve.",
    "Cormyr": "Temperato: inverni miti sulle coste del Dragonmere, estati calde; piogge autunnali abbondanti.",
    "Amn": "Mediterraneo caldo: estati secche e luminose, inverni miti e piovosi.",
    "Calimshan": "Desertico costiero: caldo tutto l'anno, brezza marina, piogge rare e concentrate.",
    "Tethyr": "Mediterraneo: estati calde e asciutte, inverni miti e umidi.",
    "Moonsea": "Continentale freddo: inverni rigidi, estati fresche, nebbie sul lago.",
    "Thay": "Steppa calda: estati torride e secche, inverni freddi; venti polverosi.",
    "Mulhorand": "Desertico: caldo estremo, escursione termica notturna marcata, piogge quasi assenti.",
    "Chult": "Tropicale monsonico: caldo umido perenne, piogge torrenziali, giungla e vapori.",
    "Lantan": "Tropicale marittimo: caldo umido, brezze oceaniche, uragani stagionali.",
    "Evermeet": "Oceanico insulare: mite tutto l'anno, piogge frequenti, nebbie magiche.",
    "Icewind Dale": "Subartico: gelo perenne, bufere, estate breve e fredda."
  };

  var fx = {
    faerun: null, real: null, city: null, pick: null,
    weather: null, offline: false, place: null
  };

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- calendario Harptos: stagione e data in gioco ----------
     Riusa FAERUN_SEASONS definito dal calendario del sito: UNA sola fonte di
     verità per le stagioni, così meteo e calendario non possono divergere. */
  function seasonOf(monthIdx) {
    var arr = (typeof window.FAERUN_SEASONS !== "undefined") ? window.FAERUN_SEASONS : null;
    if (!arr) return "\u2014";
    return arr[monthIdx] || "\u2014";
  }
  function harptosNow() {
    var d = new Date();
    var dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    var monthIdx = Math.min(11, Math.floor(dayOfYear / 30.42));
    var day = ((dayOfYear - 1) % 30) + 1;
    var names = ["Hammer", "Alturiak", "Ches", "Tarsakh", "Mirtul", "Kythorn", "Flamerule",
                 "Eleasias", "Eleint", "Marpenoth", "Uktar", "Nightal"];
    return { monthIdx: monthIdx, month: names[monthIdx], day: day, season: seasonOf(monthIdx) };
  }

  /* ---------- matching climatico ---------- */
  function profileDistance(f, r) {
    return Math.abs(f.temp_center - r.temp_center) + 2.5 * Math.abs((f.wetness || 0) - (r.wetness || 0));
  }
  function affinity(dist) { return Math.max(35, Math.min(100, Math.round(100 - dist * 3.2))); }

  function topCandidates(f, n) {
    return (fx.real || []).map(function (r) {
      return { r: r, d: profileDistance(f, r) };
    }).sort(function (a, b) { return a.d - b.d; }).slice(0, n);
  }

  /* Chiamata unica per più coordinate: Open-Meteo restituisce un array. */
  function fetchBatch(cands, cb, err) {
    var lat = cands.map(function (c) { return c.r.lat; }).join(",");
    var lon = cands.map(function (c) { return c.r.lon; }).join(",");
    var url = API + "?latitude=" + lat + "&longitude=" + lon +
      "&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,is_day" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=3&timezone=auto";
    var x = new XMLHttpRequest();
    x.open("GET", url, true);
    x.timeout = 12000;
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      if (x.status !== 200) { err("http " + x.status); return; }
      try {
        var d = JSON.parse(x.responseText);
        cb(Array.isArray(d) ? d : [d]);
      } catch (e) { err("parse"); }
    };
    x.ontimeout = function () { err("timeout"); };
    x.onerror = function () { err("network"); };
    x.send();
  }

  /* Sceglie la candidata più rappresentativa della stagione corrente. */
  function chooseBest(cands, rows, f, season) {
    var delta = SEASON_DELTA[season] || 0;
    var best = null;
    for (var i = 0; i < cands.length; i++) {
      var row = rows[i];
      var cur = row && row.current ? row.current.temperature_2m : null;
      var typical = (cur == null) ? 999 : Math.abs(cur - (cands[i].r.temp_center + delta));
      var score = cands[i].d + 0.6 * typical;
      if (!best || score < best.score) best = { cand: cands[i], row: row, score: score };
    }
    return best;
  }

  /* Stima stagionale deterministica (senza rete): dichiarata nel badge. */
  function estimate(f, season) {
    var delta = SEASON_DELTA[season] || 0;
    var t = Math.round(f.temp_center + delta);
    var code = f.wetness >= 4 ? 80 : (f.wetness === 0 ? 0 : 2);
    return {
      temp: t, code: code, wind: 8 + f.wetness * 3, hum: 35 + f.wetness * 12,
      days: null
    };
  }

  /* ---------- rendering ---------- */
  function render() {
    var box = el("fx-now");
    if (!box) return;
    var f = fx.city, w = fx.weather;
    if (!f || !w) return;
    var h = harptosNow();
    var desc = (WMO[w.code] || ["Condizioni variabili", '<span class="emoji-icona emoji-wx-nuvoloso" role="img" aria-label="Condizioni variabili"></span>'])[0];
    var sym = (WMO[w.code] || ["", '<span class="emoji-icona emoji-wx-nuvoloso" role="img" aria-label="condizione meteo variabile"></span>'])[1];
    var p = fx.pick;
    var aff = p ? affinity(p.cand.d) : null;

    var html = '<div class="fx-head">' +
      '<div class="fx-city"><span class="fx-name">' + esc(f.name) + '</span>' +
      '<span class="fx-region">' + esc(f.region) + (f.alias ? ' \u00b7 ' + esc(f.alias) : '') + '</span></div>' +
      '<div class="fx-temp"><span class="fx-sym">' + sym + '</span><span class="fx-deg">' + Math.round(w.temp) + '\u00b0C</span></div>' +
      '</div>' +
      '<p class="fx-cond">' + esc(desc) + ' \u00b7 vento ' + Math.round(w.wind) + ' km/h \u00b7 umidit\u00e0 ' + Math.round(w.hum) + '%</p>' +
      '<p class="fx-when">' + esc(h.day) + ' ' + esc(h.month) + ' \u00b7 ' + esc(h.season) +
      ' <span class="fx-sep">|</span> profilo climatico dei Reami: media ' + f.temp_center + '\u00b0C, ' +
      ['arido', 'secco', 'moderato', 'umido', 'monsonico'][f.wetness] + '</p>';

    if (f.lore) html += '<p class="fx-lore">' + esc(f.lore) + '</p>';
    if (f.fact) html += '<p class="fx-fact"><strong>Fatto verificato (Forgotten Realms Wiki):</strong> ' + esc(f.fact) + '</p>';

    box.innerHTML = html;

    /* previsione 3 giorni */
    var days = el("fx-days");
    if (days) {
      if (w.days && w.days.length) {
        days.innerHTML = w.days.map(function (d) {
          var dd = WMO[d.code] || ["", '<span class="emoji-icona emoji-wx-nuvoloso" role="img" aria-label="condizione meteo variabile"></span>'];
          return '<div class="fx-day"><span class="fx-day-name">' + esc(d.name) + '</span>' +
            '<span class="fx-day-sym">' + dd[1] + '</span>' +
            '<span class="fx-day-t">' + Math.round(d.max) + '\u00b0 / ' + Math.round(d.min) + '\u00b0</span>' +
            '<span class="fx-day-d">' + esc(dd[0]) + '</span></div>';
        }).join("");
      } else {
        days.innerHTML = '<p class="fx-meta">Previsione giornaliera non disponibile senza rete.</p>';
      }
    }

    /* provenienza: la città reale usata come sorgente dei dati */
    var prov = el("fx-prov");
    if (prov) {
      prov.innerHTML = p
        ? 'Meteo in gioco derivato dal gemello reale <strong>' + esc(p.cand.r.name) + '</strong> (' +
          esc(p.cand.r.country) + ') \u2014 affinit\u00e0 ' + aff + '% \u00b7 dati ' +
          (fx.offline ? 'stimati dalla stagione (senza rete)' : 'Open-Meteo, CC BY 4.0') +
          ' \u00b7 aggiornato ' + new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
        : '';
    }
    var badge = el("fx-badge");
    if (badge) {
      badge.textContent = fx.offline ? 'senza rete: stima stagionale' : 'dati reali';
      badge.className = "wx-badge" + (fx.offline ? " fx-badge-off" : "");
    }
  }

  function daysFrom(row) {
    if (!row || !row.daily || !row.daily.time) return null;
    var names = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
    return row.daily.time.slice(0, 3).map(function (iso, i) {
      var d = new Date(iso + "T12:00:00");
      return {
        name: names[d.getDay()], code: row.daily.weather_code[i],
        max: row.daily.temperature_2m_max[i], min: row.daily.temperature_2m_min[i]
      };
    });
  }

  /* Carica il meteo per la città selezionata (o una stima se la rete manca). */
  function load(name) {
    var f = null;
    for (var i = 0; i < fx.faerun.length; i++) { if (fx.faerun[i].name === name) { f = fx.faerun[i]; break; } }
    if (!f) return;
    fx.city = f;
    var h = harptosNow();
    var cands = topCandidates(f, 4);
    var badge = el("fx-badge");
    if (badge) badge.textContent = "interrogazione\u2026";

    fetchBatch(cands, function (rows) {
      var best = chooseBest(cands, rows, f, h.season);
      fx.pick = best;
      fx.offline = false;
      if (best && best.row && best.row.current) {
        fx.weather = {
          temp: best.row.current.temperature_2m,
          code: best.row.current.weather_code,
          wind: best.row.current.wind_speed_10m,
          hum: best.row.current.relative_humidity_2m,
          days: daysFrom(best.row)
        };
      } else {
        fx.offline = true;
        fx.weather = estimate(f, h.season);
      }
      render();
    }, function () {
      fx.offline = true;
      fx.weather = estimate(f, h.season);
      fx.pick = { cand: cands[0], d: cands[0].d };
      render();
    });
  }

  /* ---------- selezione della città (raggruppata per regione) ---------- */
  function fillSelect() {
    var sel = el("fx-city-pick");
    if (!sel) return;
    var byRegion = {};
    fx.faerun.forEach(function (c) {
      (byRegion[c.region] = byRegion[c.region] || []).push(c);
    });
    var html = "";
    Object.keys(byRegion).sort().forEach(function (reg) {
      html += '<optgroup label="' + esc(reg) + '">';
      byRegion[reg].sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (c) {
        html += '<option value="' + esc(c.name) + '">' + esc(c.name) + ' \u2014 media ' + c.temp_center + '\u00b0C</option>';
      });
      html += '</optgroup>';
    });
    sel.innerHTML = html;
    var def = (fx.meta && fx.meta.default_city) || fx.faerun[0].name;
    sel.value = def;
    sel.addEventListener("change", function () { load(sel.value); });
    load(def);
  }

  /* ---------- «usa la mia posizione»: il tuo equivalente nei Reami ----------
     Inverte utilmente il rapporto: dalla posizione reale si trova la città reale
     più vicina, e da quella la città del Faerûn climaticamente più affine. */
  function usePosition() {
    var btn = el("fx-geo");
    if (!navigator.geolocation) return;
    if (btn) { btn.disabled = true; btn.textContent = "localizzazione\u2026"; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude, lon = pos.coords.longitude;
      var near = null;
      fx.real.forEach(function (r) {
        var d = Math.pow(r.lat - lat, 2) + Math.pow(r.lon - lon, 2);
        if (!near || d < near.d) near = { r: r, d: d };
      });
      var mine = null;
      fx.faerun.forEach(function (c) {
        var d = profileDistance(c, near.r);
        if (!mine || d < mine.d) mine = { c: c, d: d };
      });
      if (btn) { btn.disabled = false; btn.textContent = "Usa la mia posizione"; }
      var sel = el("fx-city-pick");
      if (sel && mine) { sel.value = mine.c.name; }
      load(mine.c.name);
      var prov = el("fx-prov");
      if (prov) {
        prov.innerHTML = 'Dalla tua posizione: la città reale più vicina è <strong>' + esc(near.r.name) +
          '</strong> (' + esc(near.r.country) + '); nei Reami le corrisponde <strong>' + esc(mine.c.name) +
          '</strong> \u2014 affinit\u00e0 ' + affinity(mine.d) + '%.';
      }
    }, function () {
      if (btn) { btn.disabled = false; btn.textContent = "Usa la mia posizione"; }
    }, { timeout: 8000 });
  }

  /* ---------- clima per regione: TUTTE le regioni, dai dati ---------- */
  function renderRegions() {
    var box = el("fx-regions");
    if (!box) return;
    var byRegion = {};
    fx.faerun.forEach(function (c) { (byRegion[c.region] = byRegion[c.region] || []).push(c); });
    var sel = el("fx-region-pick");
    if (sel && !sel.dataset.filled) {
      var opts = '<option value="">Tutte le regioni (' + Object.keys(byRegion).length + ")</option>";
      Object.keys(byRegion).sort().forEach(function (r) { opts += '<option value="' + esc(r) + '">' + esc(r) + "</option>"; });
      sel.innerHTML = opts;
      sel.dataset.filled = "1";
      sel.addEventListener("change", function () { renderRegions(); });
    }
    var want = sel ? sel.value : "";
    var html = "";
    Object.keys(byRegion).sort().forEach(function (reg) {
      if (want && reg !== want) return;
      var cities = byRegion[reg];
      var temps = cities.map(function (c) { return c.temp_center; });
      var tmin = Math.min.apply(null, temps), tmax = Math.max.apply(null, temps);
      var wmax = Math.max.apply(null, cities.map(function (c) { return c.wetness; }));
      var wmin = Math.min.apply(null, cities.map(function (c) { return c.wetness; }));
      var wetLbl = ["arido", "secco", "moderato", "umido", "monsonico"];
      var wet = (wmin === wmax) ? wetLbl[wmin] : (wetLbl[wmin] + "\u2013" + wetLbl[wmax]);
      var prose = REGION_PROSE[reg] ||
        ("Profilo dai dati: media annua " + tmin + (tmin === tmax ? "" : "\u2013" + tmax) +
         " \u00b0C, umidit\u00e0 " + wet + ".");
      html += '<div class="fx-region-card"><h4>' + esc(reg) + '</h4>' +
        '<p class="fx-region-stats">media ' + tmin + (tmin === tmax ? "" : "\u2013" + tmax) + ' \u00b0C \u00b7 ' + wet + ' \u00b7 ' +
        cities.length + (cities.length === 1 ? " citt\u00e0" : " citt\u00e0") + '</p>' +
        '<p>' + esc(prose) + '</p>' +
        '<p class="fx-region-cities">' + cities.map(function (c) { return esc(c.name); }).join(" \u00b7 ") + '</p></div>';
    });
    box.innerHTML = html || '<p class="fx-meta">Nessuna regione selezionata.</p>';
  }

  /* ---------- avvio ---------- */
  function boot() {
    if (!el("fx-now")) return;                 // non è la pagina dei widget
    /* Il vecchio motore (widgets-wx.js) esce da solo senza #wx-now: qui si carica
       tutto l'occorrente e si riusa la sua tabella SEASONS, se presente. */
    var grab = function (url, cb) {
      var x = new XMLHttpRequest();
      x.open("GET", url, true);
      x.onreadystatechange = function () {
        if (x.readyState === 4 && x.status === 200) {
          try { cb(JSON.parse(x.responseText)); } catch (e) { cb(null); }
        }
      };
      x.send();
    };
    grab(FAERUN_URL, function (fd) {
      if (!fd) return;
      var cities = fd.cities || fd.items || fd;
      fx.meta = fd;
      fx.faerun = Array.isArray(cities) ? cities : Object.keys(cities).map(function (k) { return cities[k]; });
      grab(REAL_URL, function (rd) {
        fx.real = (rd && rd.cities) ? rd.cities : [];
        fillSelect();
        renderRegions();
        var g = el("fx-geo"); if (g) g.addEventListener("click", usePosition);
        var r = el("fx-refresh");
        if (r) r.addEventListener("click", function () { if (fx.city) load(fx.city.name); });
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

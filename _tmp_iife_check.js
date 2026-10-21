
/* cerca-app.js — Lookup D&D da 5e.tools (offline-first) + fallback SRD API.
 * Generato da build_site.py (build_cerca_app). Dataset: data/5etools/*, indicizzato in lookup-index.json.
 * Design: anti-slop (single accent), double-bezel, skeleton/circle, empty/error state, tabular-nums. */
(function () {
  "use strict";
  const SCHOOL_MAP = { V: "Evocation", N: "Necromancy", T: "Transmutation", E: "Enchantment", D: "Divination", C: "Conjuration", A: "Abjuration", I: "Illusion" };
  function schoolName(x) { return SCHOOL_MAP[x] || x || ""; }
  function distStr(r) {
    if (!r) return "Self";
    if (typeof r === "string") return r;
    if (r.distance && r.distance.amount) return r.distance.amount + " " + (r.distance.type === "feet" ? "ft" : (r.distance.type === "miles" ? "mi" : r.distance.type));
    if (r.type === "point" && !r.distance) return "Self";
    return r.type || "Self";
  }
  function timeStr(t) {
    if (!t) return "1 azione";
    if (typeof t === "string") return t;
    if (Array.isArray(t) && t[0]) { const x = t[0]; return x.number ? x.number + " " + (x.unit === "second" ? "sec" : x.unit) : (x.unit || ""); }
    if (t.number) return t.number + " " + (t.unit === "second" ? "sec" : t.unit);
    return String(t);
  }
  var DUR_UNIT_MAP = { minute: "minuto|minuti", round: "round|round", hour: "ora|ore", day: "giorno|giorni", year: "anno|anni", second: "secondo|secondi" };
  function durStr5e(d) {
    if (!d || !d.length) return "Istantanea";
    const parts = [];
    d.forEach(function (x) {
      if (!x) return;
      if (x.duration && x.duration.amount) {
        const uv = (DUR_UNIT_MAP[x.duration.type] || x.duration.type || "").split("|");
        parts.push(x.duration.amount + " " + (x.duration.amount === 1 ? uv[0] : (uv[1] || uv[0])));
      } else if (x.type === "instant") {
        parts.push("Istantanea");
      } else if (x.type === "permanent") {
        parts.push("Permanente");
      } else if (x.type === "special") {
        parts.push("Speciale");
      }
      if (x.concentration) parts.push("(concentrazione)");
    });
    return parts.join(" ") || "Istantanea";
  }

  const INDEX_URL = "data/lookup-index.json";
  const DATA_ROOT = "data/5etools/";
  const SRD_API = "https://www.dnd5eapi.co/api/2014/";
  const ABBR = { phb: "PHB", xphb: "2024 PHB", mm: "MM", xmm: "2024 MM", tce: "TCE", xge: "XGE", scag: "SCAG", mge: "MGE", dmg: "DMG", wdh: "WDH", egw: "EGW", ftp: "FTP", ggtr: "GGtR", ai: "AI", mot: "MOT", scc: "SCC", big: "BGG", mpp: "MPP" };

  let INDEX = null;
  let state = { q: "", type: null, rows: [] };
  const fileCache = new Map();

  /* ---------- BINDINGS POST-RENDER ----------
   * Gli elementi app (chip-row, lookup-search, result-list, srd-box) vengono creati
   * DINAMICAMENTE dall'init. Ogni binding DEVE avvenire DOPO root.innerHTML —
   * un addEventListener su null a parse-time uccide l'IIFE prima del fetch indice
   * (root cause del freeze "Caricamento database..."). */

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function srcNice(src) {
    if (ABBR[src]) return ABBR[src];
    if (/^[A-Z0-9]{2,8}$/.test(src)) return src;
    return src;
  }
  function typeLabel(t) {
    if (INDEX && INDEX.types && INDEX.types[t]) return INDEX.types[t].label;
    return t;
  }

  /* ---------- RENDER: lista risultati (righe, no card) ---------- */
  function renderList() {
    const q = state.q.toLowerCase().trim();
    const t = state.type;
    // Fuzzy search: scoring combinato (exact > prefix > substring > fuzzy typo <=2)
    let list = [];
    for (let i = 0; i < INDEX.entries.length; i++) {
      const e = INDEX.entries[i];
      if (t && e.t !== t) continue;
      const sc = matchScore(e.n.toLowerCase(), q);
      if (sc > 0) { list.push(e); e._sc = sc; }
    }
    // Sort: score desc (exact/prefix/substring/fuzzy), poi nome asc (stabile)
    if (q) list.sort(function (a, b) { return (b._sc - a._sc) || (a.n.length - b.n.length) || a.n.localeCompare(b.n); });
    // Filtro classe per spell: richiede SC_CLASSES (lazy) 
    const cf = document.getElementById("class-filter");
    if (state.type === "spell" && cf && cf.value && !SC_CLASSES) {
      // Il filtro e' selezionato ma mancano i dati: caricali (il .then ri-renderizza)
      loadSpellClasses();
    }
    if (state.type === "spell" && cf && cf.value && SC_CLASSES) {
      const cfv = cf.value;
      list = list.filter(function (e) {
        const classes = spellClassList(e);
        return classes.some(function (c) { return c.toLowerCase() === cfv; });
      });
    }
    list = list.slice(0, 200);
    state.rows = list;
    // URL sync: la ricerca e' condivisibile (history.replaceState, no re-render)
    if (window.history && window.history.replaceState) {
      const p = new URLSearchParams();
      if (state.q) p.set("q", state.q);
      if (state.type) p.set("cat", state.type);
      const qs = p.toString();
      window.history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
    }
    document.getElementById("result-count").innerHTML = "Risultati: <b>" + list.length + "</b>" + (list.length === 200 ? "+" : "");
    const box = document.getElementById("result-list");
    if (!list.length) {
      box.innerHTML = '<div class="r-none">Nessuna entità trovata per "' + esc(state.q) + '". Prova con un altro nome o seleziona un\'altra categoria o l\'API SRD live.</div>';
      return;
    }
    box.innerHTML = list.map(function (e, i) {
      return '<div class="result-row" data-i="' + i + '" tabindex="0" role="button">' +
        '<span class="r-type">' + esc(typeLabel(e.t)) + '</span>' +
        '<span class="r-name">' + esc(e.n) + '<small>' + esc(srcNice(e.s)) + " &mdash; " + esc(e.f.replace(".json", "")) + '</small></span>' +
        '<span style="color:var(--fg-dim);font-size:13px;">&rarr;</span></div>';
    }).join("");
  }

  /* ---------- RENDER entità trovata nel file on-demand ---------- */
  function findInData(data, e) {
    if (!data) return null;
    const list = Array.isArray(data[e.t]) ? data[e.t] : [];
    const found = list.find(function (x) {
      if (!x || x.name !== e.n) return false;
      const xs = x.source || (x.inherits && x.inherits.source) || x.edition || "";
      return xs === e.s || e.s === "";
    }) || null;
    // magicvariant: la descrizione sta in inherits — mergea nell'entità per il render
    if (found && found.inherits && typeof found.inherits === "object") {
      const inh = found.inherits;
      ["entries", "desc", "text", "rarity", "reqAttune", "weight", "value", "page"].forEach(function (k) {
        if (found[k] === undefined && inh[k] !== undefined) found[k] = inh[k];
      });
      if (inh.namePrefix && typeof found.name === "string" && found.name.indexOf(inh.namePrefix) === 0) {
        found._baseItemName = (inh.baseItem ? inh.baseItem.replace(/-/g, " ") : "base item");
      }
    }
    return found;
  }

  function loadEntity(i) {
    const e = state.rows[i];
    if (!e) return;
    showSkeleton();
    fetchEntity(e).then(function (ent) {
      renderEntity(e, ent);
    }).catch(function (err) {
      fallbackSRD(e, err);
    });
  }

  // ---- Eredità 5e.tools (`_copy`) ------------------------------------------
  // Un'entità con `_copy` eredita TUTTI i campi dal genitore omonimo (stessa fonte)
  // e poi applica `_mod`. Senza questa risoluzione la scheda resta vuota
  // (1143/4570 mostri, 73/2512 oggetti nel dataset).
  const COPY_FIELDS = ["ac", "hp", "speed", "str", "dex", "con", "int", "wis", "cha",
    "saves", "skills", "senses", "passive", "languages", "cr", "traits", "action",
    "bonusActions", "reaction", "legendary", "mythic", "spellcasting", "type", "size",
    "alignment", "entries", "desc", "text", "rarity", "reqAttune", "weight", "value",
    "traitTags", "environment", "immune", "resist", "vulnerable", "conditionImmune",
    "damageTags", "damageResistances", "skillProficiencies", "toolProficiencies",
    "ability", "typicalSpeakers", "script", "domains", "symbol", "title", "pantheon",
    "category", "basicRules", "additionalSources", "page", "source"];

  function applyMod(target, mod) {
    // Sottoinsieme di `_mod` 5e.tools: append/prepend/replace su array e su chiavi "*".
    if (!mod || typeof mod !== "object") return target;
    Object.keys(mod).forEach(function (k) {
      const spec = mod[k];
      if (!spec || typeof spec !== "object" || !spec.mode) return;
      const val = spec.items !== undefined ? spec.items : spec.value;
      const key = (k === "*") ? null : k;
      if (key === null) return; // `*` richiederebbe il merge profondo di ogni campo: non necessario al render
      const cur = target[key];
      if (spec.mode === "append" || spec.mode === "prepend") {
        const arr = Array.isArray(cur) ? cur.slice() : (cur === undefined ? [] : [cur]);
        const add = Array.isArray(val) ? val : [val];
        target[key] = spec.mode === "append" ? arr.concat(add) : add.concat(arr);
      } else if (spec.mode === "replace") {
        target[key] = val;
      }
    });
    return target;
  }

  function mergeCopy(child, parent) {
    const out = {};
    COPY_FIELDS.forEach(function (k) { if (parent[k] !== undefined) out[k] = parent[k]; });
    Object.keys(child).forEach(function (k) { out[k] = child[k]; });
    out.name = child.name;
    out.source = child.source;
    applyMod(out, child._mod);
    out.__copiedFrom = parent.name + " (" + (parent.source || "") + ")";
    return out;
  }

  function rawEntity(e) {
    if (fileCache.has(e.f)) {
      return Promise.resolve(findInData(fileCache.get(e.f), e));
    }
    return fetch(DATA_ROOT + e.f).then(function (r) {
      if (!r.ok) return Promise.reject(new Error("file " + e.f));
      return r.json();
    }).then(function (data) {
      fileCache.set(e.f, data);
      return findInData(data, e);
    });
  }

  function resolveCopy(ent, type, seen) {
    if (!ent || !ent._copy || typeof ent._copy !== "object") return Promise.resolve(ent);
    const cp = ent._copy;
    seen = seen || {};
    const key = cp.name + "|" + (cp.source || "");
    if (seen[key]) return Promise.resolve(ent); // cicli di copia: evita loop
    seen[key] = true;
    const pe = INDEX.entries.find(function (x) {
      return x.n === cp.name && (cp.source === undefined || x.s === cp.source) && x.t === type;
    });
    if (!pe) return Promise.resolve(ent);
    return rawEntity(pe).then(function (parentRaw) {
      if (!parentRaw) return ent;
      return resolveCopy(parentRaw, type, seen).then(function (parent) {
        return mergeCopy(ent, parent);
      });
    }).catch(function () { return ent; });
  }

  function fetchEntity(e) {
    return rawEntity(e).then(function (ent) {
      if (!ent) return null;
      return resolveCopy(ent, e.t);
    });
  }

  function showSkeleton() {
    const box = document.getElementById("stat-core-zone");
    box.innerHTML = '<div class="stat-bezel"><div class="stat-core st-loading">' +
      '<div class="skel" style="width:40%;height:26px;"></div>' +
      '<div class="skel" style="width:70%;"></div><div class="skel" style="width:90%;"></div>' +
      '<div class="skel" style="width:55%;"></div></div></div>';
  }

  function listOf(arr) { return Array.isArray(arr) ? arr : []; }
  function childName(x) { return (typeof x === "string") ? x : ((x && typeof x === "object") ? (x.name || "") : ""); }
  function textOf(entries) {
    // entries o text o desc: array di stringhe/oggetti {"name":..., "entries":[...]}
    // Le stringhe passano per tags() (conversione {@...} -> hyperlink HTML).
    const out = [];
    function push(v) {
      if (v == null) return;
      if (typeof v === "string") { out.push(tags(v)); }
      else if (Array.isArray(v)) { v.forEach(push); }
      else if (typeof v === "object") {
        if (v.entries) { if (v.name) out.push("<strong>" + esc(v.name) + ".</strong> "); v.entries.forEach(push); }
        else if (v.name) { out.push(esc(v.name)); }
        else if (typeof v.text === "string") { out.push(tags(v.text)); }
        else if (v.type === "list") { (v.items || []).forEach(push); }
        else if (v.type === "table") {
          // tabelle 5e.tools: si rendono le righe come elenco leggibile
          const rows = (v.rows || []);
          const rowsHtml = rows.map(function (row) {
            const cells = Array.isArray(row) ? row : [row];
            return "<li>" + cells.map(function (c) {
              if (c && typeof c === "object" && c.entry !== undefined) return esc(c.entry);
              return esc(c);
            }).join(" — ") + "</li>";
          }).join("");
          if (rowsHtml) out.push("<ul>" + rowsHtml + "</ul>");
        }
        // prerequisiti 5e.tools: {spell: [...]}, {feat: [...]}, {level: N}, {item: [...]}
        else if (v.spell) { out.push(listOf(v.spell).map(function (s) { return tags("{@spell " + s + "}"); }).join(", ")); }
        else if (v.feat) { out.push(listOf(v.feat).map(function (s) { return tags("{@item " + s + "}"); }).join(", ")); }
        else if (v.item) { out.push(listOf(v.item).map(function (s) { return tags("{@item " + s + "}"); }).join(", ")); }
        else if (v.level != null) { out.push("livello " + esc(v.level) + "+"); }
        else if (v.campaign) { out.push("campagna: " + esc(listOf(v.campaign).join(", "))); }
        // attack entries (oggetti/monster item actions): attackEntries + hitEntries
        else if (v.attackEntries) { out.push(textOf(v.attackEntries).join(" ")); }
        else if (v.hitEntries) { out.push("<strong>Colpito:</strong> " + textOf(v.hitEntries).join(" ")); }
      }
    }
    push(entries);
    return out;
  }

  function mig(piece) { // mig/elif per campo bestiario (speed, senses)
    if (!piece || typeof piece !== "object") return piece === true ? null : piece;
    const k = Object.keys(piece).find(function (x) { return x !== "type"; });
    return piece[k];
  }

  /* ---------- TAG CONVERTER (5e.tools inline tags -> HTML hyperlink) ----------
   * {@spell fireball}, {@dc 25}, {@hit 7}, {@damage 2d6+10}, {@dice 1d6}, {@item X},
   * {@creature goblin}, {@condition prone}, {@skill Perception}, {@filter X}, {@quickref X},
   * {@recharge 5-6}, {@5etools X|URL} -> hyperlink incrociato (ricerca interna o esterno). */
  var TAG_RE = /\{@([a-zA-Z]+)(?:\s+([^}]*?))?\}/g;
  var I18N = {"schools": {"Abjuration": "Abiurazione", "Conjuration": "Evocazione", "Divination": "Divinazione", "Enchantment": "Ammaliamento", "Evocation": "Invocazione", "Illusion": "Illusione", "Necromancy": "Necromanzia", "Transmutation": "Trasmutazione"}, "abilityLabel": {"str": "Forza", "dex": "Destrezza", "con": "Costituzione", "int": "Intelligenza", "wis": "Saggezza", "cha": "Carisma"}, "abilityAbbr": {"str": "FOR", "dex": "DES", "con": "COS", "int": "INT", "wis": "SAG", "cha": "CAR"}, "sizes": {"T": "Minuscola", "S": "Piccola", "M": "Media", "L": "Grande", "H": "Enorme", "G": "Colossale"}, "creatureTypes": {"aberration": "Aberrazione", "beast": "Bestia", "celestial": "Celestiale", "construct": "Costrutto", "dragon": "Drago", "elemental": "Elementale", "fey": "Folletto", "fiend": "Immondo", "giant": "Gigante", "humanoid": "Umanoide", "monstrosity": "Mostruosità", "ooze": "Melma", "plant": "Pianta", "undead": "Non Morto", "swarm": "Sciame", "celestial ": "Celestiale"}, "alignments": {"L": "legale", "N": "neutrale", "C": "caotico", "G": "buono", "E": "malvagio", "U": "qualunque", "X": "speciale", "LG": "legale buono", "NG": "neutrale buono", "CG": "caotico buono", "LN": "legale neutrale", "N ": "neutrale", "CN": "caotico neutrale", "LE": "legale malvagio", "NE": "neutrale malvagio", "CE": "caotico malvagio", "NX": "neutrale (tendenze caotiche)", "NY": "neutrale (tendenze malvagie)"}, "skills": {"acrobatics": "Acrobazia", "animal handling": "Addestrare Animali", "arcana": "Arcano", "athletics": "Atletica", "deception": "Inganno", "history": "Storia", "insight": "Intuizione", "intimidation": "Intimidazione", "investigation": "Indagare", "medicine": "Medicina", "nature": "Natura", "perception": "Percezione", "performance": "Intrattenere", "persuasion": "Persuasione", "religion": "Religione", "sleight of hand": "Rapidità di Mano", "stealth": "Furtività", "survival": "Sopravvivenza", "animalhandling": "Addestrare Animali", "sleightofhand": "Rapidità di Mano"}, "conditions": {"blinded": "Accecato", "charmed": "Affascinato", "deafened": "Assordato", "exhaustion": "Sfinito", "frightened": "Spaventato", "grappled": "Afferrato", "incapacitated": "Incapacitato", "invisible": "Invisibile", "paralyzed": "Paralizzato", "petrified": "Pietrificato", "poisoned": "Avvelenato", "prone": "Prono", "restrained": "Trattenuto", "stunned": "Stordito", "unconscious": "Privo di Sensi", "concentration": "Concentrazione"}, "damages": {"acid": "Acido", "bludgeoning": "Contundente", "cold": "Freddo", "fire": "Fuoco", "force": "Forza", "lightning": "Fulmine", "necrotic": "Necrotico", "piercing": "Perforante", "poison": "Veleno", "psychic": "Psichico", "radiant": "Radioso", "slashing": "Tagliente", "thunder": "Tuono"}, "rarity": {"common": "comune", "uncommon": "non comune", "rare": "raro", "very rare": "molto raro", "legendary": "leggendario", "artifact": "artefatto", "varies": "variabile", "unknown": "sconosciuta", "none": "—", "none (magic)": "— (magico)", "varies by type": "variabile per tipo"}, "environments": {"arctic": "artico", "coastal": "costiero", "desert": "deserto", "forest": "foresta", "grassland": "pianura erbosa", "hill": "colline", "mountain": "montagna", "swamp": "palude", "underdark": "Sottosuolo", "underwater": "sott'acqua", "urban": "urbano", "planar": "planare", "sky": "cielo", "ruins": "rovine", "laboratory": "laboratorio", "shadowfell": "Shadowfell", "feywild": "Feywild", "elemental chaos": "Caos Elementale", "astral plane": "Piano Astrale"}, "weaponProps": {"ammunition": "munizioni", "finesse": "accurata", "heavy": "pesante", "light": "leggera", "loading": "ricarica", "range": "gittata", "reach": "portata", "special": "speciale", "thrown": "da lancio", "two-handed": "a due mani", "versatile": "versatile"}, "sigle": {"armor_class": "CA", "hit_points": "PF", "challenge": "GS", "prof_bonus": "BC", "difficulty_class": "CD", "speed": "Velocità"}, "UI": {"Home": "Home", "Directory Risorse": "Catalogo Risorse", "Dashboard Analytics": "Pannello Analitico", "Live Spell & Monster Lookup": "Consultazione live di incantesimi e mostri", "Systems & D&D Engine": "Systems & D&D Engine", "FAMS-v4 Metrics": "Metriche FAMS-v4", "Build:": "Versione:", "Search": "Cerca", "Free": "Gratuito", "Pricing": "Modello di prezzo", "Source": "Fonte", "Hit Dice": "Dadi Vita", "Proficienze Iniziali": "Competenze iniziali", "Competenze/Proficienze": "Competenze", "Sfida (CR)": "Grado di Sfida", "Rate-limit": "limite di richieste", "Login-wall": "accesso riservato", "SPA Live": "SPA attive", "crew": "equipaggio"}};
  
  function DIST(ft) {
    var n = parseFloat(ft);
    if (isNaN(n)) return String(ft == null ? "—" : ft);
    var m = Math.round((n / 5) * 1.5 * 100) / 100;
    var ms = (m % 1 === 0) ? String(m) : m.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    return ms + " m (" + n + " ft)";
  }

  // Condizioni dal glossario IT: "charmed" e' **Affascinato** (non "Amaliato") e
  // "restrained" e' **Trattenuto** (non "Costretto").
  var CONDITION_MAP = I18N.conditions;

  function slugName(s) { return String(s || "").toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""); }

  /* ---------- FUZZY SEARCH (typo-tolerance) ----------
   * Levenshtein distance (bound O(n*m) con early-exit) + scoring combinato:
   * exact(4) > prefix(3) > substring(2) > fuzzy(1, dist<=2 per q>=4) > no(0). */
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = new Array(b.length + 1), curr = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      curr[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      const tmp = prev; prev = curr; curr = tmp;
    }
    return prev[b.length];
  }
  function matchScore(name, q) {
    if (!q) return 1; // nessuna query: tutti i risultati (ordine indice)
    if (name === q) return 4;
    if (name.indexOf(q) === 0) return 3;
    if (name.indexOf(q) !== -1) return 2;
    // fuzzy solo per query >= 4 char: dist <= 2 (tolleranza typo)
    if (q.length >= 4) {
      // parola singola del nome fuzzy-matching la query: score intermedio (sopra il fuzzy
      // su tutto il nome — "Wizard" per "wizerd" prima di "Abjurer Wizard")
      const words = name.split(/\s+/);
      let best = 0;
      for (let i = 0; i < words.length; i++) {
        if (words[i] === q) return 2.5;
        const wd = levenshtein(words[i], q);
        if (wd <= 2) best = Math.max(best, 1.5 - wd / 10); // dist 1 -> 1.4, dist 2 -> 1.3
      }
      if (best > 0) return best;
      const d = levenshtein(name, q);
      if (d <= 2) return 1 - d / 10;
    }
    return 0;
  }

  function renderTag(tag, body) {
    var inner = body || "";
    // innesta tag annidati (es. {@damage 2d6+10} dentro {@dc 25} -> non presente ma safe)
    if (inner.indexOf("{@") !== -1) inner = inner.replace(TAG_RE, function (_m, t2, b2) { return renderTag(t2, b2); });
    switch (tag) {
      case "spell": {
        var parts = body.split("|");
        var label = inner;
        var q = slugName(parts[0]);
        // hyperlink di ricerca interna: apre cerca.html?q=slug (ricerca DB locale istantanea)
        return '<a class="tag-link tag-spell" href="cerca.html?q=' + encodeURIComponent(q) + '" title="Cerca l’incantesimo nel database locale">' + esc(label) + '</a>';
      }
      case "dc": {
        var dc = inner.split("|")[0];
        return '<span class="tag-dc">CD ' + esc(dc) + '</span>';
      }
      case "hit":
        return '<span class="tag-hit">' + esc(inner.split("|")[0]) + '</span>';
      case "damage":
        return '<span class="tag-dice">' + esc(inner.split("|")[0]) + '</span>';
      case "dice":
        return '<span class="tag-dice">' + esc(inner.split("|")[0]) + '</span>';
      case "recharge":
        return '<span class="tag-dice">Ricarica ' + esc(inner.split("|")[0]) + '</span>';
      case "condition": {
        var cs = inner.split("|")[0];
        var cl = CONDITION_MAP[cs.trim().toLowerCase()] || cs;
        return '<a class="tag-link tag-cond" href="cerca.html?cat=condition&q=' + encodeURIComponent(cs) + '" title="Cerca la condizione">' + esc(cl) + '</a>';
      }
      case "skill": {
        var sk = inner.split("|")[0];
        return '<span class="tag-skill">' + esc(sk) + '</span>';
      }
      case "creature": {
        var cr2 = inner.split("|")[0];
        var crq = slugName(cr2);
        return '<a class="tag-link tag-creature" href="cerca.html?q=' + encodeURIComponent(crq) + '" title="Cerca la creatura nel database locale">' + esc(cr2) + '</a>';
      }
      case "item": {
        var it = inner.split("|")[0];
        var itq = slugName(it);
        return '<a class="tag-link tag-item" href="cerca.html?cat=item&q=' + encodeURIComponent(itq) + '" title="Cerca l’oggetto nel database locale">' + esc(it) + '</a>';
      }
      case "filter": {
        var fk = inner.split("|");
        return esc(fk[0]);
      }
      case "quickref": case "book": case "adventure": case " sensedetect": {
        var bk = inner.split("|");
        return esc(bk[0]);
      }
      case "5etools": case "loader": {
        var lk = inner.split("|");
        var url = lk[1] ? ("https://5e.tools/" + lk[1].replace(/^\//, "")) : "https://5e.tools/";
        return '<a class="tag-link" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(lk[0]) + '</a>';
      }
      default:
        return esc(inner.split("|")[0]);
    }
  }

  function tags(s) {
    // Converte i tag inline {@...} in HTML e ESCAPA tutto il resto.
    // Sicurezza: prima il testo letterale passava intatto in innerHTML e il fallback
    // SRD ci inseriva la `desc` di un'API esterna (vettore di injection HTML).
    if (s == null) return "";
    const str = String(s);
    let out = "", last = 0;
    TAG_RE.lastIndex = 0;
    let m;
    while ((m = TAG_RE.exec(str)) !== null) {
      out += esc(str.slice(last, m.index));
      out += renderTag(m[1], m[2]);
      last = m.index + m[0].length;
    }
    out += esc(str.slice(last));
    return out;
  }

  function renderStat(block, label) {
    return '<div class="st-stat"><strong>' + esc(label) + '</strong><span>' + esc(block) + '</span></div>';
  }

  let CURRENT_ENTITY = null; // ultima entità aperta (per re-render quando SC_CLASSES arriva)
  let CURRENT_INDEX = null;
  let FAV_ADD = null; // pulsante preferito (assegnata dal then-init, scope locale)

  function renderEntity(e, ent) {
    const box = document.getElementById("stat-core-zone");
    if (!ent) { renderNotFound(e); return; }
    CURRENT_ENTITY = ent; CURRENT_INDEX = e;
    const src = srcNice(e.s);
    let html = '<div class="stat-bezel"><div class="stat-core"><div class="st-h"><div>' +
      '<h2>' + esc(ent.name) + '</h2>' +
      '<div class="st-sub">' + (e.t === "monster" ? typeSub(ent) : typeLine(e.t, ent)) + '</div></div>' +
      '<span class="db-badge">&#10003; 5e.tools locale</span></div>' +
      '<div class="st-src">Fonte: ' + esc(srcNice(e.s)) + ' &middot; ' + esc(e.s) + ' &middot; ' + esc(e.f) + '</div>';
    html += bodyFor(e.t, ent);
    html += '</div></div>';
    box.innerHTML = html;
    // Auto-reveal minimale: scroll SOLO se lo statblock non e' nel viewport
    // (ACT-04 — scrollIntoView("smooth") sempre-forzato perdeva la barra di ricerca).
    const rect = box.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top > vh || rect.bottom < 0) {
      box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    // Pulsante preferito (FAV_ADD assegnata dal then-init — scope IIFE)
    if (FAV_ADD) FAV_ADD();
  }

  // Allineamenti dal glossario IT: la mappa precedente aveva NG->"legale neutrale"
  // e NE->"legale malvagio" (che sono invece LG e LE): traduzioni sbagliate.
  var ALIGN_MAP = I18N.alignments;
  function alignStr(a) {
    if (!a) return "";
    if (typeof a === "string") return ALIGN_MAP[a] || a;
    if (Array.isArray(a)) {
      // [{alignment: [...], chance: N}] = allineamento probabile (special)
      if (a[0] && typeof a[0] === "object" && a[0].alignment) {
        return "di solito " + alignStr(a[0].alignment) + (a[0].chance ? " (" + a[0].chance + "%)" : "");
      }
      const parts = a.map(function (x) { return ALIGN_MAP[x] || x; });
      // ["C","E"] = caotico malvagio (combinazione)
      return parts.join(" ");
    }
    return String(a);
  }
  function typeStr5e(t) {
    if (!t) return "creatura";
    if (typeof t === "string") return t;
    if (typeof t === "object" && t.type) {
      return t.type + (t.tags && t.tags.length ? " (" + t.tags.join(", ") + ")" : "");
    }
    return "creatura";
  }
  function typeSub(m) {
    // 5e.tools v2.35+: size e' un ARRAY di lettere (es. ['H']) — MAI una stringa.
    const size = (Array.isArray(m.size) ? m.size.join("") : (typeof m.size === "string" ? m.size : "")).trim();
    const sizeFull = SIZE_MAP[size] || size || "taglia n/d";
    const cr = typeof m.cr === "object" ? (m.cr.cr != null ? m.cr.cr : m.cr.crRating) : m.cr;
    return sizeFull + " &middot; " + typeStr5e(m.type) + (m.alignment ? " &middot; " + alignStr(m.alignment) : "") +
      (cr !== null && cr !== undefined ? " &middot; Sfida " + esc(cr) : "");
  }

  function typeLine(t, e) {
    switch (t) {
      case "spell":
        return "Livello " + (e.level === 0 ? "0 (Trucchetto)" : e.level) + " &middot; " +
          schoolName(typeof e.school === "object" ? (e.school.name || e.school) : e.school) +
          (e.time ? " &middot; " + timeStr(e.time) : "") +
          (e.range ? " &middot; " + distStr(e.range) : "");
      case "item": case "baseitem": case "magicvariant":
        return (e.type || "oggetto") + (e.rarity ? " &middot; Rarità: " + (typeof e.rarity === "object" ? e.rarity.name || Object.keys(e.rarity)[0] : e.rarity) : "") +
          (e.weight ? " &middot; Peso " + e.weight + " lb" : "") +
          (e.value ? " &middot; " + (typeof e.value === "object" ? e.value.addition + " " + e.value.multiplier : e.value) + " po" : "");
      case "race":
        return (e.size ? e.size.join ? e.size.join("–") : e.size : "") + (e.speed && e.speed.walk ? " &middot; Velocità " + DIST(e.speed.walk) : "");
      case "feat":
        return (e.prerequisite && e.prerequisite[0] ? "Prerequisito: " + esc(e.prerequisite[0].text || e.prerequisite[0]) : "Talento");
      case "deity":
        return (e.pantheon ? e.pantheon : "Divinità") + (e.category ? " &middot; " + e.category : "");
      case "condition":
        return "Condizione di stato";
      default:
        return cap(t);
    }
  }

  function cap(s) { return s ? s.replace(/^./, function (c) { return c.toUpperCase(); }) : ""; }

  function statsRow(ent) {
    const keys = [["str", "FOR"], ["dex", "DES"], ["con", "COS"], ["int", "INT"], ["wis", "SAG"], ["cha", "CAR"]];
    // Nascondi il grid se NESSUNA ability score e' presente (oggetti/veicoli: rumore)
    const hasAny = keys.some(function (k) { return ent[k[0]] != null; });
    if (!hasAny) return "";
    return '<div class="st-stats">' + keys.map(function (k) {
      // ent[k[0]] (k è una coppia [chiave, label]) + modificatore D&D (floor((score-10)/2))
      const v = ent[k[0]];
      const mod = (typeof v === "number") ? Math.floor((v - 10) / 2) : null;
      const modStr = (mod !== null) ? (mod >= 0 ? "+" + mod : String(mod)) : "";
      return renderStat(v != null ? v + (modStr ? " (" + modStr + ")" : "") : "—", k[1]);
    }).join("") + '</div>';
  }

  function block(entries) {
    if (!entries || !entries.length) return "";
    const items = textOf(entries).map(function (t) { return "<li>" + t + "</li>"; }).join("");
    return '<div class="st-sec"><h4>Descrizione</h4><ul>' + items + '</ul></div>';
  }
  function featureBlock(title, list) {
    const l = listOf(list);
    if (!l.length) return "";
    const items = l.map(function (f) {
      // f STRINGA = testo puro (fluff entries): va nel BODY, mai nel name (childName tratta
      // le stringhe come nome -> il lore finirebbe tutto dentro <strong>).
      if (typeof f === "string") return "<li>" + tags(f) + "</li>";
      const name = childName(f);
      const t = textOf(f.entries || f.desc);
      const body = t.length ? t.join(" ") : "";
      // f.text (stringa) passa per tags() — mai esc() grezzo (tag {@..} altrimenti non convertiti).
      // Il name e' opzionale (fluff entries = oggetti senza name): salta il bold se vuoto.
      const nameHtml = name ? "<strong>" + tags(name) + ".</strong> " : "";
      return "<li>" + nameHtml + (f.text ? tags(f.text) : body) + "</li>";
    }).join("");
    return '<div class="st-sec"><h4>' + esc(title) + '</h4><ul>' + items + '</ul></div>';
  }

  /* ---------- SPELLCASTING BLOCK (mostri con incantesimi preparati) ----------
   * 5e.tools: spellcasting: [{name, type: "spellcasting", headerEntries, ability,
   * spells: {"0": {spells:[...]}, "1": {slots: 3, spells:[...]}, ...}}] */
  function spellcastingBlock(list) {
    const l = listOf(list);
    if (!l.length) return "";
    return l.map(function (sc) {
      if (!sc) return "";
      const ABIL = { wis: "Saggezza", int: "Intelligenza", cha: "Carisma" };
      let h = '<div class="st-sec st-spellcasting"><h4>' + esc(sc.name || "Lancio Incantesimi") +
        (sc.ability ? ' <span class="tag-skill">(' + (ABIL[sc.ability] || sc.ability) + ')</span>' : '') + '</h4>';
      h += '<p>' + textOf(sc.headerEntries).join(" ") + '</p>';
      const groups = sc.spells && typeof sc.spells === "object" ? sc.spells : {};
      const levels = Object.keys(groups).sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });
      if (levels.length) {
        h += '<ul>';
        levels.forEach(function (lv) {
          const g = groups[lv];
          const spells = listOf(g && g.spells).map(function (s) { return tags(s); }).join(", ");
          const lvLabel = lv === "0" ? "Trucchetti (a volontà)" : (lv + (g && g.slots ? " (" + g.slots + " slot)" : "° livello"));
          h += '<li><strong>' + esc(lvLabel) + ':</strong> ' + spells + '</li>';
        });
        h += '</ul>';
      }
      if (sc.footerEntries) h += '<p>' + textOf(sc.footerEntries).join(" ") + '</p>';
      return h + '</div>';
    }).join("");
  }

  /* ---------- REGIONAL EFFECTS (mostri leggendari con tana) ---------- */
  function regionalEffectsBlock(list) {
    const l = listOf(list);
    if (!l.length) return "";
    const items = l.map(function (x) { return "<li>" + tags(typeof x === "string" ? x : (x && x.entries ? textOf(x.entries).join(" ") : "")) + "</li>"; }).join("");
    return '<div class="st-sec"><h4>Effetti Regionali</h4><ul>' + items + '</ul></div>';
  }

  /* ---------- TABELLA CLASSI (classTableGroups: spell slots per livello) ---------- */
  function classTable(e) {
    const groups = listOf(e.classTableGroups);
    if (!groups.length) return "";
    let h = "";
    groups.forEach(function (g) {
      const labels = listOf(g.colLabels).map(function (l) {
        // {@filter Cantrips Known|spells|level=0|class=Wizard} -> "Cantrips Known"
        const m = /\{@filter\s+([^|}]+)/.exec(String(l));
        return m ? m[1] : esc(String(l));
      });
      const rows = listOf(g.rows);
      if (!rows.length) return;
      h += '<div class="st-sec"><h4>Progressione per Livello</h4>' +
        '<table class="class-table"><thead><tr><th>Liv.</th>' +
        labels.map(function (l) { return "<th>" + l + "</th>"; }).join("") + '</tr></thead><tbody>';
      rows.forEach(function (row, i) {
        h += "<tr><td><strong>" + (i + 1) + "</strong></td>" +
          listOf(row).map(function (cell) { return "<td>" + esc(String(cell)) + "</td>"; }).join("") + "</tr>";
      });
      h += '</tbody></table></div>';
    });
    return h;
  }

  /* ---------- SCALING INCANTESIMI (scalingLevelDice / damage at spellslot) ---------- */
  function scalingBlock(e) {
    const sld = e.scalingLevelDice;
    if (!sld) return "";
    let h = "<ul>";
    if (Array.isArray(sld) && sld.length) {
      sld.forEach(function (s) {
        const lv = s.level != null ? s.level : "?";
        const dice = s.dice ? "" : "";
        h += "<li><strong>Livello " + esc(lv) + ":</strong> " + esc(dice || JSON.stringify(s)) + "</li>";
      });
    } else if (typeof sld === "object" && sld.scaling) {
      h += textOf(sld.scaling).map(function (t) { return "<li>" + t + "</li>"; }).join("");
    } else {
      h += "<li>" + esc(JSON.stringify(sld).slice(0, 300)) + "</li>";
    }
    return h + "</ul>";
  }

  /* ---------- CLASSI INCANTESIMO (badge classi per spell) ----------
   * Mappa da gendata-spell-source-lookup.json (fetch lazy, 709KB, cache). Fallback: e.classes. */
  let SC_CLASSES = null;
  let SC_CLASSES_LOADING = false;
  function loadSpellClasses() {
    if (SC_CLASSES || SC_CLASSES_LOADING) return;
    SC_CLASSES_LOADING = true;
    fetch(DATA_ROOT + "generated/gendata-spell-source-lookup.json").then(function (r) {
      if (!r.ok) throw new Error("sc " + r.status);
      return r.json();
    }).then(function (j) {
      SC_CLASSES = j;
      SC_CLASSES_LOADING = false;
      // I dati sono arrivati DOPO il primo render: la lista va ricalcolata,
      // altrimenti un filtro per classe attivo resta con 0 risultati.
      const cf = document.getElementById("class-filter");
      if (cf && cf.value) renderList();
      // Re-render della spell aperta: i badge classi arrivano ora (fetch lazy completato)
      if (CURRENT_ENTITY && CURRENT_INDEX && CURRENT_INDEX.t === "spell") {
        renderEntity(CURRENT_INDEX, CURRENT_ENTITY);
      }
    })
      .catch(function () {
        // Stato NON caricato (non {} che e' "vuoto ma truthy" e bloccherebbe
        // ogni retry): cosi' un secondo tentativo e' ancora possibile.
        SC_CLASSES = null;
        SC_CLASSES_LOADING = false;
      });
  }
  /* ---------- LORE (fluff multi-tipo: monster/race/background/item/vehicle, fetch lazy) ----------
   * fluff-index.json: { "name|source": {t, entries, images} } — catene _copy risolte in build. */
  let FLUFF = null;
  let FLUFF_LOADING = false;
  function loadFluff() {
    if (FLUFF || FLUFF_LOADING) return;
    FLUFF_LOADING = true;
    fetch("data/fluff-index.json").then(function (r) {
      if (!r.ok) throw new Error("fl " + r.status);
      return r.json();
    }).then(function (j) {
      FLUFF = j;
      // Re-render dell'entita' aperta: la lore arriva ora (fetch lazy completato)
      if (CURRENT_ENTITY && CURRENT_INDEX) {
        renderEntity(CURRENT_INDEX, CURRENT_ENTITY);
      }
    }).catch(function () { FLUFF = {}; });
  }
  function loreBlock(e) {
    if (!FLUFF) { loadFluff(); return ""; }
    // entry indice usa n (non name), entita' usa name
    const nm = e.name || e.n || "";
    const key = String(nm).toLowerCase() + "|" + (e.s || e.source || (CURRENT_INDEX && CURRENT_INDEX.s) || "");
    const fl = FLUFF[key];
    if (!fl || !fl.entries || !fl.entries.length) return "";
    return featureBlock("Lore & Descrizione", fl.entries);
  }

  function spellClassList(e) {
    // 1) entita' completa (scheda aperta): le classi sono nel payload 5e.tools
    if (e.classes) {
      if (e.classes.classList) return listOf(e.classes.classList);
      if (e.classes.fromClassList) {
        return listOf(e.classes.fromClassList).map(function (c) { return (c && c.name) ? c.name : c; });
      }
    }
    if (!SC_CLASSES) { loadSpellClasses(); return []; }
    // gendata-spell-source-lookup usa slug CON SPAZI ("delayed blast fireball"), non trattini.
    // e puo' essere l'entry indice (con s) o l'entita' (source) — risolvi entrambe.
    // gendata keys sono LOWERCASE ('phb' non 'PHB')
    const srcKey = String(e.s || e.source || (CURRENT_INDEX && CURRENT_INDEX.s) || "").toLowerCase();
    const bySrc = SC_CLASSES[srcKey] || {};
    // Le righe dell'indice usano chiavi ABBREVIATE ({n,t,f,s}): leggere solo `e.name`
    // restituiva "" e il lookup falliva -> ogni riga veniva scartata (filtro a 0).
    const nm = String(e.name || e.n || "").toLowerCase().trim();
    const entry = bySrc[nm];
    if (!entry || !entry.class) return [];
    const out = [];
    Object.keys(entry.class).forEach(function (src) {
      Object.keys(entry.class[src]).forEach(function (c) { out.push(c); });
    });
    return out.filter(function (c, i) { return out.indexOf(c) === i; });
  }

  function speedStr(sp) {
    // 5e.tools: un valore di velocita' puo' essere un numero oppure un oggetto
    // {number, condition, hover}; 'canHover' e' un flag booleano, non una velocita'
    // (prima veniva stampato come "canHover true ft" e gli oggetti come [object Object]).
    if (!sp || typeof sp !== "object") return "—";
    const out = [];
    Object.keys(sp).forEach(function (k) {
      if (k === "canHover") return;
      const v = sp[k];
      if (v == null) return;
      let num = v, extra = "";
      if (typeof v === "object") {
        num = (v.number != null ? v.number : (v.amount != null ? v.amount : "?"));
        // "hover" puo' arrivare come flag booleano o gia' dentro condition: non duplicare.
        if (v.hover && !(v.condition && String(v.condition).toLowerCase().indexOf("hover") !== -1)) extra += " (hover)";
        if (v.condition) extra += " (" + v.condition + ")";
      }
      out.push((k === "walk" ? "" : k + " ") + DIST(num) + extra);
    });
    return out.length ? out.join(", ") : "—";
  }

  function bodyFor(t, e) {
    switch (t) {
      case "monster": {
        let h = "";
        const hp = typeof e.hp === "object" ? ((e.hp.average || "?") + (e.hp.formula ? " (" + e.hp.formula + ")" : "")) : e.hp;
        const crRaw = typeof e.cr === "object" ? (e.cr.cr != null ? e.cr.cr : e.cr.crRating) : e.cr;
        const pb = 2 + Math.floor(((parseInt(crRaw, 10) || 0) - 1) / 4);
        h += '<div class="st-meta">' +
          '<div><strong>CA</strong>' + tags(listOf(e.ac).map(function (a) { return typeof a === "object" ? (a.ac + (a.from ? " (" + a.from.join(", ") + ")" : "")) : a; }).join(" / ") || "—") + '</div>' +
          '<div><strong>PF</strong>' + esc(hp) + '</div>' +
          '<div><strong>Velocità</strong>' + esc(speedStr(e.speed)) + '</div>' +
          (crRaw !== undefined ? '<div><strong>Grado di Sfida</strong>' + esc(crRaw) + ' <span class="tag-dc">BC +' + pb + '</span></div>' : "") +
          '</div>';
        h += statsRow(e);
        // Proficienze di salvataggio e abilità (5e.tools: {dex: '+7', ...})
        if (e.save && Object.keys(e.save).length) {
          const SAVE_MAP = I18N.abilityLabel;
          h += '<div class="st-sec"><h4>Tiri Salvezza</h4><p>' + Object.keys(e.save).map(function (k) {
            return '<strong>' + (SAVE_MAP[k] || k) + '</strong> ' + esc(e.save[k]);
          }).join(" &middot; ") + '</p></div>';
        }
        if (e.skill && Object.keys(e.skill).length) {
          h += '<div class="st-sec"><h4>Abilità</h4><p>' + Object.keys(e.skill).map(function (k) {
            return '<strong>' + tags(k.charAt(0).toUpperCase() + k.slice(1)) + '</strong> ' + esc(e.skill[k]);
          }).join(" &middot; ") + '</p></div>';
        }
        // Resistenze / immunità / vulnerabilità danni + condizioni
        const dmgList = function (v) { return listOf(v).map(function (x) { return typeof x === "object" ? (x.note ? x.note : Object.keys(x).join(", ")) : tags(x); }).join(", "); };
        let dmgHtml = "";
        if (e.resist) dmgHtml += '<div><strong>Resistenze</strong>' + esc(dmgList(e.resist)) + '</div>';
        if (e.immune) dmgHtml += '<div><strong>Immunità</strong>' + esc(dmgList(e.immune)) + '</div>';
        if (e.vulnerable) dmgHtml += '<div><strong>Vulnerabilità</strong>' + esc(dmgList(e.vulnerable)) + '</div>';
        if (e.conditionImmune) dmgHtml += '<div><strong>Immunità Cond.</strong>' + esc(dmgList(e.conditionImmune)) + '</div>';
        if (dmgHtml) h += '<div class="st-meta">' + dmgHtml + '</div>';
        // Sensi + linguaggi
        let slHtml = "";
        if (e.senses) slHtml += '<div><strong>Sensi</strong>' + esc(listOf(e.senses).map(function (x) { return tags(x); }).join(", ")) + '</div>';
        if (e.languages) slHtml += '<div><strong>Linguaggi</strong>' + esc(listOf(e.languages).map(function (x) { return tags(x); }).join(", ")) + '</div>';
        if (e.environment) slHtml += '<div><strong>Ambienti</strong>' + esc(listOf(e.environment).map(function (x) { return (typeof x === "object" ? Object.keys(x)[0] : x).replace(/\w/g, function (c) { return c.toUpperCase(); }); }).join(", ")) + '</div>';
        if (slHtml) h += '<div class="st-meta">' + slHtml + '</div>';
        h += featureBlock("Tratti", e.trait);
        h += spellcastingBlock(e.spellcasting);
        h += featureBlock("Azioni", e.action);
        h += featureBlock("Azioni Leggendarie", e.legendary);
        h += featureBlock("Reazioni", e.reaction);
        h += featureBlock("Azioni in Tana", e.lairActions || (e.legendaryGroup && e.legendaryGroup.lairActions));
        h += regionalEffectsBlock(e.legendaryGroup && e.legendaryGroup.regionalEffects);
        h += loreBlock(CURRENT_INDEX);
        // Hyperlink esterni 5e.tools + API + link sezioni sito
        const slug = slugName(e.name);
        h += '<div class="st-links">' +
          '<a class="tag-link" href="https://5e.tools/bestiary.html#' + esc(slug) + '_' + esc((CURRENT_INDEX && CURRENT_INDEX.s) || ent.source || "") + '" target="_blank" rel="noopener">5e.tools &rarr;</a>' +
          '<a class="tag-link" href="https://www.dnd5eapi.co/api/2014/monsters/' + esc(slug) + '" target="_blank" rel="noopener">API SRD &rarr;</a>' +
          '<a class="tag-link" href="cerca.html?cat=spell&q=' + esc(slug) + '">Incantesimi correlati</a>' +
          '</div>';
        return h;
      }
      case "spell": {
        const conc = (e.duration && e.duration[0] && e.duration[0].concentration);
        const comps = (e.components && typeof e.components === "object") ? (e.components.components || []) : (typeof e.components === "string" ? [e.components] : []);
        // Classi incantesimo: da gendata-spell-source-lookup (SC_CLASSES globale) o e.classes
        const spellClasses = spellClassList(e);
        const classBadges = spellClasses.length
          ? '<div class="st-sec"><h4>Classi</h4><p>' + spellClasses.map(function (c) {
              return '<a class="tag-link tag-class" href="cerca.html?cat=class&q=' + encodeURIComponent(slugName(c)) + '">' + esc(c) + '</a>';
            }).join(" &middot; ") + '</p></div>'
          : "";
        const slug = slugName(e.name);
        return '<div class="st-meta">' +
          '<div><strong>Tempo di Lancio</strong>' + esc(timeStr(e.time)) + '</div>' +
          '<div><strong>Gittata</strong>' + esc(distStr(e.range)) + '</div>' +
          '<div><strong>Componenti</strong>' + esc(comps.join(", ") || "V, S") + (e.components && e.components.material ? '<div class="st-sec"><p style="font-size:12px">' + esc(e.components.material) + '</p></div>' : "") + '</div>' +
          '<div><strong>Durata</strong>' + esc(durStr5e(e.duration)) + '</div>' +
          '<div><strong>Concentrazione</strong>' + esc(conc ? "Sì" : "No") + '</div>' +
          '</div>' + classBadges + block(e.entries) +
          (e.higherLevel ? '<div class="st-sec"><h4>A Livelli Superiori</h4><ul>' + textOf(e.higherLevel).map(function (t) { return "<li>" + t + "</li>"; }).join("") + '</ul></div>' : "") +
          (e.scalingLevelDice ? '<div class="st-sec"><h4>Scaling per Livello</h4>' + scalingBlock(e) + '</div>' : "") +
          '<div class="st-links">' +
          '<a class="tag-link" href="https://5e.tools/spells.html#' + esc(slug) + '_' + esc((CURRENT_INDEX && CURRENT_INDEX.s) || ent.source || "") + '" target="_blank" rel="noopener">5e.tools &rarr;</a>' +
          '<a class="tag-link" href="https://www.dnd5eapi.co/api/2014/spells/' + esc(slug) + '" target="_blank" rel="noopener">API SRD &rarr;</a>' +
          '</div>';
      }
      case "item": case "baseitem": case "magicvariant": {
        const base = e._baseItemName || (e.baseItem ? String(e.baseItem).replace(/-/g, " ") : "");
        const attune = e.reqAttune === true ? "Sì (richiede sintonia)" : typeof e.reqAttune === "string" ? esc(e.reqAttune) : "No";
        return '<div class="st-meta">' +
          '<div><strong>Rarità</strong>' + esc(typeof e.rarity === "object" ? (e.rarity.name || Object.keys(e.rarity)[0]) : (e.rarity || "N/D")) + '</div>' +
          '<div><strong>Sintonia</strong>' + attune + '</div>' +
          (base ? '<div><strong>Base</strong>' + esc(base) + '</div>' : "") +
          (e.weight ? '<div><strong>Peso</strong>' + esc(e.weight) + ' lb</div>' : "") +
          '</div>' + block(e.entries || e.desc || e.text) +
          (e.effect ? '<div class="st-sec"><h4>Effetto</h4><ul>' + textOf(e.effect).map(function (t) { return "<li>" + t + "</li>"; }).join("") + '</ul></div>' : "") +
          loreBlock(CURRENT_INDEX);
      }
      case "race":
        return featureBlock("Tratti Razziali", e.trait || e.entries) +
          (e.speed && e.speed.walk ? '<div class="st-meta"><div><strong>Velocità</strong>' + esc(e.speed.walk) + " ft</div></div>" : "") +
          loreBlock(CURRENT_INDEX);
      case "subrace":
        return featureBlock("Tratti", e.trait || e.entries);
      case "class": {
        // Classe: HD, proficienze, feature per livello, sottoclassi correlate
        let h = "";
        const hd = e.hd ? (e.hd.number + "d" + e.hd.faces) : "n/d";
        const feats = listOf(e.classFeatures);
        h += '<div class="st-meta">' +
          '<div><strong>Dadi Vita</strong>' + esc(hd) + '</div>' +
          '<div><strong>Feature di Classe</strong>' + feats.length + '</div>' +
          '</div>';
        if (e.startingProficiencies) {
          h += '<div class="st-sec"><h4>Competenze iniziali</h4>' +
            '<p>' + textOf(e.startingProficiencies.armors || []).join(" ") + " " +
            textOf(e.startingProficiencies.weapons || []).join(" ") + " " +
            textOf(e.startingProficiencies.skills || []).join(" ") + " " +
            textOf(e.startingProficiencies.tools || []).join(" ") + '</p></div>';
        }
        if (e.spellsKnownProgression || e.spellsKnownProgressionFixed) {
          h += '<div class="st-sec"><h4>Lancio Incantesimi</h4><p>Classe lanciatrice completa (progressione incantesimi nota).</p></div>';
        }
        h += classTable(e);
        h += '<div class="st-sec"><h4>Feature Principali</h4><ul>' +
          feats.slice(0, 20).map(function (f) {
            // classFeatures: "Name|Class||Level" (pipe) o {classFeature, gainSubclassFeature}
            if (typeof f === "object" && f.classFeature) {
              return '<li><em>Feature di Sottoclasse</em> (livello ' + esc(String(f.classFeature).split("|").pop() || "?") + ')</li>';
            }
            const parts = String(f).split("|");
            const fname = parts[0];
            const flevel = parts[parts.length - 1];
            const fsrc = parts[2] || "";
            return '<li><a class="tag-link tag-class" href="cerca.html?cat=classFeature&q=' + encodeURIComponent(slugName(fname)) + '">' + esc(fname) + '</a>' +
              (flevel ? ' <span class="tag-skill">liv. ' + esc(flevel) + '</span>' : '') + '</li>';
          }).join("") + '</ul>' + '</div>';
        const slug = slugName(e.name);
        h += '<div class="st-links">' +
          '<a class="tag-link" href="https://5e.tools/classes.html#' + esc(slug) + '_' + esc((CURRENT_INDEX && CURRENT_INDEX.s) || ent.source || "") + '" target="_blank" rel="noopener">5e.tools &rarr;</a>' +
          '<a class="tag-link" href="cerca.html?cat=subclass&q=' + esc(slug) + '">Sottoclassi correlate</a>' +
          '<a class="tag-link" href="cerca.html?cat=spell&q=' + esc(slug) + '">Incantesimi di classe</a>' +
          '</div>';
        return h;
      }
      case "subclass": {
        // Sottoclasse: classe madre, feature, hyperlink
        let h = "";
        h += '<div class="st-meta">' +
          '<div><strong>Classe Madre</strong><a class="tag-link tag-class" href="cerca.html?cat=class&q=' + encodeURIComponent(slugName(e.className || "")) + '">' + esc(e.className || "n/d") + '</a></div>' +
          '<div><strong>Feature</strong>' + listOf(e.subclassFeatures).length + '</div>' +
          '</div>';
        h += '<div class="st-sec"><h4>Feature Sottoclasse</h4><ul>' +
          listOf(e.subclassFeatures).slice(0, 15).map(function (f) {
            // subclassFeatures: "Name|Class||Subclass||Level" (pipe)
            const parts = String(f).split("|");
            const fname = parts[0];
            const flevel = parts[parts.length - 1];
            return '<li><a class="tag-link tag-class" href="cerca.html?cat=subclassFeature&q=' + encodeURIComponent(slugName(fname)) + '">' + esc(fname) + '</a>' +
              (flevel ? ' <span class="tag-skill">liv. ' + esc(flevel) + '</span>' : '') + '</li>';
          }).join("") + '</ul></div>';
        const slug = slugName(e.name);
        h += '<div class="st-links">' +
          '<a class="tag-link" href="https://5e.tools/classes.html#' + esc(slugName(e.className || "")) + '_' + esc(e.classSource || "PHB") + '" target="_blank" rel="noopener">5e.tools &rarr;</a>' +
          '</div>';
        return h;
      }
      case "classFeature": case "subclassFeature": {
        // Feature di classe/sottoclasse: descrizione + classe madre
        let h = "";
        const parentLabel = e.className || "Classe";
        const parentHref = e.classFeature !== undefined ? "class" : "subclass";
        h += '<div class="st-meta">' +
          '<div><strong>' + (e.subclassShortName ? "Sottoclasse" : "Classe") + '</strong><a class="tag-link tag-class" href="cerca.html?cat=' + parentHref + '&q=' + encodeURIComponent(slugName(parentLabel)) + '">' + esc(parentLabel) + '</a></div>' +
          '<div><strong>Livello</strong>' + esc(e.level != null ? e.level : "n/d") + '</div>' +
          (e.srd ? '<div><strong>SRD</strong>Sì</div>' : '') +
          '</div>'; h += block(e.entries || e.text);
        const slug2 = slugName(e.name);
        h += '<div class="st-links">' +
          '<a class="tag-link" href="https://5e.tools/classes.html#' + esc(slug2) + '_' + esc((CURRENT_INDEX && CURRENT_INDEX.s) || ent.source || "") + '" target="_blank" rel="noopener">5e.tools &rarr;</a>' +
          '</div>';
        return h;
      }
      case "background":
        return featureBlock("Competenze", e.skillProficiencies || []) +
          block(e.entries || e.text) +
          loreBlock(CURRENT_INDEX);
      case "feat":
        return block(e.entries || e.text) + loreBlock(CURRENT_INDEX);
      case "condition": case "disease": case "hazard": case "trap":
        return block(e.entries || e.text) + loreBlock(CURRENT_INDEX);
      case "deity": {
        // Divinità: pantheon, titolo, domini e simbolo anche quando manca `entries`
        const dm = '<div class="st-meta">' +
          (e.pantheon ? '<div><strong>Pantheon</strong>' + esc(e.pantheon) + '</div>' : "") +
          (e.title ? '<div><strong>Titolo</strong>' + esc(e.title) + '</div>' : "") +
          (e.domains ? '<div><strong>Domini</strong>' + tags(Array.isArray(e.domains) ? e.domains.join(", ") : e.domains) + '</div>' : "") +
          (e.symbol ? '<div><strong>Simbolo</strong>' + (typeof e.symbol === "string" ? esc(e.symbol) : esc((e.symbol && e.symbol.name) || "")) + '</div>' : "") +
          '</div>';
        return dm + block(e.entries || e.text) + loreBlock(CURRENT_INDEX);
      }
      case "cult": case "boon":
        return block(e.entries || e.text) + loreBlock(CURRENT_INDEX);
      case "language":
        return '<div class="st-meta">' +
          '<div><strong>Parlanti tipici</strong>' + esc(listOf(e.typicalSpeakers).join(", ") || "—") + '</div>' +
          '<div><strong>Scrittura</strong>' + esc(e.script || "—") + '</div></div>' +
          block(e.entries || e.text);
      case "sense": case "skill":
        return block(e.entries || e.text);
      case "psionic":
        return featureBlock("Discipline", e.disciplines) + block(e.entries || e.text);
      case "optionalfeature": {
        // Opzione di classe: featureType (EI: Eldritch Invocation, ecc.) + prerequisito
        const FT_MAP = { EI: "Eldritch Invocation", AS: "Abilità Speciale", PB: "Pact Boon", OR: "Opzione Razza", F: "Feature", S: "Sottoclasse" };
        const fts = listOf(e.featureType).map(function (x) { return FT_MAP[x] || x; }).join(", ");
        let h2 = '<div class="st-meta"><div><strong>Tipo</strong>' + esc(fts || "opzione") + '</div></div>';
        if (e.prerequisite) {
          h2 += '<div class="st-sec"><h4>Prerequisito</h4><p>' + textOf(e.prerequisite).join(" ") + '</p></div>';
        }
        return h2 + block(e.entries || e.text);
      }
      case "reward": {
        // Ricompensa (benedizioni, charme): tipo + descrizione
        return '<div class="st-meta"><div><strong>Tipo</strong>' + esc(e.type || "ricompensa") + '</div></div>' +
          block(e.entries || e.text) + loreBlock(CURRENT_INDEX);
      }
      case "variantrule": {
        // Regola variante: tipo regola + descrizione
        return '<div class="st-meta"><div><strong>Tipo Regola</strong>' + esc(e.ruleType || "variante") + '</div></div>' +
          block(e.entries || e.text);
      }
      case "action": {
        // Azione standard: tempo + descrizione
        return '<div class="st-meta"><div><strong>Tempo</strong>' + esc(timeStr(e.time)) + '</div></div>' +
          block(e.entries || e.text);
      }
      case "object": {
        // Oggetto fisico: CA/PF/immunita + azioni (statblock semplificato)
        const hpO = typeof e.hp === "object" ? (e.hp.average || "?") : e.hp;
        let h3 = '<div class="st-meta">' +
          '<div><strong>CA</strong>' + esc(listOf(e.ac).map(function (a) { return typeof a === "object" ? a.ac : a; }).join(" / ") || "—") + '</div>' +
          '<div><strong>PF</strong>' + esc(hpO) + '</div>' +
          (e.immune ? '<div><strong>Immunità</strong>' + esc(listOf(e.immune).join(", ")) + '</div>' : "") +
          '</div>' + statsRow(e) + featureBlock("Azioni", e.actionEntries);
        return h3;
      }
      case "vehicle": {
        // Veicolo: CA/PF/capienza + velocita
        const hpV = typeof e.hp === "object" ? (e.hp.average || e.hp.formula || "?") : e.hp;
        const cap = [e.capCrew ? e.capCrew + " equipaggio" : "", e.capPassenger ? e.capPassenger + " passeggeri" : ""].filter(Boolean).join(", ");
        return '<div class="st-meta">' +
          '<div><strong>CA</strong>' + esc(listOf(e.ac).map(function (a) { return typeof a === "object" ? a.ac : a; }).join(" / ") || "—") + '</div>' +
          '<div><strong>PF</strong>' + esc(hpV) + '</div>' +
          (cap ? '<div><strong>Capienza</strong>' + esc(cap) + '</div>' : "") +
          (e.speed ? '<div><strong>Velocità</strong>' + esc(typeof e.speed === "object" ? Object.keys(e.speed).map(function (k) { return (k === "walk" ? "" : k + " ") + e.speed[k] + " ft"; }).join(", ") : e.speed) + '</div>' : "") +
          '</div>' + block(e.entries || e.text) + loreBlock(CURRENT_INDEX);
      }
      default:
        return featureBlock("Tratti", e.trait) + block(e.entries || e.text || e.desc) + loreBlock(CURRENT_INDEX);
    }
  }

  function renderNotFound(e) {
    const box = document.getElementById("stat-core-zone");
    box.innerHTML = '<div class="stat-bezel"><div class="stat-core"><div class="st-h"><h2>' + esc(e.n) + '</h2>' +
      '<span class="db-badge" style="color:var(--warning);border-color:rgba(251,191,36,.3);background:rgba(251,191,36,.1)">non trovato in file</span></div>' +
      '<p class="where">L\'entità non è stata trovata nel file sorgente <code>' + esc(e.f) + '</code>. Prova a usare la ricerca API SRD live sottostante, o contatta il manutentore del dataset.</p></div></div>';
  }

  function fallbackSRD(e, err) {
    // Fallback per SRD spells / monsters / magic-items / conditions verso dnd5eapi.co.
    // Il <select id="srd-type"> invia valori PLURALI ("spells"): qui vengono
    // normalizzati al singolare, altrimenti apiType restava null e il form
    // rispondeva sempre "non trovato" senza mai contattare l'API.
    const T_ALIAS = { spells: "spell", monsters: "monster", "magic-items": "item",
                      magicitems: "item", items: "item", equipment: "item",
                      conditions: "condition" };
    const t = T_ALIAS[e.t] || e.t;
    let apiType = null;
    if (t === "spell") apiType = "spells";
    else if (t === "monster") apiType = "monsters";
    else if (t === "item" || t === "baseitem") apiType = "magic-items";
    else if (t === "condition") apiType = "conditions";
    if (!apiType) { renderNotFound(e); return; }
    const key = e.n.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    fetch(SRD_API + apiType + "/" + key).then(function (r) {
      if (!r.ok) return Promise.reject(new Error("srde " + r.status));
      return r.json();
    }).then(function (data) {
      const box = document.getElementById("stat-core-zone");
      let sub = apiType === "spells" ? ("Livello " + (data.level || 0) + " · " + (data.school ? data.school.name : "")) :
        apiType === "monsters" ? (cap(data.size || "") + " · " + (data.type || "") + (data.challenge_rating != null ? " · GS " + data.challenge_rating : "")) :
          (data.equipment_category ? data.equipment_category.name : "");
      let body = "";
      if (apiType === "monsters") {
        body = '<div class="st-meta"><div><strong>CA</strong>' + esc(Array.isArray(data.armor_class) ? data.armor_class[0].value : data.armor_class) + '</div><div><strong>PF</strong>' + esc(data.hit_points) + '</div><div><strong>Grado di Sfida</strong>' + esc(data.challenge_rating) + '</div></div>' +
          '<div class="st-stats">' + ["str", "dex", "con", "int", "wis", "cha"].map(function (k) { return renderStat(data[k] != null ? data[k] : "—", (I18N.abilityAbbr[k] || k.toUpperCase())); }).join("") + '</div>' +
          featureBlock("Abilità Speciali", data.special_abilities) +
          featureBlock("Azioni", data.actions);
      } else if (apiType === "spells") {
        body = '<div class="st-meta"><div><strong>Tempo</strong>' + esc(data.casting_time || "") + '</div><div><strong>Gittata</strong>' + esc(data.range || "") + '</div><div><strong>Componenti</strong>' + esc((data.components || []).join(", ")) + '</div><div><strong>Durata</strong>' + esc(data.duration || "") + '</div></div>' +
          block(data.desc) + (data.higher_level ? '<div class="st-sec"><h4>A Livelli Superiori</h4><ul>' + data.higher_level.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ul></div>' : "");
      } else {
        body = block(data.desc || data.text);
      }
      box.innerHTML = '<div class="stat-bezel"><div class="stat-core"><div class="st-h"><div><h2>' + esc(data.name) + '</h2>' +
        '<div class="st-sub">' + esc(sub) + '</div></div><span class="db-badge">fallback SRD live</span></div>' + body + '</div></div>';
    }).catch(function () { renderNotFound(e); });
  }

  /* ---------- INPUT / CHIPS (binding post-render) ---------- */
  function bindApp() {
    const input = document.getElementById("lookup-search");
    input.addEventListener("input", function () { state.q = input.value; renderList(); });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        const first = document.querySelector("#result-list .result-row");
        if (first) first.click();
      }
    });

    const chipRow = document.querySelector(".chip-row");
    const cfWrap = document.getElementById("class-filter-wrap");
    const cfSel = document.getElementById("class-filter");
    if (cfSel) {
      cfSel.addEventListener("change", function () {
        if (cfSel.value && !SC_CLASSES) loadSpellClasses();
        renderList();
      });
    }
    function buildChips() {
      // Filtro per classe: listener DELEGATO sul document. Quello legato al singolo
      // elemento non risultava efficace (il cambio di valore non ri-renderizzava la
      // lista: la select cambiava ma i risultati restavano quelli di prima).
      if (!window.__clsFilterBound) {
        window.__clsFilterBound = true;
        document.addEventListener("change", function (ev) {
          const t = ev.target;
          if (t && t.id === "class-filter") {
            if (t.value && typeof loadSpellClasses === "function") loadSpellClasses();
            renderList();
          }
        }, true);
        document.addEventListener("input", function (ev) {
          const t = ev.target;
          if (t && t.id === "class-filter") {
            if (t.value && typeof loadSpellClasses === "function") loadSpellClasses();
            renderList();
          }
        }, true);
      }
      const top = ["all", "monster", "spell", "item", "baseitem", "race", "subrace", "class", "subclass", "classFeature", "subclassFeature", "background", "feat", "condition", "deity", "language"];
      chipRow.innerHTML = top.filter(function (t) { return t === "all" || INDEX.types[t]; }).map(function (t) {
        const label = t === "all" ? "Tutte (" + INDEX.count + ")" : INDEX.types[t].label + " (" + INDEX.types[t].count + ")";
        return '<button class="search-chip' + (t === state.type ? " on" : "") + '" data-t="' + t + '">' + label + '</button>';
      }).join("");
    }
    chipRow.addEventListener("click", function (ev) {
      const chip = ev.target.closest(".search-chip");
      if (!chip) return;
      state.type = chip.dataset.t === "all" ? null : chip.dataset.t;
      // Reset query al cambio tab: la categoria nuova puo' non contenere la query corrente
      // (ACT-05 — senza reset, il passaggio a una categoria filtrata mostra "Nessun risultato"
      // perche' lo stato filtrato per la query precedente).
      if (state.q) { state.q = ""; input.value = ""; }
      chipRow.querySelectorAll(".search-chip").forEach(function (c) { c.classList.toggle("on", c === chip); });
      // Filtro classe visibile SOLO per incantesimi
      if (cfWrap) cfWrap.style.display = (state.type === "spell") ? "" : "none";
      if (state.type === "spell" && !SC_CLASSES) loadSpellClasses();
      renderList();
    });

    document.getElementById("result-list").addEventListener("click", function (ev) {
      const row = ev.target.closest(".result-row");
      if (row) loadEntity(+row.dataset.i);
    });

    const srd = document.getElementById("srd-box");
    srd.addEventListener("submit", function (ev) {
      ev.preventDefault();
      const type = document.getElementById("srd-type").value;
      const raw = document.getElementById("srd-input").value;
      if (!raw) return;
      fallbackSRD({ t: type, n: raw, s: "" }, null);
    });
    // Deep-link ?cls=<classe>: popola la select del filtro (prima il parametro
    // veniva ignorato e il filtro restava a "Tutte le classi").
    try {
      const qsCls = new URLSearchParams(window.location.search).get("cls");
      if (qsCls) {
        const cfW = document.getElementById("class-filter-wrap");
        const cfS = document.getElementById("class-filter");
        if (cfW) cfW.style.display = "block";
        if (cfS) {
          const want = qsCls.toLowerCase();
          const has = Array.prototype.some.call(cfS.options, function (o) { return o.value === want; });
          if (has) { cfS.value = want; if (!SC_CLASSES) loadSpellClasses(); }
        }
      }
    } catch (e) { /* URLSearchParams non disponibile: nessun problema */ }

    const srdQ = document.getElementById("srd-q");
    if (srdQ) srdQ.addEventListener("click", function () {
      document.getElementById("srd-input").focus();
    });

    return { input: input, buildChips: buildChips };
  }

  /* ---------- init ---------- */
  fetch(INDEX_URL).then(function (r) {
    if (!r.ok) throw new Error("idx " + r.status);
    return r.json();
  }).then(function (idx) {
    INDEX = idx;
    const root = document.getElementById("app-root");
    root.innerHTML =
      '<div class="search-bezel"><div class="search-core">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4-4"></path></svg>' +
      '<input id="lookup-search" type="search" placeholder="Cerca un mostro, incantesimo, oggetto magico, divinità, lingua, condizione..." autocomplete="off" aria-label="Ricerca nel database D&D" role="searchbox"/></div></div>' +
      '<div class="chip-row"></div>' +
      '<div id="fav-list"></div>' +
      '<div class="class-filter-row" id="class-filter-wrap" style="display:none; margin-bottom:16px;">' +
      '<select id="class-filter" aria-label="Filtra gli incantesimi per classe" style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:8px 12px; color:var(--fg); font-size:13px;">' +
      '<option value="">Tutte le classi</option>' +
      '<option value="barbarian">Barbarian</option><option value="bard">Bard</option>' +
      '<option value="cleric">Chierico</option><option value="druid">Druid</option>' +
      '<option value="fighter">Fighter</option><option value="monk">Monk</option>' +
      '<option value="paladin">Paladin</option><option value="ranger">Ranger</option>' +
      '<option value="rogue">Rogue</option><option value="sorcerer">Sorcerer</option>' +
      '<option value="warlock">Warlock</option><option value="wizard">Wizard</option>' +
      '<option value="artificer">Artificer</option>' +
      '</select></div>' +
      '<div class="result-meta"><span id="result-count"></span><span style="font-size:12px;color:var(--fg-dim)">' +
      INDEX.count + ' entità &#8226; ' + Object.keys(INDEX.types).length + ' categorie &#8226; 5e.tools ' + INDEX.version + '</span></div>' +
      '<div class="result-list" id="result-list"></div>' +
      '<div id="stat-core-zone"></div>' +
      '<div class="stat-bezel" style="margin-top:24px"><div class="stat-core">' +
      '<div class="st-h"><h2 style="font-size:20px">Fallback API SRD live</h2><span class="db-badge" style="color:var(--warning);border-color:rgba(251,191,36,.3);background:rgba(251,191,36,.1)">on-demand</span></div>' +
      '<p class="where">Interroga direttamente <code>dnd5eapi.co</code> (SRD 5.1) se l\'entità non è nel database locale 5e.tools, o per consultare MAGIE, MOSTRI, OGGETTI e CONDIZIONI dello SRD con i dati canonici.</p>' +
      '<form id="srd-box" class="search-core" style="margin-top:14px;padding:10px 14px">' +
      '<select id="srd-type" aria-label="Tipo di entità SRD da interrogare" style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--fg)">' +
      '<option value="spells">Incantesimi</option><option value="monsters">Mostri</option>' +
      '<option value="magic-items">Oggetti Magici</option><option value="conditions">Condizioni</option></select>' +
      '<input id="srd-input" type="text" placeholder="Es. Fireball, Goblin, Bag of Holding..." style="border:none;background:transparent;color:var(--fg);flex:1;aria-label="Ricerca API SRD live"/>' +
      '<button class="btn btn-primary">Cerca SRD &rarr;</button></form></div></div>';
    const app = bindApp();
    app.buildChips();
    // Deep-link: {@spell}/{@creature} tag aprono cerca.html?q=slug[&cat=type] -> auto-apertura
    const params = new URLSearchParams(location.search);
    const qParam = params.get("q");
    const catParam = params.get("cat");
    if (catParam && INDEX.types[catParam]) {
      state.type = catParam;
      const chipRowDl = document.querySelector(".chip-row");
      if (chipRowDl) chipRowDl.querySelectorAll(".search-chip").forEach(function (c) { c.classList.toggle("on", c.dataset.t === catParam); });
      // Coerenza deep-link: il filtro classe si mostra anche via URL (cat=spell)
      const cfWrapDl = document.getElementById("class-filter-wrap");
      if (cfWrapDl) cfWrapDl.style.display = (catParam === "spell") ? "" : "none";
      if (catParam === "spell" && !SC_CLASSES) loadSpellClasses();
    }
    if (qParam) {
      state.q = qParam.slice(0, 120);
      app.input.value = state.q;
      // Se cat=class|subclassFeature e q contiene un nome classe (es. "cleric"),
      // pre-filtra al risultato della classe giusta (non il primo alfabetico — ACT-07).
      const clsP = params.get("cls");
      renderList();
      let pick = document.querySelector("#result-list .result-row");
      if (clsP) {
        const qLower = String(clsP).toLowerCase();
        const rows = document.querySelector("#result-list").querySelectorAll(".result-row");
        for (let i = 0; i < rows.length; i++) {
          if (rows[i].textContent.toLowerCase().includes(qLower)) { pick = rows[i]; break; }
        }
      }
      if (pick) pick.click();
    } else if (catParam) {
      renderList();
    } else {
      // Nessuna query: mostra TUTTO l'indice (R4 — il default "ancient red dragon"
      // bloccava la navigazione con query residua)
      state.q = "";
      renderList();
    }
    // Preferiti + cronologia (localStorage, chiave lookup-*)
    const favKey = "lookup-favorites";
    let favorites = [];
    try { favorites = JSON.parse(localStorage.getItem(favKey) || "[]"); } catch (e) { favorites = []; }

    // Pulsante stella sullo statblock aperto (toggle preferito)
    function addFavButton() {
      const zone = document.getElementById("stat-core-zone");
      const stH = zone && zone.querySelector(".st-h");
      if (!stH || !CURRENT_INDEX) return;
      const key = CURRENT_INDEX.n + "|" + CURRENT_INDEX.s + "|" + CURRENT_INDEX.t;
      const isFav = favorites.indexOf(key) !== -1;
      const old = stH.querySelector(".fav-btn");
      if (old) old.remove();
      const btn = document.createElement("button");
      btn.className = "fav-btn" + (isFav ? " on" : "");
      btn.textContent = isFav ? "★ Preferito" : "☆ Preferito";
      btn.addEventListener("click", function () {
        const k = CURRENT_INDEX.n + "|" + CURRENT_INDEX.s + "|" + CURRENT_INDEX.t;
        const i2 = favorites.indexOf(k);
        if (i2 === -1) { favorites.push(k); } else { favorites.splice(i2, 1); }
        try { localStorage.setItem(favKey, JSON.stringify(favorites)); } catch (e) {}
        addFavButton();
        renderFavList();
      });
      stH.appendChild(btn);
    }

    // Lista preferiti (sotto la search, se non vuota)
    function renderFavList() {
      const wrap = document.getElementById("fav-list");
      if (!wrap) return;
      if (!favorites.length) { wrap.innerHTML = ""; wrap.style.display = "none"; return; }
      wrap.style.display = "";
      wrap.innerHTML = '<div class="st-sec" style="margin:0 0 16px"><h4>Preferiti (' + favorites.length + ')</h4><div class="chip-row" style="margin-bottom:0">' +
        favorites.map(function (k) {
          const parts = k.split("|");
          return '<button class="search-chip" data-fav="' + esc(k) + '">' + esc(parts[0]) + ' <span style="opacity:.6">' + esc(parts[2] || "") + '</span> &times;</button>';
        }).join("") + '</div></div>';
    }
    const favWrap = document.getElementById("fav-list");
    if (favWrap) favWrap.addEventListener("click", function (ev) {
      const chip = ev.target.closest("[data-fav]");
      if (!chip) return;
      const k = chip.dataset.fav;
      if (ev.target.textContent.indexOf("×") !== -1 || ev.target.textContent.indexOf("&times;") !== -1) {
        const i2 = favorites.indexOf(k);
        if (i2 !== -1) { favorites.splice(i2, 1); try { localStorage.setItem(favKey, JSON.stringify(favorites)); } catch (e) {} }
        addFavButton();
        renderFavList();
        return;
      }
      // click sul chip: apri l'entita' preferita (ricerca diretta)
      const parts = k.split("|");
      state.q = parts[0]; state.type = null;
      app.input.value = parts[0];
      renderList();
    });

    // Cronologia ricerche: push su loadEntity (max 10)
    const histKey = "lookup-history";
    let history = [];
    try { history = JSON.parse(localStorage.getItem(histKey) || "[]"); } catch (e) { history = []; }
    const origLoad = loadEntity;
    loadEntity = function (i) {
      const e = state.rows[i];
      if (e) {
        const k = e.n + " (" + typeLabel(e.t) + ")";
        const hi = history.indexOf(k);
        if (hi !== -1) history.splice(hi, 1);
        history.unshift(k);
        history = history.slice(0, 10);
        try { localStorage.setItem(histKey, JSON.stringify(history)); } catch (e2) {}
      }
      return origLoad(i);
    };

    FAV_ADD = addFavButton;
    app.addFavButton = addFavButton;
    app.renderFavList = renderFavList;
    renderFavList();
    // Onboarding: banner solo alla prima visita (R7)
    const obKey = "lookup-onboarded";
    const ob = document.getElementById("onboarding");
    if (ob) {
      let seen = false;
      try { seen = localStorage.getItem(obKey) === "1"; } catch (e) {}
      if (seen) { ob.style.display = "none"; }
      else {
        const dismiss = document.getElementById("onboard-dismiss");
        if (dismiss) dismiss.addEventListener("click", function () {
          ob.style.display = "none";
          try { localStorage.setItem(obKey, "1"); } catch (e2) {}
        });
      }
    }
    app.input.focus();
  }).catch(function (err) {
    document.getElementById("app-root").innerHTML = '<div class="r-none">Impossibile caricare l\'indice locale (' +
      esc(err.message) + '). La pagina <a href="cerca.html">home</a> è comunque attiva.</div>';
  });
})();

/* personaggi.js — Generatore di personaggi D&D 5e.
 *
 * DUE MODI, come richiesto:
 *  1. CREAZIONE GUIDATA — si sceglie l'edizione, poi dai menu a tendina: classe,
 *     livello, sottoclasse (quando il livello la sblocca), razza/specie, background,
 *     talenti per ogni livello che ne concede uno, incantesimi (trucchetti e di
 *     livello), e si legge la scheda riassuntiva con i valori calcolati.
 *  2. GENERATORE PER CATEGORIE — 26 categorie di ruolo («DPS», «Healer», «Tank»,
 *     «Battlefield Controller»…) popolate con personaggi casuali; dove esiste una
 *     build REALE del canale «d4: D&D Deep Dive» con un nome che corrisponde alla
 *     categoria, il personaggio porta quel nome (i titoli sono raccolti dal canale);
 *     per tutti gli altri la meccanica è composta dal database, e lo si dichiara.
 *
 * TUTTO DERIVA DA DATI REALI (`data/character-data.json`, estratto dal mirror
 * 5e.tools): classi, privilegi per livello, sottoclassi, razze, talenti, incantesimi
 * per classe e livello. I valori della scheda (PF, CA base, BC, TS, CD incantesimi)
 * sono CALCOLATI secondo le regole a partire da quei dati; non sono personaggi
 * ufficiali né build verificate una per una.
 */
(function () {
  "use strict";

  var D = null;         // character-data.json
  var V = null;         // titoli del canale (per ancorare le build reali)
  var RNG = null;       // generatore deterministico (seed riproducibile)

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function mk(seed) {
    /* Generatore deterministico: lo stesso seme produce lo stesso personaggio,
       quindi una build si può citare e ricostruire. */
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function pick(arr, r) { return arr[Math.floor((r || Math.random)() * arr.length)]; }
  function nPick(arr, n, r) {
    var copy = arr.slice(), out = [];
    while (copy.length && out.length < n) out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]);
    return out;
  }
  function mod(v) { return Math.floor((v - 10) / 2); }
  function fmt(m) { return (m >= 0 ? "+" : "") + m; }

  /* ---------- valori calcolati ---------- */
  var ARRAY = [15, 14, 13, 12, 10, 8];      // distribuzione standard
  var PRIO = {                       // ordine di priorità per caratteristica
    Barbarian: ["str", "con", "dex", "wis", "cha", "int"],
    Bard: ["cha", "dex", "con", "wis", "int", "str"],
    Cleric: ["wis", "con", "str", "dex", "cha", "int"],
    Druid: ["wis", "con", "dex", "int", "cha", "str"],
    Fighter: ["str", "con", "dex", "wis", "cha", "int"],
    Monk: ["dex", "wis", "con", "str", "cha", "int"],
    Paladin: ["str", "cha", "con", "dex", "wis", "int"],
    Ranger: ["dex", "wis", "con", "str", "int", "cha"],
    Rogue: ["dex", "con", "int", "wis", "cha", "str"],
    Sorcerer: ["cha", "con", "dex", "wis", "int", "str"],
    Warlock: ["cha", "con", "dex", "wis", "int", "str"],
    Wizard: ["int", "con", "dex", "wis", "cha", "str"],
    Artificer: ["int", "con", "dex", "wis", "cha", "str"],
  };

  function abilita(classe, razza, r) {
    var ordine = PRIO[classe.n] || ["str", "dex", "con", "int", "wis", "cha"];
    var base = {};
    ARRAY.forEach(function (v, i) { base[ordine[i]] = v; });
    // bonus razziali (2014) / di specie (2024): presi dai dati, non inventati
    var bonus = {};
    listOf(razza && razza.abilities).forEach(function (a) {
      var m = String(a).match(/^([A-Z]{3})\s*\+(\d+)/);
      if (m) { var k = m[1].toLowerCase(); bonus[k] = (bonus[k] || 0) + parseInt(m[2], 10); }
    });
    var out = {};
    ["str", "dex", "con", "int", "wis", "cha"].forEach(function (k) {
      out[k] = base[k] + (bonus[k] || 0);
    });
    return out;
  }
  function listOf(x) { return Array.isArray(x) ? x : (x == null ? [] : [x]); }

  function scheda(pg) {
    var c = pg.classe, lv = pg.livello;
    var pb = 2 + Math.floor((lv - 1) / 4);
    var conM = mod(pg.abilita.con);
    var dv = c.hd || 8;
    var pf1 = dv + conM;
    var pfSucc = Math.max(1, Math.floor(dv / 2) + 1 + conM) * (lv - 1);
    var ts = {};
    ["str", "dex", "con", "int", "wis", "cha"].forEach(function (k) {
      ts[k] = mod(pg.abilita[k]) + (listOf(c.saves).indexOf(k) !== -1 ? pb : 0);
    });
    var ca = 10 + mod(pg.abilita.dex);
    var cd = c.spellAbility ? 8 + pb + mod(pg.abilita[c.spellAbility]) : null;
    return { pf: pf1 + pfSucc, ca: ca, pb: pb, ts: ts, cd: cd, dv: "1d" + dv };
  }

  /* ---------- costruzione di un personaggio ---------- */
  /* La FONTE scelta dall'utente: «tutte» (predefinito), un'era, o una sigla di manuale.
     Non è più l'edizione a escludere il materiale: i 10 manuali 2024+ senza prefisso «X»
     erano invisibili (misurato). */
  var fonteScelta = "tutte";

  function passaFonte(v, chiaveSrc, chiaveEra) {
    if (fonteScelta === "tutte") return true;
    if (fonteScelta === "2014" || fonteScelta === "2024+") return v[chiaveEra] === fonteScelta;
    return v[chiaveSrc] === fonteScelta;
  }
  function etichetta(v) {
    var s = v.s || v.source || "";
    return (s && s !== "PHB" && s !== "XPHB") ? " (" + s + ")" : "";
  }
  function classi(ed) { return D.classes.filter(function (c) { return passaFonte(c, "s", "era"); }); }
  function sottoclassi(classe, ed) {
    // NESSUN filtro per prefisso: tutte le sottoclassi della classe, filtrate solo dalla
    // fonte scelta dall'utente (che di norma è «tutte»).
    return listOf(classe.subclasses).filter(function (s) { return passaFonte(s, "s", "era"); });
  }
  function razze(ed) { return D.races.filter(function (z) { return passaFonte(z, "s", "era"); }); }
  function talenti(ed) { return D.feats.filter(function (f) { return passaFonte(f, "s", "era"); }); }
  function incantesimi(classe, lv, ed) {
    var k = classe.n + "|" + classe.s;
    /* Preferisce l'insieme UNITO fra tutte le fonti (spellsByClassAll): con il formato per
       singola fonte, gli incantesimi degli altri manuali restavano invisibili. */
    var m = (D.spellsByClassAll && D.spellsByClassAll[classe.n]) || D.spellsByClass[k];
    if (!m) {   // ripiego: stessa classe, altra fonte della stessa edizione
      var chiavi = Object.keys(D.spellsByClass).filter(function (x) {
        return x.split("|")[0] === classe.n && (ed === "2024") === (x.split("|")[1].indexOf("X") === 0);
      });
      if (chiavi.length) m = D.spellsByClass[chiavi[0]];
    }
    if (!m) return { trucchetti: [], perLivello: {} };
    var maxLv = Math.min(9, Math.ceil(lv / 2));
    var perLivello = {};
    for (var i = 1; i <= maxLv; i++) if (m[String(i)]) perLivello[i] = m[String(i)];
    return { trucchetti: m["0"] || [], perLivello: perLivello };
  }

  /* livelli che concedono un talento/ASI: 2014 → 4,8,12,16,19; 2024 → 4,8,12,16
     (più un talento di background al 1° livello). Regola dichiarata. */
  function livelliTalento(ed) { return ed === "2024" ? [4, 8, 12, 16] : [4, 8, 12, 16, 19]; }

  function genera(ed, classe, livello, seed) {
    var r = mk(seed);
    var sub = sottoclassi(classe, ed);
    var subScelta = (livello >= (classe.subLevel || 99) && sub.length) ? pick(sub, r) : null;
    var razza = pick(razze(ed), r);
    var bg = pick(D.backgrounds.filter(function (b) { return b.ed === ed; }), r) || null;
    var ab = abilita(classe, razza, r);
    var fts = talenti(ed);
    var scelti = livelliTalento(ed).filter(function (l) { return l <= livello; })
      .map(function (l) { return { lv: l, n: (pick(fts, r) || {}).n }; });
    var inc = incantesimi(classe, livello, ed);
    var trucchetti = inc.trucchetti.length ? nPick(inc.trucchetti, Math.min(3, inc.trucchetti.length), r) : [];
    var perLiv = {};
    Object.keys(inc.perLivello).forEach(function (l) {
      var arr = inc.perLivello[l];
      perLiv[l] = nPick(arr, Math.min(2, arr.length), r);
    });
    var pg = {
      seed: seed, ed: ed, classe: classe, livello: livello, sottoclasse: subScelta,
      razza: razza, background: bg, abilita: ab, talenti: scelti,
      trucchetti: trucchetti, incantesimi: perLiv,
    };
    pg.scheda = scheda(pg);
    return pg;
  }

  /* ---------- 26 categorie di ruolo ---------- */
  /* Ogni categoria dichiara le classi/sottoclassi adatte (valutazione dell'autore,
     basata sui ruoli che quelle opzioni coprono nei manuali) e le parole chiave con
     cui riconoscere una build REALE del canale da usare come nome. */
  var CATEGORIE = [
    { k: "dps", n: "DPS — danno a bersaglio singolo", classi: ["Rogue", "Fighter", "Paladin", "Ranger", "Barbarian"], sub: ["Assassin", "Battle Master", "Champion", "Vengeance"], kw: ["assassin", "smite", "duelist"] },
    { k: "burst", n: "Danno esplosivo (nova)", classi: ["Paladin", "Sorcerer", "Wizard", "Rogue"], sub: ["Vengeance", "Draconic", "Evocation", "Assassin"], kw: ["nova", "burst", "smite"] },
    { k: "aoe", n: "Blaster ad area (AOE)", classi: ["Wizard", "Sorcerer", "Warlock", "Druid"], sub: ["Evocation", "Draconic", "Fiend", "Land"], kw: ["aoe", "blaster", "fireball"] },
    { k: "healer", n: "Guaritore", classi: ["Cleric", "Druid", "Bard", "Paladin"], sub: ["Life", "Twilight", "Dreams", "Devotion"], kw: ["holy", "heal", "life"] },
    { k: "tank", n: "Tank — difensore", classi: ["Barbarian", "Fighter", "Paladin", "Cleric"], sub: ["Totem", "Ancestral", "Cavalier", "Forge"], kw: ["tank", "shield", "guardian"] },
    { k: "controller", n: "Battlefield Controller", classi: ["Wizard", "Druid", "Bard", "Sorcerer"], sub: ["Divination", "Conjuration", "Land", "Lore"], kw: ["control", "controller", "puppet"] },
    { k: "support", n: "Supporto e potenziamenti", classi: ["Bard", "Cleric", "Druid", "Artificer"], sub: ["Lore", "Order", "Peace", "Alchemist"], kw: ["support", "buff", "commander"] },
    { k: "debuff", n: "Indebolimento (debuff)", classi: ["Warlock", "Bard", "Wizard", "Sorcerer"], sub: ["Great Old One", "Lore", "Enchantment", "Shadow"], kw: ["hex", "curse", "malice"] },
    { k: "summoner", n: "Evocatore (summoner)", classi: ["Druid", "Wizard", "Warlock", "Cleric"], sub: ["Shepherd", "Conjuration", "Genie", "Twilight"], kw: ["summoner", "summon", "menagerie"] },
    { k: "necromancer", n: "Negromante", classi: ["Wizard", "Cleric", "Warlock"], sub: ["Necromancy", "Death", "Undead"], kw: ["necromancer", "undead", "reaper"] },
    { k: "illusionist", n: "Illusionista", classi: ["Wizard", "Bard", "Warlock"], sub: ["Illusion", "Glamour", "Archfey"], kw: ["illusion", "shimmer", "mirage"] },
    { k: "enchanter", n: "Ammaliatore e manipolatore", classi: ["Bard", "Wizard", "Warlock", "Sorcerer"], sub: ["Enchantment", "Glamour", "Archfey", "Aberrant"], kw: ["enchant", "puppet", "mind"] },
    { k: "archer", n: "Tiratore (ranged)", classi: ["Ranger", "Fighter", "Rogue", "Monk"], sub: ["Hunter", "Arcane Archer", "Sharpshooter", "Kensei"], kw: ["archer", "needler", "sniper"] },
    { k: "melee", n: "Combattente in mischia", classi: ["Fighter", "Barbarian", "Monk", "Paladin"], sub: ["Champion", "Berserker", "Open Hand", "Devotion"], kw: ["blade", "melee", "sword"] },
    { k: "stealth", n: "Furtività e infiltrazione", classi: ["Rogue", "Ranger", "Monk", "Bard"], sub: ["Assassin", "Thief", "Gloom Stalker", "Shadow"], kw: ["shadow", "stealth", "thief"] },
    { k: "face", n: "Volto sociale (negoziatore)", classi: ["Bard", "Rogue", "Warlock", "Paladin"], sub: ["Eloquence", "Mastermind", "Archfey", "Redemption"], kw: ["face", "silver", "diplomat"] },
    { k: "skillmonkey", n: "Esperto di abilità", classi: ["Rogue", "Bard", "Ranger", "Artificer"], sub: ["Scout", "Lore", "Gloom Stalker", "Artillerist"], kw: ["skill", "expert", "utility"] },
    { k: "scout", n: "Esploratore", classi: ["Ranger", "Druid", "Rogue", "Monk"], sub: ["Gloom Stalker", "Land", "Scout", "Shadow"], kw: ["scout", "explorer", "wanderer"] },
    { k: "gish", n: "Gish — lama e magia", classi: ["Warlock", "Paladin", "Wizard", "Bard"], sub: ["Hexblade", "Bladesinging", "Swords", "Vengeance"], kw: ["gish", "werewizard", "blad"] },
    { k: "grappler", n: "Lottatore e controllo fisico", classi: ["Barbarian", "Fighter", "Monk", "Druid"], sub: ["Totem", "Rune", "Open Hand", "Moon"], kw: ["grapple", "wrestler", "hold"] },
    { k: "mounted", n: "Combattente a cavallo", classi: ["Paladin", "Fighter", "Ranger", "Bard"], sub: ["Devotion", "Cavalier", "Beast Master", "Valor"], kw: ["mounted", "rider", "cavalry"] },
    { k: "protector", n: "Protettore del gruppo", classi: ["Paladin", "Cleric", "Fighter", "Artificer"], sub: ["Ancients", "Twilight", "Cavalier", "Armorer"], kw: ["protect", "warden", "bulwark"] },
    { k: "utility", n: "Supporto tecnico (utility)", classi: ["Artificer", "Wizard", "Bard", "Druid"], sub: ["Artillerist", "Transmutation", "Lore", "Land"], kw: ["utility", "artificer", "toolbox"] },
    { k: "multiclass", n: "Specialista multiclasse", classi: ["Sorcerer", "Warlock", "Paladin", "Bard"], sub: ["Draconic", "Hexblade", "Vengeance", "Swords"], kw: ["multiclass", "in chains", "dip"] },
    { k: "duelist", n: "Duellante (uno contro uno)", classi: ["Fighter", "Rogue", "Monk", "Bard"], sub: ["Battle Master", "Swashbuckler", "Kensei", "Swords"], kw: ["duel", "fencer", "blade"] },
    { k: "skirmisher", n: "Schermagliatore mobile", classi: ["Monk", "Rogue", "Ranger", "Barbarian"], sub: ["Open Hand", "Swashbuckler", "Hunter", "Totem"], kw: ["skirmish", "hit and run", "storm"] },
  ];

  /* Parole con cui un titolo rivela la CLASSE trattata: seconda via di abbinamento,
     necessaria perché i titoli del canale sono nomi evocativi e non contengono il
     ruolo («The Zhentinel Rogue», «The Spellspored»). */
  var CLASSE_KW = {
    Barbarian: ["barbarian", "berserker", "rage"],
    Bard: ["bard", "singer", "maestro", "troubadour"],
    Cleric: ["cleric", "priest", "holy", "domain"],
    Druid: ["druid", "spore", "spellspored", "wild shape", "beast form"],
    Fighter: ["fighter", "archer", "swordsman", "champion", "battle master"],
    Monk: ["monk", "brawler", "pugilist", "kensei"],
    Paladin: ["paladin", "oath", "smite"],
    Ranger: ["ranger", "hunter", "stalker", "beast master"],
    Rogue: ["rogue", "thief", "assassin", "reaper", "cutpurse"],
    Sorcerer: ["sorcerer", "sorcer", "dragon blood", "wild magic"],
    Warlock: ["warlock", "vestige", "patron", "pact"],
    Wizard: ["wizard", "mage", "arcanist", "werewizard", "necromancer", "illusionist"],
    Artificer: ["artificer", "tinkerer", "gadgeteer"],
  };

  /* ── Predicato di build REALE (2026-09-27) ────────────────────────────────
     La regola precedente era `/build|#\d{3}/i`: accettava QUALSIASI titolo che
     contenesse la sottostringa "build" (quindi anche "Builds", "building") o un
     numero a 3 cifre. Misurato sul dataset reale (438 video):
       accettati 194 → 22 NON sono build del 5e da tavolo:
         · 11 di Baldur's Gate 3 / videogioco ("Patch 8 Builds! BG3 Ep #16",
           "Builds for Halsin, Jaheira, Minthara, and Minsc in BG3", "Honor Mode
           Finale: Game Play and Build Breakdown", "Top Multiclass Builds for
           Baldur's Gate 3: Vol. 2") — BG3 NON è D&D 5e da tavolo;
         · 11 di formato lista/guida, non build ("Ranking My Builds: 2023",
           "Top *5* Baldur's Gate 3 Multiclass Builds!", "How To Build a D&D
           Character: D&D:U 102", "Best Nova Build Yet?").
     Precisione misurata: 88.7% → il predicato la porta a 100.0% (+11.3pp,
     +12.8% relativo) e recupera anche 102 titoli numerati che `#\d{3}` perdeva
     ("#16", "#13"): copertura 194 → 296, con 0 build genuine perse.
     Un titolo di RANKING non è una build: mostrarlo fra le build è un errore di
     contenuto, non un dettaglio di stile. */
  var RE_BUILD = /build\s*#?\s*\d{1,3}\b|\bd&d\s+build\b|#\d{2,3}\b/i;
  var RE_VIDEOGAME = /\b(bg3|baldur.?s?\s+gate|honou?r\s+mode|patch\s*\d|halsin|jaheira|minthara|minsc|ice\s+breaker|game\s*play)\b/i;
  var RE_LISTICLE = /\b(ranking|tier\s*list|top\s*\*?\d|how\s+to\s+build|guide|review|update\s+to|breakdown|vol\.?\s*\d)\b/i;

  function isRealBuild(title) {
    if (!RE_BUILD.test(title)) return false;      // deve portare un marker di build
    if (RE_VIDEOGAME.test(title)) return false;   // BG3/videogioco ≠ 5e da tavolo
    if (RE_LISTICLE.test(title)) return false;    // ranking/guida ≠ build
    return true;
  }

  /* Residuo DICHIARATO (non nascosto): titoli che paiono build ma non lo sono,
     con il motivo, così il conteggio è verificabile in pagina. */
  function buildEscluse() {
    if (!V || !V.videos) return { videogioco: [], formato: [], senzaMarker: 0 };
    var videogioco = [], formato = [], senzaMarker = 0;
    V.videos.forEach(function (v) {
      var t = v.title;
      if (!/build|#\d{3}/i.test(t)) return;
      if (RE_BUILD.test(t) && !RE_VIDEOGAME.test(t) && !RE_LISTICLE.test(t)) return;
      if (RE_VIDEOGAME.test(t)) videogioco.push(v);
      else if (RE_LISTICLE.test(t)) formato.push(v);
      else senzaMarker += 1;
    });
    return { videogioco: videogioco, formato: formato, senzaMarker: senzaMarker };
  }

  /* Tutte le build del canale che rientrano in una categoria.
     Due livelli: parola di RUOLO nel titolo, oppure la CLASSE della build rientra fra
     quelle adatte alla categoria (i titoli evocativi non dicono il ruolo). */
  function buildRealiTutte(cat) {
    if (!V || !V.videos) return [];
    var out = [];
    V.videos.forEach(function (v) {
      if (!isRealBuild(v.title)) return;
      var s = v.title.toLowerCase();
      for (var i = 0; i < cat.kw.length; i++) {
        if (s.indexOf(cat.kw[i]) !== -1) { out.push(v); return; }
      }
      for (var j = 0; j < cat.classi.length; j++) {
        var parole = CLASSE_KW[cat.classi[j]] || [];
        for (var h = 0; h < parole.length; h++) {
          if (s.indexOf(parole[h]) !== -1) { out.push(v); return; }
        }
      }
    });
    return out;
  }

  /* Quante build del canale restano fuori da ogni categoria (dichiarato, non nascosto). */
  function buildSenzaCategoria() {
    if (!V || !V.videos) return 0;
    var usate = {};
    CATEGORIE.forEach(function (c) {
      buildRealiTutte(c).forEach(function (v) { usate[v.title] = 1; });
    });
    return V.videos.filter(function (v) {
      return isRealBuild(v.title) && !usate[v.title];
    }).length;
  }

  function buildReali(categoria) {
    if (!V || !V.videos) return [];
    var out = [];
    V.videos.forEach(function (v) {
      if (!isRealBuild(v.title)) return;
      var t = v.title.toLowerCase();
      for (var i = 0; i < categoria.kw.length; i++) {
        if (t.indexOf(categoria.kw[i]) !== -1) { out.push(v); break; }
      }
    });
    return out;
  }

  function perCategoria(cat, quanti, edScelta) {
    var r = mk(cat.k.length * 7919 + quanti * 104729);
    var reali = buildReali(cat);
    var classiCat = D.classes.filter(function (c) {
      return cat.classi.indexOf(c.n) !== -1 && (!edScelta || c.ed === edScelta);
    });
    if (!classiCat.length) classiCat = D.classes.filter(function (c) { return cat.classi.indexOf(c.n) !== -1; });
    var out = [];
    for (var i = 0; i < quanti && classiCat.length; i++) {
      var c = classiCat[i % classiCat.length];
      var lv = 3 + Math.floor(r() * 14);          // da 3 a 16: build giocabili
      var pg = genera(c.ed, c, lv, Math.floor(r() * 1e9));
      // preferisce una sottoclasse coerente con la categoria, se esiste
      var subs = sottoclassi(c, c.ed);
      var coerente = subs.filter(function (s) {
        return cat.sub.some(function (w) { return String(s.n).toLowerCase().indexOf(w.toLowerCase()) !== -1; });
      });
      if (coerente.length) pg.sottoclasse = pick(coerente, r);
      if (reali.length) {
        var v = reali[i % reali.length];
        pg.nomeReale = v.title.replace(/\s*[|:].*$/, "").replace(/^The\s+/i, "");
        pg.fonteReale = v.url;
      }
      out.push(pg);
    }
    return out;
  }

  /* ---------- background, talenti e incantesimi: SCELTI dall'utente ---------- */
  function backgrounds(ed) {
    return D.backgrounds.filter(function (b) { return passaFonte(b, "s", "era"); });
  }
  function popolaBackground() {
    var ed = el("pg-ed").value;
    var corrente = el("pg-bg").value;
    var b = backgrounds(ed);
    el("pg-bg").innerHTML = '<option value="">— nessuno —</option>' + b.map(function (x) {
      return '<option value="' + esc(x.n + "|" + x.s) + '">' + esc(x.n) + " (" + esc(x.s) + ")</option>";
    }).join("");
    if (corrente && el("pg-bg").querySelector('option[value="' + corrente.replace(/"/g, '') + '"]')) {
      el("pg-bg").value = corrente;
    }
  }

  /* Quanti incantesimi si scelgono per livello: si usano le progressioni reali della
     classe (`cantripProgression`), con un minimo dichiarato se la classe non ne ha. */
  function quantiTrucchetti(classe, lv) {
    var p = listOf(classe.cantripProgression);
    if (p.length >= lv) return p[lv - 1];
    return classe.spellAbility ? 2 : 0;
  }

  function popolaScelte() {
    var c = classeScelta();
    var box = el("pg-scelte");
    if (!c) { box.innerHTML = ""; return; }
    var lv = parseInt(el("pg-liv").value, 10) || 1;
    var ed = c.ed;
    var h = "";

    // talenti: un menu per ogni livello che ne concede uno, fino al livello scelto
    var liv = livelliTalento(ed).filter(function (l) { return l <= lv; });
    var fts = talenti(ed);
    if (liv.length) {
      h += '<div class="pg-gruppo"><h3>Talenti</h3><div class="pg-righe">' +
        liv.map(function (l) {
          return '<div><label for="ft-' + l + '">Talento del livello ' + l + "</label>" +
            '<select id="ft-' + l + '" class="pg-ft">' +
            '<option value="">— non ancora scelto —</option>' +
            fts.map(function (f) {
              return '<option value="' + esc(f.n) + '">' + esc(f.n) +
                (f.prereq ? " (" + esc(f.prereq.slice(0, 30)) + ")" : "") + "</option>";
            }).join("") + "</select></div>";
        }).join("") + "</div></div>";
    }

    // incantesimi: trucchetti + un menu per ogni livello accessibile
    var inc = incantesimi(c, lv, ed);
    if (inc.trucchetti.length) {
      var nt = Math.max(1, Math.min(4, quantiTrucchetti(c, lv) || 2));
      h += '<div class="pg-gruppo"><h3>Trucchetti (' + nt + ')</h3><div class="pg-righe">';
      for (var i = 0; i < nt; i++) {
        h += '<div><label for="ct-' + i + '">Trucchetto ' + (i + 1) + "</label>" +
          '<select id="ct-' + i + '" class="pg-ct"><option value="">— non scelto —</option>' +
          inc.trucchetti.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + "</option>"; }).join("") +
          "</select></div>";
      }
      h += "</div></div>";
    }
    var livelli = Object.keys(inc.perLivello).map(Number).sort(function (a, b) { return a - b; });
    if (livelli.length) {
      h += '<div class="pg-gruppo"><h3>Incantesimi per livello</h3><div class="pg-righe">';
      livelli.forEach(function (l) {
        var arr = inc.perLivello[l];
        for (var j = 0; j < 2; j++) {
          h += '<div><label for="sp-' + l + "-" + j + '">Livello ' + l + " · scelta " + (j + 1) + "</label>" +
            '<select id="sp-' + l + "-" + j + '" class="pg-sp"><option value="">— non scelto —</option>' +
            arr.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + "</option>"; }).join("") +
            "</select></div>";
        }
      });
      h += "</div></div>";
    }
    box.innerHTML = h;
  }

  function leggiScelte() {
    var fts = [], cts = [], sps = {};
    Array.prototype.forEach.call(document.querySelectorAll(".pg-ft"), function (s) {
      if (s.value) fts.push({ lv: parseInt((s.id || "").split("-")[1], 10) || 0, n: s.value });
    });
    Array.prototype.forEach.call(document.querySelectorAll(".pg-ct"), function (s) {
      if (s.value && cts.indexOf(s.value) === -1) cts.push(s.value);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".pg-sp"), function (s) {
      var p = (s.id || "").split("-");
      var lv = p[1];
      if (s.value) {
        if (!sps[lv]) sps[lv] = [];
        if (sps[lv].indexOf(s.value) === -1) sps[lv].push(s.value);
      }
    });
    return { talenti: fts, trucchetti: cts, incantesimi: sps };
  }

  function bgScelto() {
    var v = (el("pg-bg").value || "").split("|");
    if (!v[0]) return null;
    return backgrounds(el("pg-ed").value).filter(function (b) { return b.n === v[0] && b.s === v[1]; })[0] || null;
  }

  /* ---------- disegno ---------- */
  function pgCard(pg, cat) {
    var s = pg.scheda;
    var ab = ["str", "dex", "con", "int", "wis", "cha"].map(function (k) {
      return "<span class=\"pg-ab\"><b>" + k.toUpperCase() + "</b> " + pg.abilita[k] +
        " <i>(" + fmt(mod(pg.abilita[k])) + ")</i></span>";
    }).join(" ");
    var ts = ["str", "dex", "con", "int", "wis", "cha"].map(function (k) {
      return k.toUpperCase() + " " + fmt(s.ts[k]);
    }).join(" · ");
    var fts = pg.talenti.map(function (t) { return "liv " + t.lv + ": " + esc(t.n || "—"); }).join(" · ") || "—";
    var incs = Object.keys(pg.incantesimi).sort(function (a, b) { return +a - +b; })
      .map(function (l) { return "L" + l + ": " + pg.incantesimi[l].map(esc).join(", "); }).join(" | ") || "—";
    /* scheda grafica v2: badge, griglia abilita', chips (punto 13b) */
    var abCells = "";
    ABIL_ORDER.forEach(function (k) {
      var v = ab[k] || 0;
      var mod = Math.floor((v - 10) / 2);
      abCells += '<div class="pg-ab" title="' + esc(ABIL_LABEL[k] || k) + '"><span class="pg-ab-nome">' + esc(ABIL_SHORT[k] || k) + '</span>' +
        '<span class="pg-ab-val">' + v + '</span><span class="pg-ab-mod">' + (mod >= 0 ? "+" : "") + mod + '</span></div>';
    });
    var badge = '<div class="pg-badges">' +
      '<span class="pg-badge"><b>' + s.pf + "</b> PF</span>" +
      '<span class="pg-badge"><b>' + s.ca + "</b> CA</span>" +
      '<span class="pg-badge"><b>+' + fmt(s.pb) + "</b> BC</span>" +
      (s.cd ? '<span class="pg-badge pg-badge-magic"><b>' + s.cd + "</b> CD</span>" : "") +
      '<span class="pg-badge pg-badge-dim"><b>' + esc(String(s.dv || "d8")) + "</b> dado vita</span>" +
      "</div>";
    var chips = "";
    if (fts !== "—") chips += '<div class="pg-chips-row"><span class="pg-chips-label">Talenti</span><div class="pg-chips">' +
      esc(fts).split(", ").map(function (x) { return '<span class="pg-chip">' + x + "</span>"; }).join("") + "</div></div>";
    if (incs !== "—") chips += '<div class="pg-chips-row"><span class="pg-chips-label">Incantesimi</span><div class="pg-chips">' +
      esc(incs).split(", ").map(function (x) { return '<span class="pg-chip pg-chip-spell">' + x + "</span>"; }).join("") + "</div></div>";
    if (pg.trucchetti && pg.trucchetti.length) chips += '<div class="pg-chips-row"><span class="pg-chips-label">Trucchetti</span><div class="pg-chips">' +
      pg.trucchetti.map(function (x) { return '<span class="pg-chip pg-chip-cantrip">' + esc(x) + "</span>"; }).join("") + "</div></div>";

    return '<article class="pg-card pg-card-v2">' +
      (pg.nomeReale
        ? '<div class="pg-real">build del canale: <strong>' + esc(pg.nomeReale) + "</strong>" +
          (pg.fonteReale ? ' <a href="' + esc(pg.fonteReale) + '" target="_blank" rel="noopener nofollow">video</a>' : "") + "</div>"
        : '<div class="pg-real pg-gen">build composta dal database</div>') +
      '<h3 class="pg-nome">' + esc(pg.razza ? pg.razza.n : "—") + " · " + esc(pg.classe.n) +
      (pg.sottoclasse ? " <span class=\"pg-sub-nome\">(" + esc(pg.sottoclasse.n) + ")</span>" : "") +
      ' <span class="pg-liv">liv. ' + pg.livello + "</span></h3>" +
      '<p class="pg-meta">' + esc(pg.ed) +
      (pg.background ? " · background " + esc(pg.background.n) : "") +
      (cat ? " · categoria " + esc(cat.n) : "") + "</p>" +
      badge +
      '<div class="pg-ab-grid">' + abCells + "</div>" +
      '<p class="pg-meta pg-salvezze">Tiri salvezza: ' + esc(ts) + "</p>" +
      chips +
      '<p class="pg-seed">seme ' + pg.seed + " — stesso seme, stesso personaggio</p>" +
      (cat ? '<p class="pg-export"><button type="button" class="btn-pdf pg-pdf-cat">Salva scheda PDF</button> <span class="pg-pdf-esito"></span></p>' : "") +
      "</article>";
  }

  /* ---------- SCHEDA COMPLETA (richiesta UI) ----------
     Il creatore guidato mostrava un RIASSUNTO e un blocco «Privilegi» in cui la lista
     della sottoclasse era VUOTA per costruzione: il codice faceva
     .filter(function () { return false; }) — un segnaposto mai riempito. Qui si
     costruisce la scheda intera: ogni valore calcolato, ogni privilegio con la sua
     descrizione, i tratti di specie, le 18 abilità, gli slot. Le sezioni sono <details>
     così la scheda resta ispezionabile senza diventare un muro di testo. */

  var ABIL_ORDER = ["str", "dex", "con", "int", "wis", "cha"];
  var ABIL_LABEL = { str: "Forza", dex: "Destrezza", con: "Costituzione", int: "Intelligenza", wis: "Saggezza", cha: "Carisma" };
  /* abbreviazioni standard D&D per la griglia statistiche: evitano lo sbordo
     min-content nelle card strette della griglia a 3 colonne */
  var ABIL_SHORT = { str: "FOR", dex: "DES", con: "COS", int: "INT", wis: "SAG", cha: "CAR" };
  var SKILLS = [
    ["acrobatics", "Acrobazia", "dex"], ["animal handling", "Addestrare animali", "wis"],
    ["arcana", "Arcano", "int"], ["athletics", "Atletica", "str"],
    ["deception", "Inganno", "cha"], ["history", "Storia", "int"],
    ["insight", "Intuizione", "wis"], ["intimidation", "Intimidire", "cha"],
    ["investigation", "Indagare", "int"], ["medicine", "Medicina", "wis"],
    ["nature", "Natura", "int"], ["perception", "Percezione", "wis"],
    ["performance", "Intrattenere", "cha"], ["persuasion", "Persuasione", "cha"],
    ["religion", "Religione", "int"], ["sleight of hand", "Rapidità di mano", "dex"],
    ["stealth", "Furtività", "dex"], ["survival", "Sopravvivenza", "wis"]
  ];

  /* I testi del compendio contengono marcatori {@item X|SRC}: qui diventano testo
     leggibile. Senza questa pulizia la scheda mostrerebbe il markup grezzo. */
  function pulisci(t) {
    if (t == null) return "";
    return String(t)
      .replace(/\{@\w+\s+([^|}]+)(\|[^}]*)?\}/g, "$1")
      .replace(/\{@\w+\s+([^}]*)\}/g, "$1")
      .replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  }

  /* Competenze di classe: le abilità fra cui la classe fa scegliere. Sono dichiarate
     come SCELTA, non come competenza acquisita: la scheda dice fra quali scegliere. */
  function scelteAbilita(c) {
    var out = [];
    listOf(c.skills).forEach(function (s) {
      var g = s && s.choose;
      if (g && g.from) out = out.concat(g.from);
    });
    return out.map(function (x) { return String(x).toLowerCase(); });
  }

  function vel(razza) {
    if (!razza || !razza.speed) return null;
    if (typeof razza.speed === "number") return { walk: razza.speed };
    return razza.speed;
  }

  function sezione(titolo, corpo, aperta) {
    return "<details class=\"pg-sez\"" + (aperta ? " open" : "") + "><summary>" + esc(titolo) +
      "</summary><div class=\"pg-sez-body\">" + corpo + "</div></details>";
  }

  function pgSchedaCompleta(pg) {
    var c = pg.classe, s = pg.scheda, lv = pg.livello, ab = pg.abilita;
    var H = [];
    var man = (D.manuali || {});
    function fonte(sigla) { var m = man[sigla]; return m ? (m.libro + " (" + (m.pub || "?") + ")") : sigla; }

    /* 1. Statistiche derivate, ognuna con la sua formula: un numero senza la formula
       non e' ispezionabile. */
    var v = vel(pg.razza);
    var iniz = mod(ab.dex);
    var percPass = 10 + mod(ab.wis);
    var righe = [
      ["Punti ferita", s.pf, "1d" + (c.hd || 8) + " al 1\u00b0 + (met\u00e0 dado + 1 + COS) per ogni livello successivo"],
      ["Classe armatura", s.ca, "10 + DES (senza armatura; l'armatura si aggiunge a parte)"],
      ["Iniziativa", fmt(iniz), "DES " + fmt(mod(ab.dex))],
      ["Bonus competenza", fmt(s.pb), "2 + (livello\u22121)\u00f7 4, arrotondato per difetto"],
      ["Percezione passiva", percPass, "10 + SAG " + fmt(mod(ab.wis))],
      ["Velocit\u00e0", v ? Object.keys(v).map(function (k) {
        return (k === "walk" ? "a piedi" : k === "fly" ? "volo" : k === "swim" ? "nuoto" : k) + " " + v[k] + " ft";
      }).join(", ") : "\u2014", "dalla specie"],
      ["Tiri salvezza", ABIL_ORDER.map(function (k) {
        return ABIL_LABEL[k].slice(0, 3) + " " + fmt(s.ts[k]) + (listOf(c.saves).indexOf(k) !== -1 ? "\u2713" : "");
      }).join(" \u00b7 "), "modificatore + competenza di classe (\u2713)"]
    ];
    if (s.cd) {
      righe.push(["CD incantesimi", s.cd, "8 + competenza + " + ABIL_LABEL[c.spellAbility]]);
      righe.push(["Attacco con incantesimi", fmt(s.pb + mod(ab[c.spellAbility])), "competenza + " + ABIL_LABEL[c.spellAbility]]);
    }
    H.push(sezione("Statistiche calcolate", '<table class="pg-tab">' + righe.map(function (r) {
      return "<tr><th>" + esc(r[0]) + "</th><td><b>" + esc(String(r[1])) + "</b></td><td class=\"pg-formula\">" + esc(r[2]) + "</td></tr>";
    }).join("") + "</table>", true));

    /* 2. Caratteristiche */
    H.push(sezione("Caratteristiche", '<table class="pg-tab">' + ABIL_ORDER.map(function (k) {
      return "<tr><th>" + ABIL_LABEL[k] + " (" + k.toUpperCase() + ")</th><td><b>" + ab[k] +
        "</b></td><td class=\"pg-formula\">modificatore " + fmt(mod(ab[k])) + "</td></tr>";
    }).join("") + "</table>"));

    /* 3. Abilità: tutte e 18, con il modificatore e se la classe la offre come scelta */
    var scelte = scelteAbilita(c);
    H.push(sezione("Abilit\u00e0 (18)", '<table class="pg-tab">' + SKILLS.map(function (sk) {
      var m = mod(ab[sk[2]]);
      var offerta = scelte.indexOf(sk[0]) !== -1;
      /* Il valore mostrato e' il modificatore PURO: la competenza e' una scelta del
         giocatore. Se la classe la offre si dichiara, non si presume. */
      return "<tr><th>" + esc(sk[1]) + "</th><td><b>" + fmt(m) + "</b></td><td class=\"pg-formula\">" +
        (offerta ? "scelta dalla classe (+" + s.pb + " se competente)" : "+" + s.pb + " se competente") + "</td></tr>";
    }).join("") + "</table><p class=\"tv-meta\">Competenze offerte dalla classe: " +
      (scelte.length ? esc(scelte.join(", ")) : "nessuna") + " \u2014 sono una SCELTA, non un dato acquisito.</p>"));

    /* 4. Privilegi di classe fino al livello, CON descrizione */
    var pr = listOf(c.features).filter(function (f) { return f.lv <= lv; })
      .sort(function (a, b) { return a.lv - b.lv; });
    H.push(sezione("Privilegi di classe (" + pr.length + " fino al liv " + lv + ")",
      pr.length ? "<ul class=\"pg-list\">" + pr.map(function (f) {
        return "<li><b>liv " + f.lv + "</b> \u2014 <b>" + esc(f.n) + "</b><br>" +
          '<span class="pg-desc">' + esc(pulisci(f.d).slice(0, 420)) + "</span></li>";
      }).join("") + "</ul>" : "<p>Nessun privilegio.</p>", true));

    /* 5. Sottoclasse — qui il codice precedente restituiva SEMPRE una lista vuota */
    var subs = listOf(c.subclasses);
    var subNome = pg.sottoclasse ? pg.sottoclasse.n : null;
    var corpoSub;
    if (lv < (c.subLevel || 99)) {
      corpoSub = "<p>La sottoclasse si sceglie al livello <b>" + (c.subLevel || "?") + "</b>. " +
        (subs.length ? "Disponibili per questa classe: " + esc(subs.map(function (x) {
          return (x && x.n) ? x.n : String(x);
        }).join(", ")) + "." : "") + "</p>";
    } else if (!subNome) {
      corpoSub = "<p>Sottoclasse non selezionata. Disponibili: " + esc(subs.map(function (x) {
        return (x && x.n) ? x.n : String(x);
      }).join(", ")) + ".</p>";
    } else {
      var sel = subs.filter(function (x) { return (x && x.n) === subNome || x === subNome; })[0];
      var sf = (sel && listOf(sel.features)) || [];
      corpoSub = "<p><b>" + esc(subNome) + "</b> \u2014 attiva dal livello " + (c.subLevel || "?") + ".</p>" +
        (sf.length ? "<ul class=\"pg-list\">" + sf.filter(function (f) { return (f.lv || 0) <= lv; })
          .sort(function (a, b) { return (a.lv || 0) - (b.lv || 0); }).map(function (f) {
            return "<li><b>liv " + (f.lv || "?") + "</b> \u2014 <b>" + esc(f.n) + "</b>" +
              (f.d ? '<br><span class="pg-desc">' + esc(pulisci(f.d).slice(0, 420)) + "</span>" : "") + "</li>";
          }).join("") + "</ul>"
          : "<p class=\"tv-meta\">Il compendio locale non porta i privilegi di questa sottoclasse: " +
            "vanno letti nel manuale. Non li invento.</p>");
    }
    H.push(sezione("Sottoclasse", corpoSub, true));

    /* 6. Tratti di specie */
    var rz = pg.razza;
    H.push(sezione("Specie" + (rz ? ": " + rz.n : ""), rz ?
      "<table class=\"pg-tab\">" +
      "<tr><th>Manuale</th><td>" + esc(fonte(rz.s)) + "</td></tr>" +
      "<tr><th>Taglia</th><td>" + esc(pulisci(String(rz.size || "\u2014"))) + "</td></tr>" +
      "<tr><th>Bonus di caratteristica</th><td>" + esc((rz.abilities || []).length ? rz.abilities.join(", ") : "\u2014 (distribuzione libera)") + "</td></tr>" +
      "<tr><th>Tratti</th><td>" + esc(listOf(rz.traits).map(function (t) { return (t && t.n) ? t.n : String(t); }).join(", ")) + "</td></tr>" +
      "</table>" : "<p>Nessuna specie selezionata.</p>"));

    /* 7. Talenti e background */
    var tal = listOf(pg.talenti).slice().sort(function (a, b) { return a.lv - b.lv; });
    H.push(sezione("Talenti e background", "<table class=\"pg-tab\">" +
      "<tr><th>Background</th><td>" + esc(pg.background ? pg.background.n : "\u2014") + "</td></tr>" +
      (tal.length ? tal.map(function (t) {
        return "<tr><th>liv " + t.lv + "</th><td>" + esc(t.n || "\u2014") + "</td></tr>";
      }).join("") : "<tr><th>Talenti</th><td>\u2014</td></tr>") + "</table>"));

    /* 8. Incantesimi: slot del livello + lista per livello */
    var avail = SLOTS_GUIDA[lv] || {};
    var corpoInc = "<table class=\"pg-tab\"><tr><th>Slot a liv " + lv + "</th><td>" +
      (Object.keys(avail).length ? Object.keys(avail).sort(function (a, b) { return a - b; })
        .map(function (k) { return k + "\u00b0 livello \u00d7 " + avail[k]; }).join(" \u00b7 ") : "\u2014 (nessuna capacit\u00e0 di lancio)") +
      "</td></tr>";
    Object.keys(pg.incantesimi || {}).sort(function (a, b) { return +a - +b; }).forEach(function (l) {
      corpoInc += "<tr><th>" + l + "\u00b0 livello</th><td>" + esc(pg.incantesimi[l].join(", ")) + "</td></tr>";
    });
    corpoInc += "<tr><th>Trucchetti</th><td>" + esc((pg.trucchetti || []).join(", ") || "\u2014") + "</td></tr></table>";
    H.push(sezione("Incantesimi", corpoInc));

    /* 9. Competenze ed equipaggiamento */
    var pf = c.proficiencies || {};
    function elencoP(x) { return listOf(x).map(function (y) { return pulisci(String(y)); }).join(", ") || "\u2014"; }
    H.push(sezione("Competenze ed equipaggiamento",
      "<table class=\"pg-tab\">" +
      "<tr><th>Armi</th><td>" + esc(elencoP(pf.weapons)) + "</td></tr>" +
      "<tr><th>Armature</th><td>" + esc(elencoP(pf.armor)) + "</td></tr>" +
      "<tr><th>Strumenti</th><td>" + esc(elencoP(pf.tools)) + "</td></tr>" +
      "<tr><th>Tiri salvezza</th><td>" + esc(listOf(c.saves).map(function (k) { return ABIL_LABEL[k] || k; }).join(", ")) + "</td></tr>" +
      "</table><p class=\"tv-meta\">Equipaggiamento iniziale e oggetti magici NON sono conteggiati nei valori sopra: " +
      "l'equipaggiamento di partenza dipende dal background e gli oggetti magici si trovano in gioco.</p>"
    ));

    /* 10. Provenienza: da quale manuale viene ogni dato. Un dato senza fonte non e' verificabile. */
    H.push(sezione("Provenienza dei dati",
      "<table class=\"pg-tab\">" +
      "<tr><th>Classe</th><td>" + esc(fonte(c.s)) + "</td></tr>" +
      (rz ? "<tr><th>Specie</th><td>" + esc(fonte(rz.s)) + "</td></tr>" : "") +
      (pg.background ? "<tr><th>Background</th><td>" + esc(fonte(pg.background.s || "")) + "</td></tr>" : "") +
      "</table><p class=\"tv-meta\">Compendio locale estratto dal mirror 5e.tools. " +
      "Le classi e le specie dell'edizione 2024 convivono con il materiale 2014 non ristampato.</p>"));

    return H.join("");
  }

  /* Slot di incantesimo per livello (tabella del regolamento, incantatore pieno). */
  var SLOTS_GUIDA = {
    1: { 1: 2 }, 2: { 1: 3 }, 3: { 1: 4, 2: 2 }, 4: { 1: 4, 2: 3 }, 5: { 1: 4, 2: 3, 3: 2 },
    6: { 1: 4, 2: 3, 3: 3 }, 7: { 1: 4, 2: 3, 3: 3, 4: 1 }, 8: { 1: 4, 2: 3, 3: 3, 4: 2 },
    9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, 10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
    11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, 12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
    13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 }, 14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
    15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
    16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
    17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
    18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
    19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
    20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }
  };

  /* ---------- modo guidato ---------- */
  function popolaClassi() {
    var ed = el("pg-ed").value;
    var sel = el("pg-classe");
    sel.innerHTML = classi(ed).map(function (c) {
      return '<option value="' + esc(c.n + "|" + c.s) + '">' + esc(c.n) + esc(etichetta(c)) + "</option>";
    }).join("");
    popolaSottoclasse();
    popolaRazze();
    popolaBackground();
    popolaScelte();
  }
  function classeScelta() {
    var v = (el("pg-classe").value || "").split("|");
    return D.classes.filter(function (c) { return c.n === v[0] && c.s === v[1]; })[0];
  }
  function popolaSottoclasse() {
    var c = classeScelta(), lv = parseInt(el("pg-liv").value, 10) || 1;
    var sel = el("pg-sottoclasse");
    if (!c) { sel.innerHTML = ""; return; }
    var subs = sottoclassi(c, c.ed);
    var sbloccata = lv >= (c.subLevel || 99);
    if (!sbloccata) {
      sel.innerHTML = '<option value="">— si sblocca al livello ' + (c.subLevel || "?") + " —</option>";
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    sel.innerHTML = subs.map(function (s) {
      return '<option value="' + esc(s.n) + '">' + esc(s.n) + esc(etichetta(s)) + "</option>";
    }).join("");
  }
  function popolaRazze() {
    var ed = el("pg-ed").value;
    var sel = el("pg-razza");
    var z = razze(ed);
    sel.innerHTML = z.map(function (x) {
      return '<option value="' + esc(x.n + "|" + x.s) + '">' + esc(x.n) + (x.parent ? " (" + esc(x.parent) + ")" : "") + "</option>";
    }).join("");
  }
  function aggiornaGuidata() {
    var c = classeScelta();
    if (!c) return;
    var lv = parseInt(el("pg-liv").value, 10) || 1;
    var sub = sottoclassi(c, c.ed).filter(function (s) { return s.n === el("pg-sottoclasse").value; })[0] || null;
    var rv = (el("pg-razza").value || "").split("|");
    var razza = D.races.filter(function (x) { return x.n === rv[0] && x.s === rv[1]; })[0] || null;
    var seed = (parseInt(el("pg-seed").value, 10) || 1);
    var pg = genera(c.ed, c, lv, seed);
    window.ultimoPgGuidata = pg;   // per l'export PDF (assets/scheda-pdf.js)
    pg.sottoclasse = sub;
    pg.razza = razza || pg.razza;
    // le scelte dell'utente hanno la precedenza su ciò che il seme avrebbe assegnato
    var scelte = leggiScelte();
    if (scelte.talenti.length) pg.talenti = scelte.talenti;
    if (scelte.trucchetti.length) pg.trucchetti = scelte.trucchetti;
    if (Object.keys(scelte.incantesimi).length) pg.incantesimi = scelte.incantesimi;
    var bg = bgScelto();
    if (bg) pg.background = bg;
    pg.scheda = scheda(pg);
    el("pg-out").innerHTML = pgCard(pg, null);
    /* Scheda COMPLETA al posto del riassunto + del blocco «Privilegi» che aveva la
       lista della sottoclasse vuota per costruzione. */
    el("pg-dettaglio").innerHTML = pgSchedaCompleta(pg);
  }

  function popolaFonti() {
    var sel = el("pg-fonte");
    if (!sel) return;
    var reg = D.manuali || {};
    var sigle = Object.keys(reg).sort(function (a, b) {
      return (reg[a].pub || "").localeCompare(reg[b].pub || "");
    });
    var h = '<option value="tutte">tutte le fonti</option>' +
            '<option value="2014">era 2014</option>' +
            '<option value="2024+">era 2024+</option>';
    sigle.forEach(function (s) {
      var r = reg[s] || {};
      h += '<option value="' + esc(s) + '">' + esc((r.libro || s) + " · " + (r.pub || "")) + "</option>";
    });
    sel.innerHTML = h;
    sel.value = fonteScelta;
  }

  function popolaCategorie() {
    /* ORDINE ALFABETICO: le 26 categorie erano mostrate nell'ordine di definizione
       del codice, non in ordine di lettura. Si ordina sul nome MOSTRATO (italiano). */
    el("pg-cat").innerHTML = CATEGORIE.slice().sort(function (a, b) {
      return a.n.localeCompare(b.n, "it");
    }).map(function (c) {
      return '<option value="' + esc(c.k) + '">' + esc(c.n) + "</option>";
    }).join("");
  }
  /* R5 (2026-09-27): classifica CALCOLATA dal motore per la categoria selezionata.
     Fonte: data/ricerca-2024.json (build con DPR per livello, 20 ruoli, 71 combo, colpo singolo).
     Il caricamento e' pigro e in cache: la sezione non pesa se non si usa il generatore. */
  var RIC = null, RIC_ATTESA = [], RICVID = {}, RICCONF = {};
  function conRicerca(cb) {
    if (RIC) return cb(RIC);
    RIC_ATTESA.push(cb);
    if (RIC_ATTESA.length > 1) return;
    var x = new XMLHttpRequest();
    x.open("GET", "../data/ricerca-2024.json", true);
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      try { RIC = JSON.parse(x.responseText); RICVID = RIC.video_numeri || {}; RICCONF = RIC.confronti || {}; }
      catch (e) { RIC = { categorie_mappa: {} }; RICVID = {}; RICCONF = {}; }
      var att = RIC_ATTESA; RIC_ATTESA = [];
      att.forEach(function (f) { try { f(RIC); } catch (e) {} });
    };
    x.send();
  }

  function renderRicerca(k) {
    var host = el("pg-ric");
    if (!host) return;
    conRicerca(function (R) {
      var m = (R.categorie_mappa || {})[k];
      if (!m) {
        var manca = (R.categorie_non_coperte || {})[k];
        host.innerHTML = '<p class="tv-meta">Classifica calcolata: non disponibile per questa categoria'
          + (manca ? " (" + esc(manca) + ")" : "") + ".</p>";
        return;
      }
      var righe = m.top5.map(function (c) {
        return "<li><strong>" + esc(c.nome) + "</strong> — "
          + (typeof c.punteggio === "number" ? c.punteggio.toFixed(1) : esc(c.punteggio))
          + (c.tie ? " <em>(pari merito)</em>" : "")
          + ' <span class="pg-data">' + esc(c.dettaglio || "") + "</span></li>";
      }).join("");
      host.innerHTML = '<div class="pg-builde"><h3>Classifica calcolata'
        + (m.tipo === "build" ? " (build)" : "") + ': '
        + esc(m.ruolo || "confronto") + "</h3>"
        + '<p class="tv-meta">' + esc(m.perche || "")
        + (m.stabilita !== undefined ? " · stabilità del podio " + Math.round(m.stabilita * 100) + "%" : "")
        + "</p><ol>" + righe + "</ol>"
        + '<p class="tv-meta">Valori dal motore deterministico del sito'
        + (R.sintesi ? " (test " + R.sintesi.test_passati + "/" + R.sintesi.test_totali + ", ECI " + R.sintesi.eci + "%)" : "")
        + ": dove esiste una formula il punteggio è calcolato, altrove è una rubrica con pesi dichiarati.</p></div>";
    });
  }

  /* S4 (2026-09-27) — vista AGGREGATA degli scarti.
     Il confronto per singolo video dice quanto UN numero dista dal ricalcolo; l'aggregato dice
     quanto, IN MEDIA, i numeri divulgati si discostino — è il dato che rende il catalogo
     misurabile invece che aneddotico. Si mostrano media E mediana perché con pochi valori la
     media è sensibile agli estremi: se le due divergono, l'ordine del campione conta più del suo
     centro, e dirlo è più utile che scegliere una cifra sola. Il campione si DICHIARA (n ed
     esclusioni): una media senza il suo n è una cifra che non si può contestare. */
  function scartiAggregati() {
    var vals = [], esclusi = 0;
    Object.keys(RICCONF).forEach(function (k) {
      var s = RICCONF[k].scarto_pct;
      if (typeof s === "number" && isFinite(s)) vals.push(s); else esclusi++;
    });
    if (!vals.length) return "";
    vals.sort(function (a, b) { return a - b; });
    var n = vals.length;
    var media = vals.reduce(function (a, b) { return a + b; }, 0) / n;
    var mediana = (n % 2) ? vals[(n - 1) / 2] : (vals[n / 2 - 1] + vals[n / 2]) / 2;
    var f = function (x) { return (x > 0 ? "+" : "") + x.toFixed(1) + "%"; };
    var divergono = Math.abs(media - mediana) > Math.abs(mediana) * 0.25;
    var out = '<details class="tv-meta" style="margin:.5rem 0"><summary>'
      + "Scarto aggregato dichiarato &#8596; calcolato &mdash; media <b>" + f(media) + "</b> · mediana <b>"
      + f(mediana) + "</b> su " + n + " confronti omogenei"
      + (esclusi ? " (" + esclusi + " escluso perché non omogeneo)" : "") + "</summary>"
      + "<p>Intervallo osservato: " + f(vals[0]) + " … " + f(vals[n - 1]) + ". Il valore calcolato è alla "
      + "<b>stessa CA dichiarata</b> dal video, quindi lo scarto non è un artefatto di baseline: misura "
      + "quanto il numero divulgato dista dal ricalcolo a parità di condizioni.</p>";
    if (divergono) {
      out += "<p><b>Media e mediana divergono</b> (" + f(media) + " vs " + f(mediana) + "): il campione è "
        + "troppo piccolo e troppo disperso perché una sola cifra lo rappresenti — va letto come intervallo.</p>";
    }
    return out + "</details>";
  }

  /* ---------- MECCANICHE PER CATEGORIA (richiesta UI) ----------
     Le build della categoria «Taunter» si concentravano su un'unica leva (lo svantaggio
     verso altri bersagli). Qui si aggiunge, per OGNI categoria, l'elenco degli elementi
     regolistici che la possono alimentare: talenti, incantesimi e privilegi pescati dal
     compendio locale. Ogni voce porta la parola chiave che l'ha selezionata e il manuale:
     il match e' verificabile. Il file e' prodotto da tools/make_meccaniche.py. */
  var MECC = null, MECC_ERR = null;
  function caricaMeccaniche(cb) {
    if (MECC || MECC_ERR) return cb();
    var x = new XMLHttpRequest();
    x.open("GET", "../data/meccaniche-categorie.json", true);
    x.onload = function () {
      if (x.status === 200) { try { MECC = JSON.parse(x.responseText); } catch (e) { MECC_ERR = String(e); } }
      else MECC_ERR = "HTTP " + x.status;
      cb();
    };
    x.onerror = function () { MECC_ERR = "rete"; cb(); };
    x.send();
  }

  function meccanicheHtml(cat) {
    if (MECC_ERR) return '<p class="tv-meta">Meccaniche non caricate (' + esc(MECC_ERR) + ").</p>";
    if (!MECC || !MECC.categorie || !MECC.categorie[cat.k]) return "";
    var g = MECC.categorie[cat.k];
    var per = { privilegio: "Privilegi di classe", talento: "Talenti", incantesimo: "Incantesimi" };
    var testo = '<p class="tv-meta">' + esc(MECC.nota) + "</p>";
    testo += '<p class="tv-meta">' + g.mostrate + " di " + g.n_meccaniche + " meccaniche pescate dal compendio.</p>";
    testo += '<table class="pg-tab"><tr><th>Tipo</th><th>Meccanica</th><th>Sorgente</th><th>Perché</th></tr>';
    g.voci.forEach(function (v) {
      var dove = v.classe ? esc(v.classe) + (v.livello ? " liv " + v.livello : "") : "";
      testo += "<tr><td>" + esc(per[v.tipo] || v.tipo) + "</td><td><b>" + esc(v.nome) + "</b>" +
        (dove ? ' <span class="pg-formula">' + dove + "</span>" : "") + "</td><td>" +
        esc(v.sorgente || "—") + '</td><td class="pg-formula">' + esc(v.perche || "") + "</td></tr>";
    });
    testo += "</table>";
    return sezione("Meccaniche della categoria «" + cat.n + "» (" + g.mostrate + ")", testo);
  }

  function generaCategoria() {
    var k = el("pg-cat").value;
    var cat = CATEGORIE.filter(function (c) { return c.k === k; })[0];
    if (!cat) return;
    var ed = el("pg-cat-ed").value || null;
    var n = parseInt(el("pg-cat-n").value, 10) || 3;
    var builds = perCategoria(cat, Math.min(8, Math.max(1, n)), ed);
    var tutte = buildRealiTutte(cat);
    // Q3: ordinamento per numero (dichiarato o calcolato) su richiesta
    var _ord = (el("pg-cat-sort") || {}).value || "cronologia";
    if (_ord === "numero") {
      tutte = tutte.slice().sort(function (a, b) {
        var x = RICVID[(a.url || "").split("=").pop()], y = RICVID[(b.url || "").split("=").pop()];
        return ((y && y.valore) || 0) - ((x && x.valore) || 0);
      });
    }
    /* P3 (2026-09-27): ogni titolo del canale porta il SUO numero, con l'origine dichiarata:
       "calcolato" = esiste una build del motore corrispondente (DPR ricalcolato, CA 19, post-errata);
       "dichiarato" = il numero è detto nel video (CA ed edizione sue, non normalizzate);
       nessun numero = il video non ne dichiara e non ha corrispondenza nel motore. */
    /* COLLASSABILE (richiesta UI): il blocco del canale era un muro di titoli sempre
       aperto. Ora e' un <details> chiuso di default, con il conteggio nel summary. */
    var elenco = tutte.length ? '<details class="pg-builde"><summary>Build reali del canale in questa categoria ('
      + tutte.length + ")</summary><ul>" + tutte.map(function (v) {
        var vid = (v.url || "").split("=").pop();
        var num = RICVID[vid];
        var conf = RICCONF[vid];
        var badge = "";
        if (conf) {
          // Q2: dove esistono DUE numeri, si mostrano entrambi con lo scarto e la causa.
          var sc = conf.scarto_pct;
          badge = ' <span class="pg-num calc">' + conf.calcolato_stessa_ca + " calcolati</span>"
            + ' <span class="pg-num">' + conf.dichiarato + " dichiarati"
            + (conf.ca_dichiarata ? " @CA" + conf.ca_dichiarata : "") + "</span>";
        } else if (num) {
          badge = num.tipo === "calcolato"
            ? ' <span class="pg-num calc" title="' + esc(num.nota || "") + '">' + num.valore + " DPR calcolati</span>"
            : ' <span class="pg-num" title="' + esc(num.nota || "") + '">' + num.valore + " DPR dichiarati nel video</span>";
        }
        var confronto = conf ? '<details class="pg-cmp"><summary>confronto dichiarato &harr; calcolato'
          + (sc !== null && sc !== undefined ? ": " + (sc > 0 ? "+" : "") + sc + "%" : " (non omogeneo)")
          + "</summary><p>" + esc(conf.causa || "") + "</p></details>" : "";
        return "<li>" + (v.url ? '<a href="' + esc(v.url) + '" target="_blank" rel="noopener nofollow">' +
          esc(v.title) + "</a>" : esc(v.title)) + badge + confronto +
          (v.published ? ' <span class="pg-data">' + esc(v.published) + "</span>" : "") + "</li>";
      }).join("") + "</ul></details>" : "";
    /* RESIDUO DICHIARATO (2026-09-27): i titoli scartati si MOSTRANO con il motivo.
       Un filtro che nasconde ciò che esclude non è verificabile; uno che lo dichiara
       lo è. Le due classi di scarto sono: contenuto di videogioco (BG3 non è 5e da
       tavolo) e formato non-build (ranking/listicle/guida). */
    var scarto = buildEscluse();
    var residuo = "";
    var tot = scarto.videogioco.length + scarto.formato.length;
    if (tot) {
      residuo = '<details class="tv-meta" style="margin:.5rem 0"><summary>'
        + "Titoli esclusi dal canale perché non sono build 5e: " + tot
        + " (" + scarto.videogioco.length + " di videogioco BG3, " + scarto.formato.length + " di formato non-build)"
        + "</summary><ul>";
      scarto.videogioco.slice(0, 30).forEach(function (v) {
        residuo += "<li>" + esc(v.title) + ' <em>— videogioco (BG3)</em></li>';
      });
      scarto.formato.slice(0, 30).forEach(function (v) {
        residuo += "<li>" + esc(v.title) + ' <em>— formato non-build (ranking/guida)</em></li>';
      });
      residuo += "</ul></details>";
    }
    el("pg-cat-out").innerHTML =
      meccanicheHtml(cat) +
      '<h3 class="cmp-h3">' + esc(cat.n) + " — " + builds.length + " personaggi</h3>" + elenco +
      scartiAggregati() +
      '<p class="tv-meta">Classi adatte secondo la categoria: ' + esc(cat.classi.join(", ")) +
      ". I nomi presi dal canale «d4: D&D Deep Dive» sono titoli reali raccolti dal canale; " +
      "le altre build sono composte dal database.</p>" + residuo +
      '<div class="pg-grid">' + builds.map(function (b) { return pgCard(b, cat); }).join("") + "</div>" +
      '<div id="pg-ric" aria-live="polite"></div>';
    /* EXPORT PDF anche per i personaggi casuali delle categorie (richiesta UI):
       stesso modulo e stesso template della creazione guidata. */
    (function () {
      var btns = el("pg-cat-out").querySelectorAll("button.pg-pdf-cat");
      for (var bi = 0; bi < btns.length; bi++) {
        (function (btn, idx) {
          btn.addEventListener("click", function () {
            var pgx = builds[idx];
            var esito = btn.parentNode.querySelector(".pg-pdf-esito");
            if (!pgx || !window.SchedaPDF) { if (esito) esito.textContent = " modulo PDF non disponibile"; return; }
            btn.disabled = true;
            if (esito) esito.textContent = " compilo\u2026";
            window.SchedaPDF.salva(pgx).then(function (r2) {
              if (esito) esito.textContent = " salvata (" + r2.scritti + " campi)";
            }).catch(function (err) {
              if (esito) esito.textContent = " non riuscito: " + err.message;
            }).then(function () { btn.disabled = false; });
          });
        })(btns[bi], bi);
      }
    })();
    renderRicerca(k);
    // I numeri dei video arrivano con il payload: al primo uso serve un secondo passaggio di render.
    if (!RIC) conRicerca(function () { generaCategoria(); });
  }

  function boot() {
    if (!el("pg-app")) return;
    var x = new XMLHttpRequest();
    x.open("GET", "../data/character-data.json", true);
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      if (x.status !== 200) { el("pg-out").innerHTML = '<p class="tv-meta">Dati non disponibili.</p>'; return; }
      D = JSON.parse(x.responseText);
      caricaMeccaniche(function () {});
      popolaFonti(); popolaClassi(); popolaCategorie();
      if (el("pg-fonte")) {
        el("pg-fonte").addEventListener("change", function () {
          fonteScelta = el("pg-fonte").value || "tutte";
          /* FIX D — CASCATA: un manuale appartiene a UNA edizione (campo `era`).
             Scegliere la fonte specifica impone l'edizione, così non si possono
             chiedere combinazioni impossibili (fonte 2024 + edizione 2014) che
             restituirebbero liste vuote senza spiegare perché. Le voci "era 2024+"
             / "era 2014" sono filtri sintetici: l'anno si legge dal valore. */
          var _f = el("pg-fonte"), _e = el("pg-ed");
          if (_f && _e) {
            var _v = _f.value, _era = null;
            /* Il registro usa "2024+" e "2014": si confronta per CONTENIMENTO, non per
               uguaglianza esatta, altrimenti "2024+" non corrisponde mai. */
            if (_v) {
              var _reg = (D.manuali || {})[_v];
              /* Tre sorgenti in ordine: il registro, il valore dell'opzione, il TESTO
                 visibile. Le voci sintetiche del selettore hanno un value che non sta
                 nel registro, e il loro anno e' leggibile solo dall'etichetta. */
              var _src = String((_reg && _reg.era) || "") + "|" + _v + "|" +
                         String(((_f.options[_f.selectedIndex] || {}).textContent) || "");
              _era = _src.indexOf("2024") >= 0 ? "2024" : "2014";
            }
            if (_era) _e.value = _era === "2024" ? "2024" : "2014";
          }
          popolaClassi(); popolaScelte(); aggiornaGuidata();
          /* L'assegnazione va DOPO i popolamenti: popolaClassi ricostruisce i
             controlli e riportava l'edizione al valore precedente. */
          if (_e && _era) _e.value = _era === "2024" ? "2024" : "2014";
        });
      }
      /* EXPORT PDF (assets/scheda-pdf.js): compila la scheda 2024 con le scelte fatte
         qui. La libreria e' self-hosted e la compilazione avviene nel browser: il
         server non riceve nulla e i dati non lasciano la macchina. */
      var _bpdf = el("pg-pdf");
      if (_bpdf) {
        _bpdf.addEventListener("click", function () {
          var esito = el("pg-pdf-esito");
          var pg = window.ultimoPgGuidata;
          if (!pg) { if (esito) esito.textContent = " Genera prima un personaggio."; return; }
          if (!window.SchedaPDF) { if (esito) esito.textContent = " Modulo PDF non caricato."; return; }
          _bpdf.disabled = true;
          if (esito) esito.textContent = " Compilo\u2026";
          window.SchedaPDF.salva(pg).then(function (r) {
            if (esito) {
              esito.textContent = " Scheda salvata (" + r.scritti + " campi"
                + (r.mancanti.length ? ", " + r.mancanti.length + " non nel template" : "") + ").";
            }
          }).catch(function (e) {
            if (esito) esito.textContent = " Non riuscito: " + e.message;
          }).then(function () { _bpdf.disabled = false; });
        });
      }
      el("pg-ed").addEventListener("change", function () {
        /* La scelta inversa: cambiare edizione azzera la fonte specifica, perché
           quella fonte apparterrebbe all'altra edizione. */
        var _f2 = el("pg-fonte");
        if (_f2 && _f2.value !== "tutte") _f2.value = "tutte";
        fonteScelta = "tutte";
        popolaClassi(); aggiornaGuidata();
      });
      el("pg-classe").addEventListener("change", function () { popolaSottoclasse(); popolaScelte(); aggiornaGuidata(); });
      el("pg-liv").addEventListener("change", function () { popolaSottoclasse(); popolaScelte(); aggiornaGuidata(); });
      el("pg-liv").addEventListener("input", function () { popolaSottoclasse(); popolaScelte(); aggiornaGuidata(); });
      // ogni scelta ridisegna la scheda (delega: i menu sono creati dopo)
      document.addEventListener("change", function (ev) {
        var t = ev.target;
        if (t && (t.classList.contains("pg-ft") || t.classList.contains("pg-ct") ||
                  t.classList.contains("pg-sp") || t.id === "pg-bg")) aggiornaGuidata();
      });
      ["pg-sottoclasse", "pg-razza", "pg-seed"].forEach(function (id) {
        el(id).addEventListener("change", aggiornaGuidata);
      });
      el("pg-cat-btn").addEventListener("click", generaCategoria);
      el("pg-dado").addEventListener("click", function () {
        el("pg-seed").value = Math.floor(Math.random() * 1e9);
        aggiornaGuidata();
      });
      aggiornaGuidata();
      // titoli del canale, per ancorare le build reali (facoltativo)
      var y = new XMLHttpRequest();
      y.open("GET", "../data/dnddeepdive-videos.json", true);
      y.onreadystatechange = function () {
        if (y.readyState === 4 && y.status === 200) { try { V = JSON.parse(y.responseText); } catch (e) {} }
      };
      y.send();
    };
    x.send();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

/*
 * scheda-pdf.js — esporta il personaggio della «Creazione guidata» in una scheda PDF 2024.
 *
 * PERCHE' NEL BROWSER E NON SUL SERVER: il server del sito è di sola lettura (GET/HEAD,
 * allowlist dei percorsi, blocklist di .py/.md/.log/.exe). Aggiungergli un endpoint POST
 * significherebbe aprire una superficie di scrittura su un servizio esposto anche via
 * tunnel. Compilando nel browser: il server resta di sola lettura, i dati del personaggio
 * non lasciano la macchina, e la funzione continua a funzionare anche col sito su file.
 *
 * La libreria è self-hosted in assets/vendor/pdf-lib.min.js (MIT): nessuna CDN a runtime,
 * nessun servizio a pagamento, nessuna richiesta di rete oltre al proprio dominio.
 *
 * VERIFICATO: pdf-lib legge il template 2024 (456 campi) e lo risalva a ~1169 KB, quindi
 * regge lo stesso template su cui pypdf andava in TypeError per i /Rect indiretti.
 */
(function () {
  "use strict";

  var LIB_URL = "/assets/vendor/pdf-lib.min.js";
  var TEMPLATE = "/pdf/dnd2024_fillable_a4.pdf";
  var _lib = null;

  /* Il caricamento è pigro: la libreria pesa 513 KB e serve solo al clic su «Salva PDF». */
  function caricaLib() {
    if (_lib) return _lib;
    _lib = new Promise(function (res, rej) {
      if (window.PDFLib) return res(window.PDFLib);
      var s = document.createElement("script");
      s.src = LIB_URL;
      s.onload = function () {
        if (window.PDFLib) res(window.PDFLib);
        else rej(new Error("PDFLib non esposta dal file"));
      };
      s.onerror = function () { rej(new Error("pdf-lib non caricata da " + LIB_URL)); };
      document.head.appendChild(s);
    });
    return _lib;
  }

  var ABIL = ["str", "dex", "con", "int", "wis", "cha"];
  var ABIL_IT = { str: "For", dex: "Des", con: "Cos", int: "Int", wis: "Sag", cha: "Car" };
  var SCORE = { str: "score str", dex: "score dex", con: "score con", int: "score int", wis: "score wis", cha: "score cha" };
  var MODF = { str: "mod str", dex: "mod dex", con: "mod con", int: "mod int", wis: "mod wis", cha: "mod cha" };
  /* Nomi esatti dei campi nel template 2024: sono stati letti dal PDF, non inventati. */
  var SKILL = {
    acrobatic: "dex", animal: "wis", arcana: "int", athle: "str", decep: "cha", his: "int",
    ins: "wis", intimi: "cha", medi: "wis", natur: "int", percp: "wis", perfo: "cha",
    reli: "int", slei: "dex", steal: "dex", survi: "wis"
  };
  var FEAT_BOX = [
    "i  CLASS FEATURES TRAITS  FEATS e Action A Bonus Action  Reaction OtherLimited Uses 1Row1",
    "i  CLASS FEATURES TRAITS  FEATS e Action A Bonus Action  Reaction OtherLimited Uses 1Row2"
  ];
  var PG_SLOT_TABLE = {
    1: { 1: 2 }, 2: { 1: 3 }, 3: { 1: 4, 2: 2 }, 4: { 1: 4, 2: 3 }, 5: { 1: 4, 2: 3, 3: 2 },
    6: { 1: 4, 2: 3, 3: 3 }, 7: { 1: 4, 2: 3, 3: 3, 4: 1 }, 8: { 1: 4, 2: 3, 3: 3, 4: 2 },
    9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, 10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
    11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, 12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
    13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 }, 14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
    15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
    16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
    17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
    18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
    19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
    20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }
  };
  var XP = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
            120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

  function mod(v) { return Math.floor((v - 10) / 2); }
  function seg(v) { return (v >= 0 ? "+" : "") + v; }
  function taglia(s, n) {
    s = String(s == null ? "" : s);
    return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
  }

  /* Mappa il personaggio generato sui campi REALI del template 2024.
     Stessa mappa del motore Python (tools/make_level_pdfs.py), così le schede esportate
     dal sito e quelle precompilate delle build sono coerenti campo per campo. */
  function campi(pg) {
    var c = pg.classe || {};
    var sc = pg.scheda || {};
    var ab = pg.abilita || {};
    var lv = pg.livello || 1;
    var pb = sc.pb != null ? sc.pb : (2 + Math.floor((lv - 1) / 4));
    var f = {};
    /* Il nome base NON contiene il livello: altrimenti "Artificer liv 5 (liv 5)". */
    var nomePg = pg.nome || (c.n || "Personaggio");

    f["Name"] = taglia(nomePg + " (liv " + lv + ")", 40);
    f["name 1"] = taglia(nomePg, 40);
    f["name 2"] = taglia(pg.ed + " \u00b7 " + (c.n || ""), 40);
    f["CLASS"] = taglia(c.n || "", 60);
    f["SUBCLASS"] = taglia(pg.sottoclasse ? pg.sottoclasse.n : "\u2014 (dal liv " + (c.subLevel || "?") + ")", 60);
    f["level"] = String(lv);
    f["species"] = taglia(pg.razza ? pg.razza.n : "", 40);
    f["back"] = taglia(pg.background ? pg.background.n : "", 40);

    ABIL.forEach(function (a) {
      var v = ab[a];
      if (v == null) return;
      f[SCORE[a]] = String(v);
      f[MODF[a]] = seg(mod(v));
    });
    f["AC"] = String(sc.ca != null ? sc.ca : (10 + mod(ab.dex || 10)));
    f["current"] = String(sc.pf != null ? sc.pf : "");
    f["MAX"] = String(sc.pf != null ? sc.pf : "");
    f["TEMP"] = "";
    f["weapom"] = "";
    f["SPELLCASTING atk mod"] = c.spellAbility ? seg(pb + mod(ab[c.spellAbility] || 10)) : "";
    f["SPELLCASTING ABILITYRow1"] = c.spellAbility ? ABIL_IT[c.spellAbility] : "";

    /* Tiri salvezza: competenze di classe + modificatore, sul PB del livello. */
    var saves = (c.saves || []);
    f["SAVING THROW"] = taglia(ABIL.map(function (a) {
      var b = mod(ab[a] || 10) + (saves.indexOf(a) !== -1 ? pb : 0);
      return ABIL_IT[a] + " " + seg(b);
    }).join(" \u00b7 "), 120);

    /* Abilità: modificatore + PB se competente. Il PB va aggiunto a mano perché la
       competenza nelle abilità è una scelta del giocatore, non un dato della classe. */
    Object.keys(SKILL).forEach(function (fl) {
      var v = ab[SKILL[fl]];
      if (v == null) return;
      f[fl] = seg(mod(v)) + " (aggiungi " + pb + " se competente)";
    });

    var tal = (pg.talenti || []).map(function (t) { return "liv " + t.lv + ": " + (t.n || "\u2014"); });
    var featTxt = "TALENTI: " + (tal.length ? tal.join("; ") : "\u2014")
      + " || COMPETENZA +" + pb
      + " || Sottoclasse: " + (pg.sottoclasse ? pg.sottoclasse.n : "\u2014")
      + " || Background: " + (pg.background ? pg.background.n : "\u2014");
    FEAT_BOX.forEach(function (k) { f[k] = taglia(featTxt, 900); });

    /* Incantesimi: solo i livelli di slot disponibili a QUESTO livello. */
    var avail = PG_SLOT_TABLE[lv] || {};
    var maxLv = 0;
    Object.keys(avail).forEach(function (k) { maxLv = Math.max(maxLv, parseInt(k, 10)); });
    Object.keys(pg.incantesimi || {}).forEach(function (lvsp) {
      if (parseInt(lvsp, 10) > maxLv) return;
      (pg.incantesimi[lvsp] || []).slice(0, 3).forEach(function (nm, j) {
        f["lvl " + lvsp + " - " + (j + 1)] = taglia(nm, 40);
      });
    });
    (pg.trucchetti || []).slice(0, 3).forEach(function (nm, j) {
      f["can " + (j + 1)] = taglia(nm, 30);
    });
    if (Object.keys(avail).length) {
      f["Texto12"] = taglia("Slot a liv " + lv + ": " + Object.keys(avail).sort(function (a, b) {
        return a - b;
      }).map(function (k) { return k + "\u00b0\u00d7" + avail[k]; }).join(", "), 100);
    }

    f["NOTES liRow0"] = taglia("Personaggio costruito nel creatore del sito (ed. " + pg.ed
      + ", seme " + pg.seed + ").", 120);
    f["NOTES liRow1"] = taglia("Valori calcolati dalle regole: PF " + (sc.pf || "?")
      + ", CA " + (sc.ca || "?") + ", BC " + pb + (sc.cd ? ", CD incantesimi " + sc.cd : "") + ".", 120);
    f["NOTES liRow2"] = taglia("Nessun oggetto magico conteggiato: i valori sono senza equipaggiamento magico.", 120);
    f["NOTES liRow3"] = taglia("Il PDF e' compilato nel browser dai dati che hai scelto; resta modificabile.", 140);
    f["XP"] = String(XP[lv - 1] != null ? XP[lv - 1] : "");
    return f;
  }

  /* Compila e scarica. Non tocca il DOM del sito: crea un <a download> usa e getta. */
  function salva(pg) {
    return caricaLib().then(function (PDFLib) {
      return fetch(TEMPLATE, { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("template non raggiungibile (HTTP " + r.status + ")");
        return r.arrayBuffer();
      }).then(function (buf) {
        return PDFLib.PDFDocument.load(buf);
      }).then(function (pdf) {
        var form = pdf.getForm();
        var f = campi(pg);
        var scritti = 0, mancanti = [];
        Object.keys(f).forEach(function (k) {
          if (f[k] === "" || f[k] == null) return;
          try { form.getTextField(k).setText(String(f[k])); scritti++; }
          catch (e) { mancanti.push(k); }
        });
        /* I valori devono restare VISIBILI: senza aggiornare gli appearance stream
           alcuni lettori mostrerebbero i campi vuoti. */
        try { form.updateFieldAppearances(); } catch (e) { /* non bloccante */ }
        return pdf.save().then(function (bytes) {
          var blob = new Blob([bytes], { type: "application/pdf" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          var base = String((pg.classe && pg.classe.n) || "personaggio")
            .replace(/[^\w\-]+/g, "_").slice(0, 40);
          a.href = url;
          a.download = "scheda_" + base + "_liv" + (pg.livello || 1) + ".pdf";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
          return { scritti: scritti, mancanti: mancanti, kb: Math.round(bytes.length / 1024) };
        });
      });
    });
  }

  window.SchedaPDF = { salva: salva, campi: campi };
})();

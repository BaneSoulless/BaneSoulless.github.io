# -*- coding: utf-8 -*-
"""i18n_bi.py — Sistema bilingue IT/EN del sito.

ARCHITETTURA
  Il modulo riusa le mappe italiane di `i18n_it` e costruisce il gemello inglese.
  Nel browser viene iniettato:

      var BI = { it: {…terminologia…}, en: {…terminologia…} };
      var LANG = <lingua attiva>;
      var I18N = BI[LANG];

  Le mappe inglesi NON sono una traduzione dell'italiano: i valori di 5e.tools
  sono già in inglese, quindi la mappa `en` serve solo per le forme di
  visualizzazione che differiscono dalla chiave grezza (es. `light` -> `Light`).

UNITÀ DI MISURA
  In italiano l'unità primaria è metrica (5 ft = 1,5 m, 1 lb ≈ 0,45 kg) come
  nell'edizione italiana dei manuali; in inglese si usa l'imperiale puro, che è
  l'unità delle fonti originali. Le due funzioni DIST()/WEIGHT() sono sensibili
  alla lingua attiva.

ETICHETTE
  `LABELS` mappa chiave -> (italiano, inglese). Il codice JS usa L('chiave');
  se la chiave manca, ripiega sull'italiano e poi sulla chiave stessa, così una
  dimenticanza è visibile (mostra la chiave) invece di rompere la pagina.
"""
from __future__ import annotations

import json

import i18n_it as IT
import wiki_fr  # noqa: E402

# ------------------------------------------------------------------ etichette di scheda
# chiave -> (italiano, inglese). Gli inglesi sono i termini dei manuali originali
# (Monster Manual / Player's Handbook), non una traduzione letterale dell'italiano.
LABELS: dict[str, tuple[str, str]] = {
    # intestazioni di campo
    "speed": ("Velocità", "Speed"),
    "ac": ("CA", "AC"),
    "hp": ("PF", "HP"),
    "cr": ("Grado di Sfida", "Challenge Rating"),
    "pb": ("BC", "PB"),
    "saves": ("Tiri Salvezza", "Saving Throws"),
    "skills": ("Abilità", "Skills"),
    "resistances": ("Resistenze", "Resistances"),
    "immunities": ("Immunità", "Immunities"),
    "vulnerabilities": ("Vulnerabilità", "Vulnerabilities"),
    "conditionImmune": ("Immunità alle condizioni", "Condition Immunities"),
    "senses": ("Sensi", "Senses"),
    "languages": ("Linguaggi", "Languages"),
    "environments": ("Ambienti", "Environments"),
    "classes": ("Classi", "Classes"),
    "hitDice": ("Dadi Vita", "Hit Dice"),
    "type": ("Tipo", "Type"),
    "rarity": ("Rarità", "Rarity"),
    "attunement": ("Sintonia", "Attunement"),
    "weight": ("Peso", "Weight"),
    "value": ("Valore", "Value"),
    "effect": ("Effetto", "Effect"),
    "base": ("Base", "Base"),
    # incantesimi
    "time": ("Tempo di Lancio", "Casting Time"),
    "range": ("Gittata", "Range"),
    "components": ("Componenti", "Components"),
    "duration": ("Durata", "Duration"),
    "level": ("Livello", "Level"),
    "higherLevels": ("A Livelli Superiori", "At Higher Levels"),
    "concentration": ("Concentrazione", "Concentration"),
    "ritual": ("Rituale", "Ritual"),
    # mostri / blocchi
    "traits": ("Tratti", "Traits"),
    "actions": ("Azioni", "Actions"),
    "reactions": ("Reazioni", "Reactions"),
    "legendary": ("Azioni Leggendarie", "Legendary Actions"),
    "lair": ("Azioni di Tana", "Lair Actions"),
    "regional": ("Effetti Regionali", "Regional Effects"),
    "spellcasting": ("Invocazione di Incantesimi", "Spellcasting"),
    "bonusActions": ("Azioni Bonus", "Bonus Actions"),
    "description": ("Descrizione", "Description"),
    "lore": ("Ambientazione", "Lore"),
    "source": ("Fonte", "Source"),
    "publication": ("Pubblicazione", "Publication"),
    "originalText": ("Testo originale in inglese — fonte 5e.tools", "Source text (5e.tools)"),
    "autoTranslation": ("Traduzione automatica", "Machine translation"),
    "translateIt": ("Traduci in italiano", "Translate to Italian"),
    "showOriginal": ("Mostra originale", "Show original"),
    # progressione / tabelle
    "levelProgression": ("Progressione per Livello", "Level Progression"),
    "scaling": ("Scaling per Livello", "Scaling per Level"),
    "features": ("Privilegi", "Features"),
    "proficiency": ("Competenze", "Proficiencies"),
    "startingProficiencies": ("Competenze Iniziali", "Starting Proficiencies"),
    "equipment": ("Equipaggiamento", "Equipment"),
    "subclass": ("Sottoclasse", "Subclass"),
    "prerequisite": ("Prerequisito", "Prerequisite"),
    # interfaccia
    "search": ("Cerca", "Search"),
    "searchPlaceholder": ("Cerca mostri, incantesimi, oggetti…", "Search monsters, spells, items…"),
    "results": ("Risultati", "Results"),
    "noResults": ("Nessun risultato", "No results"),
    "all": ("Tutte", "All"),
    "readMore": ("Leggi tutto", "Read more"),
    "backToList": ("Torna ai risultati", "Back to results"),
    "sourceTabs": ("Fonti disponibili", "Available sources"),
    "mostRecentFirst": ("la più recente per prima", "newest first"),
    "noDate": ("data non disponibile", "date unavailable"),
    "sources": ("fonti", "sources"),
    "uniqueEntries": ("voci uniche", "unique entries"),
    "totalEntities": ("entità totali, incluse le ristampe", "total entities, reprints included"),
    "favorites": ("Preferiti", "Favorites"),
    "filters": ("Filtri", "Filters"),
    "language": ("Lingua", "Language"),
    "italian": ("Italiano", "Italian"),
    "english": ("Inglese", "English"),
    "srLookup": ("Consultazione SRD live", "Live SRD lookup"),
    "openInTool": ("Apri in 5e.tools", "Open in 5e.tools"),
    # navigazione e intestazioni di pagina
    "navHome": ("Home", "Home"),
    "navCatalog": ("Catalogo", "Catalog"),
    "navStats": ("Compendio", "Compendium"),
    "navTable": ("Strumenti del Tavolo", "Table Tools"),
    "navChars": ("Personaggi", "Characters"),
    "navLookup": ("Consultazione Live", "Live Lookup"),
    "navWidgets": ("Widget (calendario e meteo)", "Widgets (calendar & weather)"),
    "navLfg": ("Trova Gruppo", "Find a Group"),
    "siteTitle": ("Il Grimorio dei Reami — Consultazione, dati e strumenti per D&D 5e",
                  "Il Grimorio dei Reami — Lookup, data and tools for D&D 5e"),
    "loading": ("Caricamento…", "Loading…"),
    # blocco Forgotten Realms Wiki (contenuto esterno CC BY-SA 3.0)
    "wikiButton": ("Arricchisci con la wiki di Forgotten Realms",
                   "Enrich from the Forgotten Realms wiki"),
    "wikiHide": ("Nascondi la voce wiki", "Hide the wiki entry"),
    "wikiLicense": ("Fonte: Forgotten Realms Wiki — licenza CC BY-SA 3.0",
                    "Source: Forgotten Realms Wiki — CC BY-SA 3.0 licence"),
    "wikiOpen": ("Apri l'articolo completo", "Open the full article"),
    "wikiMissing": ("Nessuna voce su Forgotten Realms Wiki per questa entità.",
                    "No Forgotten Realms Wiki entry for this entity."),
    "wikiError": ("Wiki non raggiungibile in questo momento.",
                  "Wiki not reachable right now."),    # traduzione estesa (pagina intera)
    # guida introduttiva
    "guide": ("Guida", "Guide"),
    "guideCta": ("Come funziona questo sito", "How this site works"),
    "guideHint": ("Percorso guidato in pochi passi: dati, lookup, strumenti e ricerca gruppi.",
                  "A short guided tour: data, lookup, tools and group finding."),
    "mtPage": ("Traduci la pagina", "Translate the page"),
    "mtPageDone": ("Pagina tradotta", "Page translated"),
    "mtPagePartial": ("Tradotta in parte", "Partially translated"),
    "mtNothing": ("Niente da tradurre", "Nothing to translate"),
    "mtQuota": ("Quota di traduzione esaurita: testo originale mantenuto.",
                "Translation quota exhausted: original text kept."),
}


def _en_map(it_map: dict[str, str]) -> dict[str, str]:
    """Mappa inglese corrispondente: per 5e.tools il valore è già inglese.

    Si costruisce dalle chiavi italiane: la forma inglese è la chiave stessa con
    l'iniziale maiuscola, tranne i casi dove la chiave è un codice (taglie) o una
    coppia di sigle (allineamenti), gestiti da mappe esplicite.
    """
    out: dict[str, str] = {}
    for k, v in it_map.items():
        out[k] = v
    return out


# Mappe inglesi esplicite (dove la chiave non è già la forma di visualizzazione).
SIZES_EN = {"T": "Tiny", "S": "Small", "M": "Medium", "L": "Large", "H": "Huge", "G": "Gargantuan"}
ALIGN_EN = {
    "L": "lawful", "N": "neutral", "C": "chaotic", "G": "good", "E": "evil",
    "U": "unaligned", "X": "special", "LG": "lawful good", "NG": "neutral good",
    "CG": "chaotic good", "LN": "lawful neutral", "N ": "neutral",
    "CN": "chaotic neutral", "LE": "lawful evil", "NE": "neutral evil",
    "CE": "chaotic evil", "NX": "neutral (chaotic tendencies)", "NY": "neutral (evil tendencies)",
}
ABILITY_EN = {"str": "Strength", "dex": "Dexterity", "con": "Constitution",
              "int": "Intelligence", "wis": "Wisdom", "cha": "Charisma"}
ABILITY_ABBR_EN = {"str": "STR", "dex": "DEX", "con": "CON", "int": "INT", "wis": "WIS", "cha": "CHA"}
SPEED_EN = {"walk": "", "burrow": "burrow", "climb": "climb", "fly": "fly", "swim": "swim", "hover": ""}
SIGLE_EN = {"armor_class": "AC", "hit_points": "HP", "challenge": "CR",
            "prof_bonus": "PB", "difficulty_class": "DC", "speed": "Speed"}
RARITY_EN = {
    "common": "common", "uncommon": "uncommon", "rare": "rare", "very rare": "very rare",
    "legendary": "legendary", "artifact": "artifact", "varies": "varies",
    "unknown": "unknown", "none": "—", "none (magic)": "— (magic)",
    "varies by type": "varies by type",
}
ITEM_TYPES_EN = {
    "WD": "Wand", "RG": "Ring", "RD": "Rod", "ST": "Staff", "P": "Potion",
    "SC": "Scroll", "W": "Weapon", "A": "Armor", "S": "Shield",
    "LA": "Light armor", "MA": "Medium armor", "HA": "Heavy armor",
    "T": "Tool", "$": "Treasure", "G": "Gear", "M": "Medium armor",
    "AF": "Ammunition", "GS": "Gear", "AT": "Art object", "EXP": "Explosive",
    "FD": "Food and drink", "MNT": "Mount and tack", "SHP": "Ship tool",
    "VEH": "Vehicle", "AIR": "Air vehicle", "SW": "Weapon",
    "R": "Ranged weapon", "MV": "Variable magic item",
}
WEAPON_PROPS_EN = {
    "ammunition": "ammunition", "finesse": "finesse", "heavy": "heavy", "light": "light",
    "loading": "loading", "range": "range", "reach": "reach", "special": "special",
    "thrown": "thrown", "two-handed": "two-handed", "versatile": "versatile",
}
LANGUAGES_EN = {
    "common": "Common", "common sign language": "Common Sign Language",
    "deep speech": "Deep Speech", "elvish": "Elvish", "dwarvish": "Dwarvish",
    "draconic": "Draconic", "infernal": "Infernal", "abyssal": "Abyssal",
    "celestial": "Celestial", "giant": "Giant", "gnomish": "Gnomish", "goblin": "Goblin",
    "halfling": "Halfling", "orc": "Orc", "sylvan": "Sylvan", "undercommon": "Undercommon",
    "aquan": "Aquan", "auran": "Auran", "ignan": "Ignan", "terran": "Terran",
    "primordial": "Primordial", "gnoll": "Gnoll", "any one language": "any one language",
    "one language of your choice": "one language of your choice", "all": "all",
    "telepathy": "Telepathy",
}
SENSES_EN = {
    "darkvision": "darkvision", "blindsight": "blindsight", "tremorsense": "tremorsense",
    "truesight": "truesight", "passive perception": "passive Perception",
    "passive insight": "passive Insight", "passive investigation": "passive Investigation",
}
CLASSES_EN = {
    "artificer": "Artificer", "barbarian": "Barbarian", "bard": "Bard", "cleric": "Cleric",
    "druid": "Druid", "fighter": "Fighter", "monk": "Monk", "paladin": "Paladin",
    "ranger": "Ranger", "rogue": "Rogue", "sorcerer": "Sorcerer", "warlock": "Warlock",
    "wizard": "Wizard", "mystic": "Mystic", "blood hunter": "Blood Hunter", "sidekick": "Sidekick",
}
CREATURE_TYPES_EN = {k: k.replace("_", " ").title() for k in IT.CREATURE_TYPES}
CREATURE_TYPES_EN.update({"swarm": "Swarm", "ooze": "Ooze", "fey": "Fey"})
SKILLS_EN = {k: k.title() for k in IT.SKILLS}
SKILLS_EN.update({"animal handling": "Animal Handling", "sleight of hand": "Sleight of Hand",
                  "animalhandling": "Animal Handling", "sleightofhand": "Sleight of Hand"})
DAMAGES_EN = {k: k.title() for k in IT.DAMAGE_TYPES}
SCHOOLS_EN = {k: k for k in IT.SCHOOLS}
CONDITIONS_EN = {k: k.title() for k in IT.CONDITIONS}
ENVIRONMENTS_EN = {k: k.title() for k in IT.ENVIRONMENTS}
CREATURE_TAGS_EN = {k: k for k in IT.CREATURE_TAGS}
PRICING_EN = {
    "free": "Free", "freemium": "Freemium", "paid": "Paid", "subscription": "Subscription",
    "one-time": "One-time", "one_time": "One-time", "pay-what-you-want": "Pay what you want",
    "open source": "Open source", "unknown": "Not stated", "": "Not stated", "none": "Not stated",
}


def terms(lang: str) -> dict:
    """Mappe terminologiche per la lingua richiesta (stesse chiavi di js_maps())."""
    if lang == "en":
        return {
            "schools": SCHOOLS_EN, "abilityLabel": ABILITY_EN, "abilityAbbr": ABILITY_ABBR_EN,
            "sizes": SIZES_EN, "creatureTypes": CREATURE_TYPES_EN, "alignments": ALIGN_EN,
            "skills": SKILLS_EN, "conditions": CONDITIONS_EN, "damages": DAMAGES_EN,
            "rarity": RARITY_EN, "environments": ENVIRONMENTS_EN, "weaponProps": WEAPON_PROPS_EN,
            "sigle": SIGLE_EN, "itemTypes": ITEM_TYPES_EN, "creatureTags": CREATURE_TAGS_EN,
            "senses": SENSES_EN, "languages": LANGUAGES_EN, "classes": CLASSES_EN,
            "speedModes": SPEED_EN, "pricing": PRICING_EN,
        }
    return {
        "schools": IT.SCHOOLS, "abilityLabel": IT.ABILITY_LABEL, "abilityAbbr": IT.ABILITY_ABBR,
        "sizes": IT.SIZES, "creatureTypes": IT.CREATURE_TYPES, "alignments": IT.ALIGNMENTS,
        "skills": IT.SKILLS, "conditions": IT.CONDITIONS, "damages": IT.DAMAGE_TYPES,
        "rarity": IT.RARITY, "environments": IT.ENVIRONMENTS, "weaponProps": IT.WEAPON_PROPS,
        "sigle": IT.SIGLE, "itemTypes": IT.ITEM_TYPES, "creatureTags": IT.CREATURE_TAGS,
        "senses": IT.SENSES, "languages": IT.LANGUAGES, "classes": IT.CLASSES,
        "speedModes": IT.SPEED_MODES, "pricing": IT.PRICING,
    }


def js_blob() -> str:
    """Blob JSON completo `BI = {it: …, en: …}` da iniettare nel browser."""
    return json.dumps({"it": terms("it"), "en": terms("en")}, ensure_ascii=False)


def labels_blob() -> str:
    """Blob delle etichette: {it: {chiave: testo}, en: {chiave: testo}}."""
    return json.dumps({
        "it": {k: v[0] for k, v in LABELS.items()},
        "en": {k: v[1] for k, v in LABELS.items()},
    }, ensure_ascii=False)


# ---------------------------------------------------------------- runtime JS
RUNTIME_JS = """
  /* Lingua attiva, letta da localStorage. Dichiarata QUI (non nel blob dei
     dati) perché il runtime è condiviso da tutte le pagine e `L()`, `setLang()`
     e `applyLang()` la usano come variabile di modulo. */
  var LANG = (function () {
    try { var v = localStorage.getItem("dndhub_lang"); if (v === "en" || v === "it") return v; } catch (e) {}
    return "it";
  })();
  /* ---------- LINGUA (IT/EN) ----------
   * `BI` porta le mappe terminologiche delle due lingue; `LABELS` le etichette.
   * `LANG` è la lingua attiva; `I18N` è un alias vivo di BI[LANG] così che il
   * codice esistente (I18N.sizes[…]) continui a funzionare senza riscritture. */
  /* Escape HTML per i moduli CONDIVISI (blocco wiki): `esc()` di cerca-app.js
     è interna al suo IIFE e non è visibile da qui. Nome distinto per non
     creare ambiguità con quella. */
  function escHtml(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function L(key) {
    var d = LABELS[LANG] || LABELS.it;
    return (key in d) ? d[key] : ((key in LABELS.it) ? LABELS.it[key] : key);
  }
  function setLang(l) {
    LANG = (l === "en") ? "en" : "it";
    I18N = BI[LANG];
    try { localStorage.setItem("dndhub_lang", LANG); } catch (e) { /* storage negato */ }
    document.documentElement.setAttribute("lang", LANG);
    applyLang();
  }
  /* Applica la lingua agli elementi marcati nel markup statico:
     [data-i18n="chiave"]      -> testo
     [data-i18n-attr="attr:chiave"] -> attributo (es. placeholder:searchPlaceholder) */
  function applyLang() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = L(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      var spec = (el.getAttribute("data-i18n-attr") || "").split(":");
      if (spec.length === 2) el.setAttribute(spec[0], L(spec[1]));
    });
    var toggles = document.querySelectorAll(".lang-toggle [data-lang]");
    toggles.forEach(function (b) {
      var act = (b.getAttribute("data-lang") === LANG);
      b.setAttribute("aria-pressed", act ? "true" : "false");
      b.classList.toggle("act", act);
    });
    var btn = document.getElementById("lang-toggle-btn");
    if (btn) btn.setAttribute("aria-label", L("language") + ": " + (LANG === "it" ? L("italian") : L("english")));
    if (typeof window.onLangChange === "function") { try { window.onLangChange(); } catch (e) { /* pagina senza re-render */ } }
  }
  function toggleLang() { setLang(LANG === "it" ? "en" : "it"); }
"""


# Helper sensibili alla lingua: in inglese restituiscono il valore originale
# della fonte (5e.tools), in italiano traducono e convertono le unità.
AWARE_JS = """
  function SENSE(x)   { return LANG === "en" ? String(x == null ? "" : x) : SENSE_IT(x); }
  function LANGNAME(x){ return LANG === "en" ? String(x == null ? "" : x) : LANG_IT(x); }
  function ENV(x)     { return LANG === "en" ? String(x == null ? "" : x) : ENV_IT(x); }
  function CLASSNAME(x){ return LANG === "en" ? String(x == null ? "" : x) : CLASS_IT(x); }
"""


def markup_toggle() -> str:
    """Pulsante di cambio lingua, da inserire nella navigazione condivisa."""
    return (
        '<div class="lang-toggle" role="group" aria-label="Lingua / Language">'
        '<button type="button" data-lang="it" class="lang-btn" onclick="setLang(\'it\')" '
        'aria-pressed="false" title="Italiano">IT</button>'
        '<button type="button" data-lang="en" class="lang-btn" onclick="setLang(\'en\')" '
        'aria-pressed="false" title="English">EN</button>'
        "</div>"
    )


def shared_js() -> str:
    """Runtime bilingue condiviso da TUTTE le pagine (navigazione + contenuti).

    Sta in un unico script inline nella navigazione perché il pulsante IT|EN è
    presente su ogni pagina, mentre `cerca-app.js` è caricato solo da cerca.html:
    senza questo, il cambio lingua solleverebbe un ReferenceError altrove.

    Espone come globali: BI, LABELS, LANG, L(), setLang(), applyLang(), toggleLang().
    Al cambio lingua richiama `window.onLangChange` se una pagina lo definisce
    (il lookup lo usa per ridisegnare chips, lista e scheda aperta).
    """
    return (
        "var BI = " + js_blob() + ";" + chr(10)
        + "var LABELS = " + labels_blob() + ";" + chr(10)
        + RUNTIME_JS
        + MT_JS
        + MT_PAGE_JS
        + wiki_fr.js()
        + """
  // Applica la lingua al primo paint e ad ogni caricamento pagina.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyLang);
  } else {
    applyLang();
  }
"""
    )


# ---------------------------------------------------------------- traduzione automatica
MT_JS = r"""
  /* ---------- TRADUZIONE AUTOMATICA SU RICHIESTA (MyMemory) ----------
   * La fonte è in inglese: la traduzione è un'azione esplicita dell'utente.
   * Limite misurato: 500 caratteri per richiesta → blocchi da <=480 sulle frasi.
   * Risultati in cache; quota esaurita = avviso, originale intatto. */
  var MT_MAX = 480;
  var MT_API = "https://api.mymemory.translated.net/get";

  function mtChunks(text) {
    var parts = String(text).split(/[.!?;]\s+/);
    var out = [], buf = "";
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if ((buf + " " + p).trim().length > MT_MAX) {
        if (buf) out.push(buf.trim());
        while (p.length > MT_MAX) { out.push(p.slice(0, MT_MAX)); p = p.slice(MT_MAX); }
        buf = p;
      } else {
        buf = (buf ? buf + " " : "") + p;
      }
    }
    if (buf.trim()) out.push(buf.trim());
    return out.filter(function (x) { return x.length > 1; });
  }
  function mtKey(t) {
    var h = 5381, s = String(t);
    for (var i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; }
    return "dndhub_mt_" + LANG + "_" + h.toString(36);
  }
  function mtGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function mtSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* quota piena */ } }

  /* Traduce in sequenza (una richiesta per volta: l'API è gratuita e rate-limited).
     onProgress(i, n) aggiorna lo stato; onDone(testo) o onErr(motivo). */
  function mtTranslate(text, onProgress, onDone, onErr) {
    var k = mtKey(text);
    var hit = mtGet(k);
    if (hit) { onDone(hit); return; }
    var chunks = mtChunks(text);
    if (!chunks.length) { onDone(text); return; }
    var acc = [], idx = 0;
    function step() {
      if (idx >= chunks.length) { mtSet(k, acc.join(" ")); onDone(acc.join(" ")); return; }
      var q = chunks[idx];
      onProgress(idx + 1, chunks.length);
      var url = MT_API + "?q=" + encodeURIComponent(q) + "&langpair=en|it";
      fetch(url).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.responseData && d.responseData.translatedText &&
            d.responseStatus !== 403 && !/QUERY LENGTH LIMIT/i.test(d.responseData.translatedText)) {
          acc.push(d.responseData.translatedText);
          idx++;
          step();
        } else if (d && d.quotaFinished) {
          onErr("quota di traduzione esaurita per oggi");
        } else {
          onErr("risposta non valida dal servizio di traduzione");
        }
      }).catch(function () { onErr("servizio di traduzione non raggiungibile"); });
    }
    step();
  }

  /* Un clic su .mt-btn alterna testo tradotto e originale.
     Il pulsante conosce il proprio blocco tramite data-mt (id univoco del blocco). */
  document.addEventListener("click", function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest(".mt-btn") : null;
    if (!btn) return;
    var uid = btn.getAttribute("data-mt");
    var src = document.getElementById(uid + "-src");
    var out = document.getElementById(uid + "-out");
    var note = document.getElementById(uid + "-note");
    if (!src || !out) return;
    if (!out.hidden) {                       // mostra l'originale
      out.hidden = true; src.hidden = false;
      btn.textContent = L("translateIt");
      btn.setAttribute("aria-expanded", "false");
      return;
    }
    var text = src.innerText || src.textContent || "";
    if (!text.trim()) return;
    btn.disabled = true;
    out.hidden = false; src.hidden = true;
    btn.setAttribute("aria-expanded", "true");
    btn.textContent = L("loading");
    mtTranslate(
      text,
      function (i, n) { btn.textContent = L("loading") + " " + i + "/" + n + "\u2026"; },
      function (tradotto) {
        out.textContent = tradotto;
        btn.disabled = false;
        btn.textContent = L("showOriginal");
        if (note) note.hidden = false;
      },
      function (motivo) {
        out.hidden = true; src.hidden = false;
        btn.disabled = false;
        btn.textContent = L("translateIt");
        if (note) { note.hidden = false; note.textContent = motivo; }
      }
    );
  });
"""


# ---------------------------------------------------------------- traduzione di pagina
MT_PAGE_JS = r"""
  /* ---------- TRADUZIONE DELL'INTERA PAGINA ----------
   * Copre la prosa statica (italiana) quando la lingua attiva è EN, e i blocchi
   * di fonte (inglesi) quando è IT. Cache per singolo blocco: la seconda visita
   * non consuma quota. Una richiesta per volta, avanzamento visibile. */
  var MT_SELECTORS = "main p, main li, main h2, main h3, main h4, main .section-title";

  /* Direzione di traduzione verso la lingua ATTIVA. */
  function mtPair() { return LANG === "en" ? "it|en" : "en|it"; }

  function mtHash(text) {
    var h = 5381, s = String(text);
    for (var i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; }
    return h.toString(36);
  }

  /* Traduzione con coppia di lingue scelta (riusa mtChunks, max 500 char/richiesta). */
  function mtTranslatePair(text, pair, onProgress, onDone, onErr) {
    var key = "dndhub_mtp_" + pair.replace("|", "") + "_" + mtHash(text);
    var hit = null;
    try { hit = localStorage.getItem(key); } catch (e) {}
    if (hit) { onDone(hit); return; }
    var chunks = mtChunks(text);
    if (!chunks.length) { onDone(text); return; }
    var acc = [], idx = 0;
    function step() {
      if (idx >= chunks.length) {
        try { localStorage.setItem(key, acc.join(" ")); } catch (e) {}
        onDone(acc.join(" "));
        return;
      }
      var url = MT_API + "?q=" + encodeURIComponent(chunks[idx]) + "&langpair=" + pair;
      fetch(url).then(function (r) { return r.json(); }).then(function (d) {
        var t = (d && d.responseData) ? d.responseData.translatedText : "";
        if (t && !/QUERY LENGTH LIMIT|MYMEMORY WARNING/i.test(t)) {
          acc.push(t); idx++;
          if (onProgress) onProgress(idx, chunks.length);
          step();
        } else if (d && d.quotaFinished) { onErr("quota"); }
        else { onErr("risposta"); }
      }).catch(function () { onErr("rete"); });
    }
    step();
  }

  /* Blocchi di prosa traducibili nella pagina corrente. */
  function mtPageTargets() {
    var out = [];
    document.querySelectorAll(MT_SELECTORS).forEach(function (el) {
      if (el.closest(".mt-out") || el.closest("script") || el.closest("style")) return;
      if (el.closest(".st-src-en")) return;            // blocchi di fonte: hanno il loro pulsante
      if (el.hasAttribute("data-mt-orig")) return;     // già tradotto
      if ((el.innerText || "").trim().length < 12) return;
      out.push(el);
    });
    return out;
  }

  function mtPage() {
    var btn = document.getElementById("mt-page-btn");
    var els = mtPageTargets();
    if (!els.length) { if (btn) btn.textContent = L("mtNothing"); return; }
    var pair = mtPair(), failed = 0, done = 0;
    if (btn) btn.disabled = true;
    function next() {
      if (!els.length) {
        if (btn) {
          btn.disabled = false;
          btn.textContent = failed ? (L("mtPagePartial") + " (" + failed + ")") : L("mtPageDone");
        }
        return;
      }
      var el = els.shift();
      var orig = (el.innerText || "").trim();
      var tot = done + els.length + 1;
      if (btn) btn.textContent = L("loading") + " " + (done + 1) + "/" + tot + "\u2026";
      mtTranslatePair(orig, pair, null,
        function (testo) {
          el.setAttribute("data-mt-orig", orig);
          el.textContent = testo;
          done++; next();
        },
        function () { failed++; next(); }
      );
    }
    next();
  }

  function mtPageReset() {
    document.querySelectorAll("[data-mt-orig]").forEach(function (el) {
      el.textContent = el.getAttribute("data-mt-orig");
      el.removeAttribute("data-mt-orig");
    });
    var btn = document.getElementById("mt-page-btn");
    if (btn) btn.textContent = L("mtPage");
  }

  function mtPageToggle() {
    if (document.querySelector("[data-mt-orig]")) { mtPageReset(); return; }
    mtPage();
  }

  /* ---------- Copertura automatica dei blocchi di fonte nella scheda ----------
   * Ogni elemento lang="en" è testo di fonte: se non ha già la barra, gliela si
   * aggiunge. Il pulsante punta al blocco con data-mt-ul, quindi non serve che il
   * renderer che l'ha prodotto conosca la traduzione. */
  function mtAttachToSourceBlocks(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('[lang="en"]').forEach(function (blk) {
      if (blk.querySelector(".mt-btn")) return;
      var ul = blk.querySelector("ul") || blk;
      if (!ul.id) ul.id = "mtx" + Math.random().toString(36).slice(2, 9);
      var bar = document.createElement("div");
      bar.className = "mt-bar";
      bar.innerHTML = '<button type="button" class="mt-btn" data-mt-ul="' + escHtml(ul.id) +
        '" aria-expanded="false">' + escHtml(L("translateIt")) + '</button>' +
        '<span class="mt-note" hidden>' + escHtml(L("autoTranslation")) + ' &mdash; MyMemory, non verificata</span>';
      blk.insertBefore(bar, blk.firstChild);
    });
  }

  /* Gestore del pulsante generico: traduce il contenuto del blocco indicato. */
  document.addEventListener("click", function (ev) {
    var b = (ev.target && ev.target.closest) ? ev.target.closest(".mt-btn[data-mt-ul]") : null;
    if (!b) return;
    var ul = document.getElementById(b.getAttribute("data-mt-ul"));
    if (!ul) return;
    var bar = b.parentNode;
    var note = bar ? bar.querySelector(".mt-note") : null;
    var out = ul.nextElementSibling;
    if (!out || !out.classList || !out.classList.contains("mt-out")) {
      out = document.createElement("div");
      out.className = "mt-out";
      ul.parentNode.insertBefore(out, ul.nextSibling);
    }
    if (!out.hidden) {
      out.hidden = true; ul.hidden = false;
      b.textContent = L("translateIt"); b.setAttribute("aria-expanded", "false");
      return;
    }
    var testo = (ul.innerText || "").trim();
    if (!testo) return;
    b.disabled = true; b.textContent = L("loading");
    ul.hidden = true; out.hidden = false;
    b.setAttribute("aria-expanded", "true");
    mtTranslatePair(testo, mtPair(),
      function (i, n) { b.textContent = L("loading") + " " + i + "/" + n + "\u2026"; },
      function (t) {
        out.textContent = t;
        b.disabled = false; b.textContent = L("showOriginal");
        if (note) note.hidden = false;
      },
      function () {
        out.hidden = true; ul.hidden = false;
        b.disabled = false; b.textContent = L("translateIt");
        if (note) { note.hidden = false; note.textContent = L("mtQuota"); }
      }
    );
  });
"""


def label_html(key: str) -> str:
    """Etichetta per un controllo statico: il testo è risolto a runtime da
    applyLang tramite data-i18n, così segue la lingua attiva."""
    it = LABELS.get(key, (key, key))[0]
    return '<span data-i18n="' + key + '">' + it + "</span>"

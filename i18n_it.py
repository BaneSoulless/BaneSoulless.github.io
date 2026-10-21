# -*- coding: utf-8 -*-
"""i18n_it.py — Localizzazione italiana del sito (D&D 5e), registro C1.

FONTE DELLA TERMINOLOGIA
  I termini seguono lo **standard dell'edizione italiana** dei manuali D&D 5e
  (Asmodee/Need Games: Manuale del Giocatore, Manuale dei Mostri, Guida del DM) e
  le convenzioni consolidate della community italiana (SRD 5.1 IT).
  Nel corso di questa sessione ho tentato la verifica su fonti italiane online
  (Fandom IT e ricerca web): entrambe non raggiungibili dal backend —
  quindi la terminologia è dichiarata come «standard dell'edizione italiana»,
  non come «verificata su fonte remota». Correggibile termine per termine.

PERCHÉ NON BASTA UNA TRADUZIONE LETTERALE
  Alcuni termini hanno un equivalente ufficiale che NON è la traduzione letterale:
    proficiency      -> Competenza      (non "proficienza")
    challenge rating -> Grado di Sfida  (non "valutazione/grado di difficoltà")  sigla GS
    proficiency bonus-> Bonus di Competenza                                      sigla BC
    hit dice         -> Dadi Vita       (non "dadi di ferita")
    charmed          -> Affascinato     (non "incantato")
    exhaustion       -> Sfinito         (non "esaurimento")
    performance      -> Intrattenere    (non "esibizione")
    investigation    -> Indagare        (non "investigazione")
    sleight of hand  -> Rapidità di Mano(non "destrezza manuale")
    cantrip          -> Trucchetto      (non "trucchetto minore")
    saving throw     -> Tiro Salvezza   (non "tiro di salvataggio")
    ability check    -> Prova di Caratteristica (non "controllo di abilità")
"""
from __future__ import annotations

import json

# ---------------------------------------------------------------- sigle ufficiali
SIGLE = {
    "armor_class": "CA",        # Classe Armatura
    "hit_points": "PF",         # Punti Ferita
    "challenge": "GS",          # Grado di Sfida (era "CR")
    "prof_bonus": "BC",         # Bonus di Competenza (era "PB")
    "difficulty_class": "CD",   # Classe Difficoltà
    "speed": "Velocità",
}

# ---------------------------------------------------------------- caratteristiche
ABILITY_LABEL = {"str": "Forza", "dex": "Destrezza", "con": "Costituzione",
                 "int": "Intelligenza", "wis": "Saggezza", "cha": "Carisma"}
ABILITY_ABBR = {"str": "FOR", "dex": "DES", "con": "COS",
                "int": "INT", "wis": "SAG", "cha": "CAR"}

# ---------------------------------------------------------------- scuole di magia
SCHOOLS = {
    "Abjuration": "Abiurazione", "Conjuration": "Evocazione", "Divination": "Divinazione",
    "Enchantment": "Ammaliamento", "Evocation": "Invocazione", "Illusion": "Illusione",
    "Necromancy": "Necromanzia", "Transmutation": "Trasmutazione",
}

# ---------------------------------------------------------------- taglie
SIZES = {"T": "Minuscola", "S": "Piccola", "M": "Media",
         "L": "Grande", "H": "Enorme", "G": "Colossale"}

# ---------------------------------------------------------------- tipi di creatura
CREATURE_TYPES = {
    "aberration": "Aberrazione", "beast": "Bestia", "celestial": "Celestiale",
    "construct": "Costrutto", "dragon": "Drago", "elemental": "Elementale",
    "fey": "Folletto", "fiend": "Immondo", "giant": "Gigante",
    "humanoid": "Umanoide", "monstrosity": "Mostruosità", "ooze": "Melma",
    "plant": "Pianta", "undead": "Non Morto", "swarm": "Sciame",
    "celestial ": "Celestiale",
}

# ---------------------------------------------------------------- allineamenti (CORRETTI)
# Mappa precedente sbagliata: NG->"legale neutrale" e NE->"legale malvagio".
ALIGNMENTS = {
    "L": "legale", "N": "neutrale", "C": "caotico",
    "G": "buono", "E": "malvagio", "U": "qualunque", "X": "speciale",
    "LG": "legale buono", "NG": "neutrale buono", "CG": "caotico buono",
    "LN": "legale neutrale", "N ": "neutrale", "CN": "caotico neutrale",
    "LE": "legale malvagio", "NE": "neutrale malvagio", "CE": "caotico malvagio",
    "NX": "neutrale (tendenze caotiche)", "NY": "neutrale (tendenze malvagie)",
}

# ---------------------------------------------------------------- abilità
SKILLS = {
    "acrobatics": "Acrobazia", "animal handling": "Addestrare Animali", "arcana": "Arcano",
    "athletics": "Atletica", "deception": "Inganno", "history": "Storia",
    "insight": "Intuizione", "intimidation": "Intimidazione", "investigation": "Indagare",
    "medicine": "Medicina", "nature": "Natura", "perception": "Percezione",
    "performance": "Intrattenere", "persuasion": "Persuasione", "religion": "Religione",
    "sleight of hand": "Rapidità di Mano", "stealth": "Furtività", "survival": "Sopravvivenza",
    "animalhandling": "Addestrare Animali", "sleightofhand": "Rapidità di Mano",
}

# ---------------------------------------------------------------- condizioni
CONDITIONS = {
    "blinded": "Accecato", "charmed": "Affascinato", "deafened": "Assordato",
    "exhaustion": "Sfinito", "frightened": "Spaventato", "grappled": "Afferrato",
    "incapacitated": "Incapacitato", "invisible": "Invisibile", "paralyzed": "Paralizzato",
    "petrified": "Pietrificato", "poisoned": "Avvelenato", "prone": "Prono",
    "restrained": "Trattenuto", "stunned": "Stordito", "unconscious": "Privo di Sensi",
    "concentration": "Concentrazione",
}

# ---------------------------------------------------------------- tipi di danno
DAMAGE_TYPES = {
    "acid": "Acido", "bludgeoning": "Contundente", "cold": "Freddo", "fire": "Fuoco",
    "force": "Forza", "lightning": "Fulmine", "necrotic": "Necrotico",
    "piercing": "Perforante", "poison": "Veleno", "psychic": "Psichico",
    "radiant": "Radioso", "slashing": "Tagliente", "thunder": "Tuono",
}

# ---------------------------------------------------------------- rarità
RARITY = {
    "common": "comune", "uncommon": "non comune", "rare": "raro",
    "very rare": "molto raro", "legendary": "leggendario", "artifact": "artefatto",
    "varies": "variabile", "unknown": "sconosciuta", "none": "—",
    "none (magic)": "— (magico)", "varies by type": "variabile per tipo",
}

# ---------------------------------------------------------------- ambienti
ENVIRONMENTS = {
    "arctic": "artico", "coastal": "costiero", "desert": "deserto", "forest": "foresta",
    "grassland": "pianura erbosa", "hill": "colline", "mountain": "montagna",
    "swamp": "palude", "underdark": "Sottosuolo", "underwater": "sott'acqua",
    "urban": "urbano", "planar": "planare", "sky": "cielo", "ruins": "rovine",
    "laboratory": "laboratorio", "shadowfell": "Shadowfell", "feywild": "Feywild",
    "elemental chaos": "Caos Elementale", "astral plane": "Piano Astrale",
}

# ---------------------------------------------------------------- proprietà armi
WEAPON_PROPS = {
    "ammunition": "munizioni", "finesse": "accurata", "heavy": "pesante",
    "light": "leggera", "loading": "ricarica", "range": "gittata",
    "reach": "portata", "special": "speciale", "thrown": "da lancio",
    "two-handed": "a due mani", "versatile": "versatile",
}

# ---------------------------------------------------------------- prezzo / modelli
PRICING = {
    "free": "Gratuito", "freemium": "Freemium", "paid": "A pagamento",
    "subscription": "Abbonamento", "one-time": "Una tantum", "one_time": "Una tantum",
    "pay-what-you-want": "Paghi quanto vuoi", "open source": "Open source",
    "unknown": "Non dichiarato", "": "Non dichiarato", "none": "Non dichiarato",
}

# ---------------------------------------------------------------- etichette interfaccia
UI = {
    # inglese -> italiano (usato nel markup statico e nelle legende)
    "Home": "Home",                       # loanword accettata in italiano
    "Directory Risorse": "Catalogo Risorse",
    "Dashboard Analytics": "Pannello Analitico",
    "Live Spell & Monster Lookup": "Consultazione live di incantesimi e mostri",
    "Systems & D&D Engine": "Systems & D&D Engine",   # firma del brand
    "FAMS-v4 Metrics": "Metriche FAMS-v4",
    "Build:": "Versione:",
    "Search": "Cerca",
    "Free": "Gratuito",
    "Pricing": "Modello di prezzo",
    "Source": "Fonte",
    "Hit Dice": "Dadi Vita",
    "Proficienze Iniziali": "Competenze iniziali",
    "Competenze/Proficienze": "Competenze",
    "Sfida (CR)": "Grado di Sfida",
    "Rate-limit": "limite di richieste",
    "Login-wall": "accesso riservato",
    "SPA Live": "SPA attive",
    "crew": "equipaggio",
}

# ---------------------------------------------------------------- unità di misura
FT_PER_METRE_RATIO = 5.0 / 1.5   # l'edizione italiana usa 1,5 m per 5 ft (= 1,5 m)


def feet_to_metres(feet: float) -> int:
    """Converte i piedi in metri con il rapporto ufficiale dell'edizione IT (5 ft = 1,5 m)."""
    return int(round(feet / FT_PER_METRE_RATIO))


def dist(feet: float) -> str:
    """Distanza localizzata: metri come unità primaria, piedi fra parentesi."""
    if feet is None:
        return "—"
    try:
        f = float(feet)
    except (TypeError, ValueError):
        return str(feet)
    return f"{feet_to_metres(f)} m ({int(f)} ft)"


def rarity(value) -> str:
    if value is None:
        return "—"
    key = str(value).strip().lower()
    if key in RARITY:
        return RARITY[key]
    # forme ibride tipo "rare (requires attunement)"
    for k, v in RARITY.items():
        if key.startswith(k):
            return key.replace(k, v, 1)
    return str(value)


# ---------------------------------------------------------------- tipi di oggetto (codici 5e.tools)
# Il campo `type` degli item 5e.tools è "CODICE|FONTE" (es. "WD|DMG"): si traduce il codice.
ITEM_TYPES = {
    "WD": "Bacchetta", "RG": "Anello", "RD": "Bastone", "ST": "Bastone magico",
    "P": "Pozione", "SC": "Pergamena", "W": "Arma", "A": "Armatura", "S": "Scudo",
    "LA": "Armatura leggera", "MA": "Armatura media", "HA": "Armatura pesante",
    "T": "Attrezzo", "$": "Tesoro", "G": "Equipaggiamento", "M": "Armatura media",
    "AF": "Munizioni", "GS": "Equipaggiamento", "AT": "Oggetto d'arte",
    "EXP": "Esplosivo", "FD": "Cibo e bevande", "MNT": "Finimenti e bardature",
    "SHP": "Attrezzo da nave", "VEH": "Veicolo", "AIR": "Veicolo aereo",
    "SW": "Arma", "R": "Arma a distanza", "MV": "Oggetto magico variabile",
}

# ---------------------------------------------------------------- tag di sottotipo creatura
CREATURE_TAGS = {
    "goblinoid": "goblinoide", "shapechanger": "mutaforma", "demon": "demone",
    "devil": "diavolo", "titan": "titano", "dragonborn": "dragonide",
    "human": "umano", "elf": "elfo", "dwarf": "nano", "halfling": "halfling",
    "gnome": "gnomo", "orc": "orco", "kobold": "coboldo", "lizardfolk": "uomodibestia",
    "yuan-ti": "yuan-ti", "gith": "gith", "dinosaur": "dinosauro",
    "swarm": "sciame", "fiend": "immondo", "celestial": "celestiale",
}


def item_type(raw) -> str:
    """Traduce il codice tipo di un oggetto 5e.tools (es. 'WD|DMG' -> 'Bacchetta')."""
    if not raw:
        return "oggetto"
    code = str(raw).split("|")[0].strip().upper()
    return ITEM_TYPES.get(code, str(raw).split("|")[0].replace("-", " "))


# ---------------------------------------------------------------- modalità di movimento
# Nel Manuale dei Mostri IT: «3 m, nuotare 12 m, volare 18 m» — walk resta senza etichetta.
SPEED_MODES = {"walk": "", "burrow": "scavare", "climb": "scalare",
               "fly": "volare", "swim": "nuotare", "hover": ""}

# ---------------------------------------------------------------- sensi
SENSES = {
    "darkvision": "scurovisione", "blindsight": "vista cieca",
    "tremorsense": "vista tellurica", "truesight": "vista pura",
    "passive perception": "Percezione passiva", "passive insight": "Intuizione passiva",
    "passive investigation": "Indagare passivo",
}

# ---------------------------------------------------------------- linguaggi
LANGUAGES = {
    "common": "Comune", "common sign language": "Lingua dei segni comune",
    "deep speech": "Linguaggio Profondo", "elvish": "Elfico", "dwarvish": "Nanico",
    "draconic": "Draconico", "infernal": "Infernale", "abyssal": "Abissale",
    "celestial": "Celestiale", "giant": "Gigante", "gnomish": "Gnomesco",
    "goblin": "Goblin", "halfling": "Halfling", "orc": "Orchesco", "sylvan": "Silvano",
    "undercommon": "Sottocomune", "aquan": "Aquan", "auran": "Auran", "ignan": "Ignan",
    "terran": "Terran", "primordial": "Primordiale", "gnoll": "Gnoll",
    "any one language": "una lingua qualsiasi", "one language of your choice": "una lingua a scelta",
    "all": "tutte", "telepathy": "Telepatia",
}

# ---------------------------------------------------------------- classi
CLASSES = {
    "artificer": "Artificiere", "barbarian": "Barbaro", "bard": "Bardo",
    "cleric": "Chierico", "druid": "Druido", "fighter": "Guerriero", "monk": "Monaco",
    "paladin": "Paladino", "ranger": "Ranger", "rogue": "Ladro", "sorcerer": "Stregone",
    "warlock": "Warlock", "wizard": "Mago", "mystic": "Mistico",
    "blood hunter": "Cacciatore di Sangue", "sidekick": "Gregario",
}


def js_maps() -> str:
    """Blob JSON da iniettare nel JS del lookup (mappe usate dai renderer)."""
    return json.dumps({
        "schools": SCHOOLS, "abilityLabel": ABILITY_LABEL, "abilityAbbr": ABILITY_ABBR,
        "sizes": SIZES, "creatureTypes": CREATURE_TYPES, "alignments": ALIGNMENTS,
        "skills": SKILLS, "conditions": CONDITIONS, "damages": DAMAGE_TYPES,
        "rarity": RARITY, "environments": ENVIRONMENTS, "weaponProps": WEAPON_PROPS,
        "sigle": SIGLE, "UI": UI, "itemTypes": ITEM_TYPES, "creatureTags": CREATURE_TAGS,
        "senses": SENSES, "languages": LANGUAGES, "classes": CLASSES, "speedModes": SPEED_MODES,
    }, ensure_ascii=False)


# Helper JS per i campi testuali di un mostro (sensi, linguaggi, classi).
# I valori arrivano da 5e.tools in inglese con unità imperiali: vanno tradotti e
# convertiti (darkvision 120 ft -> scurovisione 36 m (120 ft)).
FIELD_JS = """
  function SENSE_IT(x) {
    // In inglese il valore della fonte è già corretto: nessuna mappa, nessuna conversione.
    if (typeof LANG !== "undefined" && LANG === "en") return String(x == null ? "" : x);
    var s = String(x == null ? "" : x);
    var m = s.match(/^([A-Za-z ]+?)\\s+([\\d.,]+)\\s*ft\\.?(.*)$/);
    if (m) {
      var nm = I18N.senses[m[1].trim().toLowerCase()] || m[1].trim();
      return nm + " " + DIST(m[2]) + (m[3] || "");
    }
    var k = s.trim().toLowerCase();
    if (I18N.senses[k]) return I18N.senses[k];
    return s.replace(/^([A-Za-z ]+?)\\s+(\\d+)$/, function (_m, n2, v) {
      var nm2 = I18N.senses[n2.trim().toLowerCase()] || n2.trim();
      return nm2 + " " + v;
    });
  }
  function LANG_IT(x) {
    if (typeof LANG !== "undefined" && LANG === "en") return String(x == null ? "" : x);
    var s = String(x == null ? "" : x);
    // Alcune fonti danno più linguaggi in UNA stringa ("Comune; telepatia 36 m"):
    // senza dividere, la ricerca nella mappa fallisce e i termini restano inglesi.
    if (s.indexOf(";") !== -1) {
      return s.split(";").map(function (p) { return LANG_IT(p.trim()); }).join(", ");
    }
    var lower = s.trim().toLowerCase();
    // "understands Common but can't speak" -> "comprende il Comune ma non parla"
    var u = s.match(/^understands\\s+(.+?)(\\s+but.*)?$/i);
    if (u) {
      var l1 = I18N.languages[u[1].trim().toLowerCase()] || u[1].trim();
      return "comprende il " + l1 + (u[2] ? " ma non parla" : "");
    }
    var t = s.match(/^(telepathy)\\s+([\\d.,]+)\\s*ft\\.?$/i);
    if (t) return "Telepatia " + DIST(t[2]);
    return I18N.languages[lower] || s;
  }
  function ENV_IT(x) {
    if (typeof LANG !== "undefined" && LANG === "en") {
      var raw = String(x == null ? "" : x).replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      return raw;
    }
    var k = String(x == null ? "" : x).trim().toLowerCase();
    return I18N.environments[k] || x;
  }
  function CLASS_IT(x) {
    if (typeof LANG !== "undefined" && LANG === "en") {
      return String(x == null ? "" : x).replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
    var k = String(x == null ? "" : x).trim().toLowerCase();
    return I18N.classes[k] || x;
  }
"""


# Helper JS per il peso: l'edizione italiana usa chilogrammi (1 lb = 0,4536 kg).
WEIGHT_JS = """
  function WEIGHT(lb) {
    var n = parseFloat(lb);
    if (isNaN(n)) return String(lb == null ? "—" : lb);
    if (typeof LANG !== "undefined" && LANG === "en") return n + " lb";
    var kg = Math.round(n * 0.4536 * 100) / 100;
    var s = (kg % 1 === 0) ? String(kg) : kg.toFixed(2).replace(/0+$/, "").replace(/\\.$/, "").replace(".", ",");
    return s + " kg (" + n + " lb)";
  }
"""


# Helper JS per le distanze: iniettato accanto alle mappe.
# L'edizione italiana dei manuali usa i metri (5 ft = 1,5 m): qui i metri sono
# l'unità primaria e i piedi restano fra parentesi per chi usa i manuali originali.
DIST_JS = """
  function DIST(ft) {
    var n = parseFloat(ft);
    if (isNaN(n)) return String(ft == null ? "—" : ft);
    // In inglese l'unità della fonte è già quella giusta: nessuna conversione.
    if (typeof LANG !== "undefined" && LANG === "en") return n + " ft";
    var m = Math.round((n / 5) * 1.5 * 100) / 100;
    var ms = (m % 1 === 0) ? String(m) : m.toFixed(2).replace(/0+$/, "").replace(/\\.$/, "");
    return ms + " m (" + n + " ft)";
  }
"""

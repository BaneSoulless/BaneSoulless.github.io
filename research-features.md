# Feature interattive e fonti dati — ricerca verificata

> Verifica empirica eseguita il **2026-09-22** dalla workstation locale (`curl` + `urllib`).
> Solo ciò che è stato realmente interrogato è marcato «verificato»; tutto il resto è marcato «non verificato».
> Sito di riferimento: `C:\Users\Fabrizio\workspace\public-site` (statico, offline-first, nessun backend).

## 1. Fonti dati verificate (endpoint interrogati oggi)

| Fonte | Endpoint esatto | Esito verificato | Licenza | CORS | API key | Offline |
|---|---|---|---|---|---|---|
| **D&D 5e API** (2014) | `https://www.dnd5eapi.co/api/2014` | **200** — 24 route (`ability-scores, backgrounds, classes, conditions, equipment, feats, features, languages, magic-items, monsters, proficiencies, races, rules, skills, spells, subclasses, subraces, traits, weapon-properties`, …) | SRD 5.1 → **CC-BY-4.0** (fonte primaria: PDF ufficiale licenza) | **`Access-Control-Allow-Origin: *`** (verificato su GET) | **nessuna** | no (cache possibile) |
| **D&D 5e API** (2024) | `https://www.dnd5eapi.co/api/2024` | **200** — route 2024 incl. `species`, `subspecies`, `poisons`, `weapon-mastery-properties` | da confermare per singola risorsa (SRD 5.2) | `*` | nessuna | no |
| **Open5e v2** | `https://api.open5e.com/v2/` | **200** con **34 route**: `abilities, alignments, armor, backgrounds, classes, conditions, creatures, creaturesets, creaturetypes, damagetypes, documents, environments, feats, gamesystems, images, itemcategories, itemrarities, items, itemsets, languages, licenses, magicitems, publishers, rules, rulesets, services, sizes, skills, species, spells, spellschools, weaponproperties, weapons` | **per-documento**: `/v2/licenses/` espone `cc-by-40`, `cc0`, `ogl-10a` | `access-control-allow-origin: *` (verificato su GET con `Origin`) | nessuna | no |
| Open5e — volumi | `/v2/creatures/` **count 3541** · `/v2/spells/` **count 1955** · `/v2/species/` **count 63** | 200 | come sopra, per-documento | `*` | nessuna | no |
| **Open-Meteo** forecast | `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=temperature_2m` | **200** (già in uso nel sito) | dati aperti, uso libero non commerciale | `*` | nessuna | no (fallback già implementato) |
| **Open-Meteo** geocoding | `https://geocoding-api.open-meteo.com/v1/search?name=Rome&count=1` | **200** (un primo tentativo aveva dato 000: transitorio) | idem | `*` | nessuna | no |
| **5e.tools data** (locale) | `data/` del sito — 13.219 entità indicizzate | già integrato | mirror locale dei dati aperti | n/d | n/d | **sì** |

**Nota operativa importante (verificata):** `api.open5e.com` risponde **403** con User-Agent non-browser (es. `python-urllib`) e **200** con UA browser → **dal JavaScript di una pagina statica funziona** (il browser invia il proprio UA), ma non va interrogato da script server-side senza UA.

**Nota di licenza (fonte primaria):** il testo ufficiale della licenza SRD 5.1 richiede l'attribuzione:
> *«This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.»*
Il documento aggiunge che **non** si devono includere altre attribuzioni a Wizards e che si può dichiarare l'opera «compatible with fifth edition»/«5E compatible».

## 2. Feature candidate

Complessità (1 = banale, 5 = impegnativa) e valore per il DM (1–5) sono stime dichiarate, non misure.

| # | Feature | Cosa risolve | Fonte dati | Compl. | Valore | Offline |
|---|---|---|---|---|---|---|
| 1 | **Initiative tracker** | Ordine di iniziativa, PF, condizioni, turno corrente durante il combattimento | nessuna (stato locale + `localStorage`) | 2 | 5 | **sì** |
| 2 | **Encounter difficulty calculator** | Bilanciare uno scontro con budget XP e moltiplicatori per numero di mostri | regole SRD (già presenti nel sito) + indice locale per i CR | 2 | 5 | **sì** |
| 3 | **Generatore NPC** | Nome, razza, ruolo, tratto distintivo, segreto | tabelle proprie + nomi dai dati locali | 2 | 4 | **sì** |
| 4 | **Generatore taverna/locanda** | Nome, atmosfera, voci, avventori | tabelle proprie | 2 | 4 | **sì** |
| 5 | **Generatore tesoro** | Bottino per GS con monete, oggetti, curiosità | tabelle **proprie** (le tabelle DMG non sono in SRD → non riprodurle) | 3 | 4 | **sì** |
| 6 | **Ricerca mostri con filtri** | Filtrare per GS, tipo, taglia, ambiente invece del solo testo | indice locale (13.219) + fallback `dnd5eapi.co/api/2024/monsters` | 3 | 5 | parziale (indice locale sì) |
| 7 | **Confronto mostri affiancato** | Paragonare due creature prima di sceglierle | indice + schede locali | 3 | 3 | **sì** |
| 8 | **Spellbook per classe/personaggio** | Lista incantesimi preparati con slot e note | dato locale `gendata-spell-source-lookup` (già usato) | 2 | 4 | **sì** |
| 9 | **Import SRD 2024** (`species`, `subspecies`, `poisons`) | Coprire le regole 2024 non presenti nel dataset attuale | `dnd5eapi.co/api/2024/*` | 4 | 4 | no (o cache locale) |
| 10 | **Dadi con cronologia persistente e preset** | Salvare i tiri ricorrenti (es. attacco del PG) | locale | 1 | 3 | **sì** |
| 11 | **Iniziativa condivisa via URL** | Passare l'ordine di iniziativa al tavolo con un link | stato serializzato nel fragment | 3 | 3 | **sì** |
| 12 | **Diario di campagna** | Segnare le date Harptos degli eventi e rileggerle | `data/faerun-calendar.json` (già presente) | 3 | 4 | **sì** |
| 13 | **Meteo a 7 giorni** | Estendere la previsione oltre i 3 giorni attuali | Open-Meteo (`forecast_days=7`) | 1 | 2 | **sì** (fallback) |
| 14 | **Mappa / hexcrawl** | Esplorazione su griglia | richiede asset grafici con licenza adeguata | 5 | 4 | **sì** |
| 15 | **LFG: feed sessioni** | Pubblicare/leggere sessioni senza backend | file JSON statico + link | 4 | 4 | **sì** |

## 3. Top-3 raccomandate (sketch implementativo, client-side puro)

### A. Initiative tracker + encounter calculator (stessa scheda «DM Tools»)
Zero dipendenze esterne, tutto `localStorage`, funziona offline. Massimo valore per sessione di gioco.
```js
// stato: [{name, init, hp, hpMax, cond:[]}]
const adv = state.combatants.slice().sort((a,b) => b.init - a.init);
// budget XP: soglie SRD per livello party -> easy/medium/hard/deadly, moltiplicatori
// 1 mostro x1 · 2 x1.5 · 3-6 x2 · 7-10 x2.5 · 11-14 x3 · 15+ x4 (SRD)
function difficulty(xp, thresholds) { /* confronto + esito */ }
```

### B. Generatori NPC / taverna / tesoro con tabelle proprie
Nessuna fonte esterna da rispettare (tabelle scritte da noi) → nessun rischio di licenza. Offline.
```js
const pick = (arr) => arr[Math.floor(Math.random()*arr.length)];
const npc = { nome: pick(NOMI), ruolo: pick(RUOLI), tratto: pick(TRATTI), segreto: pick(SEGRETI) };
```

### C. Ricerca mostri con filtri (GS, tipo, taglia, ambiente)
Riusa `data/lookup-index.json`: aggiungere al renderer i campi già indicizzati e un pannello filtri; fallback opzionale `dnd5eapi.co/api/2024/monsters` per le creature non in mirror (CORS `*`, nessuna chiave).
```js
const res = INDEX.filter(m => m.type === 'monster'
  && (cr === null || crOf(m) === cr) && (!size || m.size.includes(size)));
```

## 4. Fonti citate
- `https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0License.pdf` — testo ufficiale licenza SRD 5.1 (CC-BY-4.0 + obbligo di attribuzione).
- `https://www.dnd5eapi.co/api/2014` · `.../api/2024` — route e disponibilità (verificate 200).
- `https://api.open5e.com/v2/` · `/v2/creatures/` · `/v2/spells/` · `/v2/species/` · `/v2/licenses/` — route, volumi e licenze (verificate 200).
- `https://api.open-meteo.com/v1/forecast` · `https://geocoding-api.open-meteo.com/v1/search` — verificate 200.
- Dati locali del sito: `data/lookup-index.json` (13.219 entità), `data/faerun-calendar.json`, `data/5etools/`.

## 5. Rischi e limiti (dichiarati)
1. **Marchi WotC**: usare solo materiale SRD con l'attribuzione richiesta; non riprodurre contenuto non-SRD (es. tabelle del DMG).
2. **Open5e**: è un aggregatore multi-licenza — la licenza va verificata **per il singolo documento** (`cc-by-40`, `cc0`, `ogl-10a` hanno obblighi diversi).
3. **UA/rate limit**: Open5e blocca UA non-browser (403) → va interrogato dal browser, con parsimonia e cache locale.
4. **SRD 5.2 / 2024**: la copertura per singola risorsa non è stata verificata in questa sessione → «non verificato».
5. **Dipendenza dalla rete**: qualsiasi feature basata su API esterne va progettata con fallback offline (pattern già usato per il meteo).

# Chiusura gap — nomi, schede, export (run 2026-10-06)

## Task 1 — Nomi specifici (non generici): CHIUSO
- Audit: 0 nomi generici su 179 build (era 190 cartelle su 242).
- Radice: id di copertura con `abs(hash(cat))%900` non deterministico + fallback nome=id.
- Fix: `sha1(categoria)[:6]` stabile; fallback del nome sempre sotto un gradino descrittivo
  (sottoclasse -> classe -> canale+titolo). Mai un id grezzo nel nome.

## Task 2 — Schede corrette: CHIUSO
- Difetto reale: **Boon of Fortitude** (+2 PF/livello, XPHB) non contato — B08 225 invece di 265.
- Fix: Tough e Boon contati dalla lista feats, ciascuno una volta (hp += 2*lvl*n_pf_feats).
- Verifier allineato all'aritmetica del generatore (non un verifier grezzo che segnala tutto):
  **179/179 PF coerenti, 0 incoerenti**.
- Nota: il primo verifier (una sola classe, ignora multiclasse) dava 6 falsi — non riportati
  come difetti del prodotto.

## Task 3 — Gap e rimanenze: CHIUSI
1. **48 cartelle stale su disco** (vecchi hash abs()) — rimosse e rigenerate col nuovo sha1.
2. **48 cartelle orfane su E: (Altro_GA*)** — rimosse dalla pulizia orfane dell'export.
3. **Collisioni di nome nell'export** (due build -> stessa cartella, la seconda sovrascrive
   la prima che diventava "orfana"): suffisso id (ultime 4 cifre) solo quando serve.
4. **80 DD con nome id-like** (Canale_DD001_DD001): fallback novel_builds nel ramo canale.
5. **Indici E:** generatore dedicato `make_indici_E.py` (non piu' inline): ruolo dai dati,
   match inverso con ruolo+nome, normalizzazione 45 -> **28 blocchi** (27 ruoli + Canale).

## Stato finale verificato
- E:\GDR & TTRPG\06_build_ottimizzate_e_schede: **194 cartelle, 3.880 PDF, 4,3 GB**
- 99 mie + 95 canale · 0 Altro_ · 0 id-like · tutte a 20 livelli
- Indice per ruolo: 28 blocchi · INDICE_completo.csv: 194 righe
- Sito: HTTP 200 · QA 18/18 (aritmetica OK)

## Lezioni
- Un verifier che usa un'aritmetica DIVERSA da quella del generatore segnala falsi: allinearlo
  prima di credere ai numeri.
- La migrazione di formato (naming/hash) orfana SEMPRE il vecchio export: la pulizia va
  dentro l'export, non a mano dopo.
- collisione di nomi = perdita silenziosa: il piano va deduplicato PRIMA di copiare.

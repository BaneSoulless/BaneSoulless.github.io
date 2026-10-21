# Chiusura rimanenze — ingest completo (post-riavvio Hermes)

## Inventario dal DISCO: 0/9 rimanenze aperte
pdf/levels == build attese (194==194) · ogni cartella 20 livelli (anomalie=0)
E: cartelle == pdf/levels (194==194) · E: PDF == 20xcartelle (3880==3880)
payload copre tutte le build (194==194) · nessun link PDF morto · sito 200
indice 28 blocchi · nessun nome generico

## Consumer (chiusura contro chi consuma, non contro chi produce)
- QA harness: **13/13 PASS, 0 FAIL, aritmetica OK** (TEST-008 179/179 valide, TEST-012 fuori_classe=0)
- payload SERVITO via HTTP (non letto dal file): inedite 99 + trovate 95 = 194, combo 72
- TP02 servito: «L'Ultimate Taunter — il Paracolpo Assoluto» · Paladin 20 (Oath of the Crown)
- UI servita (270 KB): accordion, slider livello PDF, pulsante export presenti

## Difetti chiusi in questa sessione (ognuno con la sua misura)
1. `level` assente -> il solver assumeva livello 1: 75 build KO su 179. Fix: derivato dalla
   somma dei livelli di classe. **75 -> 2**.
2. Talenti scelti per assi SENZA prerequisiti (GWM con FOR 10, Actor con CAR 12, Drow High
   Magic su Human): 125 talenti illegali scartati dal filtro col solver.
3. Classe presa dalla FAMIGLIA, non dalla sottoclasse («Wizard 20 Grave Domain»): 20 classi
   corrette dall'indice inverso sottoclasse->classe.
4. `check_subclass` bocciava ogni sottoclasse non censita: ora distingue «classe SBAGLIATA»
   (censita altrove = errore) da «non censita» (non verificabile). 20 -> 0.
5. `spellcasting` era un flag dichiarato: War Caster illegale su Paladino. Ora derivato dalle
   classi (spellAbility). 5 -> 0.
6. Multiclasse su punteggi NON dichiarati: punteggio non noto != punteggio insufficiente.
   2 -> 0.
7. `run_codex(set(), 15)`: il parametro era il numero di LIVELLI, non di build -> 15 cartelle
   con 15 PDF. Fix: 20. 3805 -> 3880 PDF su E:.
8. Payload scritto inline e STALE (93 build su 179): generatore riproducibile `make_payload.py`.

## Persistenza
- generatore payload riproducibile · inventario di chiusura riproducibile
- TencentDB: vedi esito sotto

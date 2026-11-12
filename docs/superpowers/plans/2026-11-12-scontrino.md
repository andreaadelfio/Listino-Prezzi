# Prezzi da scontrino Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una foto dello scontrino propone prezzi aggiornati e prodotti nuovi in una finestrella; si salva solo cio' che Andrea lascia spuntato.

**Architecture:** La Edge Function `extract-price-label` capisce se la foto e' un'etichetta o uno scontrino e, per lo scontrino, restituisce le righe abbinate ai prodotti esistenti. Un modulo puro del sito (`assets/app/receipt.js`) decide quali righe sono aggiornate, nuove o non usate; `app.js` mostra la finestrella (`<dialog>`) e salva come fa il form.

**Tech Stack:** HTML/CSS/JS statico (moduli ES), Supabase JS v2 (schema `listino`), Supabase Edge Function in Deno/TypeScript, Gemini `generateContent` con `responseSchema`, test con `node --test` (Node 22, `stripTypeScriptTypes` per il TypeScript).

**Spec:** `docs/superpowers/specs/2026-11-12-scontrino-design.md`

## Global Constraints

- Lavoro nella cartella vera `~/Dropbox/Progetti/Python/portafogli-web`; il sito resta funzionante a ogni passo.
- Niente scritture sul Supabase vero durante le prove: nel preview le richieste non-GET a Supabase sono bloccate o finte.
- La funzione la pubblica Andrea (`npx supabase functions deploy extract-price-label --remote=fvhzmkvqizfnbgxexdgu --no-verify-jwt`); il sito si pubblica con `git push git@github.com:andreaadelfio/Listino-Prezzi.git main` solo dopo il suo ok.
- Formato prezzi del listino: `1,29€`, `1,79€/kg`, `3,96€/l`, `4,99€/36pz` (`parsePriceText` in `assets/app/utils.js`).
- Prezzo di listino senza sconti; sconti, cauzione, totali, sacchetti non sono righe.
- Tempi: sito 60 s, funzione 25 s a modello (etichetta e scontrino).
- Codice semplice, commenti in italiano, riuso di classi CSS e funzioni esistenti.

## Review Focus

- Scontrino con Store non riconosciuto: la finestrella chiede lo Store fra gli esistenti; "Salva" disattivato finche' manca (test in Task 3).
- Prodotto esistente con unita' diversa (`3,96€/l` contro `1,98€`): non usato, con il motivo (test in Task 1).
- Prezzo vecchio non numerico (`??€/kg`) e nuovo `1,79€/kg`: aggiornato (test in Task 1).
- Nessuna riga utile (tutte non usate o scontrino illeggibile): messaggio chiaro, nessuna finestrella vuota da salvare (test in Task 3).
- Foto di un'etichetta: continua a riempire il form come oggi (test in Task 3).

---

### Task 1: Regola delle righe (`assets/app/receipt.js`)

**Files:**
- Create: `assets/app/receipt.js`
- Create: `tests/receipt.test.mjs`
- Modify: `Makefile` (target `test`), `service-worker.js` (aggiungi `./assets/app/receipt.js` ad `APP_SHELL`)

**Interfaces:**
- Consumes: `parsePriceText(prezzo) -> { value: number|"?"|"??"|"-"|null, unit: string|null }` da `assets/app/utils.js`.
- Produces: `classifyReceiptLines(righe, storeId, rows) -> { updated, added, skipped }` dove
  - `righe`: `[{ testo, prodotto, esistente, price, categoryName }]` (risposta della funzione);
  - `storeId`: id Store (stringa o numero); `rows`: `state.rows` (ordinati dal piu' recente; campi `id, prodotto, retailer_id, prezzo, categoria`);
  - `updated`: `[{ row, price }]` (riga del listino e prezzo nuovo);
  - `added`: `[{ prodotto, price, categoryName }]` (categoria del prodotto esistente se c'e', altrimenti quella di Gemini);
  - `skipped`: `[{ testo, prodotto, reason }]` con `reason` fra `"prezzo uguale"`, `"prezzo non letto"`, `` `hai ${old}, scontrino ${new}` ``.

- [ ] **Step 1: Scrivi i test** in `tests/receipt.test.mjs` (`node:test`, `assert/strict`) con `rows` finti per lo Store `"6"`:
  - `aggiorna_stessa_unita`: Mozzarella `1,19€` -> riga `1,29€` => `updated[0].price === "1,29€"`, `updated[0].row.id` della Mozzarella.
  - `unita_diversa_non_usata`: Succo `3,96€/l` -> `1,98€` => `skipped[0].reason === "hai 3,96€/l, scontrino 1,98€"`.
  - `prezzo_uguale`: Pane `2,10€` -> `2,10€` => skipped `"prezzo uguale"`.
  - `prezzo_vecchio_ignoto`: Banane `??€/kg` -> `1,79€/kg` => updated.
  - `nuovo_prodotto`: `esistente:false`, `Passata di pomodoro`, `0,89€`, categoria `Verdura` => `added[0]` uguale.
  - `esistente_in_altro_store`: Latte solo nello Store `"7"` (categoria `Latte e derivati`) => added con quella categoria, non quella di Gemini.
  - `esistente_ma_nome_sconosciuto`: `esistente:true` con nome assente => added.
  - `nomi_senza_maiuscole_e_spazi`: `" mozzarella "` abbina `Mozzarella`.
  - `due_righe_stesso_store`: due righe Mozzarella nello Store 6 => aggiorna la prima di `rows` (piu' recente).
  - `prodotto_ripetuto`: due righe scontrino Mozzarella => una sola (la prima).
  - `prezzo_vuoto`: `price:""` => skipped `"prezzo non letto"`.
- [ ] **Step 2: Lancia** `node --test tests/` — atteso FAIL (modulo mancante).
- [ ] **Step 3: Implementa** `classifyReceiptLines` in `assets/app/receipt.js`; confronto nomi con `trim().toLowerCase()`; stessa unita' = `unit` di `parsePriceText` uguale ignorando maiuscole (null con null); prezzo uguale = stesso `value` e stessa unita'.
- [ ] **Step 4: Lancia** `node --test tests/` — atteso PASS. Aggiungi `test:\n\tnode --test tests/` al `Makefile`.
- [ ] **Step 5: Commit** `git add assets/app/receipt.js tests/receipt.test.mjs Makefile service-worker.js && git commit -m "Scontrino: regola delle righe aggiornate, nuove e non usate"`

### Task 2: Funzione: etichetta o scontrino

**Files:**
- Modify: `supabase/functions/extract-price-label/index.ts`
- Create: `tests/extract-price-label.test.mjs`
- Modify: `supabase/functions/README.md`

**Interfaces:**
- Consumes: `prezzoDaListino(prezzo, quantita, unita, prezzoUnitario)` (gia' nel file).
- Produces (risposta HTTP):
  - etichetta: `{ tipo: "etichetta", product, price, storeName, categoryName }` (come oggi + `tipo`);
  - scontrino: `{ tipo: "scontrino", storeName, righe: [{ testo, prodotto, esistente, price, categoryName }] }`.
  - export `rispostaDaLettura(letto) -> oggetto sopra` (puro, testabile).
- Input in piu': campo multipart `prodotti` (JSON dei nomi, max 1000, stessa `nomi()` con limite alzato a 1000).

- [ ] **Step 1: Scrivi i test** in `tests/extract-price-label.test.mjs`: carica il file con `stripTypeScriptTypes` (come `/tmp/claude-1000/prova2.mjs`), `Deno` e `fetch` finti.
  - `etichetta_come_prima`: lettura etichetta (prezzo 1.98, 500 ml) => `{ tipo:"etichetta", price:"3,96€/l", ... }`.
  - `scontrino_righe`: lettura `tipo:"scontrino"` con righe `{testo:"MOZZ.FIOR.LATTE", prodotto:"Mozzarella", esistente:true, prezzo:1.29, quantita:0, unita:"nessuna", prezzo_unitario:0, categoria:""}` e `{testo:"BANANE", prodotto:"Banane", esistente:true, prezzo:0.95, quantita:0.532, unita:"kg", prezzo_unitario:1.79, categoria:"Frutta"}` => price `"1,29€"` e `"1,79€/kg"`.
  - `prodotti_nel_testo`: il testo inviato a Gemini contiene i nomi del campo `prodotti`.
  - i 10 casi di `prezzoDaListino` gia' provati.
- [ ] **Step 2: Lancia** `node --test tests/` — atteso FAIL su `rispostaDaLettura`.
- [ ] **Step 3: Implementa**: schema con `tipo` (enum `etichetta|scontrino`) e `righe` (array di oggetti con `testo, prodotto, esistente, prezzo, quantita, unita, prezzo_unitario, categoria`); istruzioni: per lo scontrino `prodotto` = nome esatto fra i prodotti dati se e' lo stesso articolo, altrimenti nome breve in italiano (max 4 parole) con `esistente:false`; prezzo unitario senza sconti ("2 x 1,29" => 1,29); niente sconti/cauzione/totali/sacchetti. `TEMPO_GEMINI = 25 * 1000`. Aggiorna il README della funzione.
- [ ] **Step 4: Lancia** `node --test tests/` — atteso PASS.
- [ ] **Step 5: Commit** `git commit -m "Foto: la funzione riconosce lo scontrino e ne restituisce le righe"`

### Task 3: Finestrella e salvataggio nel sito

**Files:**
- Modify: `index.html` (dialog dopo `#row-Store-dropdown-panel`; `?v=`), `assets/app/store.js` (elementi), `assets/app.js`, `assets/styles.css`, `assets/app/constants.js` (`APP_VERSION`), `service-worker.js` (cache `v8`), `README.md` (sezione foto)

**Interfaces:**
- Consumes: `classifyReceiptLines` (Task 1); risposta funzione (Task 2); in `app.js`: `requestLabelExtraction(file)`, `handleLabelPhotoInputChange`, `findStoreByName(name)`, `findCategoryByName(name)`, `refreshData()`, `showFeedback(msg, type)`, `showLoadingOverlay/hideLoadingOverlay`, `escapeHtml`.
- Produces: `openReceiptDialog(extraction)`, `renderReceiptDialog()`, `handleReceiptSave()`; markup `<dialog id="receipt-dialog">` con `#receipt-store-select` (`<select>` Store, visibile solo se lo Store non e' riconosciuto), `#receipt-lines` (liste), `#receipt-save-button` (testo `Salva N`), `#receipt-cancel-button`.

- [ ] **Step 1: Richiesta**: `requestLabelExtraction` aggiunge `prodotti` (nomi unici di `state.rows`) e porta il timeout a 60 s; `handleLabelPhotoInputChange`: se `extraction.tipo === "scontrino"` chiama `openReceiptDialog(extraction)` invece di `applyLabelExtractionToForm`; messaggi "Analisi foto in corso...".
- [ ] **Step 2: Finestrella**: tre sezioni come nello spec (Aggiornati con `vecchio → nuovo`, Nuovi con prezzo e categoria, Non usati con motivo senza casella); caselle spuntate di default; `Salva N` conta le spuntate e si disattiva a 0 o senza Store; se `updated` e `added` sono vuoti non apre la finestrella e mostra `showFeedback("Nessun prezzo da aggiornare in questo scontrino.", "error")` con i motivi nel `label-photo-status`. Sul telefono `<dialog>` a tutta altezza, pulsanti in basso a destra.
- [ ] **Step 3: Salvataggio** (`handleReceiptSave`): per le aggiornate `update({ prezzo, prezzo_valore, prezzo_unita }).eq("id").eq("owner")`; per le nuove un solo `insert([...])` con `owner, prodotto, retailer_id, category_id` (da `findCategoryByName`, null se assente), prezzo e campi `parsePriceText`; poi `refreshData()` e `showFeedback("Scontrino: N prezzi aggiornati, M prodotti aggiunti.")`; errori con `showFeedback(..., "error")` senza chiudere la finestrella.
- [ ] **Step 4: Prova nel preview** (412×915 e 1366): fetch finto per la funzione e per i PATCH/POST di `listino_prezzi_raw` (registra i payload, risponde 200/201). Casi: scontrino con Store riconosciuto (righe giuste, Salva manda i payload attesi), Store non riconosciuto (select, Salva disattivo), nessuna riga utile (messaggio), etichetta (form riempito come oggi), deseleziona una riga (non va nei payload). `node --test tests/` ancora PASS.
- [ ] **Step 5: Commit** `git commit -m "Scontrino: finestrella di verifica e salvataggio"`

### Task 4: Pubblicazione e prova vera

- [ ] **Step 1:** Andrea pubblica la funzione (comando nei Global Constraints).
- [ ] **Step 2:** Prova con una foto vera di scontrino dal sito locale, salvataggio bloccato; screenshot della finestrella al telefono.
- [ ] **Step 3:** Con l'ok di Andrea: `git push git@github.com:andreaadelfio/Listino-Prezzi.git main`, controllo che il sito online abbia il nuovo `?v=`.

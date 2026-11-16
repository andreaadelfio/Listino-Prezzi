import { test } from "node:test";
import assert from "node:assert/strict";
import { clearEntryFormState, fetchWithTimeout, formatPriceText, makeListinoSnapshot, rankVocabularyWords, readListinoSnapshot } from "../assets/app/utils.js";

test("formatPriceText_come_nella_tabella", () => {
  assert.equal(formatPriceText("3.4€"), "3,40€");
  assert.equal(formatPriceText("12.38€/kg"), "12,38€/kg");
  assert.equal(formatPriceText("1,29€"), "1,29€");
  assert.equal(formatPriceText("??€/kg"), "??€/kg");
  assert.equal(formatPriceText("prezzo strano"), "prezzo strano");
});

// Caccia ai bug #3: dopo una foto con Store "Coop" nuovo, la x lasciava "Nuovo Store: Coop" e il
// prodotto aggiunto dopo creava lo Store
test("reset del form: via anche lo Store e la categoria nuovi letti dalla foto", () => {
  const state = {
    formStoreId: "6", formCategoryValue: "Verdura", formSearchTerm: "yog", StoreSearchTerm: "Coop",
    categorySearchTerm: "Latticini", productInlineSuggestion: "yogurt", categorySelectionSource: "photo",
    suggestedCategoryValue: "Verdura", currentOwner: "Andrea"
  };
  clearEntryFormState(state);
  assert.deepEqual(state, {
    formStoreId: "", formCategoryValue: "", formSearchTerm: "", StoreSearchTerm: "",
    categorySearchTerm: "", productInlineSuggestion: null, categorySelectionSource: "none",
    suggestedCategoryValue: "", currentOwner: "Andrea"
  });
});

// Caccia ai bug #5: ordine fatto a mano. Prima le parole che compaiono nei prodotti (maiuscole e
// accenti non contano), poi le altre; dentro ogni gruppo in ordine alfabetico italiano. Solo parole
// di almeno 5 lettere e senza cifre.
test("vocabolario: prima le parole dei prodotti, poi le altre", () => {
  assert.deepEqual(
    rankVocabularyWords(["Mozzarella di bufala", "Caffè macinato 250g", "Pane"], ["Caffe", "biscotti", "mozzarella", "zucchine", "uova", "latte2"]),
    ["bufala", "Caffe", "caffè", "macinato", "mozzarella", "biscotti", "zucchine"]
  );
  assert.deepEqual(rankVocabularyWords([], []), []);
});

test("vocabolario: veloce anche con migliaia di parole", () => {
  const prodotti = Array.from({ length: 1500 }, (_, i) => `Prodotto${"abcdefghij"[i % 10]} parola${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26) % 26)}x`);
  const vocabolario = Array.from({ length: 1500 }, (_, i) => `voce${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26) % 26)}${String.fromCharCode(97 + Math.floor(i / 676) % 26)}`);
  const inizio = performance.now();
  rankVocabularyWords(prodotti, vocabolario);
  assert.ok(performance.now() - inizio < 500, "piu' di mezzo secondo");
});

// Caccia ai bug #4: senza rete si mostra l'ultimo listino salvato, solo dello stesso owner
test("listino salvato: si rilegge per lo stesso owner, non per altri", () => {
  const listino = { owner: "Andrea", Stores: [{ id: 6, name: "Lidl" }], categories: [{ id: 9, name: "Verdura" }], rows: [{ id: 1, prodotto: "Zucchine", selected: true }] };
  const testo = makeListinoSnapshot(listino, 1763290800000);
  assert.deepEqual(readListinoSnapshot(testo, "andrea "), { ...listino, savedAt: 1763290800000 });
  assert.equal(readListinoSnapshot(testo, "Sofia"), null);
  assert.equal(readListinoSnapshot("{rotto", "Andrea"), null);
  assert.equal(readListinoSnapshot(null, "Andrea"), null);
});

test("timeout corto solo sulle letture", async (t) => {
  // In Node il timer di AbortSignal.timeout non tiene vivo il processo: lo tiene questo
  const vivo = setInterval(() => {}, 100);
  t.after(() => clearInterval(vivo));
  const lento = (url, options) => new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason)));
  const inizio = Date.now();
  await assert.rejects(fetchWithTimeout(50, lento)("https://x/rest/v1/righe"), { name: "TimeoutError" });
  assert.ok(Date.now() - inizio < 1000);

  // Le scritture non si interrompono: una insert lenta puo' arrivare lo stesso, e riprovarla farebbe doppioni
  let segnale = "non chiamato";
  await fetchWithTimeout(50, async (url, options) => { segnale = options.signal; return "ok"; })("https://x/rest/v1/righe", { method: "POST" });
  assert.equal(segnale, undefined);

  // Un segnale gia' presente (supabase-js lo usa per annullare) resta valido
  const annulla = new AbortController();
  const promessa = fetchWithTimeout(10000, lento)("https://x/rest/v1/righe", { signal: annulla.signal });
  annulla.abort(new Error("annullata"));
  await assert.rejects(promessa, /annullata/);
});

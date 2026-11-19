import { test } from "node:test";
import assert from "node:assert/strict";
import { clearEntryFormState, extractEmojiAndName, fetchWithTimeout, formatPriceForTable, formatPriceText, getProductDetails, getSortablePriceValue, getUnitPrice, groupByCategory, makeListinoSnapshot, rankVocabularyWords, readListinoSnapshot } from "../assets/app/utils.js";

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

// "❄️" sono due caratteri (❄ + U+FE0F): prima l'icona prendeva solo il primo e il nome restava
// "\uFE0F Surgelati" (categoria 55 di Andrea, 19/11)
test("categoria nuova: emoji intera nell'icona, nome pulito", () => {
  assert.deepEqual(extractEmojiAndName("❄️ Surgelati"), { name: "Surgelati", icon: "❄️" });
  assert.deepEqual(extractEmojiAndName("Surgelati ❄️"), { name: "Surgelati", icon: "❄️" });
  assert.deepEqual(extractEmojiAndName("🧑‍🍳 Cucina"), { name: "Cucina", icon: "🧑‍🍳" });
  assert.deepEqual(extractEmojiAndName("👍🏽 Ok"), { name: "Ok", icon: "👍🏽" });
  assert.deepEqual(extractEmojiAndName("🍎 Frutta"), { name: "Frutta", icon: "🍎" });
  assert.deepEqual(extractEmojiAndName("  Pasta "), { name: "Pasta", icon: null });
});

// Gruppi della lista dei selezionati: in ordine alfabetico del nome (non dell'emoji davanti),
// "Altro" (senza categoria) in fondo
test("selezionati: gruppi per categoria in ordine alfabetico, Altro in fondo", () => {
  const riga = (prodotto, categoria, icona) => ({ product: prodotto, row: { categoria, categoria_display: categoria ? `${icona} ${categoria}` : null } });
  const gruppi = groupByCategory([
    riga("Lamponi", "Surgelati", "❄️"), riga("Crostini", null), riga("Mele", "Frutta", "🍎"),
    riga("Pane", "Alimentari", "🛒"), riga("Pere", "Frutta", "🍎")
  ]);
  assert.deepEqual(gruppi.map(([titolo, voci]) => [titolo, voci.map((v) => v.product)]), [
    ["🛒 Alimentari", ["Pane"]], ["🍎 Frutta", ["Mele", "Pere"]], ["❄️ Surgelati", ["Lamponi"]], ["Altro", ["Crostini"]]
  ]);
});

// Colonna formato: prezzo al kg, al litro o al pezzo, fatto a mano (2,19 € per 800 g = 2,7375 €/kg)
test("prezzo al kg, al litro o al pezzo: dal prezzo o dal formato", () => {
  const casi = [
    ["6,95€/kg", "", 6.95, "kg"],
    ["3€/L", "1 l", 3, "l"],
    ["0.99€/200g", "", 4.95, "kg"],
    ["2.8€/300g", "3 x 100 g", 9.3333, "kg"],
    ["2.19€", "800 g", 2.7375, "kg"],
    ["2.19€", "800g", 2.7375, "kg"],
    ["2.79€/650ml", "", 4.2923, "l"],
    ["1.19€/15pz", "", 0.0793, "pz"],
    ["1,20€", "75 cl", 1.6, "l"],
    ["1,49€", "0,5 kg", 2.98, "kg"],
    ["0.39€/pezzo", "", 0.39, "pz"],
    ["2.99€", "", null],
    ["??€/kg", "500 g", null],
    ["2.99€", "una retina", null],
    ["2.99€", "0 g", null]
  ];
  for (const [prezzo, formato, valore, unita] of casi) {
    const letto = getUnitPrice(prezzo, formato);
    if (valore === null) {
      assert.equal(letto, null, `${prezzo} ${formato}`);
      continue;
    }
    assert.ok(Math.abs(letto.value - valore) < 0.0001, `${prezzo} ${formato}: ${letto?.value}`);
    assert.equal(letto.unit, unita, `${prezzo} ${formato}`);
  }
});

test("ordinamento per prezzo: al kg se il formato lo permette, altrimenti il prezzo scritto", () => {
  assert.equal(getSortablePriceValue({ prezzo: "2.19€", formato: "800 g" }), 2.7375);
  assert.equal(getSortablePriceValue({ prezzo: "0.99€/200g" }), 4.95);
  assert.equal(getSortablePriceValue({ prezzo: "2.99€" }), 2.99);
  assert.equal(getSortablePriceValue({ prezzo: "1.19€/15pz" }), 1.19);
  assert.equal(getSortablePriceValue({ prezzo: "0.69€", formato: "3 pz" }), 0.69);
  assert.equal(getSortablePriceValue({ prezzo: "??€/kg", formato: "500 g" }), Number.POSITIVE_INFINITY);
  // Cosi' 2,19 € per 800 g (2,74 €/kg) viene prima di 1,25 € per 300 g (4,17 €/kg)
  assert.ok(getSortablePriceValue({ prezzo: "2.19€", formato: "800 g" }) < getSortablePriceValue({ prezzo: "1.25€", formato: "300 g" }));
});

test("tabella: il prezzo al kg calcolato compare solo se il prezzo non lo dice gia'", () => {
  assert.match(formatPriceForTable("2.19€", "800 g"), /2,74 €\/kg/);
  assert.match(formatPriceForTable("0.99€/200g", ""), /4,95 €\/kg/);
  assert.doesNotMatch(formatPriceForTable("6.95€/kg", "500 g"), /price-per-unit/);
  assert.doesNotMatch(formatPriceForTable("2.99€", ""), /price-per-unit/);
});

test("marca e formato accanto al nome, senza ripetere nome o Store", () => {
  const casi = [
    [{ prodotto: "Mozzarella Granarolo", marca: "Granarolo", formato: "3 x 100 g", Store_name: "Lidl" }, "3 x 100 g"],
    [{ prodotto: "Panna da cucina", marca: "Conad", formato: "", Store_name: "Conad" }, ""],
    [{ prodotto: "Yogurt greco", marca: null, formato: "170 g", Store_name: "Lidl" }, "170 g"],
    [{ prodotto: "Pesto genovese", marca: "Rana", formato: "", Store_name: "Lidl" }, "Rana"],
    [{ prodotto: "Pasta", marca: "Barilla", formato: "500 g", Store_name: "Lidl" }, "Barilla · 500 g"],
    [{ prodotto: "Uova medie 10pz", marca: "", formato: "10 pz", Store_name: "Lidl" }, ""],
    [{ prodotto: "Müller dessert", marca: "Muller", formato: "", Store_name: "Lidl" }, ""],
    [{ prodotto: "Banane" }, ""],
    [{ prodotto: "Besciamella", formato: "200 g", prezzo: "1,09€/200g", Store_name: "Lidl" }, ""]
  ];
  for (const [row, atteso] of casi) assert.equal(getProductDetails(row), atteso, row.prodotto);
});

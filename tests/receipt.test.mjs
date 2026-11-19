// Regola delle righe dello scontrino: quali aggiornano, quali sono nuove, quali non si usano
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyReceiptLines, receiptItemFromSkipped, receiptItems, receiptOperations } from "../assets/app/receipt.js";

const STORE = "6";
// state.rows e' ordinato dal piu' recente
const rows = [
  { id: 1, prodotto: "Mozzarella", retailer_id: 6, prezzo: "1,19€", categoria: "Latte e derivati" },
  { id: 2, prodotto: "Succo ananas", retailer_id: 6, prezzo: "3,96€/l", categoria: "Bevande" },
  { id: 3, prodotto: "Pane", retailer_id: 6, prezzo: "2,10€", categoria: "Panificati" },
  { id: 4, prodotto: "Banane", retailer_id: 6, prezzo: "??€/kg", categoria: "Frutta" },
  { id: 5, prodotto: "Latte intero", retailer_id: 7, prezzo: "1,05€", categoria: "Latte e derivati" },
  { id: 6, prodotto: "Mozzarella", retailer_id: 6, prezzo: "1,10€", categoria: "Latte e derivati" }
];
const riga = (prodotto, price, altro = {}) => ({ testo: prodotto.toUpperCase(), prodotto, esistente: true, price, categoryName: "", ...altro });

test("aggiorna_stessa_unita", () => {
  const { updated, added, skipped } = classifyReceiptLines([riga("Mozzarella", "1,29€")], STORE, rows);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].price, "1,29€");
  assert.equal(updated[0].row.id, 1);
  assert.deepEqual([added, skipped], [[], []]);
});

test("unita_diversa_non_usata", () => {
  const { updated, skipped } = classifyReceiptLines([riga("Succo ananas", "1,98€")], STORE, rows);
  assert.equal(updated.length, 0);
  assert.equal(skipped[0].reason, "hai 3,96€/l, scontrino 1,98€");
});

test("prezzo_uguale", () => {
  const { skipped } = classifyReceiptLines([riga("Pane", "2,10€")], STORE, rows);
  assert.equal(skipped[0].reason, "prezzo uguale");
});

test("prezzo_vecchio_ignoto", () => {
  const { updated } = classifyReceiptLines([riga("Banane", "1,79€/kg")], STORE, rows);
  assert.equal(updated[0].row.id, 4);
  assert.equal(updated[0].price, "1,79€/kg");
});

test("nuovo_prodotto", () => {
  const { added } = classifyReceiptLines(
    [riga("Passata di pomodoro", "0,89€", { esistente: false, categoryName: "Verdura" })], STORE, rows);
  assert.deepEqual(added, [{ testo: "PASSATA DI POMODORO", prodotto: "Passata di pomodoro", price: "0,89€", categoryName: "Verdura" }]);
});

test("esistente_in_altro_store", () => {
  const { added, updated } = classifyReceiptLines([riga("Latte intero", "1,09€", { categoryName: "Bevande" })], STORE, rows);
  assert.equal(updated.length, 0);
  assert.deepEqual(added, [{ testo: "LATTE INTERO", prodotto: "Latte intero", price: "1,09€", categoryName: "Latte e derivati" }]);
});

test("esistente_ma_nome_sconosciuto", () => {
  const { added } = classifyReceiptLines([riga("Mozzarella di bufala", "2,49€")], STORE, rows);
  assert.equal(added[0].prodotto, "Mozzarella di bufala");
});

test("nomi_senza_maiuscole_e_spazi", () => {
  const { updated } = classifyReceiptLines([riga(" mozzarella ", "1,29€")], STORE, rows);
  assert.equal(updated[0].row.id, 1);
});

test("due_righe_stesso_store", () => {
  const { updated } = classifyReceiptLines([riga("Mozzarella", "1,29€")], STORE, rows);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].row.id, 1);
});

test("prodotto_ripetuto", () => {
  const { updated, skipped } = classifyReceiptLines([riga("Mozzarella", "1,29€"), riga("Mozzarella", "1,35€")], STORE, rows);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].price, "1,29€");
  assert.equal(skipped.length, 0);
});

test("prezzo_vuoto", () => {
  const { skipped, updated, added } = classifyReceiptLines([riga("Mozzarella", "")], STORE, rows);
  assert.equal(skipped[0].reason, "prezzo non letto");
  assert.deepEqual([updated, added], [[], []]);
});

test("motivo_con_prezzi_formattati", () => {
  const { skipped } = classifyReceiptLines([riga("Aglio", "2,10€")], STORE,
    [{ id: 9, prodotto: "Aglio", retailer_id: 6, prezzo: "12.38€/kg", categoria: "Verdura" }]);
  assert.equal(skipped[0].reason, "hai 12,38€/kg, scontrino 2,10€");
});

test("testo_dello_scontrino_per_controllare", () => {
  const { updated, added } = classifyReceiptLines([
    riga("Mozzarella", "1,29€", { testo: "MOZZ.FIOR.LATTE" }),
    riga("Filetti di sgombro", "1,41€", { testo: "FILETTI DI SGOMBRO P", esistente: false })
  ], STORE, rows);
  assert.equal(updated[0].testo, "MOZZ.FIOR.LATTE");
  assert.equal(added[0].testo, "FILETTI DI SGOMBRO P");
});

test("venduto_a_peso_senza_prezzo_al_kg", () => {
  const { skipped, added } = classifyReceiptLines(
    [riga("Zucchine", "", { esistente: false, incompleto: true, testo: "ZUCCHINE BIO IT 14-2" })], STORE, rows);
  assert.equal(added.length, 0);
  assert.equal(skipped[0].reason, "venduto a peso, manca il prezzo al kg");
});

test("nuovo_ma_con_nome_di_un_prodotto_esistente", () => {
  const { skipped, updated, added } = classifyReceiptLines(
    [riga("Mozzarella", "1,29€", { esistente: false, testo: "FILETTI DI SGOMBRO P" })], STORE, rows);
  assert.deepEqual([updated, added], [[], []]);
  assert.equal(skipped[0].reason, "abbinamento incerto");
});

test("proposte modificabili: aggiornate e nuove diventano righe da correggere", () => {
  const classified = classifyReceiptLines([
    { testo: "MOZZ.FIOR.LATTE 1,29", prodotto: "Mozzarella", esistente: true, price: "1,29€" },
    { testo: "PASS.POM. 0,89", prodotto: "Passata di pomodoro", esistente: false, price: "0,89€", categoryName: "Verdura" }
  ], STORE, rows);
  assert.deepEqual(receiptItems(classified), [
    { kind: "updated", testo: "MOZZ.FIOR.LATTE 1,29", row: rows[0], prodotto: "Mozzarella", price: "1,29€", categoryName: "Latte e derivati" },
    { kind: "added", testo: "PASS.POM. 0,89", prodotto: "Passata di pomodoro", price: "0,89€", categoryName: "Verdura" }
  ]);
});

test("salvataggio: solo le righe con nome e prezzo, con le correzioni di Andrea", () => {
  const items = [
    { kind: "updated", testo: "MOZZ", row: rows[0], prodotto: "Mozzarella", price: " 1,35€ ", categoryName: "Latte e derivati" },
    { kind: "updated", testo: "PANE", row: rows[2], prodotto: "Pane", price: "", categoryName: "Panificati" },
    { kind: "added", testo: "PASS.POM.", prodotto: " Passata ", price: "0,89€", categoryName: "Verdura" },
    { kind: "added", testo: "", prodotto: "", price: "1€", categoryName: "" },
    { kind: "added", testo: "", prodotto: "Zucchine", price: "2,49€/kg", categoryName: "" }
  ];
  assert.deepEqual(receiptOperations(items), {
    updates: [{ row: rows[0], price: "1,35€" }],
    inserts: [
      { prodotto: "Passata", price: "0,89€", categoryName: "Verdura" },
      { prodotto: "Zucchine", price: "2,49€/kg", categoryName: "" }
    ]
  });
});

// Punto 8 (19/11): le righe non usate entrano con un tocco, gia' compilate con quello che ha letto Gemini.
// Prodotto gia' in quello Store (prezzo uguale, unita' diversa): diventa un aggiornamento di quella
// riga, non un doppione; altrimenti una riga nuova.
test("non usate: si possono aggiungere, compilate con nome e prezzo letti", () => {
  const { skipped } = classifyReceiptLines([
    riga("Succo ananas", "1,98€", { testo: "SUCCO ANANAS 1,98" }),
    riga("Zucchine", "", { testo: "ZUCCHINE 2,18", incompleto: true, categoryName: "Verdura" }),
    riga("Mozzarella", "1,29€", { esistente: false, testo: "FILETTI DI SGOMBRO P", categoryName: "Pesce" })
  ], STORE, rows);
  assert.deepEqual(skipped.map(receiptItemFromSkipped), [
    { kind: "updated", testo: "SUCCO ANANAS 1,98", row: rows[1], prodotto: "Succo ananas", price: "1,98€", categoryName: "Bevande" },
    { kind: "added", testo: "ZUCCHINE 2,18", prodotto: "Zucchine", price: "", categoryName: "Verdura" },
    { kind: "updated", testo: "FILETTI DI SGOMBRO P", row: rows[0], prodotto: "Mozzarella", price: "1,29€", categoryName: "Latte e derivati" }
  ]);
});

// Colonne marca e formato: lette da Gemini, vanno nelle righe nuove; in quelle che ci sono gia'
// riempiono solo i campi vuoti (non si cambia cio' che Andrea ha scritto)
test("marca e formato letti: nelle righe nuove, e in quelle esistenti solo se mancano", () => {
  const conFormato = [...rows, { id: 9, prodotto: "Passata", retailer_id: 6, prezzo: "1,10€", formato: "690 g", marca: "Cirio", categoria: "Conserve" }];
  const lette = classifyReceiptLines([
    { testo: "POMODORINI FF G400 1,39", prodotto: "Pomodorini", esistente: false, price: "3,48€/kg", marca: "", formato: "400 g", categoryName: "Verdura" },
    { testo: "MOZZ.FIOR.LATTE GRANAROLO 1,29", prodotto: "Mozzarella", esistente: true, price: "1,29€", marca: "Granarolo", formato: "125 g", categoryName: "" },
    { testo: "PASSATA CIRIO 700G 1,19", prodotto: "Passata", esistente: true, price: "1,19€", marca: "Cirio", formato: "700 g", categoryName: "" }
  ], STORE, conFormato);
  const { updates, inserts } = receiptOperations(receiptItems(lette));
  assert.deepEqual(inserts, [{ prodotto: "Pomodorini", price: "3,48€/kg", categoryName: "Verdura", formato: "400 g" }]);
  assert.deepEqual(updates.map(({ row, price, campi = {} }) => ({ id: row.id, price, campi })), [
    { id: 1, price: "1,29€", campi: { marca: "Granarolo", formato: "125 g" } },
    { id: 9, price: "1,19€", campi: {} }
  ]);
});

test("riga non usata aggiunta a mano: porta con se' marca e formato letti", () => {
  const { skipped } = classifyReceiptLines([
    { testo: "SALVASLIP 1,99", prodotto: "Salvaslip", esistente: false, price: "", marca: "Lines", formato: "20 pz", categoryName: "" }
  ], STORE, rows);
  const item = receiptItemFromSkipped({ ...skipped[0], price: "1,99€" });
  assert.equal(item.marca, "Lines");
  assert.equal(item.formato, "20 pz");
});

// Regola delle righe dello scontrino: quali aggiornano, quali sono nuove, quali non si usano
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyReceiptLines } from "../assets/app/receipt.js";

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
  assert.deepEqual(added, [{ prodotto: "Passata di pomodoro", price: "0,89€", categoryName: "Verdura" }]);
});

test("esistente_in_altro_store", () => {
  const { added, updated } = classifyReceiptLines([riga("Latte intero", "1,09€", { categoryName: "Bevande" })], STORE, rows);
  assert.equal(updated.length, 0);
  assert.deepEqual(added, [{ prodotto: "Latte intero", price: "1,09€", categoryName: "Latte e derivati" }]);
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

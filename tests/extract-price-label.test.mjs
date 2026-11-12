// La Edge Function, con Deno e Gemini finti: etichetta, scontrino e calcolo del prezzo
import { test } from "node:test";
import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sorgente = new URL("../supabase/functions/extract-price-label/index.ts", import.meta.url);
const file = join(mkdtempSync(join(tmpdir(), "listino-")), "index.mjs");
writeFileSync(file, stripTypeScriptTypes(readFileSync(sorgente, "utf8")));

let handler;
let lettura = {};
let testoInviato = "";
let modelli = [];
globalThis.Deno = { serve: (h) => { handler = h; }, env: { get: (k) => ({ GEMINI_API_KEY: "finta" })[k] } };
globalThis.fetch = async (url, init) => {
  modelli.push(String(url).split("/models/")[1]);
  testoInviato = JSON.parse(init.body).contents[0].parts[1].text;
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(lettura) }] } }] }));
};
const { prezzoDaListino, rispostaDaLettura } = await import(file);

async function chiama(campi = {}) {
  const fd = new FormData();
  fd.append("image", new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" }));
  for (const [nome, valore] of Object.entries(campi)) fd.append(nome, JSON.stringify(valore));
  return (await handler(new Request("http://x/", { method: "POST", body: fd }))).json();
}

test("etichetta_come_prima", async () => {
  lettura = { tipo: "etichetta", prodotto: "Succo ananas mango", prezzo: 1.98, quantita: 500, unita: "ml", prezzo_unitario: 0, store: "Lidl", categoria: "Bevande", righe: [] };
  assert.deepEqual(await chiama(), { tipo: "etichetta", product: "Succo ananas mango", price: "3,96€/l", storeName: "Lidl", categoryName: "Bevande" });
});

test("scontrino_righe", async () => {
  lettura = {
    tipo: "scontrino", prodotto: "", prezzo: 0, quantita: 0, unita: "nessuna", prezzo_unitario: 0, store: "Lidl", categoria: "",
    righe: [
      { testo: "MOZZ.FIOR.LATTE", prodotto: "Mozzarella", esistente: true, prezzo: 1.29, quantita: 0, unita: "nessuna", prezzo_unitario: 0, categoria: "" },
      { testo: "BANANE", prodotto: "Banane", esistente: true, prezzo: 0.95, quantita: 0.532, unita: "kg", prezzo_unitario: 1.79, categoria: "Frutta" }
    ]
  };
  assert.deepEqual(await chiama(), {
    tipo: "scontrino",
    storeName: "Lidl",
    righe: [
      { testo: "MOZZ.FIOR.LATTE", prodotto: "Mozzarella", esistente: true, price: "1,29€", incompleto: false, categoryName: "" },
      { testo: "BANANE", prodotto: "Banane", esistente: true, price: "1,79€/kg", incompleto: false, categoryName: "Frutta" }
    ]
  });
});

test("rispostaDaLettura_senza_righe", () => {
  assert.deepEqual(rispostaDaLettura({ tipo: "scontrino", store: "Pam" }), { tipo: "scontrino", storeName: "Pam", righe: [] });
});

test("prodotti_nel_testo", async () => {
  await chiama({ prodotti: ["Mozzarella", "Passata di pomodoro"] });
  assert.match(testoInviato, /Mozzarella, Passata di pomodoro/);
});

test("prezzoDaListino_casi", () => {
  const casi = [
    [[1.98, 500, "ml", 3.96], "3,96€/l"],
    [[1.98, 500, "ml", 0], "3,96€/l"],
    [[2.49, 250, "g", 0], "9,96€/kg"],
    [[1.2, 75, "cl", 0], "1,60€/l"],
    [[3.4, 1, "kg", 0], "3,40€/kg"],
    [[4.99, 36, "pz", 0], "4,99€/36pz"],
    [[0.89, 1, "pz", 0], "0,89€"],
    [[1.5, 0, "", 0], "1,50€"],
    [[1.5, 0, "nessuna", 0], "1,50€"],
    [[0, 0, "", 0], ""]
  ];
  for (const [argomenti, atteso] of casi) assert.equal(prezzoDaListino(...argomenti), atteso, String(argomenti));
});

test("prima_flash_poi_flash_lite", async () => {
  modelli = [];
  await chiama();
  assert.equal(modelli[0], "gemini-flash-latest:generateContent");
});

test("istruzioni_severe_sullo_scontrino", async () => {
  await chiama({ prodotti: ["Pasta penne rigate De Cecco"] });
  assert.match(testoInviato, /stesso articolo/);
  assert.match(testoInviato, /mai il nome di una categoria/);
  assert.match(testoInviato, /solo se e' scritt/);
});

test("a_peso_senza_prezzo_al_kg_e_incompleto", () => {
  const { righe } = rispostaDaLettura({ tipo: "scontrino", store: "", righe: [
    { testo: "ZUCCHINE BIO IT 14-2", prodotto: "Zucchine", esistente: true, a_peso: true, prezzo: 2.18, quantita: 0, unita: "nessuna", prezzo_unitario: 0, categoria: "Verdura" },
    { testo: "BANANE", prodotto: "Banane", esistente: true, a_peso: true, prezzo: 0.95, quantita: 0.532, unita: "kg", prezzo_unitario: 1.79, categoria: "Frutta" },
    { testo: "PENNE RIGATE", prodotto: "Penne rigate", esistente: false, a_peso: false, prezzo: 1.09, quantita: 0, unita: "nessuna", prezzo_unitario: 0, categoria: "Pasta" }
  ] });
  assert.deepEqual(righe.map((riga) => [riga.price, riga.incompleto]), [["", true], ["1,79€/kg", false], ["1,09€", false]]);
});

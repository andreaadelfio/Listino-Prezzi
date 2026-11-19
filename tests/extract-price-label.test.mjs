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
  assert.deepEqual(await chiama(), { tipo: "etichetta", product: "Succo ananas mango", price: "3,96€/l", marca: "", formato: "500 ml", storeName: "Lidl", categoryName: "Bevande" });
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
      { testo: "MOZZ.FIOR.LATTE", prodotto: "Mozzarella", esistente: true, price: "1,29€", incompleto: false, marca: "", formato: "", categoryName: "" },
      { testo: "BANANE", prodotto: "Banane", esistente: true, price: "1,79€/kg", incompleto: false, marca: "", formato: "", categoryName: "Frutta" }
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

test("frutta_verdura_carne_pesce_senza_prezzo_al_kg_incompleti", () => {
  const riga = (prodotto, categoria, altro = {}) => ({ testo: prodotto.toUpperCase(), prodotto, esistente: true, a_peso: false,
    prezzo: 2.18, quantita: 0, unita: "nessuna", prezzo_unitario: 0, categoria, ...altro });
  const { righe } = rispostaDaLettura({ tipo: "scontrino", store: "Coop", righe: [
    riga("Zucchine", "Verdura"),
    riga("Kiwi", "Frutta"),
    riga("Filetti di sgombro", "Pesce e prodotti ittici"),
    riga("Pomodorini", "Verdura", { quantita: 400, unita: "g" }),
    riga("Penne rigate", "Pasta")
  ] });
  assert.deepEqual(righe.map((r) => r.price), ["", "", "", "5,45€/kg", "2,18€"]);
});

test("Gemini sovraccarico: prova i modelli di riserva, poi un messaggio breve", async () => {
  const fetchVero = globalThis.fetch;
  const provati = [];
  try {
    globalThis.fetch = async (url, init) => {
      provati.push(String(url).split("/models/")[1].split(":")[0]);
      if (provati.length < 3) return new Response(JSON.stringify({ error: { message: "This model is currently experiencing high demand." } }), { status: 503 });
      return fetchVero(url, init);
    };
    lettura = { tipo: "etichetta", prodotto: "Latte", prezzo: 1.09, quantita: 0, unita: "nessuna", prezzo_unitario: 0, store: "", categoria: "" };
    assert.equal((await chiama()).product, "Latte");
    assert.deepEqual(provati, ["gemini-flash-latest", "gemini-3.6-flash", "gemini-3.5-flash-lite"]);

    provati.length = 0;
    globalThis.fetch = async (url) => {
      provati.push(String(url).split("/models/")[1].split(":")[0]);
      return new Response(JSON.stringify({ error: { message: "This model is currently experiencing high demand." } }), { status: 503 });
    };
    const { error } = await chiama();
    assert.equal(provati.length, 4);
    assert.match(error, /^Gemini e' sovraccarico in questo momento, riprova tra qualche minuto/);
    assert.doesNotMatch(error, /high demand/);
  } finally {
    globalThis.fetch = fetchVero;
  }
});

// Colonne marca e formato: lo yogurt greco Pam del listino (500 g, 5,60 €/kg), le righe di esempio del
// prompt (pomodorini da 400 g, zucchine pesate) e una confezione a pezzi e una in litri
test("marca e formato: etichetta e righe dello scontrino", async () => {
  lettura = { tipo: "etichetta", prodotto: "Yogurt greco", marca: "Pam", prezzo: 2.8, quantita: 500, unita: "g", prezzo_unitario: 5.6, store: "Pam", categoria: "Latte e derivati", righe: [] };
  const etichetta = await chiama();
  assert.equal(etichetta.marca, "Pam");
  assert.equal(etichetta.formato, "500 g");
  assert.equal(etichetta.price, "5,60€/kg");

  lettura = {
    tipo: "scontrino", prodotto: "", marca: "", prezzo: 0, quantita: 0, unita: "nessuna", prezzo_unitario: 0, store: "Lidl", categoria: "",
    righe: [
      { testo: "POMODORINI FF G400 2 X 1,39 2,78", prodotto: "Pomodorini ciliegina", marca: "", esistente: true, a_peso: false, prezzo: 1.39, quantita: 400, unita: "g", prezzo_unitario: 0, categoria: "Verdura" },
      { testo: "ZUCCHINE BIO 0,532 kg x 2,49 EUR/kg 1,32", prodotto: "Zucchine", marca: "", esistente: true, a_peso: true, prezzo: 1.32, quantita: 0.532, unita: "kg", prezzo_unitario: 2.49, categoria: "Verdura" },
      { testo: "SALVASLIP LINES 20PZ 1,99", prodotto: "Salvaslip", marca: "Lines", esistente: false, a_peso: false, prezzo: 1.99, quantita: 20, unita: "pz", prezzo_unitario: 0, categoria: "Saponi e igiene" },
      { testo: "OLIO EVO 0,75L 6,49", prodotto: "Olio evo", marca: "", esistente: true, a_peso: false, prezzo: 6.49, quantita: 0.75, unita: "l", prezzo_unitario: 0, categoria: "" }
    ]
  };
  const { righe } = await chiama();
  // Il peso della roba pesata e' quanto si e' comprato, non il formato della confezione
  assert.deepEqual(righe.map(({ marca, formato }) => ({ marca, formato })), [
    { marca: "", formato: "400 g" },
    { marca: "", formato: "" },
    { marca: "Lines", formato: "20 pz" },
    { marca: "", formato: "0,75 l" }
  ]);
});

test("schema: Gemini legge la marca, nell'etichetta e nelle righe", async () => {
  let schema;
  const fetchPrima = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    schema = JSON.parse(init.body).generationConfig.responseSchema;
    return fetchPrima(url, init);
  };
  await chiama();
  globalThis.fetch = fetchPrima;
  assert.ok(schema.required.includes("marca"));
  assert.ok(schema.properties.righe.items.required.includes("marca"));
});

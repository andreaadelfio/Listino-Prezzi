import { formatPriceText, parsePriceText } from "./utils.js";

// Righe di uno scontrino letto da Gemini (supabase/functions/extract-price-label), confrontate con
// il listino di uno Store. Si aggiorna solo cio' che e' sicuro: stesso prodotto, stessa unita' di
// prezzo (€ con €, €/kg con €/kg...) e prezzo diverso. Il resto e' nuovo o non usato, con il motivo.
//   righe: [{ testo, prodotto, esistente, price, categoryName }]
//   rows: state.rows, dal piu' recente
// Restituisce { updated: [{ testo, row, price }], added: [{ testo, prodotto, price, categoryName }], skipped: [{ testo, prodotto, reason }] }
// (testo e' la riga com'e' scritta sullo scontrino: nella finestrella serve a controllare l'abbinamento)
const nomeChiave = (nome) => String(nome || "").trim().toLowerCase();
const unitaChiave = (prezzo) => String(parsePriceText(prezzo).unit || "").toLowerCase();

export function classifyReceiptLines(righe, storeId, rows) {
  const updated = [];
  const added = [];
  const skipped = [];
  const visti = new Set();

  for (const riga of righe) {
    const prodotto = String(riga.prodotto || "").trim();
    const chiave = nomeChiave(prodotto);
    if (!chiave || visti.has(chiave)) continue; // lo stesso prodotto due volte: vale il primo
    visti.add(chiave);

    const price = String(riga.price || "").trim();
    if (!price) {
      skipped.push({ testo: riga.testo, prodotto, reason: riga.incompleto ? "venduto a peso, manca il prezzo al kg" : "prezzo non letto" });
      continue;
    }

    const stessoNome = rows.filter((row) => nomeChiave(row.prodotto) === chiave);
    // Gemini dice "nuovo" ma usa il nome di un prodotto che c'e' gia': risposta contraddittoria
    if (riga.esistente === false && stessoNome.length) {
      skipped.push({ testo: riga.testo, prodotto, reason: "abbinamento incerto" });
      continue;
    }
    const nelloStore = stessoNome.find((row) => String(row.retailer_id) === String(storeId));
    if (!nelloStore) {
      // Nuovo, o gia' presente in un altro Store: allora tiene il suo nome e la sua categoria
      added.push({
        testo: riga.testo,
        prodotto: stessoNome[0]?.prodotto || prodotto,
        price,
        categoryName: stessoNome[0]?.categoria || riga.categoryName || ""
      });
      continue;
    }

    if (unitaChiave(nelloStore.prezzo) !== unitaChiave(price)) {
      skipped.push({ testo: riga.testo, prodotto: nelloStore.prodotto, reason: `hai ${formatPriceText(nelloStore.prezzo)}, scontrino ${formatPriceText(price)}` });
    } else if (parsePriceText(nelloStore.prezzo).value === parsePriceText(price).value) {
      skipped.push({ testo: riga.testo, prodotto: nelloStore.prodotto, reason: "prezzo uguale" });
    } else {
      updated.push({ testo: riga.testo, row: nelloStore, price });
    }
  }

  return { updated, added, skipped };
}

// Le proposte da correggere nella finestrella: una riga per ogni aggiornata e nuova, nello stesso ordine
//   kind: "updated" (cambia solo il prezzo di row) o "added" (nome, prezzo e categoria si correggono)
export function receiptItems({ updated, added }) {
  return [
    ...updated.map(({ testo, row, price }) => ({ kind: "updated", testo, row, prodotto: row.prodotto, price, categoryName: row.categoria || "" })),
    ...added.map(({ testo, prodotto, price, categoryName }) => ({ kind: "added", testo, prodotto, price, categoryName }))
  ];
}

// Cosa scrivere con "Salva": solo le righe con nome e prezzo (una riga lasciata vuota non conta)
export function receiptOperations(items) {
  const complete = items
    .map((item) => ({ ...item, prodotto: String(item.prodotto || "").trim(), price: String(item.price || "").trim() }))
    .filter((item) => item.prodotto && item.price);
  return {
    updates: complete.filter((item) => item.kind === "updated").map(({ row, price }) => ({ row, price })),
    inserts: complete.filter((item) => item.kind === "added").map(({ prodotto, price, categoryName }) => ({ prodotto, price, categoryName }))
  };
}

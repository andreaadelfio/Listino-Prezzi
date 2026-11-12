import { parsePriceText } from "./utils.js";

// Righe di uno scontrino letto da Gemini (supabase/functions/extract-price-label), confrontate con
// il listino di uno Store. Si aggiorna solo cio' che e' sicuro: stesso prodotto, stessa unita' di
// prezzo (€ con €, €/kg con €/kg...) e prezzo diverso. Il resto e' nuovo o non usato, con il motivo.
//   righe: [{ testo, prodotto, esistente, price, categoryName }]
//   rows: state.rows, dal piu' recente
// Restituisce { updated: [{ row, price }], added: [{ prodotto, price, categoryName }], skipped: [{ testo, prodotto, reason }] }
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
      skipped.push({ testo: riga.testo, prodotto, reason: "prezzo non letto" });
      continue;
    }

    const stessoNome = rows.filter((row) => nomeChiave(row.prodotto) === chiave);
    const nelloStore = stessoNome.find((row) => String(row.retailer_id) === String(storeId));
    if (!nelloStore) {
      // Nuovo, o gia' presente in un altro Store: allora tiene il suo nome e la sua categoria
      added.push({
        prodotto: stessoNome[0]?.prodotto || prodotto,
        price,
        categoryName: stessoNome[0]?.categoria || riga.categoryName || ""
      });
      continue;
    }

    if (unitaChiave(nelloStore.prezzo) !== unitaChiave(price)) {
      skipped.push({ testo: riga.testo, prodotto: nelloStore.prodotto, reason: `hai ${nelloStore.prezzo}, scontrino ${price}` });
    } else if (parsePriceText(nelloStore.prezzo).value === parsePriceText(price).value) {
      skipped.push({ testo: riga.testo, prodotto: nelloStore.prodotto, reason: "prezzo uguale" });
    } else {
      updated.push({ row: nelloStore, price });
    }
  }

  return { updated, added, skipped };
}

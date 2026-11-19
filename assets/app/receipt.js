import { formatPriceText, parsePriceText } from "./utils.js";

// Righe di uno scontrino letto da Gemini (supabase/functions/extract-price-label), confrontate con
// il listino di uno Store. Si aggiorna solo cio' che e' sicuro: stesso prodotto, stessa unita' di
// prezzo (€ con €, €/kg con €/kg...) e prezzo diverso. Il resto e' nuovo o non usato, con il motivo.
//   righe: [{ testo, prodotto, esistente, price, marca, formato, categoryName }]
//   rows: state.rows, dal piu' recente
// Restituisce { updated: [{ testo, row, price }], added: [{ testo, prodotto, price, categoryName }], skipped: [{ testo, prodotto, reason }] }
// (testo e' la riga com'e' scritta sullo scontrino: nella finestrella serve a controllare l'abbinamento)
const nomeChiave = (nome) => String(nome || "").trim().toLowerCase();
const unitaChiave = (prezzo) => String(parsePriceText(prezzo).unit || "").toLowerCase();
// Marca e formato letti da Gemini, solo quelli scritti (le righe senza restano come prima)
const campiLetti = ({ marca, formato }) =>
  Object.fromEntries(Object.entries({ marca, formato }).map(([campo, valore]) => [campo, String(valore || "").trim()]).filter(([, valore]) => valore));

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
    const letti = campiLetti(riga);
    const stessoNome = rows.filter((row) => nomeChiave(row.prodotto) === chiave);
    const nelloStore = stessoNome.find((row) => String(row.retailer_id) === String(storeId));
    // Una riga non usata tiene quello che si e' letto: Andrea puo' aggiungerla lo stesso (receiptItemFromSkipped)
    const nonUsata = (reason, nome = prodotto) => skipped.push({
      testo: riga.testo, prodotto: nome, reason, price, row: nelloStore, ...letti,
      categoryName: nelloStore?.categoria || stessoNome[0]?.categoria || riga.categoryName || ""
    });
    if (!price) {
      nonUsata(riga.incompleto ? "venduto a peso, manca il prezzo al kg" : "prezzo non letto");
      continue;
    }

    // Gemini dice "nuovo" ma usa il nome di un prodotto che c'e' gia': risposta contraddittoria
    if (riga.esistente === false && stessoNome.length) {
      nonUsata("abbinamento incerto");
      continue;
    }
    if (!nelloStore) {
      // Nuovo, o gia' presente in un altro Store: allora tiene il suo nome e la sua categoria
      added.push({
        testo: riga.testo,
        prodotto: stessoNome[0]?.prodotto || prodotto,
        price,
        categoryName: stessoNome[0]?.categoria || riga.categoryName || "",
        ...letti
      });
      continue;
    }

    if (unitaChiave(nelloStore.prezzo) !== unitaChiave(price)) {
      nonUsata(`hai ${formatPriceText(nelloStore.prezzo)}, scontrino ${formatPriceText(price)}`, nelloStore.prodotto);
    } else if (parsePriceText(nelloStore.prezzo).value === parsePriceText(price).value) {
      nonUsata("prezzo uguale", nelloStore.prodotto);
    } else {
      updated.push({ testo: riga.testo, row: nelloStore, price, ...letti });
    }
  }

  return { updated, added, skipped };
}

// Le proposte da correggere nella finestrella: una riga per ogni aggiornata e nuova, nello stesso ordine
//   kind: "updated" (cambia solo il prezzo di row) o "added" (nome, prezzo e categoria si correggono)
export function receiptItems({ updated, added }) {
  return [
    ...updated.map(({ testo, row, price, ...letti }) => ({ kind: "updated", testo, row, prodotto: row.prodotto, price, categoryName: row.categoria || "", ...letti })),
    ...added.map(({ testo, prodotto, price, categoryName, ...letti }) => ({ kind: "added", testo, prodotto, price, categoryName, ...letti }))
  ];
}

// Cosa scrivere con "Salva": solo le righe con nome e prezzo (una riga lasciata vuota non conta).
// Marca e formato letti vanno nelle righe nuove; in quelle che ci sono gia' solo dove mancano (campi)
const campiMancanti = (item) => Object.fromEntries(Object.entries(campiLetti(item)).filter(([campo]) => !item.row?.[campo]));
export function receiptOperations(items) {
  const complete = items
    .map((item) => ({ ...item, prodotto: String(item.prodotto || "").trim(), price: String(item.price || "").trim() }))
    .filter((item) => item.prodotto && item.price);
  return {
    updates: complete.filter((item) => item.kind === "updated").map((item) => {
      const campi = campiMancanti(item);
      return Object.keys(campi).length ? { row: item.row, price: item.price, campi } : { row: item.row, price: item.price };
    }),
    inserts: complete.filter((item) => item.kind === "added").map((item) => ({ prodotto: item.prodotto, price: item.price, categoryName: item.categoryName, ...campiLetti(item) }))
  };
}

// Una riga non usata, aggiunta a mano dalla finestrella: se il prodotto e' gia' in quello Store ne
// aggiorna la riga (niente doppioni), altrimenti e' una riga nuova. Si corregge come le altre.
export function receiptItemFromSkipped({ testo, prodotto, price, categoryName, row, ...altri }) {
  const letti = campiLetti(altri);
  return row
    ? { kind: "updated", testo, row, prodotto: row.prodotto, price: price || "", categoryName: row.categoria || "", ...letti }
    : { kind: "added", testo, prodotto, price: price || "", categoryName: categoryName || "", ...letti };
}

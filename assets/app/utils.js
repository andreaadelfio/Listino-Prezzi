import { SORTABLE_COLUMN_KEYS } from "./constants.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function parsePriceText(priceText) {
  const normalizedText = String(priceText || "")
    .replace(/\u00A0/g, " ")
    .trim();

  const pricePattern = /^(\d+(?:[.,]\d+)?|\?{1,2}|-)\s*€(?:\s*\/\s*(\w+))?$/i;
  const match = normalizedText.match(pricePattern);

  if (!match) {
    return { value: null, unit: null };
  }

  const rawValue = match[1];
  let value;

  if (rawValue === "?" || rawValue === "??" || rawValue === "-") {
    value = rawValue;
  } else {
    value = Number(rawValue.replace(",", "."));
  }

  return {
    value,
    unit: match[2] || null
  };
}

// Il prezzo come lo mostra la tabella, in una riga di testo: "3.4€" -> "3,40€", "12.38€/kg" -> "12,38€/kg"
export function formatPriceText(priceText) {
  const { value, unit } = parsePriceText(priceText);
  if (typeof value !== "number") {
    return String(priceText || "");
  }
  const formattedValue = value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formattedValue}€${unit ? `/${unit}` : ""}`;
}

// Contenuto della confezione ("500 g", "3 x 100 g", "1L", "10 pz") in kg, litri o pezzi; null se non si legge
// (quante ne stanno in un kg o in un litro: come IN_KG_O_L della Edge Function, si moltiplica prima di dividere)
const MISURE = { g: [1000, "kg"], kg: [1, "kg"], ml: [1000, "l"], cl: [100, "l"], l: [1, "l"], pz: [1, "pz"], pezzo: [1, "pz"], pezzi: [1, "pz"] };
function parseFormato(text) {
  const match = String(text || "").trim().toLowerCase().replace(",", ".")
    .match(/^(?:(\d+)\s*x\s*)?(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l|pz|pezzo|pezzi)$/);
  if (!match) return null;
  const [perUnit, unit] = MISURE[match[3]];
  const count = Number(match[1] || 1) * Number(match[2]);
  return count > 0 ? { count, perUnit, unit } : null;
}

// Prezzo al kg, al litro o al pezzo: dal prezzo stesso ("6,95€/kg", "0,99€/200g") o, per il prezzo
// della confezione ("2,19€"), dal formato ("800 g"). null se non si puo' calcolare
export function getUnitPrice(priceText, formato) {
  const { value, unit } = parsePriceText(priceText);
  if (typeof value !== "number") return null;
  const size = unit ? parseFormato(/^\d/.test(unit) ? unit : `1 ${unit}`) : parseFormato(formato);
  return size ? { value: (value * size.perUnit) / size.count, unit: size.unit } : null;
}

export function formatPriceForTable(priceText, formato = "") {
  const { value, unit } = parsePriceText(priceText);
  if (value === null) {
    return `
      <div class="price-table-cell">
        <span class="price-value">${escapeHtml(priceText)}</span>
      </div>`.trim();
  }

  const formattedValue = value.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const unitPart = unit ? `€/${unit}` : "€";
  // Il prezzo al kg (o al litro, al pezzo) quando quello scritto e' della confezione: e' quello che ordina
  const unitPrice = MISURE[String(unit || "").toLowerCase()] ? null : getUnitPrice(priceText, formato);
  const unitPriceText = unitPrice
    ? `${unitPrice.value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/${unitPrice.unit}`
    : "";

  return `
    <div class="price-table-cell">
      <span class="price-value">${formattedValue}</span>
      <span class="price-unit">${escapeHtml(unitPart)}</span>
      ${unitPriceText ? `<span class="price-per-unit">${escapeHtml(unitPriceText)}</span>` : ""}
    </div>
  `.trim();
}

// Marca e formato accanto al nome, se non li dicono gia' il nome, lo Store (la marca del negozio) o il prezzo ("0,99€/200g")
export function getProductDetails(row) {
  const key = (text) => normalizeAlphabetSource(text).toLowerCase().replace(/\s+/g, "");
  const name = key(row?.prodotto);
  const alreadyShown = [key(row?.Store_name), key(parsePriceText(row?.prezzo).unit)];
  return [row?.marca, row?.formato]
    .map((part) => String(part || "").trim())
    .filter((part) => part && !name.includes(key(part)) && !alreadyShown.includes(key(part)))
    .join(" ");
}

export function normalizeQuantity(value, fallback = 1) {
  const parsedValue = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }
  return parsedValue;
}

export function getSortablePriceValue(row) {
  if (!row) {
    return Number.POSITIVE_INFINITY;
  }

  // Al kg o al litro anche quando e' scritto per confezione; al pezzo no (resta il prezzo scritto, come prima)
  const unitPrice = getUnitPrice(row.prezzo, row.formato);
  if (unitPrice && unitPrice.unit !== "pz") {
    return unitPrice.value;
  }
  const parsedPrice = parsePriceText(row.prezzo);
  return Number.isFinite(parsedPrice.value) ? parsedPrice.value : Number.POSITIVE_INFINITY;
}

export function getRowQuantityValue(row) {
  return normalizeQuantity(row?.quantity, 1);
}

export function normalizeOwnerValue(value) {
  return String(value || "").trim();
}

export function normalizeAlphabetSource(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeOwnerKey(value) {
  return normalizeOwnerValue(value).toLowerCase();
}

export function normalizeSortKey(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  // Le chiavi hanno maiuscole ("Store"): il confronto va fatto in minuscolo su entrambe
  return SORTABLE_COLUMN_KEYS.find((key) => key.toLowerCase() === normalizedValue) || "prodotto";
}

export function normalizeSortDirection(value) {
  return String(value || "").trim().toLowerCase() === "desc" ? "desc" : "asc";
}

export function getProductAlphabetLetter(value) {
  const normalized = normalizeAlphabetSource(value);
  const firstCharacter = normalized.charAt(0).toUpperCase();
  return /^[A-Z]$/.test(firstCharacter) ? firstCharacter : "#";
}

export function compareTextValues(valueA, valueB) {
  return String(valueA || "").localeCompare(String(valueB || ""), "it", { sensitivity: "base" });
}

// Sul telefono il focus automatico aprirebbe la tastiera sopra le opzioni: lo lascia al tocco dell'utente.
export function focusWithoutTouchKeyboard(element) {
  if (element && !window.matchMedia("(pointer: coarse)").matches) {
    element.focus();
  }
}

// Svuota il form di inserimento (la x): campi, scelte di Store e categoria, suggerimenti
export function clearEntryFormState(state) {
  state.formStoreId = "";
  state.formCategoryValue = "";
  state.formSearchTerm = "";
  state.StoreSearchTerm = ""; // "Nuovo Store: ..." (letto dalla foto o scritto): senza, il + successivo lo creerebbe
  state.categorySearchTerm = "";
  state.productInlineSuggestion = null;
  state.categorySelectionSource = "none";
  state.suggestedCategoryValue = "";
}

// Parole per il suggerimento mentre si scrive il prodotto: prima quelle che compaiono nei prodotti
// del listino, poi le altre del vocabolario. Solo parole di almeno 5 lettere e senza cifre.
export function rankVocabularyWords(productNames, vocabularyWords) {
  const historicalWords = productNames
    .flatMap((name) => String(name || "").split(/[^\p{L}]+/u))
    .map((word) => String(word.toLowerCase() || "").trim())
    .filter((word) => word && word.length >= 5 && !/\d/.test(word));
  const words = [...new Set([...historicalWords, ...vocabularyWords]
    .map((word) => String(word || "").trim())
    .filter((word) => word && word.length >= 5 && !/\d/.test(word))
  )].sort((a, b) => a.localeCompare(b, "it"));
  // Confronto senza maiuscole e accenti con un Set (prima localeCompare parola per parola: 1,5 s sul telefono)
  const key = (word) => word.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const historicalKeys = new Set(historicalWords.map(key));
  const inProducts = (word) => historicalKeys.has(key(word));
  return [...words.filter(inProducts), ...words.filter((word) => !inProducts(word))];
}

// L'ultimo listino caricato, da mostrare senza rete (solo per lo stesso owner)
export function makeListinoSnapshot({ owner, Stores, categories, rows }, savedAt = Date.now()) {
  return JSON.stringify({ owner, savedAt, Stores, categories, rows });
}

export function readListinoSnapshot(text, owner) {
  try {
    const saved = JSON.parse(text);
    return saved && Array.isArray(saved.rows) && normalizeOwnerKey(saved.owner) === normalizeOwnerKey(owner) ? saved : null;
  } catch {
    return null;
  }
}

// fetch per supabase-js: le letture si arrendono dopo ms (rete assente o lentissima). Le scritture
// no: una insert lenta puo' arrivare lo stesso, e ripeterla farebbe doppioni.
export function fetchWithTimeout(ms, baseFetch = (...args) => fetch(...args)) {
  return (url, options = {}) => {
    const method = String(options.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      return baseFetch(url, options);
    }
    const timeout = AbortSignal.timeout(ms);
    return baseFetch(url, { ...options, signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout });
  };
}

// Categoria scritta con un'emoji ("🍎 Frutta"): l'emoji va nell'icona, il resto e' il nome
// Si divide per caratteri visibili (Intl.Segmenter): un'emoji puo' essere fatta di piu' codici
// ("❄️" = ❄ + U+FE0F, "👍🏽", "🧑‍🍳") e va presa intera, se no il resto finisce nel nome.
export function extractEmojiAndName(input) {
  const characters = [...new Intl.Segmenter("it", { granularity: "grapheme" }).segment(String(input || ""))].map((part) => part.segment);
  const iconIndex = characters.findIndex((character) => /\p{Extended_Pictographic}/u.test(character));
  if (iconIndex === -1) {
    return { name: characters.join("").trim(), icon: null };
  }
  const name = characters.filter((_, index) => index !== iconIndex).join("").replace(/\s+/g, " ").trim();
  return { name, icon: characters[iconIndex] };
}

// Selezionati raggruppati per categoria (titolo con l'icona), in ordine alfabetico del nome
export function groupByCategory(items) {
  const grouped = new Map();
  items.forEach((item) => {
    const cat = item.row.categoria_display || "Altro";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat).push(item);
  });
  // Per nome, non per titolo: il titolo comincia con l'emoji e l'ordine sarebbe quello dei codici
  const name = (cat) => grouped.get(cat)[0].row.categoria || "";
  return [...grouped.keys()]
    .sort((a, b) => (a === "Altro") - (b === "Altro") || name(a).localeCompare(name(b), "it"))
    .map((cat) => [cat, grouped.get(cat)]);
}

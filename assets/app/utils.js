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

export function formatPriceForTable(priceText) {
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

  return `
    <div class="price-table-cell">
      <span class="price-value">${formattedValue}</span>
      <span class="price-unit">${escapeHtml(unitPart)}</span>
    </div>
  `.trim();
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

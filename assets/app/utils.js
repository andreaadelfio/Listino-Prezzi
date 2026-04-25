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
  return SORTABLE_COLUMN_KEYS.includes(normalizedValue) ? normalizedValue : "prodotto";
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

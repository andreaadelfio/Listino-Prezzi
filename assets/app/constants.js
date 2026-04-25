export const APP_VERSION = "20260421-1";
export const TABLE_COLUMN_COUNT = 6;
export const FEEDBACK_DISMISS_MS = 7000;
export const QUANTITY_UPDATE_DEBOUNCE_MS = 650;
export const FILTER_INPUT_DEBOUNCE_MS = 250;
export const OWNER_CACHE_KEY = "listino-owner-cache";
export const CHECKED_PRODUCTS_CACHE_KEY = "listino-checked-products-cache";
export const SORTABLE_COLUMN_KEYS = Object.freeze(["prodotto", "rivenditore", "categoria", "prezzo"]);
export const SESSION_URL_PARAM_KEYS = Object.freeze({
  owner: "o",
  sortKey: "sk",
  sortDirection: "sd"
});
export const ALPHABET_INDEX_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

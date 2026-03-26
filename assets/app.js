const APP_VERSION = "20260326-5";
const TABLE_COLUMN_COUNT = 6;
const FEEDBACK_DISMISS_MS = 5000;
const QUANTITY_UPDATE_DEBOUNCE_MS = 650;
const OWNER_CACHE_KEY = "listino-owner-cache";
const CHECKED_PRODUCTS_CACHE_KEY = "listino-checked-products-cache";
const SORTABLE_COLUMN_KEYS = Object.freeze(["prodotto", "rivenditore", "categoria", "prezzo"]);
const SESSION_URL_PARAM_KEYS = Object.freeze({
  owner: "o",
  search: "q",
  retailerFilter: "rf",
  categoryFilter: "cf",
  advancedFilters: "af",
  sortKey: "sk",
  sortDirection: "sd"
});
const ALPHABET_INDEX_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const state = {
  ownerOptions: [],
  currentOwner: "",
  ownerDropdownOpen: false,
  ownerSearchTerm: "",
  rivenditores: [],
  rows: [],
  filteredProducts: [],
  selectedRivenditoreByProduct: {},
  checkedProducts: {},
  editingRowId: null,
  formRivenditoreId: "",
  rivenditoreDropdownOpen: false,
  rivenditoreSearchTerm: "",
  formCategoryValue: "",
  categoryDropdownOpen: false,
  categorySearchTerm: "",
  advancedFiltersOpen: false,
  urlSyncPaused: false,
  selectAllWasIndeterminate: false,
  sortKey: "prodotto",
  sortDirection: "asc",
  crossedOutProducts: {}
};

let feedbackHideTimeoutId = null;
let feedbackAnimationFrameId = null;
let alphabetHighlightTimeoutId = null;
let loadingRequestCount = 0;
const quantityUpdateTimeoutIds = new Map();

const elements = {
  loadingOverlay: document.querySelector("#loading-overlay"),
  loadingOverlayLabel: document.querySelector("#loading-overlay-label"),
  scrollToTopButton: document.querySelector("#scroll-to-top-button"),
  ownerDropdown: document.querySelector("#owner-dropdown"),
  ownerDropdownButton: document.querySelector("#owner-dropdown-button"),
  ownerDropdownLabel: document.querySelector("#owner-dropdown-label"),
  ownerDropdownPanel: document.querySelector("#owner-dropdown-panel"),
  ownerDropdownSearch: document.querySelector("#owner-dropdown-search"),
  ownerDropdownOptions: document.querySelector("#owner-dropdown-options"),
  ownerStatus: document.querySelector("#owner-status"),
  refreshButton: document.querySelector("#refresh-button"),
  priceForm: document.querySelector("#price-form"),
  priceSubmitButton: document.querySelector("#price-submit-button"),
  priceCancelButton: document.querySelector("#price-cancel-button"),
  advancedToggleButton: document.querySelector("#advanced-toggle-button"),
  advancedFilters: document.querySelector("#advanced-filters"),
  alphabetIndexWrap: document.querySelector(".alphabet-index-wrap"),
  alphabetIndex: document.querySelector("#alphabet-index"),
  tableWrap: document.querySelector(".table-wrap"),
  tableHead: document.querySelector("thead"),
  rivenditoreFilter: document.querySelector("#rivenditore-filter"),
  categoryFilter: document.querySelector("#category-filter"),
  searchInput: document.querySelector("#search-input"),
  searchResetButton: document.querySelector("#search-reset-button"),
  rivenditoreHiddenInput: document.querySelector("#rivenditore-hidden-input"),
  rivenditoreDropdown: document.querySelector("#rivenditore-dropdown"),
  rivenditoreDropdownButton: document.querySelector("#rivenditore-dropdown-button"),
  rivenditoreDropdownLabel: document.querySelector("#rivenditore-dropdown-label"),
  rivenditoreDropdownPanel: document.querySelector("#rivenditore-dropdown-panel"),
  rivenditoreDropdownSearch: document.querySelector("#rivenditore-dropdown-search"),
  rivenditoreDropdownOptions: document.querySelector("#rivenditore-dropdown-options"),
  categoryHiddenInput: document.querySelector("#category-hidden-input"),
  categoryDropdown: document.querySelector("#category-dropdown"),
  categoryDropdownButton: document.querySelector("#category-dropdown-button"),
  categoryDropdownLabel: document.querySelector("#category-dropdown-label"),
  categoryDropdownPanel: document.querySelector("#category-dropdown-panel"),
  categoryDropdownSearch: document.querySelector("#category-dropdown-search"),
  categoryDropdownOptions: document.querySelector("#category-dropdown-options"),
  entryRow: document.querySelector("#entry-row"),
  rowsBody: document.querySelector("#rows-body"),
  tableCounter: document.querySelector("#table-counter"),
  feedback: document.querySelector("#feedback"),
  selectedRowsBox: document.querySelector("#selected-rows-box"),
  selectedRowsCount: document.querySelector("#selected-rows-count"),
  selectedRowsList: document.querySelector("#selected-rows-list"),
  selectedRowsCopyButton: document.querySelector("#selected-rows-copy-button"),
  selectedRowsClearButton: document.querySelector("#selected-rows-clear-button"),
  selectAllCheckbox: document.querySelector("#select-all-checkbox"),
  selectedRowsToggleSize: document.querySelector("#selected-rows-toggle-size"),
  sortButtons: [...document.querySelectorAll(".sort-button")],
  sortHeaders: [...document.querySelectorAll("th[data-sort-column]")]
};

if (elements.rowsBody) {
  elements.rowsBody.innerHTML = `<tr><td colspan="${TABLE_COLUMN_COUNT}">Inizializzazione frontend...</td></tr>`;
}

function showLoadingOverlay(message = "Caricamento...") {
  loadingRequestCount += 1;
  if (elements.loadingOverlayLabel) {
    elements.loadingOverlayLabel.textContent = message;
  }
  elements.loadingOverlay?.classList.remove("hidden");
  elements.loadingOverlay?.setAttribute("aria-hidden", "false");
  document.body.classList.add("loading-active");
}

function hideLoadingOverlay() {
  loadingRequestCount = Math.max(loadingRequestCount - 1, 0);
  if (loadingRequestCount > 0) {
    return;
  }

  elements.loadingOverlay?.classList.add("hidden");
  elements.loadingOverlay?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("loading-active");
}

function showFatal(message) {
  if (elements.rowsBody) {
    elements.rowsBody.innerHTML = `<tr><td colspan="${TABLE_COLUMN_COUNT}">${message}</td></tr>`;
  }
  if (elements.tableCounter) {
    elements.tableCounter.textContent = "errore";
  }
  showFeedback(message, "error");
}

function updateScrollToTopButtonVisibility() {
  if (!elements.scrollToTopButton) {
    return;
  }

  const scrollTop = elements.tableWrap?.scrollTop ?? window.scrollY;
  const shouldShow = scrollTop > 280;
  elements.scrollToTopButton.classList.toggle("hidden", !shouldShow);
}

function showTableMessage(message) {
  if (elements.rowsBody) {
    elements.rowsBody.innerHTML = `<tr><td colspan="${TABLE_COLUMN_COUNT}">${message}</td></tr>`;
  }
}

function stopFeedbackTimer() {
  if (feedbackHideTimeoutId !== null) {
    window.clearTimeout(feedbackHideTimeoutId);
    feedbackHideTimeoutId = null;
  }
  if (feedbackAnimationFrameId !== null) {
    window.cancelAnimationFrame(feedbackAnimationFrameId);
    feedbackAnimationFrameId = null;
  }
}

function updateFeedbackTimer(startTime, durationMs) {
  if (!elements.feedback) {
    return;
  }
  const timerElement = elements.feedback.querySelector(".feedback-timer");
  if (!timerElement) {
    return;
  }

  const elapsed = performance.now() - startTime;
  const progress = Math.min(elapsed / durationMs, 1);
  timerElement.style.setProperty("--feedback-progress", `${progress * 100}%`);

  if (progress < 1 && !elements.feedback.classList.contains("hidden")) {
    feedbackAnimationFrameId = window.requestAnimationFrame(() => updateFeedbackTimer(startTime, durationMs));
  }
}

function startFeedbackTimer(durationMs = FEEDBACK_DISMISS_MS) {
  stopFeedbackTimer();
  const startTime = performance.now();
  updateFeedbackTimer(startTime, durationMs);
  feedbackHideTimeoutId = window.setTimeout(() => {
    clearFeedback();
  }, durationMs);
}

function showFeedback(message, type = "success") {
  if (!elements.feedback) {
    return;
  }
  stopFeedbackTimer();
  const timerMarkup = type === "success"
    ? `<span class="feedback-timer" aria-hidden="true"></span>`
    : "";
  elements.feedback.innerHTML = `
    <span class="feedback-content">
      <span class="feedback-message">${escapeHtml(message)}</span>
      ${timerMarkup}
    </span>
  `;
  elements.feedback.className = `feedback feedback-inline feedback-${type}`;

  if (type === "success") {
    startFeedbackTimer();
  }
}

function clearFeedback() {
  if (!elements.feedback) {
    return;
  }
  stopFeedbackTimer();
  elements.feedback.textContent = "";
  elements.feedback.className = "feedback feedback-inline hidden";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parsePriceText(priceText) {
  const normalizedValue = String(priceText || "").trim();
  const match = normalizedValue.match(/(-?\d+(?:[.,]\d+)?)\s*EUR?(?:\s*\/\s*([a-zA-Z]+))?/i)
    || normalizedValue.match(/(-?\d+(?:[.,]\d+)?)\s*€(?:\s*\/\s*([a-zA-Z]+))?/i);

  if (!match) {
    return { value: null, unit: null };
  }

  return {
    value: Number(match[1].replace(",", ".")),
    unit: match[2] || null
  };
}

function normalizeQuantity(value, fallback = 1) {
  const parsedValue = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }
  return parsedValue;
}

function getSortablePriceValue(row) {
  if (!row) {
    return Number.POSITIVE_INFINITY;
  }

  const parsedPrice = parsePriceText(row.prezzo);
  return Number.isFinite(parsedPrice.value) ? parsedPrice.value : Number.POSITIVE_INFINITY;
}

function compareRowsByBestPrice(rowA, rowB) {
  const priceA = getSortablePriceValue(rowA);
  const priceB = getSortablePriceValue(rowB);
  if (priceA !== priceB) {
    return priceA - priceB;
  }

  const nameA = String(rowA?.rivenditore_name || "");
  const nameB = String(rowB?.rivenditore_name || "");
  return nameA.localeCompare(nameB, "it");
}

function getRowQuantityValue(row) {
  return normalizeQuantity(row?.quantity, 1);
}

function normalizeOwnerValue(value) {
  return String(value || "").trim();
}

function normalizeAlphabetSource(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeOwnerKey(value) {
  return normalizeOwnerValue(value).toLowerCase();
}

function normalizeSortKey(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return SORTABLE_COLUMN_KEYS.includes(normalizedValue) ? normalizedValue : "prodotto";
}

function normalizeSortDirection(value) {
  return String(value || "").trim().toLowerCase() === "desc" ? "desc" : "asc";
}

function getProductAlphabetLetter(value) {
  const normalized = normalizeAlphabetSource(value);
  const firstCharacter = normalized.charAt(0).toUpperCase();
  return /^[A-Z]$/.test(firstCharacter) ? firstCharacter : "#";
}

function getCachedOwner() {
  try {
    return normalizeOwnerValue(window.localStorage.getItem(OWNER_CACHE_KEY));
  } catch {
    return "";
  }
}

function cacheOwner(owner) {
  try {
    if (!owner) {
      window.localStorage.removeItem(OWNER_CACHE_KEY);
      return;
    }
    window.localStorage.setItem(OWNER_CACHE_KEY, owner);
  } catch {
    // Ignora eventuali limiti del browser sullo storage.
  }
}

function getCheckedProductsCacheMap() {
  try {
    const rawValue = window.localStorage.getItem(CHECKED_PRODUCTS_CACHE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
      return {};
    }

    return parsedValue;
  } catch {
    return {};
  }
}


async function withUrlSyncPaused(callback) {
  const previousValue = state.urlSyncPaused;
  state.urlSyncPaused = true;
  try {
    return await callback();
  } finally {
    state.urlSyncPaused = previousValue;
  }
}

function encodeSelectedRowsForUrl(selectedItems = getSelectedProductSummaries()) {
  return selectedItems
    .map(({ row }) => String(row?.id || "").trim())
    .filter((rowId) => /^\d+$/.test(rowId))
    .map((rowId) => Number.parseInt(rowId, 10).toString(36))
    .join(".");
}

function decodeSelectedRowsFromUrl(rawValue) {
  return [...new Set(
    String(rawValue || "")
      .split(".")
      .map((token) => token.trim().toLowerCase())
      .filter((token) => /^[0-9a-z]+$/.test(token))
      .map((token) => Number.parseInt(token, 36))
      .filter((rowId) => Number.isInteger(rowId) && rowId >= 0)
      .map((rowId) => String(rowId))
  )];
}

function readSessionStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    owner: normalizeOwnerValue(params.get(SESSION_URL_PARAM_KEYS.owner)),
    search: String(params.get(SESSION_URL_PARAM_KEYS.search) || "").trim(),
    retailerFilterId: String(params.get(SESSION_URL_PARAM_KEYS.retailerFilter) || "").trim(),
    category: String(params.get(SESSION_URL_PARAM_KEYS.categoryFilter) || "").trim(),
    advancedFiltersOpen: params.get(SESSION_URL_PARAM_KEYS.advancedFilters) === "1",
    sortKey: normalizeSortKey(params.get(SESSION_URL_PARAM_KEYS.sortKey)),
    sortDirection: normalizeSortDirection(params.get(SESSION_URL_PARAM_KEYS.sortDirection))
  };
}

function buildSessionStateForUrl() {
  return {
    owner: normalizeOwnerValue(state.currentOwner),
    search: String(elements.searchInput?.value || "").trim(),
    retailerFilterId: String(elements.rivenditoreFilter?.value || "").trim(),
    category: String(elements.categoryFilter?.value || "").trim(),
    advancedFiltersOpen: Boolean(state.advancedFiltersOpen),
    selectedRows: encodeSelectedRowsForUrl(),
    sortKey: normalizeSortKey(state.sortKey),
    sortDirection: normalizeSortDirection(state.sortDirection)
  };
}

function syncUrlState() {
  if (state.urlSyncPaused) {
    return;
  }

  const url = new URL(window.location.href);
  const sessionState = buildSessionStateForUrl();
  Object.values(SESSION_URL_PARAM_KEYS).forEach((paramKey) => {
    url.searchParams.delete(paramKey);
  });

  if (sessionState.owner) {
    url.searchParams.set(SESSION_URL_PARAM_KEYS.owner, sessionState.owner);
  }
  if (sessionState.search) {
    url.searchParams.set(SESSION_URL_PARAM_KEYS.search, sessionState.search);
  }
  if (sessionState.retailerFilterId) {
    url.searchParams.set(SESSION_URL_PARAM_KEYS.retailerFilter, sessionState.retailerFilterId);
  }
  if (sessionState.category) {
    url.searchParams.set(SESSION_URL_PARAM_KEYS.categoryFilter, sessionState.category);
  }
  if (sessionState.advancedFiltersOpen) {
    url.searchParams.set(SESSION_URL_PARAM_KEYS.advancedFilters, "1");
  }
  if (sessionState.sortKey !== "prodotto" || sessionState.sortDirection !== "asc") {
    url.searchParams.set(SESSION_URL_PARAM_KEYS.sortKey, sessionState.sortKey);
    url.searchParams.set(SESSION_URL_PARAM_KEYS.sortDirection, sessionState.sortDirection);
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState({ listinoSession: sessionState }, "", nextUrl);
  }
}

function applySessionStateFromUrl(sessionState) {
  state.selectedRivenditoreByProduct = {};

  if (elements.searchInput) {
    elements.searchInput.value = sessionState.search || "";
  }

  setSelectValue(elements.rivenditoreFilter, sessionState.retailerFilterId || "");
  setSelectValue(elements.categoryFilter, sessionState.category || "");

  state.advancedFiltersOpen = Boolean(sessionState.advancedFiltersOpen);
  state.sortKey = normalizeSortKey(sessionState.sortKey);
  state.sortDirection = normalizeSortDirection(sessionState.sortDirection);
  renderAdvancedFilters();

  const rowsById = new Map(state.rows.map((row) => [String(row.id), row]));
  (sessionState.selectedRowIds || []).forEach((rowId) => {
    const row = rowsById.get(String(rowId));
    if (!row) {
      return;
    }

    state.selectedRivenditoreByProduct[row.prodotto] = String(row.retailer_id);
  });

  applyFilters({ syncUrl: false });
}

function createSupabaseClient() {
  if (!window.APP_CONFIG) {
    throw new Error("Configurazione APP_CONFIG non trovata.");
  }
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("Client Supabase non caricato. Controlla la connessione o il CDN.");
  }

  const { supabaseUrl, supabaseKey } = window.APP_CONFIG;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL o chiave mancante in assets/config.js.");
  }

  return window.supabase.createClient(supabaseUrl, supabaseKey);
}

let supabaseClient;

function setSelectValue(selectElement, value) {
  if (!selectElement) return;
  const desiredValue = String(value ?? "");
  const hasOption = [...selectElement.options].some((option) => option.value === desiredValue);
  selectElement.value = hasOption ? desiredValue : "";
}

function findCanonicalOwner(owner) {
  const ownerKey = normalizeOwnerKey(owner);
  return state.ownerOptions.find((option) => normalizeOwnerKey(option) === ownerKey) || "";
}

function ensureOwnerOption(owner) {
  const normalizedOwner = normalizeOwnerValue(owner);
  if (!normalizedOwner) {
    return "";
  }

  const existingOwner = findCanonicalOwner(normalizedOwner);
  if (existingOwner) {
    return existingOwner;
  }

  state.ownerOptions = [...state.ownerOptions, normalizedOwner]
    .sort((a, b) => a.localeCompare(b, "it"));
  return normalizedOwner;
}

function normalizeRivenditoreName(value) {
  return String(value || "").trim().toLowerCase();
}

function findRowById(rowId) {
  return state.rows.find((row) => String(row.id) === String(rowId)) || null;
}

function findGroupByProduct(product) {
  return state.filteredProducts.find((group) => group.product === product) || null;
}

function findRivenditoreByName(name) {
  const normalizedName = normalizeRivenditoreName(name);
  return state.rivenditores.find((rivenditore) => normalizeRivenditoreName(rivenditore.name) === normalizedName) || null;
}

function compareTextValues(valueA, valueB) {
  return String(valueA || "").localeCompare(String(valueB || ""), "it", { sensitivity: "base" });
}

function compareProductGroups(groupA, groupB) {
  let comparison = 0;

  switch (state.sortKey) {
    case "rivenditore":
      comparison = compareTextValues(groupA.selectedRow?.rivenditore_name, groupB.selectedRow?.rivenditore_name);
      break;
    case "categoria":
      comparison = compareTextValues(groupA.selectedRow?.categoria, groupB.selectedRow?.categoria);
      break;
    case "prezzo": {
      const priceA = getSortablePriceValue(groupA.selectedRow);
      const priceB = getSortablePriceValue(groupB.selectedRow);
      const hasPriceA = Number.isFinite(priceA);
      const hasPriceB = Number.isFinite(priceB);

      if (hasPriceA !== hasPriceB) {
        comparison = hasPriceA ? -1 : 1;
      } else if (hasPriceA && priceA !== priceB) {
        comparison = priceA - priceB;
      } else {
        comparison = compareTextValues(groupA.selectedRow?.prezzo, groupB.selectedRow?.prezzo);
      }
      break;
    }
    case "prodotto":
    default:
      comparison = compareTextValues(groupA.product, groupB.product);
      break;
  }

  if (comparison === 0) {
    comparison = compareTextValues(groupA.product, groupB.product);
  }

  return state.sortDirection === "desc" ? comparison * -1 : comparison;
}

function sortProductGroups(productGroups) {
  return [...productGroups].sort(compareProductGroups);
}

function renderSortButtons() {
  if (!elements.sortButtons.length) {
    return;
  }

  elements.sortButtons.forEach((button) => {
    const sortKey = normalizeSortKey(button.dataset.sortKey);
    const isActive = state.sortKey === sortKey;
    const indicator = button.querySelector(".sort-indicator");
    const header = elements.sortHeaders.find((element) => element.dataset.sortColumn === sortKey);

    button.classList.toggle("sort-button-active", isActive);
    button.dataset.sortDirection = isActive ? state.sortDirection : "none";
    button.setAttribute("aria-pressed", String(isActive));

    if (indicator) {
      indicator.textContent = isActive
        ? (state.sortDirection === "asc" ? "↑" : "↓")
        : "↕";
    }

    if (header) {
      header.setAttribute("aria-sort", isActive
        ? (state.sortDirection === "asc" ? "ascending" : "descending")
        : "none");
    }
  });
}

async function findRivenditoreByOwnerAndName(owner, name) {
  const { data, error } = await supabaseClient
    .from("retailers")
    .select("id, name, owner")
    .eq("owner", owner)
    .eq("name", name)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

function buildCategoryList() {
  return [...new Set(
    state.rows
      .map((row) => row.categoria)
      .filter(Boolean)
      .map((value) => String(value).trim())
  )].sort((a, b) => a.localeCompare(b, "it"));
}

function syncCheckedProducts() {
  const availableProducts = new Set(state.rows.map((row) => row.prodotto).filter(Boolean));
  state.checkedProducts = Object.fromEntries(
    Object.entries(state.checkedProducts).filter(([product, checked]) => checked && availableProducts.has(product))
  );
}

function setOwnerStatus(message, type = "neutral") {
  if (!elements.ownerStatus) {
    return;
  }
  const normalizedMessage = String(message || "").trim();
  if (!normalizedMessage) {
    elements.ownerStatus.textContent = "";
    elements.ownerStatus.className = "field-help owner-inline-status hidden";
    return;
  }

  elements.ownerStatus.textContent = normalizedMessage;
  elements.ownerStatus.className = `field-help owner-inline-status owner-status-${type}`;
}

function renderOwnerSelect() {
  if (!elements.ownerDropdownLabel || !elements.ownerDropdownSearch || !elements.ownerDropdownOptions) {
    return;
  }

  const searchTerm = state.ownerSearchTerm.toLowerCase();
  const filteredOwners = state.ownerOptions.filter((owner) => owner.toLowerCase().includes(searchTerm));
  const exactOwner = findCanonicalOwner(state.ownerSearchTerm);

  elements.ownerDropdownSearch.value = state.ownerSearchTerm;

  if (state.currentOwner) {
    elements.ownerDropdownLabel.textContent = state.currentOwner;
  } else if (state.ownerSearchTerm && !exactOwner && !filteredOwners.length) {
    elements.ownerDropdownLabel.textContent = `Nuovo owner: ${state.ownerSearchTerm}`;
  } else {
    elements.ownerDropdownLabel.textContent = "Seleziona o crea owner";
  }

  const options = filteredOwners.map((owner) => {
    const isActive = normalizeOwnerKey(owner) === normalizeOwnerKey(state.currentOwner);
    return `
      <button
        type="button"
        class="custom-dropdown-option ${isActive ? "custom-dropdown-option-active" : ""}"
        data-owner-value="${escapeHtml(owner)}"
        role="option"
        aria-selected="${isActive ? "true" : "false"}"
      >
        ${escapeHtml(owner)}
      </button>
    `;
  });

  if (state.ownerSearchTerm && !exactOwner) {
    options.unshift(`
      <button
        type="button"
        class="custom-dropdown-option"
        data-owner-value="${escapeHtml(state.ownerSearchTerm)}"
        data-owner-new="true"
        role="option"
        aria-selected="false"
      >
        Usa nuovo owner: ${escapeHtml(state.ownerSearchTerm)}
      </button>
    `);
  }

  elements.ownerDropdownOptions.innerHTML = options.length
    ? options.join("")
    : `<div class="custom-dropdown-empty">Nessun owner presente. Digita un nome per crearne uno.</div>`;
}

function closeOwnerDropdown() {
  state.ownerDropdownOpen = false;
  elements.ownerDropdownButton?.setAttribute("aria-expanded", "false");
  elements.ownerDropdownPanel?.classList.add("hidden");
}

function openOwnerDropdown() {
  closeRivenditoreDropdown();
  closeCategoryDropdown();
  state.ownerDropdownOpen = true;
  elements.ownerDropdownButton?.setAttribute("aria-expanded", "true");
  elements.ownerDropdownPanel?.classList.remove("hidden");
  elements.ownerDropdownSearch?.focus();
}

function renderAdvancedFilters() {
  if (!elements.advancedFilters || !elements.advancedToggleButton) {
    return;
  }

  elements.advancedFilters.classList.toggle("hidden", !state.advancedFiltersOpen);
  elements.advancedToggleButton.setAttribute("aria-expanded", String(state.advancedFiltersOpen));
  elements.advancedToggleButton.classList.toggle("advanced-toggle-button-active", state.advancedFiltersOpen);
}

function renderAlphabetIndex() {
  if (!elements.alphabetIndex) {
    return;
  }

  const availableLetters = new Set(
    state.filteredProducts
      .map((group) => getProductAlphabetLetter(group.product))
      .filter((letter) => letter !== "#")
  );

  elements.alphabetIndex.innerHTML = ALPHABET_INDEX_LETTERS.map((letter) => {
    const isAvailable = availableLetters.has(letter);
    return `
      <button
        type="button"
        class="alphabet-index-button ${isAvailable ? "" : "alphabet-index-button-disabled"}"
        data-letter="${letter}"
        ${isAvailable ? "" : "disabled"}
        aria-label="Vai ai prodotti che iniziano con ${letter}"
        title="${isAvailable ? `Vai alla ${letter}` : `Nessun prodotto con ${letter}`}"
      >
        ${letter}
      </button>
    `;
  }).join("");

  updateStickyAlphabetMetrics();
}

function updateStickyAlphabetMetrics() {
  const stickyTop = 6;
  const tableHeadHeight = elements.tableHead?.getBoundingClientRect().height || 0;
  const entryRowHeight = elements.entryRow?.getBoundingClientRect().height || 0;

  document.documentElement.style.setProperty("--alphabet-sticky-top", `${stickyTop}px`);
  document.documentElement.style.setProperty("--entry-row-sticky-top", `${tableHeadHeight}px`);
  document.documentElement.style.setProperty("--alphabet-scroll-offset", `${tableHeadHeight + entryRowHeight + 8}px`);
}

function highlightAlphabetTarget(row) {
  if (!(row instanceof HTMLElement)) {
    return;
  }

  if (alphabetHighlightTimeoutId !== null) {
    window.clearTimeout(alphabetHighlightTimeoutId);
    alphabetHighlightTimeoutId = null;
  }

  elements.rowsBody?.querySelectorAll(".alphabet-jump-target").forEach((element) => {
    element.classList.remove("alphabet-jump-target");
  });

  row.classList.add("alphabet-jump-target");
  alphabetHighlightTimeoutId = window.setTimeout(() => {
    row.classList.remove("alphabet-jump-target");
    alphabetHighlightTimeoutId = null;
  }, 1800);
}

function scrollToAlphabetLetter(letter) {
  const targetLetter = String(letter || "").toUpperCase();
  if (!targetLetter) {
    return;
  }

  const targetRow = [...(elements.rowsBody?.querySelectorAll("tr[data-alpha-letter]") || [])]
    .find((row) => row.getAttribute("data-alpha-letter") === targetLetter);

  if (!targetRow) {
    return;
  }

  highlightAlphabetTarget(targetRow);
  const scrollContainer = elements.tableWrap;
  if (!scrollContainer) {
    return;
  }

  const headerOffset = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--alphabet-scroll-offset")
  ) || 0;
  const containerRect = scrollContainer.getBoundingClientRect();
  const targetRect = targetRow.getBoundingClientRect();
  const targetTop = targetRect.top - containerRect.top + scrollContainer.scrollTop - headerOffset;

  scrollContainer.scrollTo({
    top: Math.max(targetTop, 0),
    behavior: "smooth"
  });
}

function handleScrollToTop() {
  const scrollContainer = elements.tableWrap;
  if (!scrollContainer) {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
    return;
  }

  scrollContainer.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function rememberSelectAllToggleIntent(event) {
  if (event instanceof KeyboardEvent && ![" ", "Enter", "Spacebar"].includes(event.key)) {
    return;
  }
  state.selectAllWasIndeterminate = Boolean(elements.selectAllCheckbox?.indeterminate);
}

async function handleSelectAllChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const visibleProducts = state.filteredProducts.map((group) => group.product).filter(Boolean);
  if (!visibleProducts.length) {
    state.selectAllWasIndeterminate = false;
    updateSelectAllCheckboxState();
    return;
  }
  
  if (state.selectAllWasIndeterminate) {
    visibleProducts.forEach((product) => {
      delete state.checkedProducts[product];
    });
    target.checked = false;
  } else if (target.checked) {
    visibleProducts.forEach((product) => {
      state.checkedProducts[product] = true;
    });
  } else {
    visibleProducts.forEach((product) => {
      delete state.checkedProducts[product];
    });
  }
  
  await supabaseClient
    .from("listino_prezzi_raw")
    .update({ selected: event.target.checked })
    .eq("owner", state.currentOwner);

  state.selectAllWasIndeterminate = false;
  renderRows();
  syncUrlState();
}

function clearCurrentOwner() {
  state.currentOwner = "";
  state.ownerSearchTerm = "";
  cacheOwner("");
  state.rivenditores = [];
  state.rows = [];
  state.filteredProducts = [];
  state.selectedRivenditoreByProduct = {};
  state.checkedProducts = {};
  state.crossedOutProducts = {};
  setPriceFormMode("create");
  renderRivenditoreControls();
  renderCategoryOptions();
  renderOwnerSelect();
  renderAlphabetIndex();
  renderSelectedRowsBox();
  updateSelectAllCheckboxState();
  showTableMessage("Seleziona un owner per caricare il listino.");
  if (elements.tableCounter) {
    elements.tableCounter.textContent = "owner richiesto";
  }
  setOwnerStatus("Seleziona un owner per caricare il listino.");
  syncUrlState();
}

function setPriceFormMode(mode, row = null) {
  if (mode === "edit" && row) {
    state.editingRowId = row.id;
    elements.priceSubmitButton.textContent = "Aggiorna";
    elements.priceCancelButton.classList.remove("hidden");
    elements.entryRow?.classList.add("entry-row-editing");

    elements.priceForm.elements.prodotto.value = row.prodotto || "";
    elements.priceForm.elements.prezzo.value = row.prezzo || "";
    state.rivenditoreSearchTerm = "";
    state.categorySearchTerm = "";
    setFormRivenditoreSelection(row.retailer_id);
    setFormCategorySelection(row.categoria || "");
    closeRivenditoreDropdown();
    closeCategoryDropdown();
    return;
  }

  state.editingRowId = null;
  elements.priceForm.reset();
  elements.priceSubmitButton.textContent = "Salva";
  elements.priceCancelButton.classList.add("hidden");
  state.rivenditoreSearchTerm = "";
  state.categorySearchTerm = "";
  elements.entryRow?.classList.remove("entry-row-editing");
  setFormRivenditoreSelection("");
  setFormCategorySelection("");
  closeRivenditoreDropdown();
  closeCategoryDropdown();
}

function closeRivenditoreDropdown() {
  state.rivenditoreDropdownOpen = false;
  elements.rivenditoreDropdownButton.setAttribute("aria-expanded", "false");
  elements.rivenditoreDropdownPanel.classList.add("hidden");
}

function openRivenditoreDropdown() {
  closeOwnerDropdown();
  closeCategoryDropdown();
  state.rivenditoreDropdownOpen = true;
  elements.rivenditoreDropdownButton.setAttribute("aria-expanded", "true");
  elements.rivenditoreDropdownPanel.classList.remove("hidden");
  elements.rivenditoreDropdownSearch.focus();
}

function updateRivenditoreDropdownLabel() {
  if (!state.formRivenditoreId) {
    if (state.rivenditoreSearchTerm) {
      const hasMatches = state.rivenditores.some((item) => item.name.toLowerCase().includes(state.rivenditoreSearchTerm.toLowerCase()));
      if (!hasMatches) {
        elements.rivenditoreDropdownLabel.textContent = `Nuovo rivenditore: ${state.rivenditoreSearchTerm}`;
        return;
      }
    }
    elements.rivenditoreDropdownLabel.textContent = "Rivenditore";
    return;
  }

  const rivenditore = state.rivenditores.find((item) => String(item.id) === String(state.formRivenditoreId));
  elements.rivenditoreDropdownLabel.textContent = rivenditore?.name || "Rivenditore";
}

function renderRivenditoreList() {
  const searchTerm = state.rivenditoreSearchTerm.toLowerCase();
  elements.rivenditoreDropdownSearch.value = state.rivenditoreSearchTerm;
  const filteredRivenditores = state.rivenditores.filter((rivenditore) => rivenditore.name.toLowerCase().includes(searchTerm));

  if (!filteredRivenditores.length) {
    if (state.rivenditoreSearchTerm) {
      elements.rivenditoreDropdownOptions.innerHTML = `
        <div class="custom-dropdown-empty">
          Nessun rivenditore trovato. Al salvataggio verra creato "${escapeHtml(state.rivenditoreSearchTerm)}".
        </div>
      `;
    } else {
      elements.rivenditoreDropdownOptions.innerHTML = `<div class="custom-dropdown-empty">Nessun rivenditore trovato.</div>`;
    }
    updateRivenditoreDropdownLabel();
    elements.rivenditoreHiddenInput.value = state.formRivenditoreId;
    return;
  }

  elements.rivenditoreDropdownOptions.innerHTML = filteredRivenditores.map((rivenditore) => {
    const isSelected = String(rivenditore.id) === String(state.formRivenditoreId);
    return `
      <button
        type="button"
        class="custom-dropdown-option ${isSelected ? "custom-dropdown-option-active" : ""}"
        data-rivenditore-id="${rivenditore.id}"
        role="option"
        aria-selected="${isSelected ? "true" : "false"}"
      >
        ${escapeHtml(rivenditore.name)}
      </button>
    `;
  }).join("");

  updateRivenditoreDropdownLabel();
  elements.rivenditoreHiddenInput.value = state.formRivenditoreId;
}

function setFormRivenditoreSelection(rivenditoreId) {
  const normalizedId = rivenditoreId ? String(rivenditoreId) : "";
  const exists = state.rivenditores.some((rivenditore) => String(rivenditore.id) === normalizedId);
  state.formRivenditoreId = exists ? normalizedId : "";
  elements.rivenditoreHiddenInput.value = state.formRivenditoreId;
  renderRivenditoreList();
}

function renderRivenditoreControls() {
  const currentRivenditoreFilter = elements.rivenditoreFilter.value;
  if (state.formRivenditoreId && !state.rivenditores.some((rivenditore) => String(rivenditore.id) === String(state.formRivenditoreId))) {
    state.formRivenditoreId = "";
  }
  const options = state.rivenditores
    .map((rivenditore) => `<option value="${rivenditore.id}">${escapeHtml(rivenditore.name)}</option>`)
    .join("");

  elements.rivenditoreFilter.innerHTML = `<option value="">Tutti</option>${options}`;
  setSelectValue(elements.rivenditoreFilter, currentRivenditoreFilter);
  renderRivenditoreList();
}

function closeCategoryDropdown() {
  state.categoryDropdownOpen = false;
  elements.categoryDropdownButton.setAttribute("aria-expanded", "false");
  elements.categoryDropdownPanel.classList.add("hidden");
}

function openCategoryDropdown() {
  closeOwnerDropdown();
  closeRivenditoreDropdown();
  state.categoryDropdownOpen = true;
  elements.categoryDropdownButton.setAttribute("aria-expanded", "true");
  elements.categoryDropdownPanel.classList.remove("hidden");
  elements.categoryDropdownSearch.focus();
}

function updateCategoryDropdownLabel() {
  if (!state.formCategoryValue) {
    if (state.categorySearchTerm) {
      const hasMatches = buildCategoryList().some((item) => item.toLowerCase().includes(state.categorySearchTerm.toLowerCase()));
      if (!hasMatches) {
        elements.categoryDropdownLabel.textContent = `Nuova categoria: ${state.categorySearchTerm}`;
        return;
      }
    }
    elements.categoryDropdownLabel.textContent = "Categoria";
    return;
  }

  elements.categoryDropdownLabel.textContent = state.formCategoryValue;
}

function renderCategoryList() {
  const searchTerm = state.categorySearchTerm.toLowerCase();
  const categories = buildCategoryList();
  elements.categoryDropdownSearch.value = state.categorySearchTerm;
  const filteredCategories = categories.filter((category) => category.toLowerCase().includes(searchTerm));

  if (!filteredCategories.length) {
    if (state.categorySearchTerm) {
      elements.categoryDropdownOptions.innerHTML = `
        <div class="custom-dropdown-empty">
          Nessuna categoria trovata. Al salvataggio verra usata "${escapeHtml(state.categorySearchTerm)}".
        </div>
      `;
    } else {
      elements.categoryDropdownOptions.innerHTML = `<div class="custom-dropdown-empty">Nessuna categoria trovata.</div>`;
    }
    updateCategoryDropdownLabel();
    elements.categoryHiddenInput.value = state.formCategoryValue;
    return;
  }

  elements.categoryDropdownOptions.innerHTML = filteredCategories.map((category) => {
    const isSelected = category === state.formCategoryValue;
    return `
      <button
        type="button"
        class="custom-dropdown-option ${isSelected ? "custom-dropdown-option-active" : ""}"
        data-category-value="${escapeHtml(category)}"
        role="option"
        aria-selected="${isSelected ? "true" : "false"}"
      >
        ${escapeHtml(category)}
      </button>
    `;
  }).join("");

  updateCategoryDropdownLabel();
  elements.categoryHiddenInput.value = state.formCategoryValue;
}

function setFormCategorySelection(categoryValue) {
  const normalizedValue = String(categoryValue || "").trim();
  state.formCategoryValue = normalizedValue;
  elements.categoryHiddenInput.value = normalizedValue;
  renderCategoryList();
}

function renderCategoryOptions() {
  const currentCategoryFilter = elements.categoryFilter.value;
  const categories = buildCategoryList();
  const extraCategories = [currentCategoryFilter, state.formCategoryValue]
    .filter((value) => value && !categories.includes(value))
    .sort((a, b) => a.localeCompare(b, "it"));
  const finalCategories = [...categories, ...extraCategories];

  elements.categoryFilter.innerHTML = [
    `<option value="">Tutte</option>`,
    ...finalCategories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
  ].join("");

  setSelectValue(elements.categoryFilter, currentCategoryFilter);
  renderCategoryList();
}

function buildProductGroups() {
  const productMap = new Map();

  state.rows.forEach((row) => {
    const productKey = row.prodotto;
    if (!productMap.has(productKey)) {
      productMap.set(productKey, {
        product: productKey,
        rows: []
      });
    }
    productMap.get(productKey).rows.push(row);
  });

  return [...productMap.values()]
    .map((group) => {
      const uniqueRivenditoreRows = new Map();
      group.rows.forEach((row) => {
        const rivenditoreKey = String(row.retailer_id ?? row.rivenditore_name ?? "");
        const existingRow = uniqueRivenditoreRows.get(rivenditoreKey);
        if (!existingRow) {
          uniqueRivenditoreRows.set(rivenditoreKey, row);
          return;
        }

        const existingDate = new Date(existingRow.created_at || 0).getTime();
        const currentDate = new Date(row.created_at || 0).getTime();
        if (currentDate >= existingDate) {
          uniqueRivenditoreRows.set(rivenditoreKey, row);
        }
      });

      const rows = [...uniqueRivenditoreRows.values()].sort(compareRowsByBestPrice);

      const savedRivenditoreId = state.selectedRivenditoreByProduct[group.product];
      const selectedRow = rows.find((row) => String(row.retailer_id) === String(savedRivenditoreId))
        || rows[0];

      return {
        product: group.product,
        rows,
        selectedRivenditoreId: String(selectedRow.retailer_id),
        selectedRow
      };
    })
    .sort((a, b) => a.product.localeCompare(b.product, "it"));
}

function getSelectedProductSummaries() {
  const productGroups = buildProductGroups();
  const groupMap = new Map(productGroups.map((group) => [group.product, group]));

  return Object.keys(state.checkedProducts)
    .filter((product) => state.checkedProducts[product])
    .sort((a, b) => a.localeCompare(b, "it"))
    .map((product) => {
      const group = groupMap.get(product);
      if (!group || !group.selectedRow) {
        return null;
      }

      return {
        product,
        row: group.selectedRow
      };
    })
    .filter(Boolean);
}

function buildSelectedRowsClipboardText(selectedItems = getSelectedProductSummaries()) {
  return selectedItems
    .map(({ product, row }) => `${getRowQuantityValue(row)}x ${product} | ${row.rivenditore_name || "-"} | ${row.prezzo || "-"}`)
    .join("\n");
}

function updateLocalQuantityForProduct(product, quantity) {
  const normalizedQuantity = normalizeQuantity(quantity, 1);

  state.rows = state.rows.map((row) => (
    row.prodotto === product
      ? { ...row, quantity: normalizedQuantity }
      : row
  ));

  state.filteredProducts = state.filteredProducts.map((group) => {
    if (group.product !== product) {
      return group;
    }

    const updatedRows = group.rows.map((row) => ({ ...row, quantity: normalizedQuantity }));
    const selectedRow = updatedRows.find(
      (row) => String(row.retailer_id) === String(group.selectedRivenditoreId)
    ) || updatedRows[0];

    return {
      ...group,
      rows: updatedRows,
      selectedRow
    };
  });
}

function scheduleQuantityUpdate(product, quantity) {
  const normalizedQuantity = normalizeQuantity(quantity, 1);

  if (quantityUpdateTimeoutIds.has(product)) {
    window.clearTimeout(quantityUpdateTimeoutIds.get(product));
  }

  const timeoutId = window.setTimeout(async () => {
    quantityUpdateTimeoutIds.delete(product);

    if (!state.currentOwner) {
      return;
    }

    try {
      await persistQuantityForProduct(product, normalizedQuantity);
    } catch (error) {
      showFeedback(`Aggiornamento quantita fallito: ${error.message}`, "error");
    }
  }, QUANTITY_UPDATE_DEBOUNCE_MS);

  quantityUpdateTimeoutIds.set(product, timeoutId);
}

async function persistQuantityForProduct(product, quantity) {
  const normalizedQuantity = normalizeQuantity(quantity, 1);
  const { error } = await supabaseClient
    .from("listino_prezzi_raw")
    .update({ quantity: normalizedQuantity })
    .eq("owner", state.currentOwner)
    .eq("prodotto", product);

  if (error) {
    throw error;
  }
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const tempTextArea = document.createElement("textarea");
  tempTextArea.value = text;
  tempTextArea.setAttribute("readonly", "");
  tempTextArea.style.position = "fixed";
  tempTextArea.style.opacity = "0";
  document.body.appendChild(tempTextArea);
  tempTextArea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("Il browser non ha completato la copia.");
    }
  } finally {
    document.body.removeChild(tempTextArea);
  }
}

function renderSelectedRowsBox() {
  if (!elements.selectedRowsBox || !elements.selectedRowsCount || !elements.selectedRowsList || !elements.selectedRowsCopyButton || !elements.selectedRowsClearButton) {
    return;
  }

  const selectedItems = getSelectedProductSummaries();
  if (!selectedItems.length) {
    elements.selectedRowsBox.classList.add("hidden");
    elements.selectedRowsCount.textContent = "0 selezionati";
    elements.selectedRowsList.innerHTML = ""; // Cambiato da textContent
    elements.selectedRowsCopyButton.disabled = true;
    elements.selectedRowsClearButton.disabled = true;
    elements.selectedRowsClearButton.classList.add("hidden");
    return;
  }

  elements.selectedRowsCount.textContent = `${selectedItems.length} selezionat${selectedItems.length === 1 ? "o" : "i"}`;
  
  elements.selectedRowsList.innerHTML = selectedItems.map(({ product, row }) => {
    const isCrossed = state.crossedOutProducts[product] ? "crossed-out" : "";
    const text = `${escapeHtml(getRowQuantityValue(row))}x ${escapeHtml(product)} | ${escapeHtml(row.rivenditore_name || "-")} | ${escapeHtml(row.prezzo || "-")}`;
    
    return `<div class="selected-row-item ${isCrossed}" data-crossed-product="${escapeHtml(product)}">${text}</div>`;
  }).join("");

  const crossedProducts = selectedItems.filter(({ product }) => Boolean(state.crossedOutProducts[product]));
  elements.selectedRowsCopyButton.disabled = false;
  elements.selectedRowsClearButton.disabled = crossedProducts.length === 0;
  elements.selectedRowsClearButton.classList.toggle("hidden", crossedProducts.length === 0);
  elements.selectedRowsBox.classList.remove("hidden");
}

function handleSelectedRowClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const item = target.closest(".selected-row-item");
  if (!item) return;

  const product = item.dataset.crossedProduct;
  if (!product) return;

  if (state.crossedOutProducts[product]) {
    delete state.crossedOutProducts[product];
  } else {
    state.crossedOutProducts[product] = true;
  }

  renderSelectedRowsBox();
}

async function handleSelectedRowsCopy() {
  const selectedItems = getSelectedProductSummaries();
  if (!selectedItems.length) {
    return;
  }

  try {
    await copyTextToClipboard(buildSelectedRowsClipboardText(selectedItems));
    showFeedback("Selezionati copiati.");
  } catch (error) {
    showFeedback(`Copia fallita: ${error.message}`, "error");
  }
}

async function handleSelectedRowsClear() {
  const selectedItems = getSelectedProductSummaries();
  if (!selectedItems.length) {
    return;
  }

  const crossedProducts = [...new Set(
    selectedItems
      .filter(({ product }) => Boolean(state.crossedOutProducts[product]))
      .map(({ product }) => String(product || "").trim())
      .filter(Boolean)
  )];

  if (!crossedProducts.length) {
    return;
  }

  try {
    crossedProducts.forEach((product) => {
      if (quantityUpdateTimeoutIds.has(product)) {
        window.clearTimeout(quantityUpdateTimeoutIds.get(product));
        quantityUpdateTimeoutIds.delete(product);
      }
    });

    if (state.currentOwner) {
      const { error } = await supabaseClient
        .from("listino_prezzi_raw")
        .update({ selected: false, quantity: normalizeQuantity(1) })
        .eq("owner", state.currentOwner)
        .in("prodotto", crossedProducts);

      if (error) {
        throw error;
      }
    }

    crossedProducts.forEach((product) => {
      delete state.checkedProducts[product];
      delete state.crossedOutProducts[product];
    });

    state.rows = state.rows.map((row) => (
      crossedProducts.includes(row.prodotto)
        ? { ...row, selected: false , quantity: normalizeQuantity(1) }
        : row
    ));

    applyFilters({ syncUrl: false });
    syncUrlState();
    showFeedback("Selezionati barrati rimossi e quantita riportata a 1.");
  } catch (error) {
    showFeedback(`Rimozione selezionati barrati fallita: ${error.message}`, "error");
  }
}

function updateSelectAllCheckboxState() {
  if (!elements.selectAllCheckbox) {
    return;
  }

  const visibleProducts = state.filteredProducts.map((group) => group.product).filter(Boolean);
  if (!visibleProducts.length) {
    elements.selectAllCheckbox.checked = false;
    elements.selectAllCheckbox.indeterminate = false;
    elements.selectAllCheckbox.disabled = true;
    return;
  }

  const checkedCount = visibleProducts.filter((product) => Boolean(state.checkedProducts[product])).length;
  elements.selectAllCheckbox.disabled = false;
  elements.selectAllCheckbox.checked = checkedCount === visibleProducts.length;
  elements.selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < visibleProducts.length;
}

function applyFilters(options = {}) {
  const { syncUrl = true } = options;
  const search = elements.searchInput.value.trim().toLowerCase();
  const rivenditoreId = elements.rivenditoreFilter.value;
  const category = elements.categoryFilter.value;

  const groupedProducts = buildProductGroups();
  const filteredGroups = groupedProducts.filter((group) => {
    const haystack = group.rows
      .flatMap((row) => [
        row.prodotto,
        String(getRowQuantityValue(row)),
        row.prezzo,
        row.categoria,
        row.rivenditore_name,
        `${row.prodotto}-${row.rivenditore_name || ""}`
      ])
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (search && !haystack.includes(search)) return false;
    if (rivenditoreId && !group.rows.some((row) => String(row.retailer_id) === rivenditoreId)) return false;
    if (category && !group.rows.some((row) => row.categoria === category)) return false;
    return true;
  });
  state.filteredProducts = sortProductGroups(filteredGroups);

  renderRows();
  if (syncUrl) {
    syncUrlState();
  }
}

function renderRows() {
  renderSortButtons();

  if (!state.filteredProducts.length) {
    elements.rowsBody.innerHTML = `<tr><td colspan="${TABLE_COLUMN_COUNT}">Nessuna riga trovata.</td></tr>`;
    elements.tableCounter.textContent = "0 prodotti";
    renderAlphabetIndex();
    renderSelectedRowsBox();
    updateSelectAllCheckboxState();
    return;
  }

  let previousLetter = "";
  const showAlphabetDividers = state.sortKey === "prodotto";
  const rowsMarkup = state.filteredProducts.map((group) => {
    const row = group.selectedRow;
    const isChecked = Boolean(state.checkedProducts[group.product]);
    const alphaLetter = getProductAlphabetLetter(group.product);
    const quantity = getRowQuantityValue(row);
    const rivenditoreOptions = group.rows.map((optionRow) => `
      <option value="${optionRow.retailer_id}" ${String(optionRow.retailer_id) === group.selectedRivenditoreId ? "selected" : ""}>
        ${escapeHtml(optionRow.rivenditore_name)}
      </option>
    `).join("");

    const dividerMarkup = showAlphabetDividers && alphaLetter !== previousLetter
      ? `
        <tr class="alphabet-divider-row" data-alpha-letter="${alphaLetter}">
          <td colspan="${TABLE_COLUMN_COUNT}">${escapeHtml(alphaLetter === "#" ? "Altro" : alphaLetter)}</td>
        </tr>
      `
      : "";

    previousLetter = alphaLetter;

    return `
      ${dividerMarkup}
      <tr data-alpha-letter="${alphaLetter}">
        <td class="selection-cell" data-label="Seleziona">
          <input
            type="checkbox"
            class="row-selection-checkbox"
            data-product="${escapeHtml(group.product)}"
            aria-label="Seleziona ${escapeHtml(group.product)}"
            ${isChecked ? "checked" : ""}
          >
        </td>
        <td data-label="Prodotto">
          <div class="product-cell">
            <div class="quantity-control">
              <input
                type="number"
                class="quantity-input row-quantity-input"
                data-product="${escapeHtml(group.product)}"
                min="1"
                step="1"
                inputmode="numeric"
                value="${quantity}"
                aria-label="Quantita per ${escapeHtml(group.product)}"
              >
              <div class="quantity-stepper" aria-hidden="true">
                <button
                  type="button"
                  class="quantity-step-button"
                  data-action="quantity-step"
                  data-product="${escapeHtml(group.product)}"
                  data-step="1"
                  tabindex="-1"
                  aria-label="Aumenta quantita di ${escapeHtml(group.product)}"
                  title="Aumenta quantita"
                >
                  ▲
                </button>
                <button
                  type="button"
                  class="quantity-step-button"
                  data-action="quantity-step"
                  data-product="${escapeHtml(group.product)}"
                  data-step="-1"
                  tabindex="-1"
                  aria-label="Diminuisci quantita di ${escapeHtml(group.product)}"
                  title="Diminuisci quantita"
                >
                  ▼
                </button>
              </div>
            </div>
            <span class="product-name">${escapeHtml(group.product)}</span>
          </div>
        </td>
        <td data-label="Rivenditore">
          <select class="row-rivenditore-select" data-product="${escapeHtml(group.product)}">
            ${rivenditoreOptions}
          </select>
        </td>
        <td data-label="Categoria">${escapeHtml(row.categoria || "-")}</td>
        <td data-label="Prezzo">${escapeHtml(row.prezzo)}</td>
        <td data-label="Azioni">
          <div class="row-actions">
            <button
              type="button"
              class="icon-button"
              data-action="edit-row"
              data-row-id="${row.id}"
              aria-label="Modifica ${escapeHtml(group.product)} presso ${escapeHtml(row.rivenditore_name)}"
              title="Modifica"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 17.25V20h2.75L17.8 8.94l-2.75-2.75L4 17.25zm14.71-9.04a1.003 1.003 0 0 0 0-1.42l-1.5-1.5a1.003 1.003 0 0 0-1.42 0l-1.17 1.17 2.75 2.75 1.34-1z"/>
              </svg>
            </button>
            <button
              type="button"
              class="icon-button icon-button-danger"
              data-action="delete-row"
              data-row-id="${row.id}"
              aria-label="Cancella ${escapeHtml(group.product)} presso ${escapeHtml(row.rivenditore_name)}"
              title="Cancella"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 7h12l-1 13H7L6 7zm3-3h6l1 2h4v2H4V6h4l1-2z"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  elements.rowsBody.innerHTML = rowsMarkup;

  elements.tableCounter.textContent = `${state.filteredProducts.length} prodotti`;
  renderAlphabetIndex();
  renderSelectedRowsBox();
  updateSelectAllCheckboxState();
}

async function loadOwnerOptions() {
  const [rivenditoresResponse, rowsResponse] = await Promise.all([
    supabaseClient
      .from("retailers")
      .select("owner")
      .not("owner", "is", null)
      .limit(1000),
    supabaseClient
      .from("listino_prezzi_raw")
      .select("owner")
      .not("owner", "is", null)
      .limit(1000)
  ]);

  if (rivenditoresResponse.error) {
    throw rivenditoresResponse.error;
  }
  if (rowsResponse.error) {
    throw rowsResponse.error;
  }

  const ownerMap = new Map();
  [...(rivenditoresResponse.data || []), ...(rowsResponse.data || [])]
    .map((row) => normalizeOwnerValue(row.owner))
    .filter(Boolean)
    .forEach((owner) => {
      const key = normalizeOwnerKey(owner);
      if (!ownerMap.has(key)) {
        ownerMap.set(key, owner);
      }
    });

  state.ownerOptions = [...ownerMap.values()].sort((a, b) => a.localeCompare(b, "it"));
  renderOwnerSelect();
}

async function loadRivenditores() {
  if (!state.currentOwner) {
    state.rivenditores = [];
    renderRivenditoreControls();
    return;
  }

  const { data, error } = await supabaseClient
    .from("retailers")
    .select("id, name, owner")
    .eq("owner", state.currentOwner)
    .order("name", { ascending: true });

  if (error) throw error;
  state.rivenditores = data || [];
  renderRivenditoreControls();
}

async function loadRows() {
  if (!state.currentOwner) {
    state.rows = [];
    renderCategoryOptions();
    applyFilters();
    return;
  }

  const { data, error } = await supabaseClient
    .from("listino_prezzi_raw")
    .select(`
      id,
      selected,
      quantity,
      prodotto,
      retailer_id,
      categoria,
      prezzo,
      created_at,
      owner
    `)
    .eq("owner", state.currentOwner)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;

  const rivenditoreMap = new Map(state.rivenditores.map((rivenditore) => [String(rivenditore.id), rivenditore.name]));
  state.rows = (data || []).map((row) => ({
    ...row,
    quantity: normalizeQuantity(row.quantity, 1),
    rivenditore_name: rivenditoreMap.get(String(row.retailer_id)) || "-"
  }));

  state.checkedProducts = {};
  state.rows.forEach(row => {
    if (row.selected) {
      state.checkedProducts[row.prodotto] = true;
    }
  });


  if (state.editingRowId && !findRowById(state.editingRowId)) {
    setPriceFormMode("create");
  }

  renderCategoryOptions();
  applyFilters();
}

async function refreshData() {
  if (!state.currentOwner) {
    showTableMessage("Seleziona un owner per caricare il listino.");
    if (elements.tableCounter) {
      elements.tableCounter.textContent = "owner richiesto";
    }
    return;
  }

  clearFeedback();
  showLoadingOverlay("Caricamento dati...");
  try {
    await loadRivenditores();
    await loadRows();
  } catch (error) {
    showTableMessage(`Errore nel caricamento dati: ${error.message}`);
    showFeedback(`Errore nel caricamento dati: ${error.message}`, "error");
  } finally {
    hideLoadingOverlay();
  }
}

function handleSelectedRowsToggleSize() {
  const box = elements.selectedRowsBox;
  if (!box) return;

  box.classList.toggle("reduced");

  elements.selectedRowsToggleSize.textContent =
    box.classList.contains("reduced") ? "↑" : "↓";
}

async function resolveRivenditoreForSubmit() {
  if (!state.currentOwner) {
    throw new Error("Seleziona prima un owner.");
  }

  const newRivenditoreName = String(state.rivenditoreSearchTerm || "").trim();
  if (newRivenditoreName) {
    const existingRivenditore = findRivenditoreByName(newRivenditoreName);
    if (existingRivenditore) {
      state.rivenditoreSearchTerm = "";
      setFormRivenditoreSelection(existingRivenditore.id);
      return {
        rivenditoreId: Number(existingRivenditore.id),
        rivenditoreName: existingRivenditore.name,
        created: false
      };
    }

    const hasPartialRivenditores = state.rivenditores.some((rivenditore) => rivenditore.name.toLowerCase().includes(newRivenditoreName.toLowerCase()));
    if (hasPartialRivenditores) {
      throw new Error("Seleziona un rivenditore dalla lista oppure continua a digitare fino a non trovare risultati.");
    }

    const { data, error } = await supabaseClient
      .from("retailers")
      .insert([{ name: newRivenditoreName, owner: state.currentOwner }])
      .select("id, name")
      .single();

    if (error) {
      if (error.code === "23505") {
        const existingRivenditore = await findRivenditoreByOwnerAndName(state.currentOwner, newRivenditoreName);
        if (existingRivenditore) {
          await loadRivenditores();
          state.rivenditoreSearchTerm = "";
          setFormRivenditoreSelection(existingRivenditore.id);
          return {
            rivenditoreId: Number(existingRivenditore.id),
            rivenditoreName: existingRivenditore.name,
            created: false
          };
        }

        throw new Error(
          "Creazione rivenditore fallita: il database ha ancora un vincolo globale su name. Esegui supabase/owner_unique_migration.sql."
        );
      }

      throw new Error(`Creazione rivenditore fallita: ${error.message}`);
    }

    await loadRivenditores();
    state.rivenditoreSearchTerm = "";
    setFormRivenditoreSelection(data.id);
    return {
      rivenditoreId: Number(data.id),
      rivenditoreName: data.name,
      created: true
    };
  }

  const selectedRivenditoreId = Number(state.formRivenditoreId || elements.rivenditoreHiddenInput.value);
  if (!selectedRivenditoreId) {
    return {
      rivenditoreId: null,
      rivenditoreName: null,
      created: false
    };
  }

  const rivenditore = state.rivenditores.find((item) => String(item.id) === String(selectedRivenditoreId));
  return {
    rivenditoreId: selectedRivenditoreId,
    rivenditoreName: rivenditore?.name || null,
    created: false
  };
}

function resolveCategoryForSubmit() {
  const searchValue = String(state.categorySearchTerm || "").trim();
  if (searchValue) {
    const categories = buildCategoryList();
    const exactCategory = categories.find((category) => category.toLowerCase() === searchValue.toLowerCase());
    if (exactCategory) {
      state.categorySearchTerm = "";
      setFormCategorySelection(exactCategory);
      return exactCategory;
    }

    const hasPartialCategories = categories.some((category) => category.toLowerCase().includes(searchValue.toLowerCase()));
    if (hasPartialCategories) {
      throw new Error("Seleziona una categoria dalla lista oppure continua a digitare fino a non trovare risultati.");
    }

    return searchValue || null;
  }

  return String(state.formCategoryValue || elements.categoryHiddenInput.value || "").trim() || null;
}

async function applyOwnerSelection(owner, options = {}) {
  const normalizedOwner = normalizeOwnerValue(owner);
  if (!normalizedOwner) {
    setOwnerStatus("Seleziona o crea un owner valido.", "error");
    return;
  }

  const { syncUrl = true } = options;

  const canonicalOwner = ensureOwnerOption(normalizedOwner);
  state.currentOwner = canonicalOwner;
  state.ownerSearchTerm = "";
  cacheOwner(canonicalOwner);
  state.selectedRivenditoreByProduct = {};
  setPriceFormMode("create");
  renderOwnerSelect();
  renderSelectedRowsBox();
  setOwnerStatus("");
  closeOwnerDropdown();
  if (syncUrl) {
    await refreshData();
    syncUrlState();
    return;
  }

  await withUrlSyncPaused(async () => {
    await refreshData();
  });
}

async function handlePriceSubmit(event) {
  event.preventDefault();
  clearFeedback();

  if (!state.currentOwner) {
    showFeedback("Seleziona prima un owner.", "error");
    setOwnerStatus("Seleziona prima un owner.", "error");
    openOwnerDropdown();
    return;
  }

  showLoadingOverlay(state.editingRowId ? "Aggiornamento riga..." : "Salvataggio riga...");
  try {
    const formData = new FormData(event.currentTarget);
    const prodotto = String(formData.get("prodotto") || "").trim();
    const prezzo = String(formData.get("prezzo") || "").trim();
    let rivenditoreInfo;
    let categoria;

    try {
      rivenditoreInfo = await resolveRivenditoreForSubmit();
      categoria = resolveCategoryForSubmit();
    } catch (error) {
      showFeedback(error.message, "error");
      return;
    }

    const rivenditoreId = rivenditoreInfo.rivenditoreId;

    if (!prodotto || !rivenditoreId || !prezzo) {
      showFeedback("Compila prodotto, rivenditore e prezzo.", "error");
      return;
    }

    const parsedPrice = parsePriceText(prezzo);
    const payload = {
      owner: state.currentOwner,
      prodotto,
      retailer_id: rivenditoreId,
      categoria,
      prezzo,
      prezzo_valore: parsedPrice.value,
      prezzo_unita: parsedPrice.unit
    };

    if (state.editingRowId) {
      const editingRowId = state.editingRowId;
      const previousRow = findRowById(editingRowId);
      const { error } = await supabaseClient
        .from("listino_prezzi_raw")
        .update(payload)
        .eq("id", editingRowId)
        .eq("owner", state.currentOwner);

      if (error) {
        showFeedback(`Aggiornamento riga fallito: ${error.message}`, "error");
        return;
      }

      if (previousRow && previousRow.prodotto !== prodotto) {
        delete state.selectedRivenditoreByProduct[previousRow.prodotto];
        if (state.checkedProducts[previousRow.prodotto]) {
          delete state.checkedProducts[previousRow.prodotto];
          state.checkedProducts[prodotto] = true;
        }
      }

      state.selectedRivenditoreByProduct[prodotto] = String(rivenditoreId);
      setPriceFormMode("create");
      await refreshData();
      showFeedback(rivenditoreInfo.created
        ? `Rivenditore "${rivenditoreInfo.rivenditoreName}" creato e riga listino aggiornata.`
        : "Riga listino aggiornata con successo.");
      return;
    }

    const { error } = await supabaseClient
      .from("listino_prezzi_raw")
      .insert([payload]);

    if (error) {
      showFeedback(`Salvataggio riga fallito: ${error.message}`, "error");
      return;
    }

    state.selectedRivenditoreByProduct[prodotto] = String(rivenditoreId);
    setPriceFormMode("create");
    await loadRows();
    showFeedback(rivenditoreInfo.created
      ? `Rivenditore "${rivenditoreInfo.rivenditoreName}" creato e riga listino salvata.`
      : "Riga listino salvata con successo.");
  } finally {
    hideLoadingOverlay();
  }
}

function handleCancelEdit() {
  clearFeedback();
  setPriceFormMode("create");
}

function handleRivenditoreDropdownToggle() {
  if (state.rivenditoreDropdownOpen) {
    closeRivenditoreDropdown();
    return;
  }

  openRivenditoreDropdown();
}

function handleRivenditoreDropdownSearch(event) {
  state.rivenditoreSearchTerm = String(event.target.value || "").trim();
  if (state.rivenditoreSearchTerm) {
    state.formRivenditoreId = "";
    elements.rivenditoreHiddenInput.value = "";
  }
  renderRivenditoreList();
}

function handleRivenditoreDropdownOptionClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const button = target.closest("button[data-rivenditore-id]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const rivenditoreId = button.dataset.rivenditoreId;
  if (!rivenditoreId) {
    return;
  }

  state.rivenditoreSearchTerm = "";
  elements.rivenditoreDropdownSearch.value = "";
  setFormRivenditoreSelection(rivenditoreId);
  closeRivenditoreDropdown();
}

function handleCategoryDropdownToggle() {
  if (state.categoryDropdownOpen) {
    closeCategoryDropdown();
    return;
  }

  openCategoryDropdown();
}

function handleCategoryDropdownSearch(event) {
  state.categorySearchTerm = String(event.target.value || "").trim();
  if (state.categorySearchTerm) {
    state.formCategoryValue = "";
    elements.categoryHiddenInput.value = "";
  }
  renderCategoryList();
}

function handleCategoryDropdownOptionClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const button = target.closest("button[data-category-value]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const categoryValue = button.dataset.categoryValue || "";
  state.categorySearchTerm = "";
  elements.categoryDropdownSearch.value = "";
  setFormCategorySelection(categoryValue);
  closeCategoryDropdown();
}

function handleOwnerDropdownToggle() {
  if (state.ownerDropdownOpen) {
    closeOwnerDropdown();
    return;
  }

  openOwnerDropdown();
}

function handleOwnerDropdownSearch(event) {
  state.ownerSearchTerm = normalizeOwnerValue(event.target.value);
  renderOwnerSelect();
}

function handleOwnerDropdownSearchKeydown(event) {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  const typedOwner = normalizeOwnerValue(event.currentTarget.value);
  const filteredOwners = state.ownerOptions.filter((owner) => owner.toLowerCase().includes(typedOwner.toLowerCase()));
  const exactOwner = findCanonicalOwner(typedOwner);
  const ownerToApply = exactOwner || filteredOwners[0] || typedOwner;

  if (!ownerToApply) {
    return;
  }

  setOwnerStatus(`Caricamento dati per ${ownerToApply}...`, "neutral");
  applyOwnerSelection(ownerToApply, { silent: true }).catch((error) => {
    setOwnerStatus(`Errore nel caricamento owner: ${error.message}`, "error");
    showFeedback(`Errore nel caricamento owner: ${error.message}`, "error");
  });
}

function handleOwnerDropdownOptionClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const button = target.closest("button[data-owner-value]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const ownerValue = normalizeOwnerValue(button.dataset.ownerValue);
  if (!ownerValue) {
    return;
  }

  setOwnerStatus(`Caricamento dati per ${ownerValue}...`, "neutral");
  applyOwnerSelection(ownerValue, { silent: true }).catch((error) => {
    setOwnerStatus(`Errore nel caricamento owner: ${error.message}`, "error");
    showFeedback(`Errore nel caricamento owner: ${error.message}`, "error");
  });
}

function handleAdvancedToggle() {
  state.advancedFiltersOpen = !state.advancedFiltersOpen;
  renderAdvancedFilters();
  syncUrlState();
}

function handleAlphabetIndexClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const button = target.closest("button[data-letter]");
  if (!(button instanceof HTMLButtonElement) || button.disabled) {
    return;
  }

  scrollToAlphabetLetter(button.dataset.letter || "");
}

function handleDocumentClick(event) {
  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (elements.rivenditoreDropdown && !elements.rivenditoreDropdown.contains(target)) {
    closeRivenditoreDropdown();
  }
  if (elements.categoryDropdown && !elements.categoryDropdown.contains(target)) {
    closeCategoryDropdown();
  }
  if (elements.ownerDropdown && !elements.ownerDropdown.contains(target)) {
    closeOwnerDropdown();
  }
}

function handleDocumentKeydown(event) {
  if (event.key === "Escape") {
    closeOwnerDropdown();
    closeRivenditoreDropdown();
    closeCategoryDropdown();
  }
}

async function handleRowRivenditoreChange(event) {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.classList.contains("row-selection-checkbox")) {
    const product = target.dataset.product;
    if (!product) {
      return;
    }

    if (target.checked) {
      state.checkedProducts[product] = true;
    } else {
      delete state.checkedProducts[product];
    }

    await supabaseClient
      .from("listino_prezzi_raw")
      .update({ selected: target.checked })
      .eq("prodotto", product)
      .eq("owner", state.currentOwner);

    updateSelectAllCheckboxState();
    renderSelectedRowsBox();
    return;
  }

  if (target instanceof HTMLInputElement && target.classList.contains("row-quantity-input")) {
    const product = target.dataset.product;
    if (!product) {
      return;
    }

    const normalizedQuantity = normalizeQuantity(target.value, 1);
    target.value = String(normalizedQuantity);
    updateLocalQuantityForProduct(product, normalizedQuantity);
    renderSelectedRowsBox();
    scheduleQuantityUpdate(product, normalizedQuantity);
    return;
  }

  if (!(target instanceof HTMLSelectElement) || !target.classList.contains("row-rivenditore-select")) {
    return;
  }

  const product = target.dataset.product;
  if (!product) {
    return;
  }

  state.selectedRivenditoreByProduct[product] = target.value;
  applyFilters();
}

async function handleDeleteRow(rowId) {
  clearFeedback();

  if (!state.currentOwner) {
    showFeedback("Seleziona prima un owner.", "error");
    return;
  }

  const row = findRowById(rowId);
  if (!row) {
    showFeedback("Riga non trovata per la cancellazione.", "error");
    return;
  }

  const confirmMessage = `Vuoi cancellare "${row.prodotto}" per "${row.rivenditore_name}"?`;
  if (!window.confirm(confirmMessage)) {
    return;
  }

  showLoadingOverlay("Cancellazione riga...");
  try {
    const { error } = await supabaseClient
      .from("listino_prezzi_raw")
      .delete()
      .eq("id", rowId)
      .eq("owner", state.currentOwner);

    if (error) {
      showFeedback(`Cancellazione fallita: ${error.message}`, "error");
      return;
    }

    delete state.selectedRivenditoreByProduct[row.prodotto];
    if (String(state.editingRowId) === String(rowId)) {
      setPriceFormMode("create");
    }

    await refreshData();
    showFeedback(`Riga "${row.prodotto}" per "${row.rivenditore_name}" cancellata.`);
  } finally {
    hideLoadingOverlay();
  }
}

async function handleRowActionClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const button = target.closest("button[data-action]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  if (button.dataset.action === "quantity-step") {
    const product = String(button.dataset.product || "").trim();
    const step = Number.parseInt(String(button.dataset.step || "0"), 10);
    if (!product || !Number.isFinite(step) || step === 0) {
      return;
    }

    const group = findGroupByProduct(product);
    const nextQuantity = Math.max(1, getRowQuantityValue(group?.selectedRow) + step);
    updateLocalQuantityForProduct(product, nextQuantity);

    elements.rowsBody
      ?.querySelectorAll(".row-quantity-input")
      .forEach((inputElement) => {
        if (inputElement instanceof HTMLInputElement && inputElement.dataset.product === product) {
          inputElement.value = String(nextQuantity);
        }
      });

    renderSelectedRowsBox();
    scheduleQuantityUpdate(product, nextQuantity);
    return;
  }

  const rowId = button.dataset.rowId;
  if (!rowId) {
    return;
  }

  if (button.dataset.action === "edit-row") {
    const row = findRowById(rowId);
    if (!row) {
      showFeedback("Riga non trovata per la modifica.", "error");
      return;
    }

    setPriceFormMode("edit", row);
    (elements.entryRow || elements.priceSubmitButton)?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (button.dataset.action === "delete-row") {
    await handleDeleteRow(rowId);
  }
}

function handleSortButtonClick(event) {
  const button = event.currentTarget;
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const nextSortKey = normalizeSortKey(button.dataset.sortKey);
  if (state.sortKey === nextSortKey) {
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  } else {
    state.sortKey = nextSortKey;
    state.sortDirection = "asc";
  }

  applyFilters();
}

function handleSearchReset() {
  if (elements.searchInput) {
    elements.searchInput.value = "";
  }

  setSelectValue(elements.rivenditoreFilter, "");
  setSelectValue(elements.categoryFilter, "");
  applyFilters();
}

function handleRowsBodyInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.classList.contains("row-quantity-input")) {
    return;
  }

  const product = target.dataset.product;
  if (!product) {
    return;
  }

  const rawValue = String(target.value || "").trim();
  if (!/^\d+$/.test(rawValue)) {
    return;
  }

  const normalizedQuantity = normalizeQuantity(rawValue, 1);
  updateLocalQuantityForProduct(product, normalizedQuantity);
  renderSelectedRowsBox();
  scheduleQuantityUpdate(product, normalizedQuantity);
}

function bindEvents() {
  elements.scrollToTopButton?.addEventListener("click", handleScrollToTop);
  elements.selectedRowsList?.addEventListener("click", handleSelectedRowClick);
  elements.selectAllCheckbox?.addEventListener("pointerdown", rememberSelectAllToggleIntent);
  elements.selectAllCheckbox?.addEventListener("keydown", rememberSelectAllToggleIntent);
  elements.selectAllCheckbox?.addEventListener("change", handleSelectAllChange);
  elements.ownerDropdownButton.addEventListener("click", handleOwnerDropdownToggle);
  elements.ownerDropdownSearch.addEventListener("input", handleOwnerDropdownSearch);
  elements.ownerDropdownSearch.addEventListener("keydown", handleOwnerDropdownSearchKeydown);
  elements.ownerDropdownOptions.addEventListener("click", handleOwnerDropdownOptionClick);
  elements.priceForm.addEventListener("submit", handlePriceSubmit);
  elements.priceCancelButton.addEventListener("click", handleCancelEdit);
  elements.selectedRowsCopyButton?.addEventListener("click", handleSelectedRowsCopy);
  elements.selectedRowsClearButton?.addEventListener("click", handleSelectedRowsClear);
  elements.advancedToggleButton.addEventListener("click", handleAdvancedToggle);
  elements.alphabetIndex?.addEventListener("click", handleAlphabetIndexClick);
  elements.refreshButton.addEventListener("click", refreshData);
  elements.rivenditoreDropdownButton.addEventListener("click", handleRivenditoreDropdownToggle);
  elements.rivenditoreDropdownSearch.addEventListener("input", handleRivenditoreDropdownSearch);
  elements.rivenditoreDropdownOptions.addEventListener("click", handleRivenditoreDropdownOptionClick);
  elements.categoryDropdownButton.addEventListener("click", handleCategoryDropdownToggle);
  elements.categoryDropdownSearch.addEventListener("input", handleCategoryDropdownSearch);
  elements.categoryDropdownOptions.addEventListener("click", handleCategoryDropdownOptionClick);
  elements.rowsBody.addEventListener("input", handleRowsBodyInput);
  elements.rowsBody.addEventListener("change", handleRowRivenditoreChange);
  elements.rowsBody.addEventListener("click", handleRowActionClick);
  elements.selectedRowsToggleSize?.addEventListener("click", handleSelectedRowsToggleSize);
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);
  window.addEventListener("resize", updateStickyAlphabetMetrics);
  window.addEventListener("scroll", updateScrollToTopButtonVisibility, { passive: true });
  elements.tableWrap?.addEventListener("scroll", updateScrollToTopButtonVisibility, { passive: true });

  elements.searchInput.addEventListener("input", applyFilters);
  elements.searchResetButton?.addEventListener("click", handleSearchReset);
  elements.rivenditoreFilter.addEventListener("change", applyFilters);
  elements.categoryFilter.addEventListener("change", applyFilters);
  elements.sortButtons.forEach((button) => button.addEventListener("click", handleSortButtonClick));
}

async function bootstrap() {
  showLoadingOverlay("Avvio applicazione...");
  try {
    const sharedSession = readSessionStateFromUrl();
    supabaseClient = createSupabaseClient();
    bindEvents();
    renderAdvancedFilters();
    updateScrollToTopButtonVisibility();
    await loadOwnerOptions();

    const initialOwner = sharedSession.owner || getCachedOwner();
    if (initialOwner) {
      await applyOwnerSelection(initialOwner, { syncUrl: false });

      if (sharedSession.owner) {
        applySessionStateFromUrl(sharedSession);
      }

      syncUrlState();
      return;
    }

    clearCurrentOwner();
    setOwnerStatus(
      state.ownerOptions.length
        ? "Seleziona un owner esistente oppure digitane uno nuovo."
        : "Nessun owner presente: digita un nome per iniziare.",
      "neutral"
    );
  } catch (error) {
    showFatal(`Avvio app fallito: ${error.message}`);
    setOwnerStatus(`Avvio app fallito: ${error.message}`, "error");
  } finally {
    hideLoadingOverlay();
  }
}

bootstrap();

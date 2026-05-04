import {
  ALPHABET_INDEX_LETTERS,
  FEEDBACK_DISMISS_MS,
  FILTER_INPUT_DEBOUNCE_MS,
  OWNER_CACHE_KEY,
  QUANTITY_UPDATE_DEBOUNCE_MS,
  SESSION_URL_PARAM_KEYS,
  TABLE_COLUMN_COUNT
} from "./app/constants.js";
import { createProductGroupsSelector } from "./app/groups.js";
import { elements, state } from "./app/store.js";
import {
  compareTextValues,
  escapeHtml,
  formatPriceForTable,
  getProductAlphabetLetter,
  getRowQuantityValue,
  getSortablePriceValue,
  normalizeAlphabetSource,
  normalizeOwnerKey,
  normalizeOwnerValue,
  normalizeQuantity,
  parsePriceText,
  normalizeSortDirection,
  normalizeSortKey
} from "./app/utils.js";

const selectProductGroups = createProductGroupsSelector();

if (elements.rowsBody) {
  elements.rowsBody.innerHTML = `<tr><td colspan="${TABLE_COLUMN_COUNT}">Inizializzazione frontend...</td></tr>`;
}

function showLoadingOverlay(message = "Caricamento...") {
  state.loadingRequestCount += 1;
  if (elements.loadingOverlayLabel) {
    elements.loadingOverlayLabel.textContent = message;
  }
  elements.loadingOverlay?.classList.remove("hidden");
  elements.loadingOverlay?.setAttribute("aria-hidden", "false");
  document.body.classList.add("loading-active");
}

function hideLoadingOverlay() {
  state.loadingRequestCount = Math.max(state.loadingRequestCount - 1, 0);
  if (state.loadingRequestCount > 0) {
    return;
  }

  elements.loadingOverlay?.classList.add("hidden");
  elements.loadingOverlay?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("loading-active");
}

function showFatal(message) {
  if (elements.rowsBody) {
    const markup = `<tr><td colspan="${TABLE_COLUMN_COUNT}">${message}</td></tr>`;
    if (state.renderCache.rowsMarkup !== markup) {
      elements.rowsBody.innerHTML = markup;
      state.renderCache.rowsMarkup = markup;
    }
  }
  setTableCounterText("errore");
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
    const markup = `<tr><td colspan="${TABLE_COLUMN_COUNT}">${escapeHtml(message)}</td></tr>`;
    if (state.renderCache.rowsMarkup !== markup) {
      elements.rowsBody.innerHTML = markup;
      state.renderCache.rowsMarkup = markup;
    }
  }
}

function setTableCounterText(value) {
  const normalizedValue = String(value || "");
  if (elements.tableCounter && state.renderCache.tableCounter !== normalizedValue) {
    elements.tableCounter.textContent = normalizedValue;
    state.renderCache.tableCounter = normalizedValue;
  }
}

function stopFeedbackTimer() {
  if (state.feedbackHideTimeoutId !== null) {
    window.clearTimeout(state.feedbackHideTimeoutId);
    state.feedbackHideTimeoutId = null;
  }
  if (state.feedbackAnimationFrameId !== null) {
    window.cancelAnimationFrame(state.feedbackAnimationFrameId);
    state.feedbackAnimationFrameId = null;
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
    state.feedbackAnimationFrameId = window.requestAnimationFrame(() => updateFeedbackTimer(startTime, durationMs));
  }
}

function startFeedbackTimer(durationMs = FEEDBACK_DISMISS_MS) {
  stopFeedbackTimer();
  const startTime = performance.now();
  updateFeedbackTimer(startTime, durationMs);
  state.feedbackHideTimeoutId = window.setTimeout(() => {
    clearFeedback();
  }, durationMs);
}

function showFeedback(message, type = "success") {
  if (!elements.feedback) {
    return;
  }
  stopFeedbackTimer();
  const timerMarkup = `<span class="feedback-timer" aria-hidden="true"></span>`;
  elements.feedback.innerHTML = `
    <span class="feedback-content">
      <span class="feedback-message">${escapeHtml(message)}</span>
      ${timerMarkup}
    </span>
  `;
  elements.feedback.className = `feedback feedback-inline feedback-${type}`;

  startFeedbackTimer();
}

function showSuccessFeedbackWithProductLink(message, product) {
  if (!elements.feedback) {
    return;
  }

  const normalizedProduct = String(product || "").trim();
  if (!normalizedProduct) {
    showFeedback(message, "success");
    return;
  }

  stopFeedbackTimer();
  const timerMarkup = `<span class="feedback-timer" aria-hidden="true"></span>`;
  elements.feedback.innerHTML = `
    <span class="feedback-content">
      <span class="feedback-message">
        <button
        type="button"
        class="feedback-link-button"
        data-feedback-product="${escapeHtml(normalizedProduct)}"
        >
        ${escapeHtml(normalizedProduct)}
        </button>
        ${escapeHtml(message)}
      </span>
      ${timerMarkup}
    </span>
  `;
  elements.feedback.className = "feedback feedback-inline feedback-success";
  startFeedbackTimer();
}

function clearFeedback() {
  if (!elements.feedback) {
    return;
  }
  stopFeedbackTimer();
  elements.feedback.textContent = "";
  elements.feedback.className = "feedback feedback-inline hidden";
}

function setFormSearchValue(value) {
  const normalizedValue = String(value || "").trim();
  state.formSearchTerm = normalizedValue;
  if (elements.productInput) {
    elements.productInput.value = normalizedValue;
  }
  renderProductInlineSuggestion();
}

function highlightProductRow(row) {
  if (!(row instanceof HTMLElement)) {
    return;
  }

  elements.rowsBody?.querySelectorAll(".product-jump-target").forEach((element) => {
    element.classList.remove("product-jump-target");
  });

  row.classList.add("product-jump-target");
  window.setTimeout(() => {
    row.classList.remove("product-jump-target");
  }, 1800);
}

function findVisibleProductRow(product) {
  const normalizedProduct = String(product || "").trim();
  if (!normalizedProduct || !elements.rowsBody) {
    return null;
  }

  return [...elements.rowsBody.querySelectorAll("tr[data-product]")]
    .find((row) => row.getAttribute("data-product") === normalizedProduct) || null;
}

function revealProductInTable(product) {
  const normalizedProduct = String(product || "").trim();
  if (!normalizedProduct) {
    return;
  }

  let targetRow = findVisibleProductRow(normalizedProduct);
  if (!targetRow) {
    setFormStoreSelection("");
    setFormCategorySelection("");
    setFormSearchValue(normalizedProduct);
    applyFilters({ syncUrl: false });
    targetRow = findVisibleProductRow(normalizedProduct);
  }

  if (!targetRow) {
    showFeedback(`Prodotto "${normalizedProduct}" non trovato nella tabella.`, "error");
    return;
  }

  const scrollContainer = elements.tableWrap;
  if (scrollContainer) {
    const headerOffset = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--alphabet-scroll-offset")
    ) || 0;
    const containerRect = scrollContainer.getBoundingClientRect();
    const targetRect = targetRow.getBoundingClientRect();
    const targetTop = targetRect.top - containerRect.top + scrollContainer.scrollTop - headerOffset;
    scrollContainer.scrollTo({ top: Math.max(targetTop, 0), behavior: "smooth" });
  } else {
    targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  highlightProductRow(targetRow);
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
  state.selectedStoreByProduct = {};

  state.sortKey = normalizeSortKey(sessionState.sortKey);
  state.sortDirection = normalizeSortDirection(sessionState.sortDirection);

  const rowsById = new Map(state.rows.map((row) => [String(row.id), row]));
  (sessionState.selectedRowIds || []).forEach((rowId) => {
    const row = rowsById.get(String(rowId));
    if (!row) {
      return;
    }

    state.selectedStoreByProduct[row.prodotto] = String(row.retailer_id);
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

function normalizeStoreName(value) {
  return String(value || "").trim().toLowerCase();
}

function findRowById(rowId) {
  return state.rows.find((row) => String(row.id) === String(rowId)) || null;
}

function findGroupByProduct(product) {
  return state.filteredProducts.find((group) => group.product === product) || null;
}

function findStoreByName(name) {
  const normalizedName = normalizeStoreName(name);
  return state.Stores.find((Store) => normalizeStoreName(Store.name) === normalizedName) || null;
}

function findCategoryByName(name) {
  const normalizedName = String(name || "").trim().toLowerCase();
  return state.categories.find((category) => String(category.name || "").trim().toLowerCase() === normalizedName) || null;
}

function getDefaultStore() {
  return state.Stores.find((Store) => Store.is_default) || null;
}

function syncDefaultStoreSelection() {
  if (state.editingRowId || state.StoreSearchTerm.trim()) {
    return;
  }

  return;
}

function compareProductGroups(groupA, groupB) {
  let comparison = 0;

  switch (state.sortKey) {
    case "Store":
      comparison = compareTextValues(groupA.selectedRow?.Store_name, groupB.selectedRow?.Store_name);
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

async function findStoreByOwnerAndName(owner, name) {
  const { data, error } = await state.supabaseClient
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

async function createOrReuseStoreByName(storeName) {
  const normalizedStoreName = String(storeName || "").trim();
  if (!state.currentOwner) {
    throw new Error("Seleziona prima un owner.");
  }
  if (!normalizedStoreName) {
    throw new Error("Inserisci un nome Store valido.");
  }

  const existingStore = findStoreByName(normalizedStoreName);
  if (existingStore) {
    return {
      store: existingStore,
      created: false
    };
  }

  const { data, error } = await state.supabaseClient
    .from("retailers")
    .insert([{ name: normalizedStoreName, owner: state.currentOwner }])
    .select("id, name")
    .single();

  if (error) {
    if (error.code === "23505") {
      const duplicatedStore = await findStoreByOwnerAndName(state.currentOwner, normalizedStoreName);
      if (duplicatedStore) {
        await loadStores();
        const refreshedStore = findStoreByName(normalizedStoreName) || duplicatedStore;
        return {
          store: refreshedStore,
          created: false
        };
      }

      throw new Error(
        "Creazione Store fallita: il database ha ancora un vincolo globale su name. Esegui supabase/owner_unique_migration.sql."
      );
    }

    throw new Error(`Creazione Store fallita: ${error.message}`);
  }

  await loadStores();
  return {
    store: findStoreByName(data.name) || data,
    created: true
  };
}

function buildCategoryList() {
  if (state.cachedCategories !== null) {
    return state.cachedCategories;
  }

  state.cachedCategories = [...new Set(
    state.categories
      .map((category) => category.name)
      .filter(Boolean)
      .map((value) => String(value).trim())
  )].sort((a, b) => a.localeCompare(b, "it"));

  return state.cachedCategories;
}

function getSortedCategoryOptions() {
  return [...state.categories].sort((categoryA, categoryB) =>
    String(categoryA?.name || "").localeCompare(String(categoryB?.name || ""), "it")
  );
}

function getCategoryDisplayName(category) {
  const categoryName = String(category?.name || "").trim();
  const categoryIcon = String(category?.icon || "").trim();
  if (!categoryName) {
    return "";
  }

  return categoryIcon ? `${categoryIcon} ${categoryName}` : categoryName;
}

function normalizeAssociationProduct(value) {
  return normalizeAlphabetSource(value)
    .toLocaleLowerCase("it")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokenizeAssociationProduct(value) {
  return normalizeAssociationProduct(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function getSuggestedCategoryForProduct(productValue) {
  const normalizedInput = normalizeAssociationProduct(productValue);
  if (!normalizedInput || normalizedInput.length < 3) {
    return null;
  }

  const inputTokens = tokenizeAssociationProduct(productValue);
  if (!inputTokens.length) {
    return null;
  }

  const categoryScores = new Map();

  state.rows.forEach((row) => {
    const categoryName = String(row?.categoria || "").trim();
    const historicalProduct = String(row?.prodotto || "").trim();
    if (!categoryName || !historicalProduct) {
      return;
    }

    const normalizedHistoricalProduct = normalizeAssociationProduct(historicalProduct);
    if (!normalizedHistoricalProduct) {
      return;
    }

    let score = 0;
    if (normalizedHistoricalProduct === normalizedInput) {
      score += 120;
    } else {
      if (
        normalizedHistoricalProduct.startsWith(normalizedInput) ||
        normalizedInput.startsWith(normalizedHistoricalProduct)
      ) {
        score += 55;
      } else if (
        normalizedHistoricalProduct.includes(normalizedInput) ||
        normalizedInput.includes(normalizedHistoricalProduct)
      ) {
        score += 35;
      }

      const historicalTokens = tokenizeAssociationProduct(historicalProduct);
      const overlapCount = inputTokens.filter((token) => historicalTokens.includes(token)).length;
      if (overlapCount > 0) {
        score += overlapCount * 18;
      }
    }

    if (score <= 0) {
      return;
    }

    const currentEntry = categoryScores.get(categoryName) || {
      value: categoryName,
      score: 0,
      matches: 0
    };

    currentEntry.score += score;
    currentEntry.matches += 1;
    categoryScores.set(categoryName, currentEntry);
  });

  const rankedSuggestions = [...categoryScores.values()]
    .sort((suggestionA, suggestionB) =>
      suggestionB.score - suggestionA.score
      || suggestionB.matches - suggestionA.matches
      || suggestionA.value.localeCompare(suggestionB.value, "it")
    );

  const bestSuggestion = rankedSuggestions[0];
  const secondSuggestion = rankedSuggestions[1];
  if (!bestSuggestion || bestSuggestion.score < 35) {
    return null;
  }

  if (secondSuggestion && bestSuggestion.score - secondSuggestion.score < 12) {
    return null;
  }

  return bestSuggestion;
}

function syncSuggestedCategoryFromProduct() {
  const suggestedCategory = getSuggestedCategoryForProduct(elements.productInput?.value || "");
  state.suggestedCategoryValue = suggestedCategory?.value || "";

  const canApplySuggestion = state.categorySelectionSource !== "manual"
    && !state.editingRowId
    && !String(state.categorySearchTerm || "").trim();

  if (!canApplySuggestion) {
    renderCategoryList();
    return;
  }

  if (!suggestedCategory) {
    if (state.categorySelectionSource === "suggested") {
      setFormCategorySelection("", { source: "none", shouldApplyFilters: false });
      return;
    }

    renderCategoryList();
    return;
  }

  if (
    state.formCategoryValue === suggestedCategory.value
    && state.categorySelectionSource === "suggested"
  ) {
    renderCategoryList();
    return;
  }

  setFormCategorySelection(suggestedCategory.value, {
    source: "suggested",
    shouldApplyFilters: false
  });
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
  closeStoreDropdown();
  closeCategoryDropdown();
  state.ownerDropdownOpen = true;
  elements.ownerDropdownButton?.setAttribute("aria-expanded", "true");
  elements.ownerDropdownPanel?.classList.remove("hidden");
  elements.ownerDropdownSearch?.focus();
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

  const markup = ALPHABET_INDEX_LETTERS.map((letter) => {
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

  if (state.renderCache.alphabetMarkup !== markup) {
    elements.alphabetIndex.innerHTML = markup;
    state.renderCache.alphabetMarkup = markup;
  }

  updateStickyAlphabetMetrics();
}

function getProductSuggestionCandidate(inputValue) {
  const rawInput = String(inputValue || "");
  if (rawInput.length < 3) {
    return null;
  }
  const tokenMatch = rawInput.match(/^(.*?)([\p{L}]+)$/u);
  if (!tokenMatch) {
    return null;
  }

  const [, prefix, token] = tokenMatch;
  if (token.length < 3) {
    return null;
  }

  const normalizedNeedle = normalizeAlphabetSource(token).toLocaleLowerCase("it");
  
  const exactMatch = state.rankedWords.find((word) => word.localeCompare(token, "it", { sensitivity: "base" }) === 0);
  if (exactMatch) {
    return null;
  }
  
  const suggestionWord = state.rankedWords.find((word) =>
    normalizeAlphabetSource(word).toLocaleLowerCase("it").startsWith(normalizedNeedle)
  );

  if (!suggestionWord) {
    return null;
  }

  const suffix = suggestionWord.slice(token.length);
  if (!suffix) {
    return null;
  }

  return {
    completedValue: `${prefix}${token}${suffix}`,
    suffix
  };
}

function renderProductInlineSuggestion() {
  if (!elements.productInput || !elements.productInlineSuggestion || !elements.productInlineMeasure) {
    return;
  }

  const inputValue = String(elements.productInput.value || "");
  const suggestion = getProductSuggestionCandidate(inputValue);
  state.productInlineSuggestion = suggestion;

  if (!suggestion) {
    elements.productInlineSuggestion.textContent = "";
    elements.productInlineSuggestion.classList.add("hidden");
    if (elements.productInput.parentElement) {
      elements.productInput.parentElement.style.setProperty("--product-suggestion-offset", "0px");
    }
    return;
  }

  const { suffix } = suggestion;
  if (!suffix) {
    elements.productInlineSuggestion.textContent = "";
    elements.productInlineSuggestion.classList.add("hidden");
    return;
  }

  elements.productInlineMeasure.textContent = inputValue;
  const inputStyles = window.getComputedStyle(elements.productInput);
  elements.productInlineMeasure.style.font = inputStyles.font;
  elements.productInlineMeasure.style.fontSize = inputStyles.fontSize;
  elements.productInlineMeasure.style.fontWeight = inputStyles.fontWeight;
  elements.productInlineMeasure.style.letterSpacing = inputStyles.letterSpacing;

  const textWidth = elements.productInlineMeasure.getBoundingClientRect().width;
  elements.productInput.parentElement?.style.setProperty("--product-suggestion-offset", `${textWidth}px`);
  elements.productInlineSuggestion.textContent = suffix;
  elements.productInlineSuggestion.classList.remove("hidden");
}

function applyProductInlineSuggestion() {
  if (!elements.productInput || !state.productInlineSuggestion) {
    return;
  }

  const nextValue = state.productInlineSuggestion.completedValue;
  elements.productInput.value = nextValue;
  state.formSearchTerm = nextValue;
  state.productInlineSuggestion = null;
  renderProductInlineSuggestion();
  syncSuggestedCategoryFromProduct();
  applyFilters();
  elements.productInput.focus();
  elements.productInput.setSelectionRange(nextValue.length, nextValue.length);
}

function normalizePriceFilterText(value) {
  return String(value || "")
    .replace(/\u00A0/g, " ")
    .trim()
    .toLowerCase();
}

function matchesPriceFilter(priceText, filterText) {
  const normalizedFilter = normalizePriceFilterText(filterText);
  if (!normalizedFilter) {
    return true;
  }

  const rangeMatch = normalizedFilter.match(/^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)$/);
  if (rangeMatch) {
    const minValue = Number(rangeMatch[1].replace(",", "."));
    const maxValue = Number(rangeMatch[2].replace(",", "."));
    const parsedPrice = parsePriceText(priceText);
    if (!Number.isFinite(parsedPrice.value)) {
      return false;
    }
    return parsedPrice.value >= Math.min(minValue, maxValue) && parsedPrice.value <= Math.max(minValue, maxValue);
  }

  const comparisonMatch = normalizedFilter.match(/^(<=|>=|<|>)\s*(\d+(?:[.,]\d+)?)$/);
  if (comparisonMatch) {
    const [, operator, rawValue] = comparisonMatch;
    const targetValue = Number(rawValue.replace(",", "."));
    const parsedPrice = parsePriceText(priceText);
    if (!Number.isFinite(parsedPrice.value)) {
      return false;
    }

    switch (operator) {
      case "<":
        return parsedPrice.value < targetValue;
      case "<=":
        return parsedPrice.value <= targetValue;
      case ">":
        return parsedPrice.value > targetValue;
      case ">=":
        return parsedPrice.value >= targetValue;
      default:
        return false;
    }
  }

  return normalizePriceFilterText(priceText).includes(normalizedFilter);
}

function getPriceSuggestionCandidate(inputValue) {
  const rawInput = String(inputValue || "").trim();
  // Se l'input è puramente numerico (con . o ,), suggeriamo €/kg
  if (/^\d+([.,]\d*)?$/.test(rawInput) && rawInput.length > 0) {
    return {
      completedValue: `${rawInput}€/kg`,
      suffix: "€/kg"
    };
  }
  return null;
}

function renderPriceInlineSuggestion() {
  if (!elements.priceInput || !elements.priceInlineSuggestion || !elements.priceInlineMeasure) {
    return;
  }

  const inputValue = String(elements.priceInput.value || "");
  const suggestion = getPriceSuggestionCandidate(inputValue);
  state.priceInlineSuggestion = suggestion;

  if (!suggestion) {
    elements.priceInlineSuggestion.textContent = "";
    elements.priceInlineSuggestion.classList.add("hidden");
    if (elements.priceInput.parentElement) {
      elements.priceInput.parentElement.style.setProperty("--product-suggestion-offset", "0px");
    }
    return;
  }

  const { suffix } = suggestion;
  elements.priceInlineMeasure.textContent = inputValue;
  const inputStyles = window.getComputedStyle(elements.priceInput);
  elements.priceInlineMeasure.style.font = inputStyles.font;
  elements.priceInlineMeasure.style.fontSize = inputStyles.fontSize;
  elements.priceInlineMeasure.style.fontWeight = inputStyles.fontWeight;
  elements.priceInlineMeasure.style.letterSpacing = inputStyles.letterSpacing;

  const textWidth = elements.priceInlineMeasure.getBoundingClientRect().width;
  elements.priceInput.parentElement?.style.setProperty("--product-suggestion-offset", `${textWidth}px`);
  elements.priceInlineSuggestion.textContent = suffix;
  elements.priceInlineSuggestion.classList.remove("hidden");
}

function applyPriceInlineSuggestion() {
  if (!elements.priceInput || !state.priceInlineSuggestion) {
    return;
  }

  const nextValue = state.priceInlineSuggestion.completedValue;
  elements.priceInput.value = nextValue;
  state.priceInlineSuggestion = null;
  renderPriceInlineSuggestion();
  if (!state.editingRowId) {
    applyFilters();
  }
  elements.priceInput.focus();
  elements.priceInput.setSelectionRange(nextValue.length, nextValue.length);
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

  if (state.alphabetHighlightTimeoutId !== null) {
    window.clearTimeout(state.alphabetHighlightTimeoutId);
    state.alphabetHighlightTimeoutId = null;
  }

  elements.rowsBody?.querySelectorAll(".alphabet-jump-target").forEach((element) => {
    element.classList.remove("alphabet-jump-target");
  });

  row.classList.add("alphabet-jump-target");
  state.alphabetHighlightTimeoutId = window.setTimeout(() => {
    row.classList.remove("alphabet-jump-target");
    state.alphabetHighlightTimeoutId = null;
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
  
  let nextSelected = Boolean(target.checked);

  if (state.selectAllWasIndeterminate) {
    visibleProducts.forEach((product) => {
      delete state.checkedProducts[product];
      delete state.crossedOutProducts[product];
      updateLocalSelectionFlagsForProduct(product, { selected: false, isScratched: false });
    });
    target.checked = false;
    nextSelected = false;
  } else if (target.checked) {
    visibleProducts.forEach((product) => {
      state.checkedProducts[product] = true;
      delete state.crossedOutProducts[product];
      updateLocalSelectionFlagsForProduct(product, { selected: true, isScratched: false });
    });
  } else {
    visibleProducts.forEach((product) => {
      delete state.checkedProducts[product];
      delete state.crossedOutProducts[product];
      if (state.quantityUpdateTimeoutIds.has(product)) {
        window.clearTimeout(state.quantityUpdateTimeoutIds.get(product));
        state.quantityUpdateTimeoutIds.delete(product);
      }
      updateLocalSelectionFlagsForProduct(product, { selected: false, isScratched: false });
    });
    nextSelected = false;
  }

  try {
    const { error } = await state.supabaseClient
      .from("listino_prezzi_raw")
      .update({
        selected: nextSelected,
        is_scratched: false,
        ...(nextSelected ? {} : { quantity: normalizeQuantity(1) })
      })
      .eq("owner", state.currentOwner)
      .in("prodotto", visibleProducts);

    if (error) {
      throw error;
    }
  } catch (error) {
    showFeedback(`Aggiornamento selezione fallito: ${error.message}`, "error");
    await loadRows();
  }

  state.selectAllWasIndeterminate = false;
  renderRows();
  syncUrlState();
}

function clearCurrentOwner() {
  state.currentOwner = "";
  state.ownerSearchTerm = "";
  state.productVocabularyWords = [];
  cacheOwner("");
  state.cachedCategories = null;
  state.Stores = [];
  state.categories = [];
  state.rows = [];
  state.filteredProducts = [];
  state.selectedStoreByProduct = {};
  state.activeShoppingStoreId = null;
  state.checkedProducts = {};
  state.crossedOutProducts = {};
  setPriceFormMode("create");
  renderOwnerSelect();
  renderAlphabetIndex();
  renderSelectedRowsBox();
  updateSelectAllCheckboxState();
  showTableMessage("Seleziona un owner per caricare il listino.");
  setTableCounterText("owner richiesto");
  setOwnerStatus("Seleziona un owner per caricare il listino.");
  updateShoppingSessionUI();
  syncUrlState();
}

function setPriceFormMode(mode, row = null) {
  if (mode === "edit" && row) {
    state.editingRowId = row.id;
    state.categorySelectionSource = "manual";
    state.suggestedCategoryValue = "";
    elements.entryRow?.classList.add("entry-row-editing");

    if (elements.productInput) {
      elements.productInput.value = row.prodotto || "";
    }
    if (elements.priceInput) {
      elements.priceInput.value = row.prezzo || "";
    }
    state.StoreSearchTerm = "";
    state.categorySearchTerm = "";
    setFormStoreSelection(row.retailer_id);
    setFormCategorySelection(row.categoria || "", { source: "manual" });
    closeStoreDropdown();
    closeCategoryDropdown();
    renderProductInlineSuggestion();
    renderPriceInlineSuggestion();
    return;
  }

  state.editingRowId = null;
  elements.priceForm.reset();
  state.StoreSearchTerm = "";
  state.categorySearchTerm = "";
  state.categorySelectionSource = "none";
  state.suggestedCategoryValue = "";
  elements.entryRow?.classList.remove("entry-row-editing");
  setFormStoreSelection("");
  setFormCategorySelection("", { source: "none" });
  state.formSearchTerm = "";
  closeStoreDropdown();
  closeCategoryDropdown();
  state.productInlineSuggestion = null;
  state.priceInlineSuggestion = null;
  renderProductInlineSuggestion();
  renderPriceInlineSuggestion();
}

function closeStoreDropdown() {
  state.StoreDropdownOpen = false;
  elements.StoreDropdownButton.setAttribute("aria-expanded", "false");
  elements.StoreDropdownPanel.classList.add("hidden");
}

function openStoreDropdown() {
  closeOwnerDropdown();
  closeCategoryDropdown();
  state.StoreDropdownOpen = true;
  elements.StoreDropdownButton.setAttribute("aria-expanded", "true");
  elements.StoreDropdownPanel.classList.remove("hidden");
  elements.StoreDropdownSearch.focus();
}

function updateStoreDropdownLabel() {
  if (!state.formStoreId) {
    if (state.StoreSearchTerm) {
      const hasMatches = state.Stores.some((item) => item.name.toLowerCase().includes(state.StoreSearchTerm.toLowerCase()));
      if (!hasMatches) {
        elements.StoreDropdownLabel.textContent = `Nuovo Store: ${state.StoreSearchTerm}`;
        return;
      }
    }
    elements.StoreDropdownLabel.textContent = "Select";
    return;
  }

  const Store = state.Stores.find((item) => String(item.id) === String(state.formStoreId));
  elements.StoreDropdownLabel.textContent = Store?.name || "Select";
}

function renderStoreList() {
  const searchTerm = state.StoreSearchTerm.toLowerCase();
  elements.StoreDropdownSearch.value = state.StoreSearchTerm;
  const filteredStores = state.Stores.filter((Store) => Store.name.toLowerCase().includes(searchTerm));

  if (!filteredStores.length) {
    if (state.StoreSearchTerm) {
      elements.StoreDropdownOptions.innerHTML = `
        <div class="custom-dropdown-empty">
          Nessun Store "${escapeHtml(state.StoreSearchTerm)}", verrà creato al salvataggio.
        </div>
      `;
    } else {
      elements.StoreDropdownOptions.innerHTML = `<div class="custom-dropdown-empty">Nessun Store trovato.</div>`;
    }
    updateStoreDropdownLabel();
    elements.StoreHiddenInput.value = state.formStoreId;
    return;
  }

  elements.StoreDropdownOptions.innerHTML = filteredStores.map((Store) => {
    const isSelected = String(Store.id) === String(state.formStoreId);
    return `
      <button
        type="button"
        class="custom-dropdown-option ${isSelected ? "custom-dropdown-option-active" : ""}"
        data-store-id="${Store.id}"
        role="option"
        aria-selected="${isSelected ? "true" : "false"}"
      >
        ${escapeHtml(Store.name)}
      </button>
    `;
  }).join("");

  updateStoreDropdownLabel();
  elements.StoreHiddenInput.value = state.formStoreId;
}

function setFormStoreSelection(StoreId) {
  const normalizedId = StoreId ? String(StoreId) : "";
  const exists = state.Stores.some((Store) => String(Store.id) === normalizedId);
  state.formStoreId = exists ? normalizedId : "";
  elements.StoreHiddenInput.value = state.formStoreId;
  renderStoreList();
  applyFilters();
}

function closeCategoryDropdown() {
  state.categoryDropdownOpen = false;
  elements.categoryDropdownButton.setAttribute("aria-expanded", "false");
  elements.categoryDropdownPanel.classList.add("hidden");
}

function openCategoryDropdown() {
  closeOwnerDropdown();
  closeStoreDropdown();
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
    elements.categoryDropdownLabel.textContent = "Select";
    return;
  }

  const selectedCategory = findCategoryByName(state.formCategoryValue);
  elements.categoryDropdownLabel.textContent = selectedCategory?.icon
    ? `${selectedCategory.icon} ${state.formCategoryValue}`
    : state.formCategoryValue;
}

function renderCategoryList() {
  const searchTerm = state.categorySearchTerm.toLowerCase();
  const categories = getSortedCategoryOptions();
  elements.categoryDropdownSearch.value = state.categorySearchTerm;
  const filteredCategories = categories.filter((category) =>
    String(category?.name || "").toLowerCase().includes(searchTerm)
  );
  const suggestionValue = String(state.suggestedCategoryValue || "").trim();
  const showSuggestionHint = Boolean(
    suggestionValue
    && !searchTerm
    && state.categorySelectionSource !== "manual"
  );

  if (!filteredCategories.length) {
    if (state.categorySearchTerm) {
      elements.categoryDropdownOptions.innerHTML = `
        <div class="custom-dropdown-empty">
          Nessuna categoria "${escapeHtml(state.categorySearchTerm)}", verrà creata al salvataggio.
        </div>
      `;
    } else {
      elements.categoryDropdownOptions.innerHTML = `<div class="custom-dropdown-empty">Nessuna categoria trovata.</div>`;
    }
    updateCategoryDropdownLabel();
    elements.categoryHiddenInput.value = state.formCategoryValue;
    return;
  }

  const suggestionMarkup = showSuggestionHint
    ? `<div class="custom-dropdown-hint">Suggerita dallo storico: ${escapeHtml(suggestionValue)}</div>`
    : "";

  elements.categoryDropdownOptions.innerHTML = `${suggestionMarkup}${filteredCategories.map((category) => {
    const categoryName = String(category?.name || "").trim();
    const categoryIcon = String(category?.icon || "").trim();
    const isSelected = categoryName === state.formCategoryValue;
    const isSuggested = categoryName === suggestionValue;
    return `
      <button
        type="button"
        class="custom-dropdown-option ${isSelected ? "custom-dropdown-option-active" : ""}"
        data-category-value="${escapeHtml(categoryName)}"
        role="option"
        aria-selected="${isSelected ? "true" : "false"}"
      >
        ${categoryIcon ? `<span class="category-option-icon" aria-hidden="true">${escapeHtml(categoryIcon)}</span>` : ""}
        <span>${escapeHtml(categoryName)}</span>
        ${isSuggested ? `<span class="category-option-badge">Suggerita</span>` : ""}
      </button>
    `;
  }).join("")}`;

  updateCategoryDropdownLabel();
  elements.categoryHiddenInput.value = state.formCategoryValue;
}

function setFormCategorySelection(categoryValue, options = {}) {
  const {
    source = "manual",
    shouldApplyFilters = true
  } = options;
  const normalizedValue = String(categoryValue || "").trim();
  state.formCategoryValue = normalizedValue;
  state.categorySelectionSource = normalizedValue ? source : "none";
  elements.categoryHiddenInput.value = normalizedValue;
  renderCategoryList();
  if (shouldApplyFilters) {
    applyFilters();
  }
}

function closeRowStoreDropdown() {
  state.openRowStoreProduct = null;
  elements.rowStoreDropdownPanel?.classList.add("hidden");
}

function openRowStoreDropdown(product, anchorElement) {
  closeOwnerDropdown();
  closeStoreDropdown();
  closeCategoryDropdown();

  state.openRowStoreProduct = product;
  renderRowStoreOptions(product);
  
  const rect = anchorElement.getBoundingClientRect();
  const panel = elements.rowStoreDropdownPanel;
  
  if (panel) {
    panel.classList.remove("hidden");
    panel.style.position = "fixed";

    let top = rect.bottom + 5;
    let left = rect.left;

    // Previeni l'uscita a destra (viewport width - larghezza pannello - padding)
    if (left + panel.offsetWidth > window.innerWidth) {
      left = Math.max(10, window.innerWidth - panel.offsetWidth - 10);
    }
    // Previeni l'uscita in basso (se non c'è spazio, apri verso l'alto)
    if (top + panel.offsetHeight > window.innerHeight) {
      top = rect.top - panel.offsetHeight - 5;
    }

    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
  }
}

function renderRowStoreOptions(product) {
  const group = findGroupByProduct(product);
  if (!group || !elements.rowStoreDropdownOptions) return;

  elements.rowStoreDropdownOptions.innerHTML = group.rows.map((opt) => {
    const isSelected = String(opt.retailer_id) === group.selectedStoreId;
    return `
      <button
        type="button"
        class="custom-dropdown-option ${isSelected ? "custom-dropdown-option-active" : ""}"
        data-action="select-row-retailer"
        data-product="${escapeHtml(product)}"
        data-retailer-id="${opt.retailer_id}"
      >
        ${escapeHtml(opt.Store_name)}
      </button>
    `;
  }).join("");
}

function handleSelectRowRetailer(product, retailerId) {
  state.selectedStoreByProduct[product] = String(retailerId);
  closeRowStoreDropdown();
  applyFilters();
}

function handleRowStoreDropdownOptionClick(event) {
  const target = event.target;
  const button = target.closest('button[data-action="select-row-retailer"]');
  if (!button) return;

  const product = button.dataset.product;
  const retailerId = button.dataset.retailerId;
  if (product && retailerId) {
    handleSelectRowRetailer(product, retailerId);
  }
}

function getCurrentProductGroups() {
  return selectProductGroups(state.rows, state.selectedStoreByProduct);
}

function getSelectedProductSummaries() {
  const productGroups = getCurrentProductGroups();
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
  if (selectedItems.length > 5) {
    const grouped = new Map();
    selectedItems.forEach(item => {
      const cat = item.row.categoria_display || "Altro";
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat).push(item);
    });

    const sortedCats = [...grouped.keys()].sort((a, b) => a.localeCompare(b, "it"));
    let text = "";
    sortedCats.forEach(cat => {
      text += `${cat}\n`;
      grouped.get(cat).forEach(({ product, row }) => {
        text += `  ${getRowQuantityValue(row)}x ${product} | ${row.Store_name || "-"} | ${row.prezzo || "-"}\n`;
      });
    });
    return text.trim();
  }

  return selectedItems
    .map(({ product, row }) => `${getRowQuantityValue(row)}x ${product} | ${row.Store_name || "-"} | ${row.prezzo || "-"}`)
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
      (row) => String(row.retailer_id) === String(group.selectedStoreId)
    ) || updatedRows[0];

    return {
      ...group,
      rows: updatedRows,
      selectedRow
    };
  });
}

function updateLocalSelectionFlagsForProduct(product, { selected, isScratched }) {
  const normalizedSelected = Boolean(selected);
  const normalizedScratched = normalizedSelected && Boolean(isScratched);
  const nextQuantity = normalizedSelected ? null : normalizeQuantity(1);

  state.rows = state.rows.map((row) => (
    row.prodotto === product
      ? {
        ...row,
        selected: normalizedSelected,
        is_scratched: normalizedScratched,
        ...(nextQuantity === null ? {} : { quantity: nextQuantity })
      }
      : row
  ));

  state.filteredProducts = state.filteredProducts.map((group) => {
    if (group.product !== product) {
      return group;
    }

    const updatedRows = group.rows.map((row) => ({
      ...row,
      selected: normalizedSelected,
      is_scratched: normalizedScratched,
      ...(nextQuantity === null ? {} : { quantity: nextQuantity })
    }));
    const selectedRow = updatedRows.find(
      (row) => String(row.retailer_id) === String(group.selectedStoreId)
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

  if (state.quantityUpdateTimeoutIds.has(product)) {
    window.clearTimeout(state.quantityUpdateTimeoutIds.get(product));
  }

  const timeoutId = window.setTimeout(async () => {
    state.quantityUpdateTimeoutIds.delete(product);

    if (!state.currentOwner) {
      return;
    }

    try {
      await persistQuantityForProduct(product, normalizedQuantity);
    } catch (error) {
      showFeedback(`Aggiornamento quantita fallito: ${error.message}`, "error");
    }
  }, QUANTITY_UPDATE_DEBOUNCE_MS);

  state.quantityUpdateTimeoutIds.set(product, timeoutId);
}

async function persistQuantityForProduct(product, quantity) {
  const normalizedQuantity = normalizeQuantity(quantity, 1);
  const { error } = await state.supabaseClient
    .from("listino_prezzi_raw")
    .update({ quantity: normalizedQuantity })
    .eq("owner", state.currentOwner)
    .eq("prodotto", product);

  if (error) {
    throw error;
  }
}

async function persistScratchedForProduct(product, isScratched) {
  const nextScratchedValue = Boolean(state.checkedProducts[product]) && Boolean(isScratched);

  if (!state.currentOwner) {
    return;
  }

  const { error } = await state.supabaseClient
    .from("listino_prezzi_raw")
    .update({ is_scratched: nextScratchedValue })
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
    const emptyCount = "0 selezionati";
    if (state.renderCache.selectedRowsCount !== emptyCount) {
      elements.selectedRowsCount.textContent = emptyCount;
      state.renderCache.selectedRowsCount = emptyCount;
    }
    if (state.renderCache.selectedRowsMarkup !== "") {
      elements.selectedRowsList.innerHTML = "";
      state.renderCache.selectedRowsMarkup = "";
    }
    elements.selectedRowsCopyButton.disabled = true;
    elements.selectedRowsClearButton.disabled = true;
    elements.selectedRowsClearButton.classList.add("hidden");
    state.renderCache.selectedRowsClearDisabled = true;
    state.renderCache.selectedRowsClearHidden = true;
    if (!state.renderCache.selectedRowsHidden) {
      elements.selectedRowsBox.classList.add("hidden");
      state.renderCache.selectedRowsHidden = true;
    }
    return;
  }

  const countText = `${selectedItems.length} selezionat${selectedItems.length === 1 ? "o" : "i"}`;
  if (state.renderCache.selectedRowsCount !== countText) {
    elements.selectedRowsCount.textContent = countText;
    state.renderCache.selectedRowsCount = countText;
  }

  let markup = "";
  if (selectedItems.length > 5) {
    const grouped = new Map();
    selectedItems.forEach(item => {
      const cat = item.row.categoria_display || "Altro";
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat).push(item);
    });

    const sortedCats = [...grouped.keys()].sort((a, b) => a.localeCompare(b, "it"));

    sortedCats.forEach(cat => {
      markup += `<div class="selection-category-header">${escapeHtml(cat)}</div>`;
      grouped.get(cat).forEach(({ product, row }) => {
        const isCrossed = state.crossedOutProducts[product] ? "crossed-out" : "";
        const itemText = `  ${escapeHtml(getRowQuantityValue(row))}x ${escapeHtml(product)} | ${escapeHtml(row.Store_name || "-")} | ${escapeHtml(row.prezzo || "-")}`;
        markup += `<div class="selected-row-item ${isCrossed}" data-crossed-product="${escapeHtml(product)}">${itemText}</div>`;
      });
    });
  } else {
    markup = selectedItems.map(({ product, row }) => {
      const isCrossed = state.crossedOutProducts[product] ? "crossed-out" : "";
      const text = `${escapeHtml(getRowQuantityValue(row))}x ${escapeHtml(product)} | ${escapeHtml(row.Store_name || "-")} | ${escapeHtml(row.prezzo || "-")}`;
      return `<div class="selected-row-item ${isCrossed}" data-crossed-product="${escapeHtml(product)}">${text}</div>`;
    }).join("");
  }

  if (state.renderCache.selectedRowsMarkup !== markup) {
    elements.selectedRowsList.innerHTML = markup;
    state.renderCache.selectedRowsMarkup = markup;
  }

  const crossedProducts = selectedItems.filter(({ product }) => Boolean(state.crossedOutProducts[product]));
  elements.selectedRowsCopyButton.disabled = false;
  const clearDisabled = crossedProducts.length === 0;
  if (state.renderCache.selectedRowsClearDisabled !== clearDisabled) {
    elements.selectedRowsClearButton.disabled = clearDisabled;
    state.renderCache.selectedRowsClearDisabled = clearDisabled;
  }
  if (state.renderCache.selectedRowsClearHidden !== clearDisabled) {
    elements.selectedRowsClearButton.classList.toggle("hidden", clearDisabled);
    state.renderCache.selectedRowsClearHidden = clearDisabled;
  }
  if (state.renderCache.selectedRowsHidden) {
    elements.selectedRowsBox.classList.remove("hidden");
    state.renderCache.selectedRowsHidden = false;
  }
}

async function handleSelectedRowClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const item = target.closest(".selected-row-item");
  if (!item) return;

  const product = item.dataset.crossedProduct;
  if (!product) return;

  const previousCrossed = Boolean(state.crossedOutProducts[product]);
  const nextCrossed = !previousCrossed;

  if (nextCrossed) {
    state.crossedOutProducts[product] = true;
  } else {
    delete state.crossedOutProducts[product];
  }

  updateLocalSelectionFlagsForProduct(product, { selected: true, isScratched: nextCrossed });
  renderSelectedRowsBox();

  try {
    await persistScratchedForProduct(product, nextCrossed);
  } catch (error) {
    if (previousCrossed) {
      state.crossedOutProducts[product] = true;
    } else {
      delete state.crossedOutProducts[product];
    }
    updateLocalSelectionFlagsForProduct(product, { selected: true, isScratched: previousCrossed });
    renderSelectedRowsBox();
    showFeedback(`Aggiornamento barratura fallito: ${error.message}`, "error");
  }
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
      if (state.quantityUpdateTimeoutIds.has(product)) {
        window.clearTimeout(state.quantityUpdateTimeoutIds.get(product));
        state.quantityUpdateTimeoutIds.delete(product);
      }
    });

    if (state.currentOwner) {
      const { error } = await state.supabaseClient
        .from("listino_prezzi_raw")
        .update({ selected: false, is_scratched: false, quantity: normalizeQuantity(1) })
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
        ? { ...row, selected: false, is_scratched: false, quantity: normalizeQuantity(1) }
        : row
    ));

    applyFilters({ syncUrl: false });
    syncUrlState();
    showFeedback("Lista della spesa ripulita.");
  } catch (error) {
    showFeedback(`Pulizia della lista della spesa fallita: ${error.message}`, "error");
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
  const search = state.formSearchTerm.toLowerCase();
  const StoreId = state.formStoreId;
  const category = state.categorySelectionSource === "manual"
    ? state.formCategoryValue
    : "";
  const priceFilter = state.editingRowId
    ? ""
    : String(elements.priceInput?.value || "").trim();

  const groupedProducts = getCurrentProductGroups();
  const filteredGroups = groupedProducts.filter((group) => {
    const haystack = group.rows
      .flatMap((row) => [
        row.prodotto,
        String(getRowQuantityValue(row)),
        row.prezzo,
        row.categoria_display,
        row.Store_name,
        `${row.prodotto}-${row.Store_name || ""}`
      ])
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (search && !haystack.includes(search)) return false;
    if (StoreId && !group.rows.some((row) => String(row.retailer_id) === StoreId)) return false;
    if (category && !group.rows.some((row) => row.categoria === category)) return false;
    if (priceFilter && !matchesPriceFilter(group.selectedRow?.prezzo, priceFilter)) return false;
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
    const emptyMarkup = `<tr><td colspan="${TABLE_COLUMN_COUNT}">Nessuna riga trovata.</td></tr>`;
    if (state.renderCache.rowsMarkup !== emptyMarkup) {
      elements.rowsBody.innerHTML = emptyMarkup;
      state.renderCache.rowsMarkup = emptyMarkup;
    }
    setTableCounterText("0 prodotti");
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
      <tr data-alpha-letter="${alphaLetter}" data-product="${escapeHtml(group.product)}">
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
                ${isChecked ? "" : "disabled"}
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
                  ${isChecked ? "" : "disabled"}
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
                  ${isChecked ? "" : "disabled"}
                >
                  ▼
                </button>
              </div>
            </div>
            <a
              href="#"
              class="category-link"
              data-action="edit-row"
              data-row-id="${row.id}"
              title="Modifica ${escapeHtml(group.product)}"
            >
              <span class="category-link-text">${escapeHtml(group.product)}</span>
            </a>
          </div>
        </td>
        <td data-label="Prezzo">${formatPriceForTable(row.prezzo)}</td>
        <td data-label="Store">
          <div class="row-Store-cell">
            <a
              href="#"
              class="Store-link"
              data-action="filter-Store"
              data-retailer-id="${row.retailer_id}"
              title="Filtra per questo Store"
            >
              ${escapeHtml(row.Store_name)}
            </a>
            <button
              type="button"
              class="icon-button compact-button"
              data-action="toggle-row-Store-dropdown"
              data-product="${escapeHtml(group.product)}"
              aria-label="Cambia Store"
              title="Scegli un altro Store"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>
            </button>
          </div>
        </td>
        <td data-label="Categoria">
          ${row.categoria ? `
            <a
              href="#"
              class="category-link"
              data-action="filter-category"
              data-category="${escapeHtml(row.categoria)}"
              title="Filtra per ${escapeHtml(row.categoria_display)}"
            >
              ${row.categoria_display && row.categoria_display !== row.categoria
                ? `<span class="category-link-icon" aria-hidden="true">${escapeHtml(String(row.categoria_display).replace(String(row.categoria), "").trim())}</span>`
                : ""
              }
              <span class="category-link-text">${escapeHtml(row.categoria)}</span>
            </a>
          ` : "-"}
        </td>
        <td data-label="Azioni">
          <div class="row-actions">
            <button
              type="button"
              class="icon-button"
              data-action="edit-row"
              data-row-id="${row.id}"
              aria-label="Modifica ${escapeHtml(group.product)} presso ${escapeHtml(row.Store_name)}"
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
              aria-label="Cancella ${escapeHtml(group.product)} presso ${escapeHtml(row.Store_name)}"
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

  if (state.renderCache.rowsMarkup !== rowsMarkup) {
    elements.rowsBody.innerHTML = rowsMarkup;
    state.renderCache.rowsMarkup = rowsMarkup;
  }

  setTableCounterText(`${state.filteredProducts.length} prodotti`);
  renderAlphabetIndex();
  renderSelectedRowsBox();
  updateSelectAllCheckboxState();
}

async function loadOwnerOptions() {
  const [StoresResponse, rowsResponse] = await Promise.all([
    state.supabaseClient
      .from("retailers")
      .select("owner")
      .not("owner", "is", null)
      .limit(1000),
    state.supabaseClient
      .from("listino_prezzi_raw")
      .select("owner")
      .not("owner", "is", null)
      .limit(1000)
  ]);

  if (StoresResponse.error) {
    throw StoresResponse.error;
  }
  if (rowsResponse.error) {
    throw rowsResponse.error;
  }

  const ownerMap = new Map();
  [...(StoresResponse.data || []), ...(rowsResponse.data || [])]
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

async function loadStores() {
  if (!state.currentOwner) {
    state.Stores = [];
    return;
  }

  const { data, error } = await state.supabaseClient
    .from("retailers")
    .select("id, name, owner, is_default")
    .eq("owner", state.currentOwner)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;
  state.Stores = data || [];
  syncDefaultStoreSelection();
  renderStoreList();
  renderCategoryList();
}

async function loadCategories() {
  state.cachedCategories = null;
  if (!state.currentOwner) {
    state.categories = [];
    return;
  }

  const { data, error } = await state.supabaseClient
    .from("categories")
    .select("id, name, icon, owner")
    .eq("owner", state.currentOwner)
    .order("name", { ascending: true });

  if (error) throw error;
  state.categories = data || [];
  renderCategoryList();
}

async function loadProductVocabulary() {
  if (!state.currentOwner) {
    state.productVocabularyWords = [];
    renderProductInlineSuggestion();
    return;
  }

  const { data, error } = await state.supabaseClient
    .from("product_vocabulary")
    .select("word")
    .eq("owner", state.currentOwner)
    .order("word", { ascending: true })
    .limit(2000);

  if (error) throw error;
  state.productVocabularyWords = (data || [])
    .map((row) => String(row.word || "").trim())
    .filter(Boolean);

  const historicalWords = state.rows
  .flatMap((row) => String(row?.prodotto || "").split(/[^\p{L}]+/u))
  .map((word) => String(word.toLowerCase() || "").trim())
  .filter((word) => word && word.length >= 5 && !/\d/.test(word));
  const words = [...new Set([
    ...historicalWords,
    ...state.productVocabularyWords
  ]
    .map((word) => String(word || "").trim())
    .filter((word) => word && word.length >= 5 && !/\d/.test(word))
  )].sort((a, b) => a.localeCompare(b, "it"));
  
  state.rankedWords = [
    ...words.filter((word) => historicalWords.some((historicalWord) => historicalWord.localeCompare(word, "it", { sensitivity: "base" }) === 0)),
    ...words.filter((word) => !historicalWords.some((historicalWord) => historicalWord.localeCompare(word, "it", { sensitivity: "base" }) === 0))
  ];
  renderProductInlineSuggestion();
}

async function loadRows() {
  state.cachedCategories = null;
  if (!state.currentOwner) {
    state.rows = [];
    applyFilters();
    return;
  }

  const { data, error } = await state.supabaseClient
    .from("listino_prezzi_raw")
    .select(`
      id,
      selected,
      is_scratched,
      quantity,
      prodotto,
      retailer_id,
      category_id,
      prezzo,
      created_at,
      owner
    `)
    .eq("owner", state.currentOwner)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;

  const StoreMap = new Map(state.Stores.map((Store) => [String(Store.id), Store.name]));
  const categoryDisplayMap = new Map(state.categories.map((category) => [String(category.id), getCategoryDisplayName(category)]));
  const categoryRawMap = new Map(state.categories.map((category) => [String(category.id), category.name]));

  state.rows = (data || []).map((row) => ({
    ...row,
    is_scratched: Boolean(row.is_scratched) && Boolean(row.selected),
    quantity: normalizeQuantity(row.quantity, 1),
    Store_name: StoreMap.get(String(row.retailer_id)) || "-",
    categoria: categoryRawMap.get(String(row.category_id)) || null,
    categoria_display: categoryDisplayMap.get(String(row.category_id)) || null
  }));

  state.checkedProducts = {};
  state.crossedOutProducts = {};
  state.rows.forEach((row) => {
    if (row.selected) {
      state.checkedProducts[row.prodotto] = true;
    }
    if (row.selected && row.is_scratched) {
      state.crossedOutProducts[row.prodotto] = true;
    }
  });


  if (state.editingRowId && !findRowById(state.editingRowId)) {
    setPriceFormMode("create");
  }

  applyFilters();
  renderCategoryList();
  renderProductInlineSuggestion();

}

async function refreshData() {
  state.cachedCategories = null;
  if (!state.currentOwner) {
    showTableMessage("Seleziona un owner per caricare il listino.");
    setTableCounterText("owner richiesto");
    return;
  }

  clearFeedback();
  showLoadingOverlay("Caricamento dati...");
  try {
    await loadStores();
    await loadCategories();
    await loadProductVocabulary();
    await loadRows();
  } catch (error) {
    updateShoppingSessionUI();
    showTableMessage(`Errore nel caricamento dati: ${error.message}`);
    showFeedback(`Errore nel caricamento dati: ${error.message}`, "error");
  } finally {
    hideLoadingOverlay();
  }
}

function initSelectionResizer() {
  const box = elements.selectedRowsBox;
  if (!box) return;

  // cerca in document l'elemento di trascinamento del box
  const resizer = box.querySelector(".selection-resizer");
  if (!resizer) return;

  let startY, startHeight;

  const handleMove = (e) => {
    // Supporto sia per MouseEvent che TouchEvent
    const currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaY = currentY - startY;
    
    // Calcoliamo la nuova altezza (startHeight - deltaY perché trasciniamo verso l'alto per ingrandire)
    // Aggiungiamo un limite minimo di 120px per evitare che sparisca
    const newHeight = Math.max(120, startHeight - deltaY);
    
    box.style.height = `${newHeight}px`;
    box.style.maxHeight = "90vh"; // Limite ragionevole rispetto alla viewport
  };

  const handleEnd = () => {
    box.classList.remove("is-resizing");
    document.removeEventListener("mousemove", handleMove);
    document.removeEventListener("mouseup", handleEnd);
    document.removeEventListener("touchmove", handleMove);
    document.removeEventListener("touchend", handleEnd);
  };

  const handleStart = (e) => {
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startHeight = box.offsetHeight;
    
    // Durante il resize, rimuoviamo la transizione e la classe 'reduced' 
    // per evitare che il CSS provi a limitare l'altezza
    box.style.transition = "none";
    box.classList.add("is-resizing");

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    // Passive: false è necessario per poter fare preventDefault su touchmove
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd);
  };

  resizer.addEventListener("mousedown", handleStart);
  resizer.addEventListener("touchstart", handleStart, { passive: false });
}

function handleSelectedRowsToggleSize() {
  const box = elements.selectedRowsBox;
  if (!box) return;

  // Se l'utente clicca il pulsante toggle, resettiamo le dimensioni manuali
  // per tornare al comportamento standard gestito dalle classi CSS
  box.style.height = "";
  box.style.maxHeight = "";

  box.classList.toggle("reduced");

  elements.selectedRowsToggleSize.textContent =
    box.classList.contains("reduced") ? "↑" : "↓";
}

function updateShoppingSessionUI() {
  if (!elements.shoppingSessionButton) return;

  if (state.activeShoppingStoreId) {
    const store = state.Stores.find(s => String(s.id) === String(state.activeShoppingStoreId));
    elements.shoppingSessionButton.textContent = `${store?.name || "Store"}`;
    elements.shoppingSessionButton.classList.add("session-active");
  } else {
    elements.shoppingSessionButton.textContent = "Fai spesa?";
    elements.shoppingSessionButton.classList.remove("session-active");
  }
}

function closeSessionStoreDropdown() {
  state.sessionStoreDropdownOpen = false;
  state.sessionStoreSearchTerm = "";
  elements.shoppingSessionButton?.setAttribute("aria-expanded", "false");
  elements.sessionStoreDropdownPanel?.classList.add("hidden");
}

function openSessionStoreDropdown() {
  closeOwnerDropdown();
  closeStoreDropdown();
  closeCategoryDropdown();
  state.sessionStoreDropdownOpen = true;
  elements.shoppingSessionButton?.setAttribute("aria-expanded", "true");
  elements.sessionStoreDropdownPanel?.classList.remove("hidden");
  elements.sessionStoreDropdownSearch?.focus();
  renderSessionStoreList();
}

function renderSessionStoreList() {
  if (!elements.sessionStoreDropdownOptions) return;
  const rawSearchTerm = String(state.sessionStoreSearchTerm || "");
  const trimmedSearchTerm = rawSearchTerm.trim();
  const searchTerm = rawSearchTerm.toLowerCase();
  const exactStore = findStoreByName(trimmedSearchTerm);
  elements.sessionStoreDropdownSearch.value = state.sessionStoreSearchTerm;
  const filteredStores = state.Stores.filter((store) => store.name.toLowerCase().includes(searchTerm));

  const options = filteredStores.map((store) => {
    return `
      <button
        type="button"
        class="custom-dropdown-option"
        data-session-store-id="${store.id}"
        role="option"
      >
        ${escapeHtml(store.name)}
      </button>
    `;
  });

  if (trimmedSearchTerm && !exactStore) {
    options.unshift(`
      <button
        type="button"
        class="custom-dropdown-option"
        data-session-store-new="true"
        data-session-store-name="${escapeHtml(trimmedSearchTerm)}"
        role="option"
      >
        Usa nuovo Store: ${escapeHtml(trimmedSearchTerm)}
      </button>
    `);
  }

  elements.sessionStoreDropdownOptions.innerHTML = options.length
    ? options.join("")
    : `<div class="custom-dropdown-empty">Nessun Store trovato.</div>`;
}

function handleSessionStoreDropdownSearch(event) {
  state.sessionStoreSearchTerm = String(event.target.value || "");
  renderSessionStoreList();
}

function activateShoppingSessionStore(store, options = {}) {
  const { created = false } = options;
  if (!store) {
    return;
  }

  state.activeShoppingStoreId = String(store.id);
  closeSessionStoreDropdown();
  updateShoppingSessionUI();
  showFeedback(
    created
      ? `Store "${store.name}" creato e impostato per la spesa.`
      : `${store.name} è ora lo store di default.`
  );
}

async function createSessionStore(storeName) {
  showLoadingOverlay("Creazione Store...");
  try {
    const { store, created } = await createOrReuseStoreByName(storeName);
    activateShoppingSessionStore(store, { created });
  } catch (error) {
    showFeedback(error.message, "error");
  } finally {
    hideLoadingOverlay();
  }
}

function handleSessionStoreDropdownOptionClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const newStoreButton = target.closest("button[data-session-store-new]");
  if (newStoreButton instanceof HTMLButtonElement) {
    const storeName = String(newStoreButton.dataset.sessionStoreName || "").trim();
    if (!storeName) {
      return;
    }

    createSessionStore(storeName);
    return;
  }

  const button = target.closest("button[data-session-store-id]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const storeId = button.dataset.sessionStoreId;
  const store = state.Stores.find((item) => String(item.id) === String(storeId));
  if (!store) {
    return;
  }

  activateShoppingSessionStore(store);
}

function handleSessionStoreDropdownSearchKeydown(event) {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  const typedStore = String(event.currentTarget.value || "").trim();
  if (!typedStore) {
    return;
  }

  const exactStore = findStoreByName(typedStore);
  if (exactStore) {
    activateShoppingSessionStore(exactStore);
    return;
  }

  createSessionStore(typedStore);
}

function handleShoppingSessionToggle() {
  if (state.activeShoppingStoreId) {
    state.activeShoppingStoreId = null;
    updateShoppingSessionUI();
    return;
  }

  if (!state.currentOwner) {
    showFeedback("Carica prima un owner per iniziare la spesa.", "error");
    return;
  }

  if (state.sessionStoreDropdownOpen) {
    closeSessionStoreDropdown();
  } else {
    openSessionStoreDropdown();
  }
}

async function resolveStoreForSubmit() {
  if (!state.currentOwner) {
    throw new Error("Seleziona prima un owner.");
  }

  const newStoreName = String(state.StoreSearchTerm || "").trim();
  if (newStoreName) {
    const hasPartialStores = state.Stores.some((Store) => Store.name.toLowerCase().includes(newStoreName.toLowerCase()));
    if (hasPartialStores) {
      throw new Error("Seleziona un Store dalla lista oppure continua a digitare fino a non trovare risultati.");
    }

    const { store, created } = await createOrReuseStoreByName(newStoreName);
    state.StoreSearchTerm = "";
    setFormStoreSelection(store.id);
    return {
      StoreId: Number(store.id),
      StoreName: store.name,
      created
    };
  }

  const selectedStoreId = Number(state.formStoreId || elements.StoreHiddenInput.value);
  if (!selectedStoreId) {
    // Priorità 2: Store della sessione di spesa attiva
    if (state.activeShoppingStoreId) {
      const sessionStore = state.Stores.find(
        (item) => String(item.id) === String(state.activeShoppingStoreId)
      );
      if (sessionStore) {
        return {
          StoreId: Number(sessionStore.id),
          StoreName: sessionStore.name,
          created: false
        };
      }
    }

    // Priorità 3: Store di default globale
    const defaultRiv = getDefaultStore();
    return {
      StoreId: defaultRiv ? Number(defaultRiv.id) : null,
      StoreName: defaultRiv?.name || null,
      created: false
    };
  }

  const Store = state.Stores.find((item) => String(item.id) === String(selectedStoreId));
  return {
    StoreId: selectedStoreId,
    StoreName: Store?.name || null,
    created: false
  };
}

function extractEmojiAndName(input) {
  const emojiRegex = /\p{Extended_Pictographic}/u;
  const match = input.match(emojiRegex);

  if (match) {
    const icon = match[0];
    const name = input.replace(icon, "").trim();
    return { name, icon };
  }

  return { name: input.trim(), icon: null };
}

async function resolveCategoryForSubmit() {
  const searchValue = String(state.categorySearchTerm || "").trim();
  if (searchValue) {
    const { name: cleanName, icon } = extractEmojiAndName(searchValue);

    const exactCategory = findCategoryByName(cleanName);
    if (exactCategory) {
      state.categorySearchTerm = "";
      setFormCategorySelection(exactCategory.name);
      return {
        categoryId: Number(exactCategory.id),
        categoryName: exactCategory.name
      };
    }

    const hasPartialCategories = buildCategoryList().some((category) => category.toLowerCase().includes(cleanName.toLowerCase()));
    if (hasPartialCategories) {
      throw new Error("Seleziona una categoria dalla lista oppure continua a digitare fino a non trovare risultati.");
    }

    const { data, error } = await state.supabaseClient
      .from("categories")
      .insert([{ name: cleanName, icon: icon, owner: state.currentOwner }])
      .select("id, name")
      .single();

    if (error) {
      if (error.code === "23505") {
        const existingCategory = findCategoryByName(searchValue);
        if (existingCategory) {
          state.categorySearchTerm = "";
          setFormCategorySelection(existingCategory.name);
          return {
            categoryId: Number(existingCategory.id),
            categoryName: existingCategory.name
          };
        }
      }

      throw new Error(`Creazione categoria fallita: ${error.message}`);
    }

    await loadCategories();
    state.categorySearchTerm = "";
    setFormCategorySelection(data.name);
    return {
      categoryId: Number(data.id),
      categoryName: data.name
    };
  }

  const selectedCategoryName = String(state.formCategoryValue || elements.categoryHiddenInput.value || "").trim();
  if (!selectedCategoryName) {
    return {
      categoryId: null,
      categoryName: null
    };
  }

  const selectedCategory = findCategoryByName(selectedCategoryName);
  return {
    categoryId: selectedCategory ? Number(selectedCategory.id) : null,
    categoryName: selectedCategoryName
  };
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
  state.selectedStoreByProduct = {};
  state.activeShoppingStoreId = null;
  updateShoppingSessionUI();
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
    const prezzo = String(formData.get("prezzo") || "??€/kg").trim();
    let StoreInfo;
    let categoriaInfo;
    try {
      StoreInfo = await resolveStoreForSubmit();
      categoriaInfo = await resolveCategoryForSubmit();
    } catch (error) {
      showFeedback(error.message, "error");
      return;
    }

    const StoreId = StoreInfo.StoreId;

    if (!prodotto || !StoreId) {
      showFeedback("Compila prodotto e Store.", "error");
      return;
    }

    const parsedPrice = parsePriceText(prezzo);

    const payload = {
      owner: state.currentOwner,
      prodotto,
      retailer_id: StoreId,
      category_id: categoriaInfo.categoryId,
      prezzo,
      prezzo_valore: typeof parsedPrice.value === "number" ? parsedPrice.value : null,
      prezzo_unita: parsedPrice.unit
    };
    
    if (state.editingRowId) {
      const editingRowId = state.editingRowId;
      const previousRow = findRowById(editingRowId);
      const { error } = await state.supabaseClient
        .from("listino_prezzi_raw")
        .update(payload)
        .eq("id", editingRowId)
        .eq("owner", state.currentOwner);

      if (error) {
        showFeedback(`Aggiornamento riga fallito: ${error.message}`, "error");
        return;
      }

      if (previousRow && previousRow.prodotto !== prodotto) {
        delete state.selectedStoreByProduct[previousRow.prodotto];
        if (state.checkedProducts[previousRow.prodotto]) {
          delete state.checkedProducts[previousRow.prodotto];
          state.checkedProducts[prodotto] = true;
        }
      }

      state.selectedStoreByProduct[prodotto] = String(StoreId);
      setPriceFormMode("create");
      await refreshData();
      showSuccessFeedbackWithProductLink(
        StoreInfo.created
          ? `Store "${StoreInfo.StoreName}" creato e riga listino aggiornata per `
          : " aggiornato con successo.",
        prodotto
      );
      return;
    }

    const { error } = await state.supabaseClient
      .from("listino_prezzi_raw")
      .insert([payload]);

    if (error) {
      showFeedback(`Salvataggio riga fallito: ${error.message}`, "error");
      return;
    }

    state.selectedStoreByProduct[prodotto] = String(StoreId);
    setPriceFormMode("create");
    await loadRows();
    showSuccessFeedbackWithProductLink(
      StoreInfo.created
        ? `Store "${StoreInfo.StoreName}" creato e riga listino salvata per `
        : " inserito con successo.",
      prodotto
    );
  } finally {
    hideLoadingOverlay();
  }
}

function handleCancelEdit() {
  clearFeedback();
  setPriceFormMode("create");
  applyFilters();
}

function handleStoreDropdownToggle() {
  if (state.StoreDropdownOpen) {
    closeStoreDropdown();
    return;
  }

  openStoreDropdown();
}

function handleStoreDropdownSearch(event) {
  state.StoreSearchTerm = String(event.target.value || "");
  if (state.StoreSearchTerm.trim()) {
    state.formStoreId = "";
    elements.StoreHiddenInput.value = "";
  }
  renderStoreList();
}

function handleStoreDropdownOptionClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const button = target.closest("button[data-store-id]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const StoreId = button.dataset.storeId;
  if (!StoreId) {
    return;
  }

  state.StoreSearchTerm = "";
  elements.StoreDropdownSearch.value = "";
  setFormStoreSelection(StoreId);
  closeStoreDropdown();
}

function handleCategoryDropdownToggle() {
  if (state.categoryDropdownOpen) {
    closeCategoryDropdown();
    return;
  }

  openCategoryDropdown();
}

function handleCategoryDropdownSearch(event) {
  state.categorySearchTerm = String(event.target.value || "");
  if (state.categorySearchTerm.trim()) {
    state.formCategoryValue = "";
    state.categorySelectionSource = "manual";
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
  setFormCategorySelection(categoryValue, { source: "manual" });
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

  if (elements.StoreDropdown && !elements.StoreDropdown.contains(target)) {
    closeStoreDropdown();
  }
  if (elements.categoryDropdown && !elements.categoryDropdown.contains(target)) {
    closeCategoryDropdown();
  }
  if (elements.ownerDropdown && !elements.ownerDropdown.contains(target)) {
    closeOwnerDropdown();
  }
  if (elements.sessionStoreDropdown && !elements.sessionStoreDropdown.contains(target)) {
    closeSessionStoreDropdown();
  }
  if (elements.rowStoreDropdownPanel && !elements.rowStoreDropdownPanel.contains(target) && !target.closest('[data-action="toggle-row-Store-dropdown"]')) {
    closeRowStoreDropdown();
  }
}

function handleDocumentKeydown(event) {
  if (event.key === "Escape") {
    closeOwnerDropdown();
    closeStoreDropdown();
    closeCategoryDropdown();
    closeSessionStoreDropdown();
  }
}

async function handleRowStoreChange(event) {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.classList.contains("row-selection-checkbox")) {
    const product = target.dataset.product;
    if (!product) {
      return;
    }

    const previousSelected = Boolean(state.checkedProducts[product]);
    const previousScratched = Boolean(state.crossedOutProducts[product]);
    const shouldResetQuantity = !target.checked;

    if (target.checked) {
      state.checkedProducts[product] = true;
    } else {
      delete state.checkedProducts[product];
      if (state.quantityUpdateTimeoutIds.has(product)) {
        window.clearTimeout(state.quantityUpdateTimeoutIds.get(product));
        state.quantityUpdateTimeoutIds.delete(product);
      }
    }

    delete state.crossedOutProducts[product];
    updateLocalSelectionFlagsForProduct(product, { selected: target.checked, isScratched: false });

    try {
      const { error } = await state.supabaseClient
        .from("listino_prezzi_raw")
        .update({
          selected: target.checked,
          is_scratched: false,
          ...(shouldResetQuantity ? { quantity: normalizeQuantity(1) } : {})
        })
        .eq("prodotto", product)
        .eq("owner", state.currentOwner);

      if (error) {
        throw error;
      }
    } catch (error) {
      if (previousSelected) {
        state.checkedProducts[product] = true;
      } else {
        delete state.checkedProducts[product];
      }

      if (previousScratched) {
        state.crossedOutProducts[product] = true;
      } else {
        delete state.crossedOutProducts[product];
      }

      updateLocalSelectionFlagsForProduct(product, {
        selected: previousSelected,
        isScratched: previousScratched
      });
      renderRows();
      renderSelectedRowsBox();
      syncUrlState();
      showFeedback(`Aggiornamento selezione fallito: ${error.message}`, "error");
      return;
    }

    renderRows();
    updateSelectAllCheckboxState();
    renderSelectedRowsBox();
    syncUrlState();
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

  const confirmMessage = `Vuoi cancellare "${row.prodotto}" per "${row.Store_name}"?`;
  if (!window.confirm(confirmMessage)) {
    return;
  }

  showLoadingOverlay("Cancellazione riga...");
  try {
    const { error } = await state.supabaseClient
      .from("listino_prezzi_raw")
      .delete()
      .eq("id", rowId)
      .eq("owner", state.currentOwner);

    if (error) {
      showFeedback(`Cancellazione fallita: ${error.message}`, "error");
      return;
    }

    delete state.selectedStoreByProduct[row.prodotto];
    if (String(state.editingRowId) === String(rowId)) {
      setPriceFormMode("create");
    }

    await refreshData();
    showFeedback(`"${row.prodotto}" cancellato per "${row.Store_name}".`);
  } finally {
    hideLoadingOverlay();
  }
}

async function handleRowActionClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const trigger = target.closest("[data-action]");
  if (!trigger) {
    return;
  }

  if (trigger.dataset.action === "quantity-step") {
    const product = String(trigger.dataset.product || "").trim();
    const step = Number.parseInt(String(trigger.dataset.step || "0"), 10);
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

    if (trigger.dataset.action === "filter-Store") {
      event.preventDefault();
      setFormStoreSelection(trigger.dataset.retailerId || "");
      handleScrollToTop();
      return;
    }

    if (trigger.dataset.action === "toggle-row-Store-dropdown") {
      const product = trigger.dataset.product;
      if (state.openRowStoreProduct === product) {
        closeRowStoreDropdown();
      } else {
        openRowStoreDropdown(product, trigger);
      }
      return;
    }

    if (trigger.dataset.action === "select-row-retailer") {
      handleSelectRowRetailer(trigger.dataset.product, trigger.dataset.retailerId);
      return;
    }

    if (trigger.dataset.action === "filter-category") {
      event.preventDefault();
      setFormCategorySelection(trigger.dataset.category || "");
      handleScrollToTop();
      return;
    }

  const rowId = trigger.dataset.rowId;
  if (!rowId) {
    return;
  }

  if (trigger.dataset.action === "edit-row") {
    const row = findRowById(rowId);
    if (!row) {
      showFeedback("Riga non trovata per la modifica.", "error");
      return;
    }

    setPriceFormMode("edit", row);
    return;
  }

  if (trigger.dataset.action === "delete-row") {
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

function handlePriceResetFilters() {
  if (state.editingRowId) {
    handleCancelEdit();
    return;
  }

  // Reset solo del form di inserimento
  elements.priceForm.reset();
  state.formStoreId = "";
  state.formCategoryValue = "";
  state.formSearchTerm = "";
  state.productInlineSuggestion = null;
  state.categorySelectionSource = "none";
  state.suggestedCategoryValue = "";

  renderStoreList();
  renderCategoryList();
  renderProductInlineSuggestion();
  renderPriceInlineSuggestion();
  applyFilters();
}

function handleFormPriceInput() {
  renderPriceInlineSuggestion();
  if (!state.editingRowId) {
    applyFilters();
  }
}

function handlePriceInputKeydown(event) {
  if (event.key !== "Tab" || !state.priceInlineSuggestion) {
    return;
  }

  event.preventDefault();
  applyPriceInlineSuggestion();
}

function handlePriceInlineSuggestionClick() {
  applyPriceInlineSuggestion();
}

function handleFormProductInput() {
  state.formSearchTerm = elements.productInput?.value.trim() || "";
  renderProductInlineSuggestion();
  syncSuggestedCategoryFromProduct();
  if (state.filterInputTimeoutId !== null) {
    window.clearTimeout(state.filterInputTimeoutId);
  }
  state.filterInputTimeoutId = window.setTimeout(() => {
    state.filterInputTimeoutId = null;
    applyFilters();
  }, FILTER_INPUT_DEBOUNCE_MS);
}

function handleProductInputKeydown(event) {
  if (event.key !== "Tab" || !state.productInlineSuggestion) {
    return;
  }

  event.preventDefault();
  applyProductInlineSuggestion();
}

function handleFeedbackClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const button = target.closest("button[data-feedback-product]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const product = String(button.dataset.feedbackProduct || "").trim();
  if (!product) {
    return;
  }

  revealProductInTable(product);
}

function handleProductInlineSuggestionClick() {
  applyProductInlineSuggestion();
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
  // Eventi globali
  elements.scrollToTopButton?.addEventListener("click", handleScrollToTop);
  elements.shoppingSessionButton?.addEventListener("click", handleShoppingSessionToggle);
  elements.selectedRowsList?.addEventListener("click", handleSelectedRowClick);
  elements.selectAllCheckbox?.addEventListener("pointerdown", rememberSelectAllToggleIntent);
  elements.selectAllCheckbox?.addEventListener("keydown", rememberSelectAllToggleIntent);
  elements.selectAllCheckbox?.addEventListener("change", handleSelectAllChange);

  // Owner dropdown
  elements.ownerDropdownButton.addEventListener("click", handleOwnerDropdownToggle);
  elements.ownerDropdownSearch.addEventListener("input", handleOwnerDropdownSearch);
  elements.ownerDropdownSearch.addEventListener("keydown", handleOwnerDropdownSearchKeydown);
  elements.ownerDropdownOptions.addEventListener("click", handleOwnerDropdownOptionClick);

  // Form inserimento/modifica
  elements.priceForm.addEventListener("submit", handlePriceSubmit);
  elements.priceResetFiltersButton?.addEventListener("click", handlePriceResetFilters);
  elements.productInput?.addEventListener("input", handleFormProductInput);
  elements.productInput?.addEventListener("keydown", handleProductInputKeydown);
  elements.priceInput?.addEventListener("input", handleFormPriceInput);
  elements.priceInput?.addEventListener("keydown", handlePriceInputKeydown);
  elements.productInlineSuggestion?.addEventListener("click", handleProductInlineSuggestionClick);
  elements.priceInlineSuggestion?.addEventListener("click", handlePriceInlineSuggestionClick);
  elements.feedback?.addEventListener("click", handleFeedbackClick);

  // Store e Categoria dropdown (nel form)
  elements.StoreDropdownButton.addEventListener("click", handleStoreDropdownToggle);
  elements.StoreDropdownSearch.addEventListener("input", handleStoreDropdownSearch);
  elements.StoreDropdownOptions.addEventListener("click", handleStoreDropdownOptionClick);

  elements.categoryDropdownButton.addEventListener("click", handleCategoryDropdownToggle);
  elements.categoryDropdownSearch.addEventListener("input", handleCategoryDropdownSearch);
  elements.categoryDropdownOptions.addEventListener("click", handleCategoryDropdownOptionClick);
  elements.rowStoreDropdownOptions?.addEventListener("click", handleRowStoreDropdownOptionClick);

  // Sessione di spesa
  elements.sessionStoreDropdownSearch?.addEventListener("input", handleSessionStoreDropdownSearch);
  elements.sessionStoreDropdownSearch?.addEventListener("keydown", handleSessionStoreDropdownSearchKeydown);
  elements.sessionStoreDropdownOptions?.addEventListener("click", handleSessionStoreDropdownOptionClick);

  // Tabella
  elements.rowsBody.addEventListener("input", handleRowsBodyInput);
  elements.rowsBody.addEventListener("change", handleRowStoreChange);
  elements.rowsBody.addEventListener("click", handleRowActionClick);
  elements.sortButtons.forEach((button) => button.addEventListener("click", handleSortButtonClick));

  // Selezionati
  elements.selectedRowsCopyButton?.addEventListener("click", handleSelectedRowsCopy);
  elements.selectedRowsClearButton?.addEventListener("click", handleSelectedRowsClear);
  elements.selectedRowsToggleSize?.addEventListener("click", handleSelectedRowsToggleSize);

  initSelectionResizer();

  // Altri eventi generali
  elements.refreshButton.addEventListener("click", refreshData);
  elements.alphabetIndex?.addEventListener("click", handleAlphabetIndexClick);

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);

  window.addEventListener("resize", updateStickyAlphabetMetrics);
  window.addEventListener("scroll", updateScrollToTopButtonVisibility, { passive: true });
  elements.tableWrap?.addEventListener("scroll", updateScrollToTopButtonVisibility, { passive: true });
}

async function bootstrap() {
  showLoadingOverlay("Avvio applicazione...");
  try {
    const sharedSession = readSessionStateFromUrl();
    state.supabaseClient = createSupabaseClient();
    bindEvents();
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

if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("./service-worker.js", { scope: "./" }).catch((error) => {
    console.warn("Registrazione service worker fallita:", error);
  });
}

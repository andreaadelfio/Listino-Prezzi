const APP_VERSION = "20260316-17";
const TABLE_COLUMN_COUNT = 5;
const FEEDBACK_DISMISS_MS = 5000;
window.__listinoVersion = APP_VERSION;

const state = {
  retailers: [],
  rows: [],
  filteredProducts: [],
  selectedRetailerByProduct: {},
  editingRowId: null,
  formRetailerId: "",
  retailerDropdownOpen: false,
  retailerSearchTerm: ""
};

let feedbackHideTimeoutId = null;
let feedbackAnimationFrameId = null;

const elements = {
  refreshButton: document.querySelector("#refresh-button"),
  priceForm: document.querySelector("#price-form"),
  priceFormEyebrow: document.querySelector("#price-form-eyebrow"),
  priceFormTitle: document.querySelector("#price-form-title"),
  priceSubmitButton: document.querySelector("#price-submit-button"),
  priceCancelButton: document.querySelector("#price-cancel-button"),
  priceFormNote: document.querySelector("#price-form-note"),
  retailerFilter: document.querySelector("#retailer-filter"),
  categoryFilter: document.querySelector("#category-filter"),
  searchInput: document.querySelector("#search-input"),
  retailerHiddenInput: document.querySelector("#retailer-hidden-input"),
  retailerDropdown: document.querySelector("#retailer-dropdown"),
  retailerDropdownButton: document.querySelector("#retailer-dropdown-button"),
  retailerDropdownLabel: document.querySelector("#retailer-dropdown-label"),
  retailerDropdownPanel: document.querySelector("#retailer-dropdown-panel"),
  retailerDropdownSearch: document.querySelector("#retailer-dropdown-search"),
  retailerDropdownOptions: document.querySelector("#retailer-dropdown-options"),
  priceCategorySelect: document.querySelector("#price-category-select"),
  rowsBody: document.querySelector("#rows-body"),
  tableCounter: document.querySelector("#table-counter"),
  feedback: document.querySelector("#feedback")
};

if (elements.rowsBody) {
  elements.rowsBody.innerHTML = `<tr><td colspan="${TABLE_COLUMN_COUNT}">Inizializzazione frontend...</td></tr>`;
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
  elements.feedback.className = `feedback feedback-${type}`;

  if (type === "success") {
    startFeedbackTimer();
  }
}

function clearFeedback() {
  stopFeedbackTimer();
  elements.feedback.textContent = "";
  elements.feedback.className = "feedback hidden";
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

function normalizeRetailerName(value) {
  return String(value || "").trim().toLowerCase();
}

function findRowById(rowId) {
  return state.rows.find((row) => String(row.id) === String(rowId)) || null;
}

function findRetailerByName(name) {
  const normalizedName = normalizeRetailerName(name);
  return state.retailers.find((retailer) => normalizeRetailerName(retailer.name) === normalizedName) || null;
}

function buildCategoryList() {
  return [...new Set(
    state.rows
      .map((row) => row.categoria)
      .filter(Boolean)
      .map((value) => String(value).trim())
  )].sort((a, b) => a.localeCompare(b, "it"));
}

function setPriceFormMode(mode, row = null) {
  if (mode === "edit" && row) {
    state.editingRowId = row.id;
    elements.priceFormEyebrow.textContent = "Modifica riga";
    elements.priceFormTitle.textContent = "Aggiorna la voce selezionata";
    elements.priceSubmitButton.textContent = "Aggiorna riga";
    elements.priceCancelButton.classList.remove("hidden");
    elements.priceFormNote.textContent = `Stai modificando ${row.prodotto} presso ${row.retailer_name}.`;

    elements.priceForm.elements.prodotto.value = row.prodotto || "";
    elements.priceForm.elements.categoria.value = row.categoria || "";
    elements.priceForm.elements.prezzo.value = row.prezzo || "";
    setFormRetailerSelection(row.retailer_id);
    state.retailerSearchTerm = "";
    closeRetailerDropdown();
    return;
  }

  state.editingRowId = null;
  elements.priceForm.reset();
  elements.priceFormEyebrow.textContent = "Nuova riga";
  elements.priceFormTitle.textContent = "Inserisci voce listino raw";
  elements.priceSubmitButton.textContent = "Salva riga";
  elements.priceCancelButton.classList.add("hidden");
  elements.priceFormNote.textContent = "La combinazione prodotto-retailer viene gestita automaticamente.";
  setFormRetailerSelection("");
  state.retailerSearchTerm = "";
  closeRetailerDropdown();
}

function closeRetailerDropdown() {
  state.retailerDropdownOpen = false;
  elements.retailerDropdownButton.setAttribute("aria-expanded", "false");
  elements.retailerDropdownPanel.classList.add("hidden");
}

function openRetailerDropdown() {
  state.retailerDropdownOpen = true;
  elements.retailerDropdownButton.setAttribute("aria-expanded", "true");
  elements.retailerDropdownPanel.classList.remove("hidden");
  elements.retailerDropdownSearch.focus();
}

function updateRetailerDropdownLabel() {
  if (!state.formRetailerId) {
    if (state.retailerSearchTerm) {
      const hasMatches = state.retailers.some((item) => item.name.toLowerCase().includes(state.retailerSearchTerm.toLowerCase()));
      if (!hasMatches) {
        elements.retailerDropdownLabel.textContent = `Nuovo retailer: ${state.retailerSearchTerm}`;
        return;
      }
    }
    elements.retailerDropdownLabel.textContent = "Seleziona retailer";
    return;
  }

  const retailer = state.retailers.find((item) => String(item.id) === String(state.formRetailerId));
  elements.retailerDropdownLabel.textContent = retailer?.name || "Seleziona retailer";
}

function renderRetailerList() {
  const searchTerm = state.retailerSearchTerm.toLowerCase();
  elements.retailerDropdownSearch.value = state.retailerSearchTerm;
  const filteredRetailers = state.retailers.filter((retailer) => retailer.name.toLowerCase().includes(searchTerm));

  if (!filteredRetailers.length) {
    if (state.retailerSearchTerm) {
      elements.retailerDropdownOptions.innerHTML = `
        <div class="custom-dropdown-empty">
          Nessun retailer trovato. Al salvataggio verra creato "${escapeHtml(state.retailerSearchTerm)}".
        </div>
      `;
    } else {
      elements.retailerDropdownOptions.innerHTML = `<div class="custom-dropdown-empty">Nessun retailer trovato.</div>`;
    }
    updateRetailerDropdownLabel();
    elements.retailerHiddenInput.value = state.formRetailerId;
    return;
  }

  elements.retailerDropdownOptions.innerHTML = filteredRetailers.map((retailer) => {
    const isSelected = String(retailer.id) === String(state.formRetailerId);
    return `
      <button
        type="button"
        class="custom-dropdown-option ${isSelected ? "custom-dropdown-option-active" : ""}"
        data-retailer-id="${retailer.id}"
        role="option"
        aria-selected="${isSelected ? "true" : "false"}"
      >
        ${escapeHtml(retailer.name)}
      </button>
    `;
  }).join("");

  updateRetailerDropdownLabel();
  elements.retailerHiddenInput.value = state.formRetailerId;
}

function setFormRetailerSelection(retailerId) {
  const normalizedId = retailerId ? String(retailerId) : "";
  const exists = state.retailers.some((retailer) => String(retailer.id) === normalizedId);
  state.formRetailerId = exists ? normalizedId : "";
  elements.retailerHiddenInput.value = state.formRetailerId;
  renderRetailerList();
}

function renderRetailerControls() {
  const currentRetailerFilter = elements.retailerFilter.value;
  if (state.formRetailerId && !state.retailers.some((retailer) => String(retailer.id) === String(state.formRetailerId))) {
    state.formRetailerId = "";
  }
  const options = state.retailers
    .map((retailer) => `<option value="${retailer.id}">${escapeHtml(retailer.name)}</option>`)
    .join("");

  elements.retailerFilter.innerHTML = `<option value="">Tutti</option>${options}`;
  setSelectValue(elements.retailerFilter, currentRetailerFilter);
  renderRetailerList();
}

function renderCategoryOptions() {
  const currentCategoryFilter = elements.categoryFilter.value;
  const currentPriceCategory = elements.priceCategorySelect.value;
  const categories = buildCategoryList();
  const extraCategories = [currentCategoryFilter, currentPriceCategory]
    .filter((value) => value && !categories.includes(value))
    .sort((a, b) => a.localeCompare(b, "it"));
  const finalCategories = [...categories, ...extraCategories];

  elements.categoryFilter.innerHTML = [
    `<option value="">Tutte</option>`,
    ...finalCategories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
  ].join("");

  elements.priceCategorySelect.innerHTML = [
    `<option value="">Seleziona categoria</option>`,
    ...finalCategories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
  ].join("");

  setSelectValue(elements.categoryFilter, currentCategoryFilter);
  setSelectValue(elements.priceCategorySelect, currentPriceCategory);
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
      const uniqueRetailerRows = new Map();
      group.rows.forEach((row) => {
        const retailerKey = String(row.retailer_id ?? row.retailer_name ?? "");
        const existingRow = uniqueRetailerRows.get(retailerKey);
        if (!existingRow) {
          uniqueRetailerRows.set(retailerKey, row);
          return;
        }

        const existingDate = new Date(existingRow.created_at || 0).getTime();
        const currentDate = new Date(row.created_at || 0).getTime();
        if (currentDate >= existingDate) {
          uniqueRetailerRows.set(retailerKey, row);
        }
      });

      const rows = [...uniqueRetailerRows.values()].sort((a, b) => {
        const retailerA = a.retailer_name || "";
        const retailerB = b.retailer_name || "";
        return retailerA.localeCompare(retailerB, "it");
      });

      const savedRetailerId = state.selectedRetailerByProduct[group.product];
      const selectedRow = rows.find((row) => String(row.retailer_id) === String(savedRetailerId))
        || rows[0];

      return {
        product: group.product,
        rows,
        selectedRetailerId: String(selectedRow.retailer_id),
        selectedRow
      };
    })
    .sort((a, b) => a.product.localeCompare(b.product, "it"));
}

function applyFilters() {
  const search = elements.searchInput.value.trim().toLowerCase();
  const retailerId = elements.retailerFilter.value;
  const category = elements.categoryFilter.value;

  const groupedProducts = buildProductGroups();
  state.filteredProducts = groupedProducts.filter((group) => {
    const haystack = group.rows
      .flatMap((row) => [
        row.prodotto,
        row.prezzo,
        row.categoria,
        row.retailer_name,
        `${row.prodotto}-${row.retailer_name || ""}`
      ])
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (search && !haystack.includes(search)) return false;
    if (retailerId && !group.rows.some((row) => String(row.retailer_id) === retailerId)) return false;
    if (category && !group.rows.some((row) => row.categoria === category)) return false;
    return true;
  });

  renderRows();
}

function renderRows() {
  if (!state.filteredProducts.length) {
    elements.rowsBody.innerHTML = `<tr><td colspan="${TABLE_COLUMN_COUNT}">Nessuna riga trovata.</td></tr>`;
    elements.tableCounter.textContent = "0 prodotti";
    return;
  }

  elements.rowsBody.innerHTML = state.filteredProducts.map((group) => {
    const row = group.selectedRow;
    const retailerOptions = group.rows.map((optionRow) => `
      <option value="${optionRow.retailer_id}" ${String(optionRow.retailer_id) === group.selectedRetailerId ? "selected" : ""}>
        ${escapeHtml(optionRow.retailer_name)}
      </option>
    `).join("");

    return `
      <tr>
        <td>${escapeHtml(group.product)}</td>
        <td>
          <select class="row-retailer-select" data-product="${escapeHtml(group.product)}">
            ${retailerOptions}
          </select>
        </td>
        <td>${escapeHtml(row.categoria || "-")}</td>
        <td>${escapeHtml(row.prezzo)}</td>
        <td>
          <div class="row-actions">
            <button
              type="button"
              class="icon-button"
              data-action="edit-row"
              data-row-id="${row.id}"
              aria-label="Modifica ${escapeHtml(group.product)} presso ${escapeHtml(row.retailer_name)}"
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
              aria-label="Cancella ${escapeHtml(group.product)} presso ${escapeHtml(row.retailer_name)}"
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

  elements.tableCounter.textContent = `${state.filteredProducts.length} prodotti`;
}

async function loadRetailers() {
  const { data, error } = await supabaseClient
    .from("retailers")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw error;
  state.retailers = data || [];
  renderRetailerControls();
}

async function loadRows() {
  const { data, error } = await supabaseClient
    .from("listino_prezzi_raw")
    .select(`
      id,
      prodotto,
      retailer_id,
      categoria,
      prezzo,
      created_at
    `)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;

  const retailerMap = new Map(state.retailers.map((retailer) => [String(retailer.id), retailer.name]));
  state.rows = (data || []).map((row) => ({
    ...row,
    retailer_name: retailerMap.get(String(row.retailer_id)) || "-"
  }));

  if (state.editingRowId && !findRowById(state.editingRowId)) {
    setPriceFormMode("create");
  }

  renderCategoryOptions();
  applyFilters();
}

async function refreshData() {
  clearFeedback();
  try {
    await loadRetailers();
    await loadRows();
  } catch (error) {
    showTableMessage(`Errore nel caricamento dati: ${error.message}`);
    showFeedback(`Errore nel caricamento dati: ${error.message}`, "error");
  }
}

async function resolveRetailerForSubmit() {
  const newRetailerName = String(state.retailerSearchTerm || "").trim();
  if (newRetailerName) {
    const existingRetailer = findRetailerByName(newRetailerName);
    if (existingRetailer) {
      state.retailerSearchTerm = "";
      setFormRetailerSelection(existingRetailer.id);
      return {
        retailerId: Number(existingRetailer.id),
        retailerName: existingRetailer.name,
        created: false
      };
    }

    const hasPartialRetailers = state.retailers.some((retailer) => retailer.name.toLowerCase().includes(newRetailerName.toLowerCase()));
    if (hasPartialRetailers) {
      throw new Error("Seleziona un retailer dalla lista oppure continua a digitare fino a non trovare risultati.");
    }

    const { data, error } = await supabaseClient
      .from("retailers")
      .insert([{ name: newRetailerName }])
      .select("id, name")
      .single();

    if (error) {
      throw new Error(`Creazione retailer fallita: ${error.message}`);
    }

    await loadRetailers();
    state.retailerSearchTerm = "";
    setFormRetailerSelection(data.id);
    return {
      retailerId: Number(data.id),
      retailerName: data.name,
      created: true
    };
  }

  const selectedRetailerId = Number(state.formRetailerId || elements.retailerHiddenInput.value);
  if (!selectedRetailerId) {
    return {
      retailerId: null,
      retailerName: null,
      created: false
    };
  }

  const retailer = state.retailers.find((item) => String(item.id) === String(selectedRetailerId));
  return {
    retailerId: selectedRetailerId,
    retailerName: retailer?.name || null,
    created: false
  };
}

async function testRetailersQuery() {
  if (!supabaseClient) {
    throw new Error("Client Supabase non inizializzato.");
  }

  return supabaseClient
    .from("retailers")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(5);
}

async function testRowsQuery() {
  if (!supabaseClient) {
    throw new Error("Client Supabase non inizializzato.");
  }

  return supabaseClient
    .from("listino_prezzi_raw")
    .select("id, prodotto, retailer_id, categoria, prezzo, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
}

async function handlePriceSubmit(event) {
  event.preventDefault();
  clearFeedback();

  const formData = new FormData(event.currentTarget);
  const prodotto = String(formData.get("prodotto") || "").trim();
  const categoria = String(formData.get("categoria") || "").trim() || null;
  const prezzo = String(formData.get("prezzo") || "").trim();
  let retailerInfo;

  try {
    retailerInfo = await resolveRetailerForSubmit();
  } catch (error) {
    showFeedback(error.message, "error");
    return;
  }

  const retailerId = retailerInfo.retailerId;

  if (!prodotto || !retailerId || !prezzo) {
    showFeedback("Compila prodotto, retailer e prezzo.", "error");
    return;
  }

  const parsedPrice = parsePriceText(prezzo);
  const payload = {
    prodotto,
    retailer_id: retailerId,
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
      .eq("id", editingRowId);

    if (error) {
      showFeedback(`Aggiornamento riga fallito: ${error.message}`, "error");
      return;
    }

    if (previousRow && previousRow.prodotto !== prodotto) {
      delete state.selectedRetailerByProduct[previousRow.prodotto];
    }

    state.selectedRetailerByProduct[prodotto] = String(retailerId);
    setPriceFormMode("create");
    await refreshData();
    showFeedback(retailerInfo.created
      ? `Retailer "${retailerInfo.retailerName}" creato e riga listino aggiornata.`
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

  state.selectedRetailerByProduct[prodotto] = String(retailerId);
  setPriceFormMode("create");
  await loadRows();
  showFeedback(retailerInfo.created
    ? `Retailer "${retailerInfo.retailerName}" creato e riga listino salvata.`
    : "Riga listino salvata con successo.");
}

function handleCancelEdit() {
  clearFeedback();
  setPriceFormMode("create");
}

function handleRetailerDropdownToggle() {
  if (state.retailerDropdownOpen) {
    closeRetailerDropdown();
    return;
  }

  openRetailerDropdown();
}

function handleRetailerDropdownSearch(event) {
  state.retailerSearchTerm = String(event.target.value || "").trim();
  if (state.retailerSearchTerm) {
    state.formRetailerId = "";
    elements.retailerHiddenInput.value = "";
  }
  renderRetailerList();
}

function handleRetailerDropdownOptionClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const button = target.closest("button[data-retailer-id]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const retailerId = button.dataset.retailerId;
  if (!retailerId) {
    return;
  }

  state.retailerSearchTerm = "";
  elements.retailerDropdownSearch.value = "";
  setFormRetailerSelection(retailerId);
  closeRetailerDropdown();
}

function handleDocumentClick(event) {
  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (!elements.retailerDropdown.contains(target)) {
    closeRetailerDropdown();
  }
}

function handleDocumentKeydown(event) {
  if (event.key === "Escape") {
    closeRetailerDropdown();
  }
}

function handleRowRetailerChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement) || !target.classList.contains("row-retailer-select")) {
    return;
  }

  const product = target.dataset.product;
  if (!product) {
    return;
  }

  state.selectedRetailerByProduct[product] = target.value;
  applyFilters();
}

async function handleDeleteRow(rowId) {
  clearFeedback();

  const row = findRowById(rowId);
  if (!row) {
    showFeedback("Riga non trovata per la cancellazione.", "error");
    return;
  }

  const confirmMessage = `Vuoi cancellare "${row.prodotto}" per "${row.retailer_name}"?`;
  if (!window.confirm(confirmMessage)) {
    return;
  }

  const { error } = await supabaseClient
    .from("listino_prezzi_raw")
    .delete()
    .eq("id", rowId);

  if (error) {
    showFeedback(`Cancellazione fallita: ${error.message}`, "error");
    return;
  }

  delete state.selectedRetailerByProduct[row.prodotto];
  if (String(state.editingRowId) === String(rowId)) {
    setPriceFormMode("create");
  }

  await refreshData();
  showFeedback(`Riga "${row.prodotto}" per "${row.retailer_name}" cancellata.`);
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
    elements.priceForm.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (button.dataset.action === "delete-row") {
    await handleDeleteRow(rowId);
  }
}

function bindEvents() {
  elements.priceForm.addEventListener("submit", handlePriceSubmit);
  elements.priceCancelButton.addEventListener("click", handleCancelEdit);
  elements.refreshButton.addEventListener("click", refreshData);
  elements.retailerDropdownButton.addEventListener("click", handleRetailerDropdownToggle);
  elements.retailerDropdownSearch.addEventListener("input", handleRetailerDropdownSearch);
  elements.retailerDropdownOptions.addEventListener("click", handleRetailerDropdownOptionClick);
  elements.rowsBody.addEventListener("change", handleRowRetailerChange);
  elements.rowsBody.addEventListener("click", handleRowActionClick);
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);

  elements.searchInput.addEventListener("input", applyFilters);
  elements.retailerFilter.addEventListener("change", applyFilters);
  elements.categoryFilter.addEventListener("change", applyFilters);
}

async function bootstrap() {
  try {
    supabaseClient = createSupabaseClient();
    window.listinoDebug = {
      testRetailersQuery,
      testRowsQuery,
      refreshData
    };
    bindEvents();
    await refreshData();
  } catch (error) {
    showFatal(`Avvio app fallito: ${error.message}`);
  }
}

bootstrap();

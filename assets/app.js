const APP_VERSION = "20260316-6";
const TABLE_COLUMN_COUNT = 4;
window.__listinoVersion = APP_VERSION;

const state = {
  retailers: [],
  rows: [],
  filteredProducts: [],
  selectedRetailerByProduct: {}
};

const elements = {
  authState: document.querySelector("#auth-state"),
  refreshButton: document.querySelector("#refresh-button"),
  retailerForm: document.querySelector("#retailer-form"),
  priceForm: document.querySelector("#price-form"),
  retailerFilter: document.querySelector("#retailer-filter"),
  categoryFilter: document.querySelector("#category-filter"),
  newFilter: document.querySelector("#new-filter"),
  searchInput: document.querySelector("#search-input"),
  retailerSelect: document.querySelector("#retailer-select"),
  rowsBody: document.querySelector("#rows-body"),
  tableCounter: document.querySelector("#table-counter"),
  feedback: document.querySelector("#feedback")
};

if (elements.authState) {
  elements.authState.textContent = `JavaScript caricato (${APP_VERSION}), inizializzazione in corso...`;
}

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

function showFeedback(message, type = "success") {
  elements.feedback.textContent = message;
  elements.feedback.className = `feedback feedback-${type}`;
}

function clearFeedback() {
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
  const match = String(priceText || "").trim().match(/(-?\d+(?:[.,]\d+)?)\s*EUR?(?:\s*\/\s*([a-zA-Z]+))?/i)
    || String(priceText || "").trim().match(/(-?\d+(?:[.,]\d+)?)\s*€(?:\s*\/\s*([a-zA-Z]+))?/i);
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

function renderRetailerOptions() {
  const options = state.retailers
    .map((retailer) => `<option value="${retailer.id}">${escapeHtml(retailer.name)}</option>`)
    .join("");

  elements.retailerSelect.innerHTML = `<option value="">Seleziona retailer</option>${options}`;
  elements.retailerFilter.innerHTML = `<option value="">Tutti</option>${options}`;
}

function renderCategoryOptions() {
  const categories = [...new Set(
    state.rows
      .map((row) => row.categoria)
      .filter(Boolean)
      .map((value) => String(value).trim())
  )].sort((a, b) => a.localeCompare(b, "it"));

  elements.categoryFilter.innerHTML = [
    `<option value="">Tutte</option>`,
    ...categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
  ].join("");
}

function applyFilters() {
  const search = elements.searchInput.value.trim().toLowerCase();
  const retailerId = elements.retailerFilter.value;
  const category = elements.categoryFilter.value;
  const onlyNew = elements.newFilter.checked;

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
    if (onlyNew && !group.rows.some((row) => row.is_new)) return false;
    return true;
  });

  renderRows();
}

function buildProductGroups() {
  const productMap = new Map();

  state.rows.forEach((row) => {
    const key = row.prodotto;
    if (!productMap.has(key)) {
      productMap.set(key, {
        product: key,
        rows: []
      });
    }
    productMap.get(key).rows.push(row);
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

      const rows = [...uniqueRetailerRows.values()];
      rows.sort((a, b) => {
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
  renderRetailerOptions();
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
      is_new,
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

async function handleRetailerSubmit(event) {
  event.preventDefault();
  clearFeedback();

  const formEl = event.currentTarget;
  const formData = new FormData(formEl);
  const name = String(formData.get("name") || "").trim();
  if (!name) {
    showFeedback("Inserisci il nome del retailer.", "error");
    return;
  }

  const { error } = await supabaseClient
    .from("retailers")
    .insert([{ name }]);

  if (error) {
    showFeedback(`Salvataggio retailer fallito: ${error.message}`, "error");
    return;
  }

  formEl.reset();
  await loadRetailers();
  showFeedback(`Retailer "${name}" aggiunto con successo.`);
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
    .select("id, prodotto, retailer_id, categoria, prezzo, is_new, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
}

async function handlePriceSubmit(event) {
  event.preventDefault();
  clearFeedback();

  const formEl = event.currentTarget;
  const formData = new FormData(formEl);
  const prodotto = String(formData.get("prodotto") || "").trim();
  const retailerId = Number(formData.get("retailer_id"));
  const categoria = String(formData.get("categoria") || "").trim() || null;
  const prezzo = String(formData.get("prezzo") || "").trim();
  const isNew = formData.get("is_new") === "on";

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
    is_new: isNew,
    prezzo_valore: parsedPrice.value,
    prezzo_unita: parsedPrice.unit
  };

  const { error } = await supabaseClient
    .from("listino_prezzi_raw")
    .insert([payload]);

  if (error) {
    showFeedback(`Salvataggio riga fallito: ${error.message}`, "error");
    return;
  }

  formEl.reset();
  await loadRows();
  showFeedback("Riga listino salvata con successo.");
}

function bindEvents() {
  elements.retailerForm.addEventListener("submit", handleRetailerSubmit);
  elements.priceForm.addEventListener("submit", handlePriceSubmit);
  elements.refreshButton.addEventListener("click", refreshData);
  elements.rowsBody.addEventListener("change", handleRowRetailerChange);

  elements.searchInput.addEventListener("input", applyFilters);
  elements.retailerFilter.addEventListener("change", applyFilters);
  elements.categoryFilter.addEventListener("change", applyFilters);
  elements.newFilter.addEventListener("change", applyFilters);
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

const { supabaseUrl, supabaseKey } = window.APP_CONFIG;
const { createClient } = window.supabase;
const supabase = createClient(supabaseUrl, supabaseKey);

const state = {
  retailers: [],
  rows: [],
  filteredRows: []
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

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

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

  state.filteredRows = state.rows.filter((row) => {
    const haystack = [
      row.prodotto,
      row.prezzo,
      row.categoria,
      row.retailers?.name,
      `${row.prodotto}-${row.retailers?.name || ""}`
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (search && !haystack.includes(search)) return false;
    if (retailerId && String(row.retailer_id) !== retailerId) return false;
    if (category && row.categoria !== category) return false;
    if (onlyNew && !row.is_new) return false;
    return true;
  });

  renderRows();
}

function renderRows() {
  if (!state.filteredRows.length) {
    elements.rowsBody.innerHTML = `<tr><td colspan="7">Nessuna riga trovata.</td></tr>`;
    elements.tableCounter.textContent = "0 righe";
    return;
  }

  elements.rowsBody.innerHTML = state.filteredRows.map((row) => {
    const retailerName = row.retailers?.name || "-";
    const prodRiv = `${row.prodotto}-${retailerName}`;
    return `
      <tr>
        <td>${escapeHtml(row.prodotto)}</td>
        <td>${escapeHtml(retailerName)}</td>
        <td>${escapeHtml(prodRiv)}</td>
        <td>${escapeHtml(row.categoria || "-")}</td>
        <td>${escapeHtml(row.prezzo)}</td>
        <td>${row.is_new ? `<span class="tag-new">Y</span>` : "N"}</td>
        <td><span class="row-meta">${escapeHtml(formatDate(row.created_at))}</span></td>
      </tr>
    `;
  }).join("");

  elements.tableCounter.textContent = `${state.filteredRows.length} righe`;
}

async function loadRetailers() {
  const { data, error } = await supabase
    .from("retailers")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw error;
  state.retailers = data || [];
  renderRetailerOptions();
}

async function loadRows() {
  const { data, error } = await supabase
    .from("listino_prezzi_raw")
    .select(`
      id,
      prodotto,
      retailer_id,
      categoria,
      prezzo,
      is_new,
      created_at,
      retailers ( id, name )
    `)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;
  state.rows = data || [];
  renderCategoryOptions();
  applyFilters();
}

async function refreshData() {
  clearFeedback();
  try {
    await Promise.all([loadRetailers(), loadRows()]);
  } catch (error) {
    showFeedback(`Errore nel caricamento dati: ${error.message}`, "error");
  }
}

async function handleRetailerSubmit(event) {
  event.preventDefault();
  clearFeedback();

  const formData = new FormData(event.currentTarget);
  const name = String(formData.get("name") || "").trim();
  if (!name) {
    showFeedback("Inserisci il nome del retailer.", "error");
    return;
  }

  const { error } = await supabase
    .from("retailers")
    .insert([{ name }]);

  if (error) {
    showFeedback(`Salvataggio retailer fallito: ${error.message}`, "error");
    return;
  }

  event.currentTarget.reset();
  await loadRetailers();
  showFeedback(`Retailer "${name}" aggiunto con successo.`);
}

async function handlePriceSubmit(event) {
  event.preventDefault();
  clearFeedback();

  const formData = new FormData(event.currentTarget);
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

  const { error } = await supabase
    .from("listino_prezzi_raw")
    .insert([payload]);

  if (error) {
    showFeedback(`Salvataggio riga fallito: ${error.message}`, "error");
    return;
  }

  event.currentTarget.reset();
  await loadRows();
  showFeedback("Riga listino salvata con successo.");
}

function bindEvents() {
  elements.retailerForm.addEventListener("submit", handleRetailerSubmit);
  elements.priceForm.addEventListener("submit", handlePriceSubmit);
  elements.refreshButton.addEventListener("click", refreshData);

  elements.searchInput.addEventListener("input", applyFilters);
  elements.retailerFilter.addEventListener("change", applyFilters);
  elements.categoryFilter.addEventListener("change", applyFilters);
  elements.newFilter.addEventListener("change", applyFilters);
}

async function bootstrap() {
  bindEvents();
  await refreshData();
}

bootstrap();

import { compareTextValues, getSortablePriceValue } from "./utils.js";

function compareRowsByBestPrice(rowA, rowB) {
  const priceA = getSortablePriceValue(rowA);
  const priceB = getSortablePriceValue(rowB);
  if (priceA !== priceB) {
    return priceA - priceB;
  }

  const nameA = String(rowA?.Store_name || "");
  const nameB = String(rowB?.Store_name || "");
  return nameA.localeCompare(nameB, "it");
}

function buildSelectionSignature(selectedStoreByProduct) {
  return Object.entries(selectedStoreByProduct)
    .filter(([, retailerId]) => retailerId !== undefined && retailerId !== null && retailerId !== "")
    .sort(([productA], [productB]) => productA.localeCompare(productB, "it"))
    .map(([product, retailerId]) => `${product}:${retailerId}`)
    .join("|");
}

export function createProductGroupsSelector() {
  let previousRowsRef = null;
  let previousSelectionSignature = "";
  let previousResult = [];

  return function selectProductGroups(rows, selectedStoreByProduct) {
    const selectionSignature = buildSelectionSignature(selectedStoreByProduct);
    if (rows === previousRowsRef && selectionSignature === previousSelectionSignature) {
      return previousResult;
    }

    const productMap = new Map();

    rows.forEach((row) => {
      const productKey = row.prodotto;
      if (!productMap.has(productKey)) {
        productMap.set(productKey, {
          product: productKey,
          rows: []
        });
      }
      productMap.get(productKey).rows.push(row);
    });

    previousResult = [...productMap.values()]
      .map((group) => {
        const uniqueStoreRows = new Map();
        group.rows.forEach((row) => {
          const StoreKey = String(row.retailer_id ?? row.Store_name ?? "");
          const existingRow = uniqueStoreRows.get(StoreKey);
          if (!existingRow) {
            uniqueStoreRows.set(StoreKey, row);
            return;
          }

          const existingDate = new Date(existingRow.created_at || 0).getTime();
          const currentDate = new Date(row.created_at || 0).getTime();
          if (currentDate >= existingDate) {
            uniqueStoreRows.set(StoreKey, row);
          }
        });

        const groupRows = [...uniqueStoreRows.values()].sort(compareRowsByBestPrice);
        const savedStoreId = selectedStoreByProduct[group.product];
        const selectedRow = groupRows.find((row) => String(row.retailer_id) === String(savedStoreId))
          || groupRows[0];

        return {
          product: group.product,
          rows: groupRows,
          selectedStoreId: String(selectedRow.retailer_id),
          selectedRow
        };
      })
      .sort((a, b) => compareTextValues(a.product, b.product));

    previousRowsRef = rows;
    previousSelectionSignature = selectionSignature;
    return previousResult;
  };
}

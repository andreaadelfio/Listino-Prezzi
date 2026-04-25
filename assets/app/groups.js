import { compareTextValues, getSortablePriceValue } from "./utils.js";

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

function buildSelectionSignature(selectedRivenditoreByProduct) {
  return Object.entries(selectedRivenditoreByProduct)
    .filter(([, retailerId]) => retailerId !== undefined && retailerId !== null && retailerId !== "")
    .sort(([productA], [productB]) => productA.localeCompare(productB, "it"))
    .map(([product, retailerId]) => `${product}:${retailerId}`)
    .join("|");
}

export function createProductGroupsSelector() {
  let previousRowsRef = null;
  let previousSelectionSignature = "";
  let previousResult = [];

  return function selectProductGroups(rows, selectedRivenditoreByProduct) {
    const selectionSignature = buildSelectionSignature(selectedRivenditoreByProduct);
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

        const groupRows = [...uniqueRivenditoreRows.values()].sort(compareRowsByBestPrice);
        const savedRivenditoreId = selectedRivenditoreByProduct[group.product];
        const selectedRow = groupRows.find((row) => String(row.retailer_id) === String(savedRivenditoreId))
          || groupRows[0];

        return {
          product: group.product,
          rows: groupRows,
          selectedRivenditoreId: String(selectedRow.retailer_id),
          selectedRow
        };
      })
      .sort((a, b) => compareTextValues(a.product, b.product));

    previousRowsRef = rows;
    previousSelectionSignature = selectionSignature;
    return previousResult;
  };
}

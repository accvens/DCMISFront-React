import { normalizeCatalogProductRow } from "./catalogProductRow.js";

function extractListItems(res) {
  if (!res || typeof res !== "object") {
    return [];
  }
  if (Array.isArray(res)) {
    return res;
  }
  const keys = ["items", "results", "data", "content", "records", "rows", "list"];
  for (const k of keys) {
    const v = res[k];
    if (Array.isArray(v)) {
      return v;
    }
    if (v && typeof v === "object" && Array.isArray(v.items)) {
      return v.items;
    }
    if (v && typeof v === "object" && Array.isArray(v.results)) {
      return v.results;
    }
  }
  return [];
}

/**
 * Load every row from a paginated list API (`{ items, total_pages?, page_size? }`).
 * Uses page_size=100 so older APIs that cap at 100 still work.
 */
export async function fetchAllListItems(apiRequest, listPath, requestOpts, options = {}) {
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 200;
  const items = [];
  let page = 1;
  let lastResponse = null;

  for (;;) {
    const res = await apiRequest(`${listPath}?page=${page}&page_size=${pageSize}`, requestOpts);
    lastResponse = res;
    let batch = extractListItems(res);
    if (
      batch.length === 0 &&
      res &&
      typeof res === "object" &&
      String(listPath || "").includes("/masters/products")
    ) {
      for (const val of Object.values(res)) {
        if (!Array.isArray(val) || val.length === 0) {
          continue;
        }
        const first = val[0];
        if (
          first &&
          typeof first === "object" &&
          (first.product_id != null ||
            first.productId != null ||
            first.id != null ||
            first.product_name != null ||
            first.productName != null)
        ) {
          batch = val;
          break;
        }
      }
    }
    items.push(...batch);

    const totalPages = Number(res?.total_pages);
    const doneByCount = batch.length < pageSize;
    const doneByMeta = Number.isFinite(totalPages) && totalPages >= 1 && page >= totalPages;

    if (doneByCount || doneByMeta || page >= maxPages) {
      break;
    }
    page += 1;
  }

  const path = String(listPath || "");
  if (path.includes("/masters/products")) {
    const normalized = items.map((row) => normalizeCatalogProductRow(row)).filter((row) => row != null);
    if (normalized.length === 0 && lastResponse && typeof lastResponse === "object") {
      for (const val of Object.values(lastResponse)) {
        if (!Array.isArray(val) || val.length === 0) {
          continue;
        }
        const first = val[0];
        if (
          first &&
          typeof first === "object" &&
          (first.product_id != null ||
            first.productId != null ||
            first.product_name != null ||
            first.productName != null)
        ) {
          return val.map((row) => normalizeCatalogProductRow(row)).filter((row) => row != null);
        }
      }
    }
    return normalized;
  }
  return items;
}

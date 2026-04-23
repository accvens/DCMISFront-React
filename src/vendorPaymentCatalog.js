import { vendorAssignedTypeIds } from "./assignedProductTypeIds.js";
import {
  catalogProductPrimaryId,
  catalogProductTypeId,
  catalogRowsHaveSelectableProductId,
  normalizeCatalogProductRow,
} from "./catalogProductRow.js";

function productTypeMasterId(row) {
  const id = Number(row?.id ?? row?.product_type_id ?? row?.productTypeId);
  return Number.isFinite(id) ? id : NaN;
}

/**
 * Normalize list-shaped API bodies (legacy payment-catalogue endpoint or odd proxies).
 */
/**
 * Legacy: payment catalogue embedded on vendor detail. Vendor GET no longer returns this; use
 * `/masters/vendors/{id}/payment-catalogue-products` or the masters products list if needed.
 */
export function extractVendorDetailPaymentCatalog(body) {
  if (!body || typeof body !== "object") {
    return [];
  }
  const p =
    body.payment_catalogue_products ??
    body.paymentCatalogueProducts ??
    (body.data && typeof body.data === "object"
      ? body.data.payment_catalogue_products ?? body.data.paymentCatalogueProducts
      : undefined);
  return Array.isArray(p) ? p : [];
}

export function productTypeNameByIdMap(productTypes) {
  const m = new Map();
  for (const t of productTypes || []) {
    const id = productTypeMasterId(t);
    if (Number.isFinite(id)) {
      m.set(id, String(t.product_name || t.type_name || "").trim() || `Type ${id}`);
    }
  }
  return m;
}

/** Optgroup label: prefer product_master `description` (e.g. Hotel Accommodation), else short name. */
export function productTypeOptgroupLabelByIdMap(productTypes) {
  const m = new Map();
  for (const t of productTypes || []) {
    const id = productTypeMasterId(t);
    if (!Number.isFinite(id)) {
      continue;
    }
    const desc = String(t.description ?? "").trim();
    const name = String(t.product_name || t.type_name || "").trim();
    const label = desc || name;
    if (label) {
      m.set(id, label);
    }
  }
  return m;
}

/**
 * Labels from merged vendor row `assigned_product_types` when present (e.g. cached legacy), else masters only.
 * Same order as `assigned_product_type_ids` when `product_type_id` is omitted on each brief (legacy).
 */
export function productTypeOptgroupLabelMapFromVendorDetail(vendorRow) {
  const m = new Map();
  if (!vendorRow || typeof vendorRow !== "object") {
    return m;
  }
  const ids = vendorAssignedTypeIds(vendorRow);
  const briefs = vendorRow.assigned_product_types ?? vendorRow.assignedProductTypes;
  if (!Array.isArray(briefs)) {
    return m;
  }
  briefs.forEach((b, i) => {
    const id = Number(b?.product_type_id ?? b?.productTypeId ?? ids[i]);
    if (!Number.isFinite(id)) {
      return;
    }
    const desc = String(b?.description ?? "").trim();
    const name = String(b?.product_name ?? b?.type_name ?? "").trim();
    const label = desc || name;
    if (label) {
      m.set(id, label);
    }
  });
  return m;
}

function mergeProductTypeLabelMaps(fromMasters, fromVendorDetail) {
  const m = new Map(fromMasters);
  for (const [id, label] of fromVendorDetail) {
    const t = String(label ?? "").trim();
    if (t) {
      m.set(id, t);
    }
  }
  return m;
}

/**
 * Group vendor payment catalogue rows for <optgroup> by vendor type order (`vendor_products` / assigned ids).
 */
export function vendorPaymentProductSelectGroups(lineCatalogProducts, vendorRow, productTypes) {
  const assignedIds = vendorAssignedTypeIds(vendorRow);
  const typeLabels = mergeProductTypeLabelMaps(
    productTypeOptgroupLabelByIdMap(productTypes),
    productTypeOptgroupLabelMapFromVendorDetail(vendorRow),
  );
  const optgroupTitle = (typeId) => {
    const label = typeLabels.get(typeId);
    return (label && String(label).trim()) || "Products";
  };
  const rawRows = lineCatalogProducts || [];
  const withPid = rawRows.filter(
    (item) =>
      item &&
      catalogProductPrimaryId(item) != null &&
      String(catalogProductPrimaryId(item)).trim() !== "",
  );
  const rows = withPid.length > 0 ? withPid : rawRows;
  const normalizedRows = rows.map((r) => normalizeCatalogProductRow(r)).filter(Boolean);

  if (!assignedIds.length) {
    return [{ key: "flat", label: null, items: normalizedRows.length ? normalizedRows : rows }];
  }

  const byType = new Map();
  for (const item of normalizedRows.length ? normalizedRows : rows) {
    const tid = catalogProductTypeId(item);
    const key = Number.isFinite(tid) ? tid : "__other";
    if (!byType.has(key)) {
      byType.set(key, []);
    }
    byType.get(key).push(item);
  }

  const groups = [];
  const used = new Set();
  for (const tid of assignedIds) {
    const n = Number(tid);
    if (!Number.isFinite(n)) {
      continue;
    }
    const items = byType.get(n) || [];
    if (items.length === 0) {
      continue;
    }
    used.add(n);
    groups.push({
      key: `type-${n}`,
      label: optgroupTitle(n),
      items,
    });
  }

  for (const [k, items] of byType.entries()) {
    if (k === "__other" || used.has(Number(k))) {
      continue;
    }
    const n = Number(k);
    if (!items.length) {
      continue;
    }
    groups.push({
      key: `type-${n}-extra`,
      label: optgroupTitle(n),
      items,
    });
    used.add(n);
  }

  if (byType.has("__other") && (byType.get("__other") || []).length > 0) {
    groups.push({ key: "type-other", label: "Other", items: byType.get("__other") });
  }

  if (groups.length === 0 && rows.length > 0) {
    return [{ key: "flat", label: null, items: normalizedRows.length ? normalizedRows : rows }];
  }

  return groups;
}

export function extractPaymentCatalogArray(data) {
  if (data == null) {
    return [];
  }
  if (Array.isArray(data)) {
    return data;
  }
  if (typeof data === "object") {
    const keys = ["items", "results", "data", "content", "records", "rows", "list"];
    for (const k of keys) {
      const v = data[k];
      if (Array.isArray(v)) {
        return v;
      }
    }
  }
  return [];
}

/**
 * Merge payment-catalogue API rows with full masters rows so selects always have labels and stable ids.
 * `masterById` is Map<string, object> keyed by catalogue product_id string.
 */
export function mergeVendorPaymentCatalogRows(rows, masterById) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return rows;
  }
  if (!(masterById instanceof Map) || masterById.size === 0) {
    return rows.map((r) => normalizeCatalogProductRow(r)).filter(Boolean);
  }
  const merged = rows.map((row) => {
    const normalized = normalizeCatalogProductRow(row);
    const cur = normalized ?? row;
    const pid = String(catalogProductPrimaryId(cur) ?? cur?.product_id ?? "").trim();
    if (!pid) {
      return cur;
    }
    const master = masterById.get(pid);
    if (!master) {
      return cur;
    }
    const merged = {
      ...master,
      ...row,
      product_id: pid,
      product_type_id: cur.product_type_id ?? master.product_type_id,
      product_name:
        (cur.product_name && String(cur.product_name).trim()) ||
        (cur.productName && String(cur.productName).trim()) ||
        master.product_name ||
        master.productName ||
        "",
      vendor_id: cur.vendor_id ?? cur.vendorId ?? master.vendor_id ?? master.vendorId,
      destination: cur.destination ?? master.destination,
      price: cur.price != null && cur.price !== "" ? cur.price : master.price,
    };
    return normalizeCatalogProductRow(merged) ?? merged;
  });
  return merged.filter(Boolean);
}

/**
 * Prefer vendor-detail catalogue rows when present; if merged rows cannot populate a product
 * select (no stable ids), merge the fallback masters list instead.
 */
export function mergeVendorPaymentPickerRows(apiRows, fallbackRows, masterById) {
  const safeFallback = Array.isArray(fallbackRows) ? fallbackRows : [];
  const picked =
    apiRows !== undefined ? (apiRows.length > 0 ? apiRows : safeFallback) : safeFallback;
  const merged = mergeVendorPaymentCatalogRows(picked, masterById);
  if (catalogRowsHaveSelectableProductId(merged)) {
    return merged;
  }
  const mergedFallback = mergeVendorPaymentCatalogRows(safeFallback, masterById);
  if (catalogRowsHaveSelectableProductId(mergedFallback)) {
    return mergedFallback;
  }
  if (masterById instanceof Map && masterById.size > 0) {
    const pool = Array.from(masterById.values());
    const mergedAll = mergeVendorPaymentCatalogRows(pool, masterById);
    if (catalogRowsHaveSelectableProductId(mergedAll)) {
      return mergedAll;
    }
  }
  return merged;
}

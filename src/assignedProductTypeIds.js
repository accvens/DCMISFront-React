/**
 * Vendor payment: read `product_type_id` from each `vendor_products` row, then filter masters products by those ids.
 */
import { catalogProductTypeId } from "./catalogProductRow.js";

/** Ordered type ids from `vendor_products` / `vendorProducts` (API snake_case or camelCase). */
export function typeIdsFromVendorProductLinks(vendorRow) {
  if (!vendorRow || typeof vendorRow !== "object") {
    return [];
  }
  const links = vendorRow.vendor_products ?? vendorRow.vendorProducts;
  if (!Array.isArray(links) || !links.length) {
    return [];
  }
  return links
    .map((row) => Number(row?.product_type_id ?? row?.productTypeId))
    .filter((x) => Number.isFinite(x));
}

/**
 * Match a booking line’s `vendor_id` (numeric id, or legacy name string) to a row from `/masters/vendors`.
 */
export function resolveVendorRow(vendors, lineVendorId) {
  const raw = String(lineVendorId ?? "").trim();
  if (!raw) {
    return undefined;
  }
  const list = Array.isArray(vendors) ? vendors : [];
  let hit = list.find((v) => String(v.id).trim() === raw);
  if (hit) {
    return hit;
  }
  hit = list.find((v) => String(v.vendor_id ?? "").trim() === raw);
  if (hit) {
    return hit;
  }
  const lower = raw.toLowerCase();
  return list.find((v) => String(v.vendor_name ?? "").trim().toLowerCase() === lower);
}

/** Assigned product master / type ids from a vendor row (snake_case or camelCase API). */
export function vendorAssignedTypeIds(vendorRow) {
  if (!vendorRow || typeof vendorRow !== "object") {
    return [];
  }
  const fromLinks = typeIdsFromVendorProductLinks(vendorRow);
  if (fromLinks.length) {
    return fromLinks;
  }
  const fromRaw = normalizeAssignedProductTypeIds(
    vendorRow.assigned_product_type_ids ?? vendorRow.assignedProductTypeIds,
  );
  if (fromRaw.length) {
    return fromRaw;
  }
  const types = vendorRow?.assigned_product_types ?? vendorRow?.assignedProductTypes;
  if (!Array.isArray(types) || !types.length) {
    return [];
  }
  const fromBriefs = types
    .map((t) => Number(t?.product_type_id ?? t?.productTypeId ?? t?.id))
    .filter((x) => Number.isFinite(x));
  return fromBriefs.length ? fromBriefs : [];
}

/**
 * Merge list vendor row with GET /masters/vendors/:id cache (`vendor_products` + assigned types briefs).
 */
export function mergeVendorRowWithPaymentDetailCache(base, vendorIdStr, cacheByVendorId) {
  const vid = String(vendorIdStr ?? "").trim();
  const entry = vid ? cacheByVendorId?.[vid] : undefined;
  if (!entry || typeof entry !== "object") {
    return base;
  }
  const links = entry.vendor_products ?? entry.vendorProducts;
  let ids = typeIdsFromVendorProductLinks(entry);
  if (!ids.length) {
    ids = normalizeAssignedProductTypeIds(entry.assigned_product_type_ids ?? entry.assignedProductTypeIds);
  }
  const briefs = entry.assigned_product_types ?? entry.assignedProductTypes;
  if (!ids.length && Array.isArray(briefs) && briefs.length) {
    ids = briefs
      .map((t) => Number(t?.product_type_id ?? t?.productTypeId ?? t?.id))
      .filter((x) => Number.isFinite(x));
  }
  const next = { ...(base || { vendor_name: "" }) };
  let touched = false;
  if (Array.isArray(links) && links.length) {
    next.vendor_products = links;
    touched = true;
  }
  if (ids.length) {
    next.assigned_product_type_ids = ids;
    touched = true;
  }
  if (Array.isArray(briefs) && briefs.length) {
    next.assigned_product_types = briefs;
    touched = true;
  }
  if ("credit_limit_days" in entry && entry.credit_limit_days != null) {
    next.credit_limit_days = entry.credit_limit_days;
    touched = true;
  }
  return touched ? next : base;
}

/**
 * Keep only masters catalogue rows whose product type is in the vendor’s
 * `vendor_products` (or merged `assigned_product_type_ids` / briefs when links are absent).
 * If the vendor has no assigned types, returns `products` unchanged.
 * If filtering would remove every row, returns the original list so the select stays usable.
 */
export function filterCatalogProductsByVendorAssignedTypes(products, vendorRow, hasVendorId) {
  const list = Array.isArray(products) ? products.filter(Boolean) : [];
  if (!hasVendorId) {
    return list;
  }
  const typeIds = vendorAssignedTypeIds(vendorRow);
  const set = new Set(typeIds);
  if (set.size === 0) {
    return list;
  }
  const narrowed = list.filter((p) => {
    const tid = catalogProductTypeId(p);
    return Number.isFinite(tid) && set.has(tid);
  });
  return narrowed.length > 0 ? narrowed : list;
}

/**
 * When GET /masters/vendors/:id returns `assigned_product_types` (names only), resolve type ids using
 * rows from GET /masters/vendors/product-type-assignment-catalog (type_name + product_type_id).
 */
export function vendorAssignedTypeIdsWithCatalog(vendorRow, typeAssignmentRows) {
  const fromIds = vendorAssignedTypeIds(vendorRow);
  if (fromIds.length) {
    return fromIds;
  }
  const types = vendorRow?.assigned_product_types ?? vendorRow?.assignedProductTypes;
  if (!Array.isArray(types) || !Array.isArray(typeAssignmentRows) || typeAssignmentRows.length === 0) {
    return [];
  }
  const out = [];
  for (const t of types) {
    const name = String(t.product_name ?? t.type_name ?? "").trim().toLowerCase();
    if (!name) {
      continue;
    }
    const row = typeAssignmentRows.find((r) => String(r.type_name ?? "").trim().toLowerCase() === name);
    if (row != null && Number.isFinite(Number(row.product_type_id))) {
      out.push(Number(row.product_type_id));
    }
  }
  return out;
}

export function normalizeAssignedProductTypeIds(raw) {
  if (raw == null) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.map((x) => Number(x)).filter((x) => Number.isFinite(x));
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) {
      return [];
    }
    if (s.startsWith("{") && s.endsWith("}")) {
      const inner = s.slice(1, -1).trim();
      if (!inner) {
        return [];
      }
      return inner
        .split(",")
        .map((t) => Number(t.trim()))
        .filter((x) => Number.isFinite(x));
    }
    if (s.startsWith("[")) {
      try {
        return normalizeAssignedProductTypeIds(JSON.parse(s));
      } catch {
        return [];
      }
    }
    const n = Number(s);
    return Number.isFinite(n) ? [n] : [];
  }
  const n = Number(raw);
  return Number.isFinite(n) ? [n] : [];
}

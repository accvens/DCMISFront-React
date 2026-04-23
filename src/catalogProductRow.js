/** Stable type id for Masters catalogue rows (ORM may expose `product_type_id` or legacy `product_master_id`). */
export function catalogProductTypeId(p) {
  const v = Number(
    p?.product_type_id ?? p?.productTypeId ?? p?.product_master_id ?? p?.productMasterId,
  );
  return Number.isFinite(v) ? v : NaN;
}

/** Primary key on a catalogue row for UI lists (snake_case or camelCase JSON). */
export function catalogProductPrimaryId(p) {
  if (!p || typeof p !== "object") {
    return null;
  }
  const candidates = [
    p.product_id,
    p.productId,
    p.id,
    p.catalog_product_id,
    p.catalogProductId,
    p.productID,
    p.product_pk,
  ];
  for (const raw of candidates) {
    if (raw != null && String(raw).trim() !== "") {
      return raw;
    }
  }
  return null;
}

/** Label for `<option>` / select lists: catalogue name plus optional product master (`product_master`) name. */
export function catalogProductPickerLabel(item) {
  if (!item || typeof item !== "object") {
    return "";
  }
  const pid = catalogProductPrimaryId(item);
  const pname = String(
    item.product_name ?? item.productName ?? (pid != null && pid !== "" ? `Product #${pid}` : ""),
  ).trim();
  const master = String(
    item.product_master_name ??
      item.productMasterName ??
      item.product_type_name ??
      item.productTypeName ??
      "",
  ).trim();
  return master ? `${pname} — ${master}` : pname;
}

/** True when at least one row has a stable catalogue id for a product picker. */
export function catalogRowsHaveSelectableProductId(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return false;
  }
  return rows.some((item) => {
    const raw = catalogProductPrimaryId(item) ?? item?.product_id ?? item?.productId ?? item?.id;
    return raw != null && String(raw).trim() !== "";
  });
}

/** Ensure list rows always expose `product_id`, `product_type_id`, `vendor_id`, and `product_name` for booking UI. */
export function normalizeCatalogProductRow(p) {
  if (!p || typeof p !== "object") {
    return null;
  }
  const product_id = catalogProductPrimaryId(p);
  const tid = catalogProductTypeId(p);
  const vendor_raw = p.vendor_id ?? p.vendorId;
  const vendor_id =
    vendor_raw === undefined || vendor_raw === null || vendor_raw === "" ? null : vendor_raw;
  const product_name = p.product_name ?? p.productName ?? p.name ?? "";
  const next = { ...p, vendor_id, product_name };
  if (product_id != null && product_id !== "") {
    next.product_id = product_id;
  }
  if (Number.isFinite(tid)) {
    next.product_type_id = tid;
  }
  return next;
}

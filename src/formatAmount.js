/** Strip grouping commas and spaces so values like 1,23,456.78 parse as numbers. */
export function stripAmountGrouping(raw) {
  if (raw == null) {
    return "";
  }
  return String(raw).replace(/,/g, "").replace(/\s/g, "").trim();
}

/** Parse a user-entered amount string (with optional grouping) for validation and math. */
export function parseAmountNumeric(raw) {
  const n = Number(stripAmountGrouping(String(raw ?? "")));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Plain amount string for inputs and form state: no digit grouping, rounded to paise,
 * no unnecessary trailing zeros (500 not 500.00; 12.5 not 12.50).
 */
export function formatAmountPlain(value) {
  if (value === "" || value == null) {
    return "";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "";
    }
    const r = Math.round(value * 100) / 100;
    const s = r.toFixed(2);
    if (s.endsWith(".00")) {
      return s.slice(0, -3);
    }
    if (s.endsWith("0") && s.includes(".")) {
      return s.slice(0, -1);
    }
    return s;
  }
  const raw = stripAmountGrouping(String(value).trim());
  if (raw === "") {
    return "";
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return raw;
  }
  return formatAmountPlain(n);
}

/**
 * Indian grouping for amount inputs when not focused; no forced ".00" on whole numbers.
 */
export function formatAmountInputGrouped(value) {
  const n = Number(stripAmountGrouping(String(value ?? "")));
  if (!Number.isFinite(n)) {
    return String(value ?? "");
  }
  const r = Math.round(n * 100) / 100;
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(r);
}

/**
 * Display amounts with Indian digit grouping (en-IN), always two fraction digits, no currency symbol.
 */
export function formatCurrency(value) {
  const n = Number(stripAmountGrouping(String(value ?? "")));
  const x = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(x);
}

/** Indian grouping with the rupee symbol (for user-facing validation copy). */
export function formatInrWithRupee(value) {
  const n = Number(stripAmountGrouping(String(value ?? "")));
  const x = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(x);
}

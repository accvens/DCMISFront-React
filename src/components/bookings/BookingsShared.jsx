import { useEffect, useMemo, useRef, useState } from "react";
import {
  AmountFormattedInput,
  ConfirmActionModal,
  FormModal,
  formatDate,
  SelectField,
  TextField,
} from "../access/AccessShared.jsx";
import {
  CustomerAutocomplete,
  TravelerAutocomplete,
  buildTravelersListUrl,
} from "../customers/CustomersShared.jsx";
import { BookingAlertMessage } from "./BookingAlertMessage.jsx";
import {
  normalizeAssignedProductTypeIds,
  resolveVendorRow,
  vendorAssignedTypeIds,
} from "../../assignedProductTypeIds.js";
import {
  catalogProductPickerLabel,
  catalogProductPrimaryId,
  catalogProductTypeId,
} from "../../catalogProductRow.js";
import {
  formatAmountPlain,
  formatCurrency,
  formatInrWithRupee,
  parseAmountNumeric,
  stripAmountGrouping,
} from "../../formatAmount.js";

export { formatDate };
export { formatCurrency };
export {
  filterCatalogProductsByVendorAssignedTypes,
  mergeVendorRowWithPaymentDetailCache,
  normalizeAssignedProductTypeIds,
  resolveVendorRow,
  vendorAssignedTypeIds,
} from "../../assignedProductTypeIds.js";
export { BookingsSubmenu } from "./BookingsSubmenu.jsx";

/** Shared with booking payment lines and standalone payments UI. */
export const PAYMENT_STATUS_OPTIONS = ["Pending", "Paid"];

/**
 * Customer / vendor payment line status for selects: only Pending and Paid are allowed.
 * Legacy `Partial` (and unknown values) map to Pending so controlled selects stay valid.
 */
export function normalizePaymentLineStatusForForm(status) {
  const s = String(status ?? "").trim();
  if (!s) {
    return "Pending";
  }
  const lower = s.toLowerCase();
  if (lower === "paid") {
    return "Paid";
  }
  if (lower === "pending") {
    return "Pending";
  }
  if (lower === "partial") {
    return "Pending";
  }
  return "Pending";
}

/** Booking workflow: incomplete order saved for later completion (backend + list). */
export const BOOKING_STATUS_DRAFT = "Draft";

/**
 * List UI: only Open / Closed.
 * - Closed = stored Completed
 * - Open = Pending, Draft, and any other non-completed state
 */
export const BOOKING_LIST_STATUS_OPTIONS = ["Open", "Closed"];

export function bookingListDisplayStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "completed") {
    return "Closed";
  }
  return "Open";
}

/** @deprecated Use {@link bookingListDisplayStatus} — list uses Open/Closed only. */
export function bookingListStatusSelectValue(status) {
  return bookingListDisplayStatus(status);
}

export function StatusBadge({ status, ...rest }) {
  let className = "bg-info-subtle text-info";
  const normalized = (status || "Unknown").toLowerCase();

  if (normalized === "confirmed" || normalized === "paid" || normalized === "completed") {
    className = "bg-success-subtle text-success";
  } else if (normalized === "closed") {
    className = "bg-success-subtle text-success";
  } else if (normalized === "open") {
    className = "bg-warning-subtle text-warning";
  } else if (normalized === "draft") {
    className = "bg-secondary-subtle text-secondary";
  } else if (
    normalized === "pending" ||
    normalized === "partial" ||
    normalized === "in progress"
  ) {
    className = "bg-warning-subtle text-warning";
  } else if (normalized === "cancelled") {
    className = "bg-danger-subtle text-danger";
  }

  return (
    <span className={`badge rounded-pill ${className} ta-status-badge`} {...rest}>
      {status || "Unknown"}
    </span>
  );
}

export function createMap(items, key) {
  return items.reduce((map, item) => {
    map[item[key]] = item;
    return map;
  }, {});
}

export function normDestLabel(value) {
  return String(value ?? "").trim();
}

function destLabelsMatch(a, b) {
  return normDestLabel(a).toLowerCase() === normDestLabel(b).toLowerCase();
}

/** Catalogue product rows scoped to a booking destination label (free text). */
export function productsForBookingDestination(products, destinationLabel) {
  const d = normDestLabel(destinationLabel);
  if (!d || !Array.isArray(products)) {
    return [];
  }
  return products.filter((p) => destLabelsMatch(p.destination, destinationLabel));
}

function escapeHtmlProforma(text) {
  if (text == null) {
    return "";
  }
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Proforma / invoice number when none is stored: PI-{id} with at least 3 digits (PI-001),
 * or PI-001 when the booking has no numeric id yet (e.g. unsaved draft print preview).
 */
export function formatBookingProformaInvoiceNumberFromId(bookingNumericId) {
  const s = String(bookingNumericId ?? "").trim();
  if (/^\d+$/.test(s)) {
    return `PI-${String(Number(s)).padStart(3, "0")}`;
  }
  return "PI-001";
}

/** Old server default: `%Y-%m-%d` + `%H:%M:%S` with no space (e.g. 2026-04-2211:01:51). */
function isLegacyProformaInvoiceAutonumber(raw) {
  const s = String(raw ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}\d{2}:\d{2}:\d{2}$/.test(s);
}

/** First customer payment row’s Sale PI / Rcpt no., or PI-001 when missing (same convention as the grid). */
function primarySalePiReceiptNoForProforma(form) {
  const lines = Array.isArray(form?.paymentLines) ? form.paymentLines : [];
  const s0 = String(lines[0]?.sale_pi_receipt_no ?? "").trim();
  return s0 || formatSalePiReceiptSequential(0);
}

/** Use Sale PI row 1 for proforma invoice number when blank, legacy autonumber, or old PI-{bookingId} style. */
function shouldSyncProformaInvoiceNumberToFirstSalePi(proformaNoRaw, resolvedBookingIdRaw) {
  const raw = String(proformaNoRaw ?? "").trim();
  if (!raw) {
    return true;
  }
  if (isLegacyProformaInvoiceAutonumber(raw)) {
    return true;
  }
  const idRaw = String(resolvedBookingIdRaw ?? "").trim();
  if (!/^\d+$/.test(idRaw)) {
    return false;
  }
  return raw.toLowerCase() === formatBookingProformaInvoiceNumberFromId(idRaw).toLowerCase();
}

function formatProformaLongDateLabel(iso) {
  if (!iso) {
    return "—";
  }
  const raw = String(iso).trim();
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return escapeHtmlProforma(formatDate(raw));
  }
  return escapeHtmlProforma(
    d.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }),
  );
}

/** Resolve logo/asset URL for print preview (about:blank needs absolute URLs; paths must use Vite base). */
function resolveProformaAbsoluteAssetUrl(raw) {
  const t = String(raw || "").trim();
  if (!t || typeof window === "undefined") {
    return "";
  }
  if (/^https?:\/\//i.test(t) || /^data:/i.test(t)) {
    return t;
  }
  if (t.startsWith("//")) {
    return `${window.location.protocol}${t}`;
  }
  const origin = window.location.origin;
  let baseHref = `${origin}/`;
  try {
    if (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) {
      baseHref = new URL(String(import.meta.env.BASE_URL || "/"), origin).href;
    }
  } catch {
    /* keep origin/ */
  }
  if (t.startsWith("/")) {
    try {
      return new URL(t, origin).href;
    } catch {
      return "";
    }
  }
  try {
    return new URL(t, baseHref).href;
  } catch {
    return "";
  }
}

/** Default print logo: `public/travel-logo-lg.jpeg` → `/travel-logo-lg.jpeg` (dev: http://localhost:5174/... ). */
const DEFAULT_PROFORMA_LOGO_PATH = "travel-logo-lg.jpeg";

function getProformaLogoAbsoluteUrlForPrint() {
  try {
    const fromEnv =
      typeof import.meta !== "undefined" && import.meta.env?.VITE_COMPANY_LOGO_URL
        ? String(import.meta.env.VITE_COMPANY_LOGO_URL).trim()
        : "";
    if (fromEnv) {
      return resolveProformaAbsoluteAssetUrl(fromEnv);
    }
  } catch {
    /* ignore */
  }
  const branded = resolveProformaAbsoluteAssetUrl(DEFAULT_PROFORMA_LOGO_PATH);
  if (branded) {
    return branded;
  }
  const favicon = resolveProformaAbsoluteAssetUrl("favicon.svg");
  if (favicon) {
    return favicon;
  }
  return resolveProformaAbsoluteAssetUrl("favicon.ico");
}

function proformaDueDateDisplay(form) {
  const lines = form.vendorPaymentLines || [];
  const dueDates = lines
    .map((l) => String(l.due_date || "").trim())
    .filter(Boolean)
    .sort();
  if (dueDates.length) {
    return formatProformaLongDateLabel(dueDates[0]);
  }
  if (form.travel_end_date) {
    return formatProformaLongDateLabel(form.travel_end_date);
  }
  if (form.travel_start_date) {
    return formatProformaLongDateLabel(form.travel_start_date);
  }
  return "—";
}

/**
 * Opens a printable proforma invoice from a booking-shaped form and catalogue state (draft or saved booking).
 * @param {unknown} [_options] Ignored (kept for call-site compatibility).
 */
export function openProformaInvoicePrintWindow(form, state, bookingId, _options) {
  const customers = state?.customers ?? [];
  const products = state?.products ?? [];

  const customer = customers.find((c) => String(c.id) === String(form.customer_id));
  const customerName = customer
    ? [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || "—"
    : "—";
  const destinationName = normDestLabel(form.destination) || "—";
  const productById = new Map(products.map((p) => [String(p.product_id), p]));

  const proformaNoRaw = String(form.proforma_invoice_number ?? "").trim();
  const resolvedBookingIdRaw =
    bookingId != null && String(bookingId).trim() !== ""
      ? String(bookingId).trim()
      : form?.id != null && String(form.id).trim() !== ""
        ? String(form.id).trim()
        : "";
  const resolvedBookingId = /^\d+$/.test(resolvedBookingIdRaw) ? resolvedBookingIdRaw : "";
  const salePiAsInvoiceNo = primarySalePiReceiptNoForProforma(form);
  const proformaNo = shouldSyncProformaInvoiceNumberToFirstSalePi(proformaNoRaw, resolvedBookingIdRaw)
    ? salePiAsInvoiceNo
    : proformaNoRaw;
  const proformaDate = String(form.proforma_invoice_date ?? "").trim();
  const drcNo = String(form.drc_no ?? "").trim();

  const configuredLines = (form.productLines || []).filter(
    (l) =>
      l.vendor_id &&
      (String(l.product_id || "").trim() || String(l.booking_product_type_id || "").trim()),
  );

  const lineRows = configuredLines
    .map((l) => {
      const p = productById.get(String(l.product_id));
      const desc =
        p?.product_name ||
        (String(l.booking_product_type_id || "").trim()
          ? `Product master #${l.booking_product_type_id}`
          : `Product #${l.product_id}`);
      const qty = String(l.quantity || "1").trim() || "1";
      return `<tr>
        <td>${escapeHtmlProforma(desc)}</td>
        <td class="num">${escapeHtmlProforma(qty)}</td>
        <td class="num">${escapeHtmlProforma(formatCurrency(l.price))}</td>
        <td class="num">${escapeHtmlProforma(formatCurrency(l.line_total))}</td>
      </tr>`;
    })
    .join("");

  const subtotalNum = configuredLines.reduce((sum, l) => {
    const n = parseBookingAmountNumber(l.line_total);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  const taxNum = configuredLines.reduce((sum, l) => {
    const n = parseBookingAmountNumber(l.gst_amount);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  const totalDueNum = parseBookingAmountNumber(form.total_amount);
  const totalDue =
    Number.isFinite(totalDueNum) && totalDueNum > 0 ? totalDueNum : subtotalNum + taxNum;

  const billAddressParts = [customer?.address, customer?.city, customer?.country].filter(
    (x) => String(x || "").trim(),
  );
  const billAddress = escapeHtmlProforma(
    billAddressParts.length ? billAddressParts.join(", ") : "—",
  );
  const billEmail = escapeHtmlProforma(String(customer?.email || "").trim() || "—");

  const logoUrlRaw = getProformaLogoAbsoluteUrlForPrint();
  const logoSrcAttr = logoUrlRaw ? escapeHtmlProforma(logoUrlRaw) : "";
  const companyName =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_COMPANY_NAME
      ? escapeHtmlProforma(String(import.meta.env.VITE_COMPANY_NAME).trim())
      : "";
  const displayName = companyName || escapeHtmlProforma("Travel Agency");
  const logoBlock = logoSrcAttr
    ? `<div class="logo-frame">
    <img class="company-logo" src="${logoSrcAttr}" alt="" decoding="async" referrerpolicy="no-referrer" onerror="this.style.display='none';var f=this.nextElementSibling;if(f)f.style.display='flex';" />
    <div class="logo-fallback" style="display:none">${displayName}</div>
  </div>
  <div class="company-name company-name-under-logo">${displayName}</div>`
    : `<div class="company-name">${displayName}</div>`;

  const travelStart = form.travel_start_date ? formatDate(form.travel_start_date) : "—";
  const travelEnd = form.travel_end_date ? formatDate(form.travel_end_date) : "—";

  const invoiceNumber = escapeHtmlProforma(proformaNo);
  const invoiceDateHtml = formatProformaLongDateLabel(proformaDate);
  const dueDateHtml = proformaDueDateDisplay(form);
  const detailRows =
    lineRows ||
    `<tr><td colspan="4" class="muted">No invoice line items configured.</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Proforma invoice — ${escapeHtmlProforma(proformaNo)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, system-ui, sans-serif; margin: 2rem; color: #1a1a1a; font-size: 14px; line-height: 1.45; }
    .doc-note { color: #555; font-size: 12px; margin: 0.5rem 0 1.25rem; }
    .logo-wrap { text-align: center; margin-bottom: 1.25rem; }
    .logo-frame { display: flex; align-items: center; justify-content: center; margin: 0 auto; min-height: 56px; max-width: 420px; }
    .company-logo { display: block; max-height: 96px; max-width: 100%; width: auto; height: auto; object-fit: contain; object-position: center; margin: 0 auto; }
    .logo-fallback { display: none; font-size: 1.2rem; font-weight: 700; letter-spacing: 0.02em; text-align: center; padding: 0.35rem 0.5rem; }
    .company-name { font-size: 1.1rem; font-weight: 600; margin-top: 0.35rem; letter-spacing: 0.02em; }
    .company-name-under-logo { margin-top: 0.5rem; }
    .meta-table { width: 100%; max-width: 420px; border-collapse: collapse; margin: 0 0 1.75rem; font-size: 13px; }
    .meta-table th, .meta-table td { border: 1px solid #c5ccd6; padding: 0.45rem 0.65rem; text-align: left; vertical-align: top; }
    .meta-table th { background: #eef2f7; width: 38%; font-weight: 600; color: #222; }
    .section-title { font-size: 15px; font-weight: 700; margin: 1.25rem 0 0.5rem; }
    .bill-list { margin: 0 0 0.25rem; padding-left: 1.1rem; }
    .bill-list li { margin: 0.2rem 0; }
    .ref-lines { font-size: 12px; color: #444; margin: 0 0 1rem; }
    table.inv-lines { width: 100%; border-collapse: collapse; margin-top: 0.35rem; font-size: 13px; }
    table.inv-lines th, table.inv-lines td { border: 1px solid #c5ccd6; padding: 0.5rem 0.65rem; text-align: left; }
    table.inv-lines thead th { background: #e8eef5; font-weight: 600; }
    td.num, th.num { text-align: right; }
    .muted { color: #666; font-style: italic; }
    table.amounts { width: 100%; max-width: 360px; margin-left: auto; margin-top: 1rem; border-collapse: collapse; font-size: 13px; }
    table.amounts th, table.amounts td { border: 1px solid #c5ccd6; padding: 0.45rem 0.65rem; }
    table.amounts th { background: #eef2f7; text-align: left; width: 55%; }
    table.amounts td { text-align: right; font-variant-numeric: tabular-nums; }
    table.amounts tr.total td { font-weight: 700; font-size: 1.05rem; }
    @media print { body { margin: 1rem; } }
  </style>
</head>
<body>
  <div class="logo-wrap">
    ${logoBlock}
  </div>
  <p class="doc-note">Proforma — not a tax invoice.</p>

  <table class="meta-table" role="presentation">
    <tbody>
      <tr><th scope="row">Invoice number</th><td>${invoiceNumber}</td></tr>
      <tr><th scope="row">Invoice date</th><td>${invoiceDateHtml}</td></tr>
      <tr><th scope="row">Due date</th><td>${dueDateHtml}</td></tr>
    </tbody>
  </table>

  ${
    drcNo || resolvedBookingId
      ? `<p class="ref-lines">${drcNo ? `DRC no.: ${escapeHtmlProforma(drcNo)}` : ""}${
          drcNo && resolvedBookingId ? " · " : ""
        }${resolvedBookingId ? `Booking: #${escapeHtmlProforma(resolvedBookingId)}` : ""}</p>`
      : ""
  }

  <div class="section-title">Bill To:</div>
  <ul class="bill-list">
    <li><strong>Customer name:</strong> ${escapeHtmlProforma(customerName)}</li>
    <li><strong>Address:</strong> ${billAddress}</li>
    <li><strong>Email:</strong> ${billEmail}</li>
    <li><strong>Destination:</strong> ${escapeHtmlProforma(destinationName)}</li>
    <li><strong>Travel:</strong> ${escapeHtmlProforma(travelStart)} — ${escapeHtmlProforma(travelEnd)}</li>
  </ul>

  <div class="section-title">Invoice details:</div>
  <table class="inv-lines">
    <thead>
      <tr>
        <th scope="col">Description</th>
        <th class="num" scope="col">Quantity</th>
        <th class="num" scope="col">Unit price</th>
        <th class="num" scope="col">Total</th>
      </tr>
    </thead>
    <tbody>${detailRows}</tbody>
  </table>

  <div class="section-title">Total amounts:</div>
  <table class="amounts">
    <tbody>
      <tr><th scope="row">Subtotal</th><td>${escapeHtmlProforma(formatCurrency(subtotalNum))}</td></tr>
      <tr><th scope="row">Tax (GST)</th><td>${escapeHtmlProforma(formatCurrency(taxNum))}</td></tr>
      <tr class="total"><th scope="row">Total due</th><td>${escapeHtmlProforma(formatCurrency(totalDue))}</td></tr>
    </tbody>
  </table>
</body>
</html>`;

  const triggerPrint = (targetWindow) => {
    setTimeout(() => {
      try {
        targetWindow?.focus();
        targetWindow?.print();
      } catch {
        /* ignore */
      }
    }, 200);
  };

  /** Do not pass `noopener` in the third argument: the spec requires `window.open` to return `null`, so `document.write` never runs. */
  const w = window.open("", "_blank");
  if (w) {
    try {
      w.opener = null;
      w.document.open();
      w.document.write(html);
      w.document.close();
      triggerPrint(w);
      return;
    } catch {
      try {
        w.close();
      } catch {
        /* ignore */
      }
    }
  }

  // Popup blocked or write failed: print from an off-screen iframe (layout must exist or some browsers print a blank page).
  try {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Proforma invoice print preview");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:0;width:210mm;min-height:297mm;border:0;background:#fff;visibility:visible;";
    document.body.appendChild(iframe);
    const idoc = iframe.contentWindow?.document;
    if (!idoc) {
      iframe.remove();
      window.alert(
        "Could not open the print preview. Allow pop-ups for this site, or try using a different browser.",
      );
      return;
    }
    idoc.open();
    idoc.write(html);
    idoc.close();
    const pw = iframe.contentWindow;
    const cleanup = () => {
      try {
        iframe.remove();
      } catch {
        /* ignore */
      }
    };
    pw?.addEventListener("afterprint", cleanup, { once: true });
    triggerPrint(pw);
    setTimeout(cleanup, 120_000);
  } catch {
    window.alert(
      "Could not open the print preview. Allow pop-ups for this site, or try using a different browser.",
    );
  }
}

export function emptyTravelerLine() {
  return {
    traveler_id: "",
    seat_preference: "",
    meal_preference: "",
    special_request: "",
  };
}

/** `isoDateStr` as YYYY-MM-DD; returns YYYY-MM-DD after adding whole days (local calendar). */
export function addDaysToIsoDate(isoDateStr, days) {
  const d = String(isoDateStr ?? "").trim();
  const n = Number(days);
  if (!d || !Number.isFinite(n) || n < 0) {
    return "";
  }
  const parts = d.split("-");
  if (parts.length !== 3) {
    return "";
  }
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  const da = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da)) {
    return "";
  }
  const dt = new Date(y, mo - 1, da);
  if (Number.isNaN(dt.getTime())) {
    return "";
  }
  dt.setDate(dt.getDate() + Math.trunc(n));
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function vendorCreditLimitDaysFromRow(vendorRow) {
  if (!vendorRow || typeof vendorRow !== "object") {
    return null;
  }
  const raw = vendorRow.credit_limit_days ?? vendorRow.creditLimitDays;
  if (raw == null || raw === "") {
    return null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return Math.trunc(n);
}

/** Shown in `ConfirmActionModal` before adding another row in product sections (wizard Products + Vendor Payment lines). */
export const CONFIRM_ADD_PRODUCT_LINE_MESSAGE =
  "Total tour value may change if you add another product line. Do you want to continue?";

/** Shown in `ConfirmActionModal` after changing unit price when only one Products row is configured. */
export const CONFIRM_SINGLE_PRODUCT_PRICE_CHANGE_MESSAGE =
  "The total tour value may change if you modify this amount. Do you want to continue?";

/** Products card rows (step 1 style): vendor + product type or catalogue product. */
export function countConfiguredVendorCatalogLines(vendorPaymentLines) {
  const lines = Array.isArray(vendorPaymentLines) ? vendorPaymentLines : [];
  return lines.filter(
    (l) =>
      String(l.vendor_id || "").trim() &&
      (String(l.product_id || "").trim() || String(l.product_type_id || "").trim()),
  ).length;
}

export function emptyProductLine() {
  return {
    product_id: "",
    /** Type-only pick: persisted on `vendor_payments` with `product_type_id` (no catalogue row required). */
    booking_product_type_id: "",
    vendor_id: "",
    quantity: "1",
    price: "",
    line_total: "0",
    invoice_ref_numbers: "",
    invoice_ref_date: "",
    gross_amount: "",
    taxable_amount: "",
    gst_percent: "",
    gst_amount: "",
    commission_percent: "",
    commission_amount: "",
    tds_percent: "",
    tds_amount: "",
    net_payable: "",
    due_date: "",
    payment_mode: "",
  };
}

/**
 * GST amount = taxable × (GST% / 100). Commission amount = taxable × (Comm% / 100).
 * TDS amount = taxable × (TDS% / 100). All rounded to 2 decimals.
 * `gross_amount` is unused in the UI but kept for API compatibility.
 *
 * Net payable = taxable + GST amount − TDS − commission amount (2 decimals), using 0 for
 * missing GST/commission/TDS parts when taxable is valid.
 */
function inferProductLineTdsPercentFromLegacyAmount(row) {
  const out = { ...row };
  const pctStr = String(out.tds_percent ?? "").trim();
  if (pctStr !== "") {
    return out;
  }
  const taxable = parseBookingAmountNumber(out.taxable_amount);
  const tds = parseBookingAmountNumber(out.tds_amount);
  if (Number.isFinite(taxable) && taxable > 0 && Number.isFinite(tds) && tds >= 0) {
    const inferred = (tds / taxable) * 100;
    if (Number.isFinite(inferred) && inferred >= 0) {
      out.tds_percent = inferred.toFixed(4);
    }
  }
  return out;
}

function productLineAmountFromPercentAndTaxable(pctRaw, taxable) {
  const base = parseBookingAmountNumber(taxable);
  const pct = Number(String(pctRaw ?? "").trim());
  if (!Number.isFinite(base) || base < 0) {
    return "";
  }
  if (String(pctRaw ?? "").trim() === "" || !Number.isFinite(pct) || pct < 0) {
    return "";
  }
  return formatAmountPlain((base * pct) / 100);
}

function productLinePercentFromAmountAndTaxable(amountRaw, taxable) {
  const base = parseBookingAmountNumber(taxable);
  const a = parseBookingAmountNumber(amountRaw);
  if (!(base > 0) || !Number.isFinite(a) || a < 0) {
    return "";
  }
  const pct = (a / base) * 100;
  if (!Number.isFinite(pct) || pct < 0) {
    return "";
  }
  const rounded = Math.round(pct * 1e6) / 1e6;
  return String(rounded);
}

/** True while the user is still typing a decimal amount (avoid forcing toFixed on each keystroke). */
function isIncompleteTaxableLinkedAmountString(raw) {
  const s = stripAmountGrouping(String(raw ?? "").trim());
  if (s === "") {
    return false;
  }
  if (s.endsWith(".")) {
    return true;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) {
    return true;
  }
  const dot = s.indexOf(".");
  if (dot !== -1) {
    const frac = s.slice(dot + 1);
    if (frac.length > 0 && frac.length < 2) {
      return true;
    }
  }
  return false;
}

/**
 * Keeps GST / commission / TDS percent and amount in sync with taxable.
 * @param touchedKeys keys from the user's patch (e.g. `Object.keys(patch)`), or `null` for initial/API sync.
 */
function reconcileTaxableLinkedPair(next, touched, taxable, pctKey, amtKey) {
  const touchedSet = touched;
  const mode =
    touchedSet == null
      ? "auto"
      : touchedSet.has(amtKey) && !touchedSet.has(pctKey)
        ? "amount"
        : touchedSet.has(pctKey)
          ? "percent"
          : touchedSet.has("taxable_amount")
            ? "refresh"
            : "none";

  if (mode === "none") {
    return;
  }

  const clearPair = () => {
    next[pctKey] = "";
    next[amtKey] = "";
  };

  if (!Number.isFinite(taxable) || taxable < 0) {
    clearPair();
    return;
  }

  const pStr = String(next[pctKey] ?? "").trim();
  const aStr = String(next[amtKey] ?? "").trim();
  const pNum = Number(pStr);

  if (mode === "amount") {
    const strippedAmt = stripAmountGrouping(String(next[amtKey] ?? "").trim());
    if (strippedAmt === "") {
      clearPair();
    } else if (isIncompleteTaxableLinkedAmountString(strippedAmt)) {
      next[amtKey] = strippedAmt;
    } else {
      const finalized = formatAmountPlain(parseBookingAmountNumber(strippedAmt));
      next[amtKey] = finalized;
      next[pctKey] = taxable > 0 ? productLinePercentFromAmountAndTaxable(finalized, taxable) : "";
    }
    return;
  }

  if (mode === "percent") {
    if (pStr === "" || !Number.isFinite(pNum) || pNum < 0) {
      next[amtKey] = "";
    } else {
      next[amtKey] = productLineAmountFromPercentAndTaxable(pStr, taxable);
    }
    return;
  }

  if (mode === "refresh") {
    if (pStr !== "" && Number.isFinite(pNum) && pNum >= 0) {
      next[amtKey] = productLineAmountFromPercentAndTaxable(pStr, taxable);
    } else if (aStr !== "" && taxable > 0) {
      const strippedRefresh = stripAmountGrouping(String(next[amtKey] ?? "").trim());
      if (isIncompleteTaxableLinkedAmountString(strippedRefresh)) {
        next[amtKey] = strippedRefresh;
      } else {
        const finalized = formatAmountPlain(parseBookingAmountNumber(strippedRefresh));
        next[pctKey] = productLinePercentFromAmountAndTaxable(finalized, taxable);
        next[amtKey] = finalized;
      }
    }
    return;
  }

  if (pStr !== "" && Number.isFinite(pNum) && pNum >= 0) {
    next[amtKey] = productLineAmountFromPercentAndTaxable(pStr, taxable);
  } else if (aStr !== "" && taxable > 0) {
    const strippedAuto = stripAmountGrouping(String(next[amtKey] ?? "").trim());
    if (isIncompleteTaxableLinkedAmountString(strippedAuto)) {
      next[amtKey] = strippedAuto;
    } else {
      const finalized = formatAmountPlain(parseBookingAmountNumber(strippedAuto));
      next[pctKey] = productLinePercentFromAmountAndTaxable(finalized, taxable);
      next[amtKey] = finalized;
    }
  }
}

export function applyProductLineGstCommissionDerived(row, touchedKeys = null) {
  const next = { ...row };
  const touched = Array.isArray(touchedKeys) ? new Set(touchedKeys) : null;
  const taxable = parseBookingAmountNumber(next.taxable_amount);

  reconcileTaxableLinkedPair(next, touched, taxable, "gst_percent", "gst_amount");
  reconcileTaxableLinkedPair(next, touched, taxable, "commission_percent", "commission_amount");
  reconcileTaxableLinkedPair(next, touched, taxable, "tds_percent", "tds_amount");

  const gstNum = parseBookingAmountNumber(next.gst_amount);
  const commNum = parseBookingAmountNumber(next.commission_amount);
  const tdsNum = parseBookingAmountNumber(next.tds_amount);

  if (Number.isFinite(taxable) && taxable >= 0) {
    const net = taxable + gstNum - tdsNum - commNum;
    next.net_payable = Number.isFinite(net) ? formatAmountPlain(net) : "";
  } else {
    next.gst_percent = "";
    next.gst_amount = "";
    next.commission_percent = "";
    next.commission_amount = "";
    next.tds_percent = "";
    next.tds_amount = "";
    next.net_payable = "";
  }
  return next;
}

function strOrNull(v) {
  const t = String(v ?? "").trim();
  return t ? t : null;
}

function truncStr(v, maxLen) {
  const t = String(v ?? "").trim();
  if (!t) {
    return null;
  }
  return t.length <= maxLen ? t : t.slice(0, maxLen);
}

function decOrNull(v) {
  if (v === "" || v == null) {
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Sequential Sale PI / receipt labels: PI-001, PI-002, … (from 0-based row index). */
export function formatSalePiReceiptSequential(zeroBasedIndex) {
  const n = Number(zeroBasedIndex);
  const seq = Number.isFinite(n) && n >= 0 ? n + 1 : 1;
  return `PI-${String(seq).padStart(3, "0")}`;
}

/** Primary value for filters / legacy `amount` on save: received first, then PI amount, then legacy `amount`. */
export function customerPaymentLinePrimaryAmount(line) {
  const rec = parseBookingAmountNumber(line?.amount_received);
  const inv = parseBookingAmountNumber(line?.invoice_amount);
  const leg = parseBookingAmountNumber(line?.amount);
  if (Number.isFinite(rec) && rec > 0) {
    return rec;
  }
  if (Number.isFinite(inv) && inv > 0) {
    return inv;
  }
  if (Number.isFinite(leg) && leg > 0) {
    return leg;
  }
  return 0;
}

/** `amount_received` included in booking wizard progress / outstanding when status is Paid (case-insensitive). */
export function customerPaymentLineReceivedForPaidProgress(line) {
  const st = String(line?.status ?? "").trim().toLowerCase();
  if (st !== "paid") {
    return 0;
  }
  const rec = parseBookingAmountNumber(line?.amount_received);
  return Number.isFinite(rec) && rec >= 0 ? rec : 0;
}

export function emptyPaymentLine() {
  return {
    sale_pi_receipt_no: "",
    invoice_amount: "",
    amount_received: "",
    amount: "",
    payment_method: "",
    transaction_reference: "",
    payment_date: "",
    received_on: "",
    status: "Pending",
  };
}

/** Sets `sale_pi_receipt_no` on each customer payment row: PI-001, PI-002, … by row order (default for any row count). */
export function normalizeCustomerPaymentSalePiReceiptNos(lines) {
  const base = lines?.length ? lines.map((row) => ({ ...row })) : [{ ...emptyPaymentLine() }];
  return base.map((row, i) => ({
    ...row,
    sale_pi_receipt_no: formatSalePiReceiptSequential(i),
  }));
}

/**
 * Options for customer receipt `payment_method` from payment mode masters, plus the
 * current value when it is not in the master list (legacy rows).
 */
export function paymentMethodFieldOptions(
  paymentModes,
  currentValue = "",
  emptyLabel = "Select method",
) {
  const list = paymentModes || [];
  const v = String(currentValue ?? "").trim();
  const names = new Set(
    list.map((m) => String(m.payment_mode_name ?? "").trim()).filter(Boolean),
  );
  const out = [{ value: "", label: emptyLabel }];
  for (const m of list) {
    const n = String(m.payment_mode_name ?? "").trim();
    if (n) {
      out.push({ value: n, label: n });
    }
  }
  if (v && !names.has(v)) {
    out.push({ value: v, label: `${v} (saved)` });
  }
  return out;
}

export function emptyVendorPaymentLine() {
  return {
    product_type_id: "",
    vendor_id: "",
    product_id: "",
    amount: "",
    quantity: "1",
    payment_method: "",
    payment_date: "",
    status: "Pending",
  };
}

function productTypeDisplayName(productTypes, typeIdRaw) {
  const tid = vendorLineProductTypeValue(typeIdRaw);
  if (!tid) {
    return "";
  }
  const t = (productTypes || []).find((x) => String(x.id) === tid);
  return t ? String(t.product_name || "").trim() : "";
}

function isPackageProductTypeName(name) {
  return String(name || "").trim().toLowerCase() === "package";
}

function packageProductTypeIdString(productTypes) {
  const pkg = (productTypes || []).find((t) => isPackageProductTypeName(t.product_name));
  if (!pkg || pkg.id == null) {
    return "";
  }
  const s = String(pkg.id).trim();
  return s;
}

function normalizedPositiveOrderTotal(orderTotalDefaultPrice) {
  const raw = String(orderTotalDefaultPrice ?? "").trim();
  if (!raw) {
    return null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return raw;
}

/**
 * First Products row + master name "Package" → price defaults to booking total order value when set;
 * otherwise catalogue / empty string from `catalogueAmountRaw`.
 */
function resolveVendorLineDefaultAmount(
  lineIndex,
  typeIdRaw,
  productTypes,
  catalogueAmountRaw,
  orderTotalDefaultPrice,
) {
  const orderStr = normalizedPositiveOrderTotal(orderTotalDefaultPrice);
  const nm = productTypeDisplayName(productTypes, typeIdRaw);
  if (lineIndex === 0 && orderStr && isPackageProductTypeName(nm)) {
    return vendorLineAmountInputValue(orderStr);
  }
  const c = catalogueAmountRaw;
  return vendorLineAmountInputValue(c != null && c !== "" ? String(c) : "");
}

/** Stable string for controlled `<select>` / inputs on vendor payment lines (API may send numbers). */
export function vendorLineProductTypeValue(raw) {
  return String(raw ?? "").trim();
}

export function vendorLineAmountInputValue(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return "";
  }
  return String(raw);
}

/** Strip grouping commas and spaces so amounts like 5,000 / 15 000 parse as numbers. */
export function normalizeBookingAmountInput(raw) {
  return stripAmountGrouping(raw);
}

/** Parse a booking amount field for math (commas / spaces stripped). */
export function parseBookingAmountNumber(raw) {
  return parseAmountNumeric(raw);
}

function amountStringsEqualNumerically(a, b) {
  const na = Number(normalizeBookingAmountInput(a));
  const nb = Number(normalizeBookingAmountInput(b));
  if (!Number.isFinite(na) || !Number.isFinite(nb)) {
    return false;
  }
  return Math.abs(na - nb) < 1e-6;
}

/** Unit price × qty for one Product Details row (`amount` = unit price). */
export function vendorProductDetailLineTotal(line) {
  const unit = Number(String(line.amount ?? "").trim());
  const qty = Number(String(line.quantity ?? "1").trim());
  const q = Number.isFinite(qty) && qty > 0 ? qty : 0;
  const u = Number.isFinite(unit) && unit >= 0 ? unit : 0;
  return u * q;
}

/** Sum of line totals (unit price × qty) for Product Details rows. */
export function sumVendorProductDetailAmounts(vendorPaymentLines) {
  const lines = vendorPaymentLines?.length ? vendorPaymentLines : [];
  let s = 0;
  for (const line of lines) {
    s += vendorProductDetailLineTotal(line);
  }
  return s;
}

/** Sum of entered prices only (no × quantity) — for Products table footer display. */
export function sumVendorProductDetailPriceInputs(vendorPaymentLines) {
  const lines = vendorPaymentLines?.length ? vendorPaymentLines : [];
  let s = 0;
  for (const line of lines) {
    const unit = Number(String(line.amount ?? "").trim());
    if (Number.isFinite(unit) && unit >= 0) {
      s += unit;
    }
  }
  return s;
}

/**
 * Legacy fallback: set row 0 amount only (no Package / swing split). Used when no catalogue context is passed.
 */
function applyBookingTotalToFirstVendorCatalogRow(vendorPaymentLines, targetTotal) {
  const raw = vendorPaymentLines?.length ? vendorPaymentLines : [emptyVendorPaymentLine()];
  const T = Number(normalizeBookingAmountInput(String(targetTotal)));
  if (!Number.isFinite(T) || T < 0) {
    return raw;
  }
  const sumOthers = sumVendorProductDetailPriceInputs(raw.slice(1));
  const swing = Math.max(0, T - sumOthers);
  return patchLine(raw, 0, { amount: vendorLineAmountInputValue(formatAmountPlain(swing)) });
}

/**
 * When the user edits Booking Details `total_amount`, keep **total order value = sum of line prices**:
 * row 0 is the **Package** line (type + catalogue vendor/product) and its unit price becomes
 * `target total − sum(other rows’ prices)` (never negative).
 *
 * @param {object} ctx — `products`, `productTypes`, `vendors`, `bookingDestination`, `passengerCount`
 */
function applyBookingTotalToPackageSwingRow(vendorPaymentLines, targetTotal, ctx) {
  const raw = vendorPaymentLines?.length ? vendorPaymentLines : [emptyVendorPaymentLine()];
  const T = Number(normalizeBookingAmountInput(String(targetTotal)));
  if (!Number.isFinite(T) || T < 0) {
    return raw;
  }
  const sumOthers = sumVendorProductDetailPriceInputs(raw.slice(1));
  const swing = Math.max(0, T - sumOthers);
  const swingStr = vendorLineAmountInputValue(formatAmountPlain(swing));

  const pkgId = packageProductTypeIdString(ctx?.productTypes || []);
  if (!pkgId) {
    return patchLine(raw, 0, { amount: swingStr });
  }

  const products = ctx?.products || [];
  const vendors = ctx?.vendors || [];
  const bookingDestination = ctx?.bookingDestination ?? "";
  const pc = Number(ctx?.passengerCount) > 0 ? Math.trunc(Number(ctx.passengerCount)) : 0;

  const line0Base = { ...(raw[0] || emptyVendorPaymentLine()), product_type_id: pkgId };
  const merged = vendorLineFromProductType(
    products,
    bookingDestination,
    pkgId,
    pc,
    line0Base,
    vendors,
  );
  return patchLine(raw, 0, {
    ...merged,
    amount: swingStr,
  });
}

/**
 * Bidirectional sync: Products card price sum → Booking Details `total_amount`;
 * when the user edits `total_amount` (see `userEditedTotalRef`), row 0 becomes **Package** with a swing amount so
 * sum(lines) equals the new total. After that patch, one sum→total pass is skipped to avoid flicker.
 *
 * @param {object|null} vendorCatalogCtx — optional; when set, Package row + swing amounts are applied (order entry).
 */
export function useBookingTotalVendorPriceBidirectionalSync(form, setForm, userEditedTotalRef, vendorCatalogCtx = null) {
  const suppressNextSumToTotalRef = useRef(false);
  const sum = useMemo(
    () => sumVendorProductDetailPriceInputs(form.vendorPaymentLines),
    [form.vendorPaymentLines],
  );
  const totalTrim = normalizeBookingAmountInput(form.total_amount);
  const totalNum = Number(totalTrim);

  useEffect(() => {
    if (userEditedTotalRef?.current) {
      userEditedTotalRef.current = false;
      if (!Number.isFinite(totalNum) || totalNum <= 0) {
        return;
      }
      setForm((c) => {
        const raw = c.vendorPaymentLines?.length ? c.vendorPaymentLines : [emptyVendorPaymentLine()];
        const s = sumVendorProductDetailPriceInputs(raw);
        if (Math.abs(totalNum - s) < 1e-6) {
          return c;
        }
        const nl = vendorCatalogCtx
          ? applyBookingTotalToPackageSwingRow(raw, totalNum, vendorCatalogCtx)
          : applyBookingTotalToFirstVendorCatalogRow(raw, totalNum);
        const same =
          nl.length === raw.length &&
          nl.every((row, i) => {
            const a = raw[i] || {};
            const b = nl[i] || {};
            return (
              amountStringsEqualNumerically(String(b.amount ?? ""), String(a.amount ?? "")) &&
              String(b.product_type_id ?? "") === String(a.product_type_id ?? "") &&
              String(b.product_id ?? "") === String(a.product_id ?? "") &&
              String(b.vendor_id ?? "") === String(a.vendor_id ?? "") &&
              String(b.quantity ?? "") === String(a.quantity ?? "")
            );
          });
        if (same) {
          return c;
        }
        suppressNextSumToTotalRef.current = true;
        return { ...c, vendorPaymentLines: nl };
      });
      return;
    }

    if (suppressNextSumToTotalRef.current) {
      suppressNextSumToTotalRef.current = false;
      return;
    }

    if (Number.isFinite(sum) && sum > 0) {
      const next = formatAmountPlain(sum);
      setForm((c) => {
        const cur = String(c.total_amount ?? "").trim();
        if (cur === next || amountStringsEqualNumerically(cur, next)) {
          return c;
        }
        return { ...c, total_amount: next };
      });
    }
  }, [sum, totalTrim, totalNum, setForm, userEditedTotalRef, vendorCatalogCtx]);
}

/**
 * Passenger count for Product Details quantity checks: one slot for the Lead PAX (SPOC) customer row
 * plus each Co PAX row that has a traveler profile selected.
 */
export function travelerPassengerCount(travelerLines) {
  const lines = travelerLines?.length ? travelerLines : [];
  if (!lines.length) {
    return 0;
  }
  const coWithProfile = lines.slice(1).filter((l) => String(l.traveler_id ?? "").trim()).length;
  return 1 + coWithProfile;
}

/** Sum of `line_total` on booking Product Details rows (catalog / product lines). */
export function sumBookingProductLineTotals(productLines) {
  const lines = productLines?.length ? productLines : [];
  let s = 0;
  for (const line of lines) {
    const n = Number(String(line.line_total ?? "").trim());
    if (Number.isFinite(n) && n >= 0) {
      s += n;
    }
  }
  return s;
}

/** Booking total = sum of Product Details “Total price” (`line_total` per row). */
export function computedBookingTotalFromProductLines(productLines) {
  const sum = sumBookingProductLineTotals(productLines);
  return sum > 0 ? formatAmountPlain(sum) : "";
}

/**
 * Effective tour value = total tour value minus estimated margin % (profit).
 * Returns null if total is missing/invalid or margin % is invalid; if margin is empty, returns total.
 */
export function effectiveTourValueNumber(totalAmount, estimatedMarginRaw) {
  const total = Number(normalizeBookingAmountInput(totalAmount));
  if (!Number.isFinite(total) || total <= 0) {
    return null;
  }
  const marginRaw = String(estimatedMarginRaw ?? "").trim();
  if (marginRaw === "") {
    return total;
  }
  const pct = Number(marginRaw);
  if (!Number.isFinite(pct) || pct < 0) {
    return null;
  }
  return total * (1 - pct / 100);
}

/**
 * Sum of `taxable_amount` across Product Details / vendor invoice lines (`productLines`).
 */
export function sumProductLinesTaxableTotal(productLines) {
  const lines = productLines || [];
  return lines.reduce((a, l) => a + parseBookingAmountNumber(l.taxable_amount), 0);
}

/**
 * When total vendor taxable amount is greater than or equal to (total order value − profit),
 * returns a user-facing validation message; otherwise "".
 */
function validateVendorTaxableAgainstNetOrder(form) {
  const orderNum = Number(normalizeBookingAmountInput(form.total_amount));
  if (!form.total_amount || !Number.isFinite(orderNum) || orderNum <= 0) {
    return "";
  }
  const cap = effectiveTourValueNumber(form.total_amount, form.estimated_margin);
  if (cap == null || !Number.isFinite(cap) || cap < 0) {
    return "";
  }
  const taxableSum = sumProductLinesTaxableTotal(form.productLines);
  const capR = Math.round(cap * 100) / 100;
  const taxR = Math.round(taxableSum * 100) / 100;
  if (taxR < capR) {
    return "";
  }
  const maxLabel = formatInrWithRupee(capR);
  const currentLabel = formatInrWithRupee(taxR);
  return `Maximum allowed: ${maxLabel} (total order value minus profit). Current total taxable: ${currentLabel}.`;
}

/** Detects {@link validateVendorTaxableAgainstNetOrder} message (for modal + flow). */
export function isVendorTaxableCapValidationMessage(message) {
  const s = String(message || "").trim();
  return (
    s.includes("Maximum allowed:") &&
    s.includes("(total order value minus profit)") &&
    s.includes("Current total taxable:")
  );
}

/** Keeps `total_amount` equal to the sum of catalogue product line totals when enabled. */
export function useBookingTotalFromProductLinesAndTravelers(form, setForm, enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const next = computedBookingTotalFromProductLines(form.productLines);
    setForm((c) => {
      const cur = String(c.total_amount ?? "");
      if (cur === next) {
        return c;
      }
      return { ...c, total_amount: next };
    });
  }, [enabled, form.productLines, setForm]);
}

export function createEmptyBookingForm() {
  return {
    customer_id: "",
    destination: "",
    atpl_member: false,
    atpl_assigned_user_id: "",
    drc_no: "",
    travel_start_date: "",
    travel_end_date: "",
    estimated_margin: "",
    total_amount: "",
    status: "Pending",
    travelerLines: [emptyTravelerLine()],
    productLines: [emptyProductLine()],
    paymentLines: normalizeCustomerPaymentSalePiReceiptNos([emptyPaymentLine()]),
    vendorPaymentLines: [emptyVendorPaymentLine()],
    proforma_invoice_number: "",
    proforma_invoice_date: "",
  };
}

/** Initial create-booking form: no pre-selected customer, travelers, or catalogue lines. */
export function createDefaultBookingForm(_data) {
  return createEmptyBookingForm();
}

export function createBookingFormFromBooking(booking, options = {}) {
  const catalogueProducts = options.catalogueProducts ?? [];
  const tSrc = booking.travelers?.length ? booking.travelers : [];
  const spocHas =
    String(booking.spoc_seat_preference ?? "").trim() ||
    String(booking.spoc_meal_preference ?? "").trim() ||
    String(booking.spoc_special_request ?? "").trim();

  const leadLine = {
    traveler_id: "",
    seat_preference: String(booking.spoc_seat_preference ?? ""),
    meal_preference: String(booking.spoc_meal_preference ?? ""),
    special_request: String(booking.spoc_special_request ?? ""),
  };

  let travelerLines;
  if (!spocHas && tSrc.length === 1) {
    // Legacy / modal: one booking_traveler row only — keep a single form line.
    travelerLines = [
      {
        traveler_id: String(tSrc[0].traveler_id),
        seat_preference: tSrc[0].seat_preference || "",
        meal_preference: tSrc[0].meal_preference || "",
        special_request: tSrc[0].special_request || "",
      },
    ];
  } else if (!tSrc.length) {
    travelerLines = [leadLine];
  } else {
    travelerLines = [
      leadLine,
      ...tSrc.map((t) => ({
        traveler_id: String(t.traveler_id),
        seat_preference: t.seat_preference || "",
        meal_preference: t.meal_preference || "",
        special_request: t.special_request || "",
      })),
    ];
  }

  const pSrc = booking.products?.length ? booking.products : [];
  const fromProducts = pSrc.length
    ? pSrc.map((p) =>
        applyProductLineGstCommissionDerived(
          inferProductLineTdsPercentFromLegacyAmount({
            product_id: String(p.product_id),
            booking_product_type_id: "",
            vendor_id: String(p.vendor_id),
            quantity: String(p.quantity),
            price: String(p.price),
            line_total: String(p.total_amount ?? ""),
            invoice_ref_numbers: p.invoice_ref_numbers != null ? String(p.invoice_ref_numbers) : "",
            invoice_ref_date: p.invoice_ref_date || "",
            gross_amount: p.gross_amount != null ? String(p.gross_amount) : "",
            taxable_amount: p.taxable_amount != null ? String(p.taxable_amount) : "",
            gst_percent: p.gst_percent != null ? String(p.gst_percent) : "",
            gst_amount: p.gst_amount != null ? String(p.gst_amount) : "",
            commission_percent: p.commission_percent != null ? String(p.commission_percent) : "",
            commission_amount: p.commission_amount != null ? String(p.commission_amount) : "",
            tds_percent: p.tds_percent != null ? String(p.tds_percent) : "",
            tds_amount: p.tds_amount != null ? String(p.tds_amount) : "",
            net_payable: p.net_payable != null ? String(p.net_payable) : "",
            due_date: p.due_date || "",
            payment_mode: p.payment_mode != null ? String(p.payment_mode) : "",
          }),
          null,
        ),
      )
    : [];

  const paySrc = booking.payments?.length ? booking.payments : [];
  const paymentLinesRaw = paySrc.length
    ? paySrc.map((pay) => {
        /** Only map explicit `amount_received` from API — do not copy legacy `amount` (often mirrors PI/invoice). */
        const ar =
          pay.amount_received != null && String(pay.amount_received).trim() !== ""
            ? String(pay.amount_received)
            : "";
        const ia =
          pay.invoice_amount != null && String(pay.invoice_amount).trim() !== ""
            ? String(pay.invoice_amount)
            : "";
        return {
          sale_pi_receipt_no: "",
          invoice_amount: ia,
          amount_received: ar,
          amount: "",
          payment_method: pay.payment_method || "",
          transaction_reference: pay.transaction_reference || "",
          payment_date: pay.payment_date || "",
          received_on: pay.received_on || "",
          status: normalizePaymentLineStatusForForm(pay.status),
        };
      })
    : [emptyPaymentLine()];
  const paymentLines = normalizeCustomerPaymentSalePiReceiptNos(paymentLinesRaw);

  const vpaySrc = booking.vendor_payments?.length ? booking.vendor_payments : [];
  const vpIsWizardLine = (vp) => Boolean(vp.booking_vendor_line ?? vp.bookingVendorLine);
  const vpWizard = vpaySrc.filter(vpIsWizardLine);
  const vpSimple = vpaySrc.filter((vp) => !vpIsWizardLine(vp));

  const fromVpWizard = vpWizard.map((vp) => {
    const qtyRaw = Number(vp.quantity);
    const qty = Number.isFinite(qtyRaw) && qtyRaw >= 1 ? Math.floor(qtyRaw) : 1;
    const totalAmt = Number(vp.amount);
    const unit = Number.isFinite(totalAmt) && qty > 0 ? totalAmt / qty : totalAmt;
    const unitStr =
      Number.isFinite(unit) && qty > 0
        ? formatAmountPlain(Math.round(unit * 100) / 100)
        : String(vp.amount ?? "");
    const tid =
      vp.product_type_id !== null && vp.product_type_id !== undefined
        ? String(vp.product_type_id)
        : "";
    return applyProductLineGstCommissionDerived(
      inferProductLineTdsPercentFromLegacyAmount({
        product_id: "",
        booking_product_type_id: tid,
        vendor_id: String(vp.vendor_id),
        quantity: String(qty),
        price: unitStr,
        line_total: String(vp.amount ?? ""),
        invoice_ref_numbers: vp.invoice_ref_no != null ? String(vp.invoice_ref_no) : "",
        invoice_ref_date: vp.invoice_ref_date || "",
        gross_amount: vp.gross_amount != null ? String(vp.gross_amount) : "",
        taxable_amount: vp.taxable_amount != null ? String(vp.taxable_amount) : "",
        gst_percent: vp.gst_percent != null ? String(vp.gst_percent) : "",
        gst_amount: vp.gst_amount != null ? String(vp.gst_amount) : "",
        commission_percent: vp.commission_percent != null ? String(vp.commission_percent) : "",
        commission_amount: vp.commission_amount != null ? String(vp.commission_amount) : "",
        tds_percent: vp.tds_percent != null ? String(vp.tds_percent) : "",
        tds_amount: vp.tds_amount != null ? String(vp.tds_amount) : "",
        net_payable: "",
        due_date: vp.due_date || "",
        payment_mode: vp.payment_method != null ? String(vp.payment_method) : "",
      }),
      null,
    );
  });

  const productLines =
    fromProducts.length || fromVpWizard.length
      ? [...fromProducts, ...fromVpWizard]
      : [emptyProductLine()];

  const vendorPaymentLines = vpSimple.length
    ? vpSimple.map((vp) => {
        const pid =
          vp.product_id !== null && vp.product_id !== undefined ? String(vp.product_id) : "";
        const cat = pid
          ? catalogueProducts.find((p) => String(p.product_id) === pid)
          : null;
        const typeFromVp =
          vp.product_type_id !== null && vp.product_type_id !== undefined
            ? String(vp.product_type_id)
            : "";
        const qtyRaw = Number(vp.quantity);
        const qty = Number.isFinite(qtyRaw) && qtyRaw >= 1 ? Math.floor(qtyRaw) : 1;
        const totalAmt = Number(vp.amount);
        const unit = Number.isFinite(totalAmt) && qty > 0 ? totalAmt / qty : totalAmt;
        const unitStr =
          Number.isFinite(unit) && qty > 0
            ? formatAmountPlain(Math.round(unit * 100) / 100)
            : String(vp.amount ?? "");
        return {
          product_type_id:
            cat?.product_type_id !== null && cat?.product_type_id !== undefined
              ? String(cat.product_type_id)
              : typeFromVp,
          vendor_id: String(vp.vendor_id),
          product_id: pid,
          amount: unitStr,
          quantity: String(qty),
          payment_method: vp.payment_method || "",
          payment_date: vp.payment_date || "",
          status: normalizePaymentLineStatusForForm(vp.status),
        };
      })
    : [emptyVendorPaymentLine()];

  return {
    id: String(booking.id),
    customer_id: String(booking.customer_id || ""),
    destination: String(booking.destination ?? ""),
    atpl_member: Boolean(booking.atpl_member),
    atpl_assigned_user_id:
      booking.atpl_assigned_user_id != null && booking.atpl_assigned_user_id !== undefined
        ? String(booking.atpl_assigned_user_id)
        : "",
    drc_no: booking.drc_no || "",
    travel_start_date: booking.travel_start_date || "",
    travel_end_date: booking.travel_end_date || "",
    estimated_margin:
      booking.estimated_margin === null || booking.estimated_margin === undefined
        ? ""
        : String(booking.estimated_margin),
    total_amount: String(booking.total_amount || ""),
    status: booking.status || "Pending",
    travelerLines,
    productLines,
    paymentLines,
    vendorPaymentLines,
    proforma_invoice_number: (() => {
      const raw =
        booking.proforma_invoice_number != null ? String(booking.proforma_invoice_number).trim() : "";
      const bookingIdStr = String(booking.id ?? "").trim();
      if (shouldSyncProformaInvoiceNumberToFirstSalePi(raw, bookingIdStr)) {
        const s0 = String(paymentLines[0]?.sale_pi_receipt_no ?? "").trim();
        return s0 || formatSalePiReceiptSequential(0);
      }
      return raw;
    })(),
    proforma_invoice_date: booking.proforma_invoice_date || "",
  };
}

/**
 * @param {object} form
 * @param {{ draft?: boolean }} [options] Pass `{ draft: true }` to save incomplete bookings (status Draft, relaxed totals/destination).
 */
export function buildBookingPayload(form, options = {}) {
  const draft = Boolean(options.draft);
  const lines = form.travelerLines?.length ? form.travelerLines : [emptyTravelerLine()];
  const lead0 = lines[0] || emptyTravelerLine();
  const coSlice = lines.slice(1);
  const coWithId = coSlice.filter((l) => String(l.traveler_id ?? "").trim());
  const leadTravelerId = String(lead0.traveler_id ?? "").trim();

  let travelers;
  let spoc_seat_preference;
  let spoc_meal_preference;
  let spoc_special_request;

  if (coWithId.length) {
    const coMapped = coWithId.map((l) => ({
      traveler_id: Number(l.traveler_id),
      seat_preference: l.seat_preference || null,
      meal_preference: l.meal_preference || null,
      special_request: l.special_request || null,
    }));
    if (leadTravelerId) {
      // Legacy line 0 still had a traveler profile; keep it as the first booking_traveler row.
      travelers = [
        {
          traveler_id: Number(lead0.traveler_id),
          seat_preference: lead0.seat_preference || null,
          meal_preference: lead0.meal_preference || null,
          special_request: lead0.special_request || null,
        },
        ...coMapped,
      ];
      spoc_seat_preference = null;
      spoc_meal_preference = null;
      spoc_special_request = null;
    } else {
      travelers = coMapped;
      spoc_seat_preference = strOrNull(lead0.seat_preference);
      spoc_meal_preference = strOrNull(lead0.meal_preference);
      spoc_special_request = strOrNull(lead0.special_request);
    }
  } else if (leadTravelerId) {
    // Single-row forms (e.g. booking modal): preferences stay on the booking_traveler row.
    travelers = [
      {
        traveler_id: Number(lead0.traveler_id),
        seat_preference: lead0.seat_preference || null,
        meal_preference: lead0.meal_preference || null,
        special_request: lead0.special_request || null,
      },
    ];
    spoc_seat_preference = null;
    spoc_meal_preference = null;
    spoc_special_request = null;
  } else {
    travelers = [];
    spoc_seat_preference = strOrNull(lead0.seat_preference);
    spoc_meal_preference = strOrNull(lead0.meal_preference);
    spoc_special_request = strOrNull(lead0.special_request);
  }

  const products = (form.productLines || [])
    .filter((l) => l.vendor_id && String(l.product_id || "").trim())
    .map((l) => {
      const hasPid = String(l.product_id || "").trim();
      const base = {
      product_id: hasPid ? Number(l.product_id) : null,
      product_type_id: null,
      vendor_id: Number(l.vendor_id),
      quantity: Number(l.quantity),
      price: parseBookingAmountNumber(l.price),
      total_amount: parseBookingAmountNumber(l.line_total),
      vendor_display_name: null,
      invoice_ref_numbers: strOrNull(l.invoice_ref_numbers),
      invoice_ref_date: strOrNull(l.invoice_ref_date) || null,
      gross_amount: decOrNull(l.gross_amount),
      taxable_amount: decOrNull(l.taxable_amount),
      gst_percent: decOrNull(l.gst_percent),
      gst_amount: decOrNull(l.gst_amount),
      commission_percent: decOrNull(l.commission_percent),
      commission_amount: decOrNull(l.commission_amount),
      tds_percent: decOrNull(l.tds_percent),
      tds_amount: decOrNull(l.tds_amount),
      net_payable: decOrNull(l.net_payable),
      minimum_due: null,
      due_date: strOrNull(l.due_date) || null,
      payment_mode: strOrNull(l.payment_mode),
    };
      return base;
    });

  const productLinesAsVendorPayments = (form.productLines || [])
    .filter(
      (l) =>
        l.vendor_id &&
        !String(l.product_id || "").trim() &&
        String(l.booking_product_type_id || "").trim(),
    )
    .map((l) => {
      const qRaw = Number(String(l.quantity ?? "1").trim());
      const quantity = Number.isFinite(qRaw) && qRaw >= 1 ? Math.floor(qRaw) : 1;
      return {
        vendor_id: Number(l.vendor_id),
        product_id: null,
        product_type_id: Number(l.booking_product_type_id),
        booking_vendor_line: true,
        product_name: null,
        amount: Number(l.line_total),
        quantity,
        payment_method: strOrNull(l.payment_mode)?.trim() || "Unspecified",
        payment_date: null,
        status: "Pending",
        invoice_ref_no: truncStr(l.invoice_ref_numbers, 150),
        invoice_ref_date: strOrNull(l.invoice_ref_date) || null,
        gross_amount: decOrNull(l.gross_amount),
        taxable_amount: decOrNull(l.taxable_amount),
        gst_percent: decOrNull(l.gst_percent),
        gst_amount: decOrNull(l.gst_amount),
        commission_percent: decOrNull(l.commission_percent),
        commission_amount: decOrNull(l.commission_amount),
        tds_percent: decOrNull(l.tds_percent),
        tds_amount: decOrNull(l.tds_amount),
        minimum_due: null,
        due_date: strOrNull(l.due_date) || null,
      };
    });

  const payments = (form.paymentLines || [])
    .map((l, idx) => ({ line: l, idx }))
    .filter(({ line: l }) => customerPaymentLinePrimaryAmount(l) > 0)
    .map(({ line: l, idx }) => {
      const pi = String(l.sale_pi_receipt_no ?? "").trim() || formatSalePiReceiptSequential(idx);
      return {
        amount: customerPaymentLinePrimaryAmount(l),
        invoice_amount: decOrNull(l.invoice_amount),
        amount_received: decOrNull(l.amount_received),
        payment_method: String(l.payment_method || "").trim() || "Unspecified",
        transaction_reference: l.transaction_reference || null,
        payment_date: l.payment_date || null,
        received_on: strOrNull(l.received_on) || null,
        status: l.status || "Pending",
        sale_pi_receipt_no: pi,
      };
    });

  const vendor_paymentsFromProductCard = (form.vendorPaymentLines || [])
    .filter((l) => {
      if (!l.vendor_id) {
        return false;
      }
      const lineAmt = vendorProductDetailLineTotal(l);
      return lineAmt > 0;
    })
    .map((l) => {
      const qRaw = Number(String(l.quantity ?? "1").trim());
      const quantity = Number.isFinite(qRaw) && qRaw >= 1 ? Math.floor(qRaw) : 1;
      const hasPid = String(l.product_id || "").trim();
      const hasTid = String(l.product_type_id || "").trim();
      return {
        vendor_id: Number(l.vendor_id),
        product_id: hasPid ? Number(l.product_id) : null,
        product_type_id: hasTid ? Number(l.product_type_id) : null,
        booking_vendor_line: false,
        product_name: null,
        amount: vendorProductDetailLineTotal(l),
        quantity,
        payment_method: String(l.payment_method || "").trim() || "Unspecified",
        payment_date: l.payment_date || null,
        status: l.status || "Pending",
        invoice_ref_no: null,
        invoice_ref_date: null,
        gross_amount: null,
        taxable_amount: null,
        gst_percent: null,
        gst_amount: null,
        commission_percent: null,
        commission_amount: null,
        tds_amount: null,
        minimum_due: null,
      };
    });

  const vendor_payments = [...productLinesAsVendorPayments, ...vendor_paymentsFromProductCard];

  const assigneeRaw = String(form.atpl_assigned_user_id ?? "").trim();
  const atpl_assigned_user_id = assigneeRaw ? Number(assigneeRaw) : null;
  const atpl_member = atpl_assigned_user_id != null ? true : Boolean(form.atpl_member);

  const destTrimmed = String(form.destination ?? "").trim();
  const destination = draft && !normDestLabel(destTrimmed) ? "TBD" : destTrimmed;

  const totalParsed = Number(normalizeBookingAmountInput(form.total_amount));
  const total_amount = draft
    ? Number.isFinite(totalParsed) && totalParsed >= 0
      ? totalParsed
      : 0
    : Number.isFinite(totalParsed)
      ? totalParsed
      : 0;

  const statusRaw = (form.status && String(form.status).trim()) || "Pending";
  let status = draft ? BOOKING_STATUS_DRAFT : statusRaw;
  if (!draft && String(status).toLowerCase() === BOOKING_STATUS_DRAFT.toLowerCase()) {
    status = "Pending";
  }

  const customerIdParsed = Number(String(form.customer_id ?? "").trim());
  const customer_id =
    Number.isFinite(customerIdParsed) && customerIdParsed > 0 ? Math.trunc(customerIdParsed) : 0;

  return {
    customer_id,
    destination,
    atpl_member,
    atpl_assigned_user_id,
    drc_no: form.drc_no || null,
    travel_start_date: form.travel_start_date || null,
    travel_end_date: form.travel_end_date || null,
    estimated_margin: form.estimated_margin ? Number(form.estimated_margin) : null,
    total_amount,
    status,
    proforma_invoice_number: strOrNull(form.proforma_invoice_number),
    proforma_invoice_date: strOrNull(form.proforma_invoice_date) || null,
    spoc_seat_preference,
    spoc_meal_preference,
    spoc_special_request,
    travelers,
    products,
    payments,
    vendor_payments,
  };
}

/** Minimal checks when saving an incomplete booking (stored with status Draft until completed). */
export function validateBookingDraft(form) {
  if (!String(form.customer_id || "").trim()) {
    return "Select a customer to save this booking.";
  }
  const cid = Number(form.customer_id);
  if (!Number.isFinite(cid) || cid <= 0) {
    return "Select a valid customer to save this booking.";
  }

  if (form.travel_start_date && form.travel_end_date && form.travel_end_date < form.travel_start_date) {
    return "Travel end date cannot be earlier than travel start date.";
  }

  if (form.estimated_margin && Number(form.estimated_margin) < 0) {
    return "Estimated margin cannot be negative.";
  }

  const vendorTaxableErr = validateVendorTaxableAgainstNetOrder(form);
  if (vendorTaxableErr) {
    return vendorTaxableErr;
  }

  return "";
}

export function validateBookingForm(form) {
  if (!form.customer_id) {
    return "Customer is required.";
  }

  if (!normDestLabel(form.destination)) {
    return "Destination is required.";
  }

  const products = form.productLines || [];
  const validProducts = products.filter(
    (l) =>
      l.vendor_id &&
      (String(l.product_id || "").trim() || String(l.booking_product_type_id || "").trim()),
  );
  if (!validProducts.length) {
    return "Product lines: add at least one line with vendor and a product (or vendor product master).";
  }

  for (const line of validProducts) {
    if (!line.quantity || Number(line.quantity) <= 0) {
      return "Each product line detail needs quantity greater than 0.";
    }
    if (!line.price || parseBookingAmountNumber(line.price) <= 0) {
      return "Each product line detail needs price greater than 0.";
    }
  }

  const orderTotalNum = Number(normalizeBookingAmountInput(form.total_amount));
  if (!form.total_amount || !Number.isFinite(orderTotalNum) || orderTotalNum <= 0) {
    return "Total order value must be greater than 0.";
  }

  if (form.travel_start_date && form.travel_end_date && form.travel_end_date < form.travel_start_date) {
    return "Travel end date cannot be earlier than travel start date.";
  }

  if (form.estimated_margin && Number(form.estimated_margin) < 0) {
    return "Estimated margin cannot be negative.";
  }

  const vendorTaxableErr = validateVendorTaxableAgainstNetOrder(form);
  if (vendorTaxableErr) {
    return vendorTaxableErr;
  }

  for (const line of form.vendorPaymentLines || []) {
    if (vendorProductDetailLineTotal(line) > 0) {
      if (!line.vendor_id) {
        return "Vendor is required when vendor payment amount is entered.";
      }
      const unit = Number(String(line.amount ?? "").trim());
      const qty = Number(String(line.quantity ?? "1").trim());
      if (!Number.isFinite(unit) || unit <= 0) {
        return "Products: each line with a total needs unit price greater than 0.";
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return "Products: each line needs quantity greater than 0.";
      }
    }
  }

  const passengerCount = travelerPassengerCount(form.travelerLines);
  for (const line of form.vendorPaymentLines || []) {
    if (vendorProductDetailLineTotal(line) <= 0) {
      continue;
    }
    const qty = Number(String(line.quantity ?? "1").trim());
    if (Number.isFinite(qty) && qty > 0 && passengerCount > 0 && qty !== passengerCount) {
      return `Products: quantity on each line must match the number of travelers (${passengerCount} passenger${
        passengerCount === 1 ? "" : "s"
      }). Current line has quantity ${qty}.`;
    }
  }

  return "";
}

/**
 * Maps `validateBookingForm` messages to the order-entry wizard step index (0–4).
 */
export function wizardStepForBookingValidationError(message) {
  const m = String(message || "").trim();
  if (!m) {
    return null;
  }
  if (
    m.includes("Select a customer") ||
    m.includes("Select a valid customer") ||
    m === "Customer is required."
  ) {
    return 0;
  }
  if (
    m.startsWith("Products:") ||
    m.startsWith("Product Details:") ||
    m.includes("vendor payment amount")
  ) {
    return 1;
  }
  if (isVendorTaxableCapValidationMessage(m)) {
    return 4;
  }
  if (m.startsWith("Product lines:") || m.includes("product line detail")) {
    return 4;
  }
  if (/traveler/i.test(m)) {
    return 2;
  }
  return 0;
}

export function patchLine(lines, index, patch) {
  return lines.map((row, i) => (i === index ? { ...row, ...patch } : row));
}

/**
 * Vendor IDs that appear on catalogue product rows for a destination.
 * Names come from the vendors master list.
 */
export function vendorIdsFromProductsForDestination(products, destinationLabel) {
  const d = normDestLabel(destinationLabel);
  if (!d) {
    return new Set();
  }
  const ids = new Set();
  for (const p of products || []) {
    if (!destLabelsMatch(p.destination, destinationLabel)) {
      continue;
    }
    const vid = Number(p.vendor_id);
    if (Number.isFinite(vid)) {
      ids.add(vid);
    }
  }
  return ids;
}

/**
 * Vendors that may supply lines for this destination: explicit vendor_id on catalogue rows,
 * plus vendors whose assigned product types (Manage Vendors) match unassigned catalogue rows.
 */
export function vendorIdsEligibleForDestination(products, vendors, destinationLabel) {
  const d = normDestLabel(destinationLabel);
  const destPool = productsForBookingDestination(products, destinationLabel);
  const pool =
    destPool.length > 0 ? destPool : Array.isArray(products) ? products.filter(Boolean) : [];
  const out = new Set();
  for (const p of pool) {
    if (d && !destLabelsMatch(p.destination, destinationLabel)) {
      continue;
    }
    const pv = Number(p.vendor_id);
    if (Number.isFinite(pv) && pv > 0) {
      out.add(pv);
    }
  }
  for (const v of vendors || []) {
    const vid = Number(v.id);
    if (!Number.isFinite(vid) || vid <= 0) {
      continue;
    }
    const typeSet = new Set(vendorAssignedTypeIds(v));
    if (typeSet.size === 0) {
      continue;
    }
    const any = pool.some((p) => {
      const tid = catalogProductTypeId(p);
      return (
        (!d || destLabelsMatch(p.destination, destinationLabel)) &&
        Number.isFinite(tid) &&
        typeSet.has(tid) &&
        (!Number(p.vendor_id) || Number(p.vendor_id) <= 0 || Number(p.vendor_id) === vid)
      );
    });
    if (any) {
      out.add(vid);
    }
  }
  return out;
}

/**
 * Catalogue rows for vendor payment UI after a vendor is chosen: linked by vendor_id,
 * or unassigned rows whose product_type_id is in the vendor's `vendor_products` / assigned types.
 * When vendorId is empty, returns the same pool as destination-only (or full catalogue fallback).
 *
 * Matching is resilient to string/number ids from JSON. If a vendor has no rows with their
 * `vendor_id` yet, unassigned catalogue rows are offered (all unassigned when Manage Vendors has no
 * types checked; otherwise only types assigned to that vendor). If still empty, destination-wide
 * then full catalogue fallbacks keep the dropdown usable.
 */
export function productsForVendorPaymentLine(products, destinationLabel, vendorId, assignedTypeIds) {
  const all = Array.isArray(products) ? products.filter(Boolean) : [];
  const destPool = productsForBookingDestination(products, destinationLabel);
  const poolNoVendor =
    destPool.length > 0 ? destPool : [...all];

  const vid = Number(vendorId);
  if (!Number.isFinite(vid) || vid <= 0) {
    return [...poolNoVendor].sort((a, b) =>
      String(a.product_name || "").localeCompare(String(b.product_name || "")),
    );
  }
  const typeSet = new Set(normalizeAssignedProductTypeIds(assignedTypeIds));

  function sameVendorId(a, b) {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) {
      return na === nb;
    }
    return String(a ?? "").trim() === String(b ?? "").trim();
  }

  function productVendorId(p) {
    return p?.vendor_id ?? p?.vendorId;
  }

  function isUnassignedProduct(p) {
    const raw = productVendorId(p);
    if (raw === null || raw === undefined || raw === "") {
      return true;
    }
    const n = Number(raw);
    return !Number.isFinite(n) || n <= 0;
  }

  const explicit = all.filter((p) => sameVendorId(productVendorId(p), vid));

  let forVendor;
  if (explicit.length > 0) {
    forVendor = explicit;
  } else {
    const unassigned = all.filter(isUnassignedProduct);
    if (typeSet.size > 0) {
      forVendor = unassigned.filter((p) => {
        const tid = catalogProductTypeId(p);
        return Number.isFinite(tid) && typeSet.has(tid);
      });
    } else {
      forVendor = unassigned;
    }
  }

  const d = normDestLabel(destinationLabel);
  function preferDestination(rows) {
    if (!d || !rows.length) {
      return rows;
    }
    const destPreferred = rows.filter((p) => destLabelsMatch(p.destination, destinationLabel));
    return destPreferred.length > 0 ? destPreferred : rows;
  }

  let narrowed = preferDestination(forVendor);
  if (narrowed.length === 0 && d) {
    narrowed = preferDestination(all.filter((p) => destLabelsMatch(p.destination, destinationLabel)));
  }
  if (narrowed.length === 0) {
    narrowed = [...all];
  }

  return narrowed.sort((a, b) =>
    String(a.product_name || "").localeCompare(String(b.product_name || "")),
  );
}

/** Catalogue products for a destination + vendor (vendor payout product picker). */
export function productsForVendorAndDestination(products, destinationLabel, vendorId) {
  const d = normDestLabel(destinationLabel);
  const vid = Number(vendorId);
  if (!d || !Number.isFinite(vid)) {
    return [];
  }
  return (products || []).filter(
    (p) => destLabelsMatch(p.destination, destinationLabel) && Number(p.vendor_id) === vid,
  );
}

/**
 * First vendor master row that offers `typeId` (vendor_products / assigned types).
 * Used when there is no catalogue row so `vendor_payments` can still get a vendor_id.
 */
export function defaultVendorIdForProductType(vendors, typeIdRaw) {
  const tid = Number(vendorLineProductTypeValue(typeIdRaw));
  if (!Number.isFinite(tid)) {
    return "";
  }
  for (const v of vendors || []) {
    const types = vendorAssignedTypeIds(v);
    if (types.some((x) => Number(x) === tid)) {
      const id = v?.id ?? v?.vendor_id;
      return id != null && String(id).trim() !== "" ? String(id).trim() : "";
    }
  }
  return "";
}

/**
 * Fills vendor payment line fields from the first catalogue product for this destination + type.
 * When no catalogue row exists, still sets `vendor_id` from masters (first vendor assigned that type)
 * so `vendor_payments` rows are not dropped on save.
 */
export function vendorLineFromProductType(
  products,
  destinationLabel,
  typeId,
  passengerCount,
  existingLine,
  vendors = [],
) {
  const tid = vendorLineProductTypeValue(typeId);
  const qty = passengerCount > 0 ? String(passengerCount) : "1";
  if (!tid) {
    return {
      ...existingLine,
      product_type_id: "",
      product_id: "",
      vendor_id: "",
      amount: "",
      quantity: qty,
    };
  }
  const candidates = productsForBookingDestination(products, destinationLabel)
    .filter((p) => vendorLineProductTypeValue(p.product_type_id) === tid)
    .sort((a, b) => String(a.product_name || "").localeCompare(String(b.product_name || "")));

  const existingPid = String(existingLine.product_id || "").trim();
  let prod = null;
  if (existingPid && candidates.some((p) => String(p.product_id) === existingPid)) {
    prod = candidates.find((p) => String(p.product_id) === existingPid);
  } else {
    prod = candidates[0];
  }

  if (!prod) {
    const defVid = defaultVendorIdForProductType(vendors, tid);
    return {
      ...existingLine,
      product_type_id: tid,
      product_id: "",
      vendor_id: defVid,
      amount: "",
      quantity: qty,
    };
  }
  return {
    ...existingLine,
    product_type_id: tid,
    product_id: String(prod.product_id),
    vendor_id: String(prod.vendor_id),
    amount: vendorLineAmountInputValue(
      prod.price != null && prod.price !== "" ? String(prod.price) : "",
    ),
    quantity: qty,
  };
}

/**
 * Vendor payout lines for a booking (API: `vendor_payments`).
 * Used on the booking wizard vendor-products step and in the list "Add Booking" modal.
 */
export function VendorBookingProductsSection({
  vendorPaymentLines,
  setForm,
  products = [],
  productTypes = [],
  /** Masters vendor list — used to set `vendor_id` when no catalogue row matches the selected type. */
  vendors = [],
  bookingDestination = "",
  /** When greater than 0, line quantity is synced to traveler count for validation. */
  passengerCount = 0,
  cardClassName = "card mb-0 ta-order-section ta-order-section--wizard-panel",
  /** Optional row of actions (e.g. add product / vendor / catalogue product on booking). */
  catalogToolbar = null,
  /**
   * When a line has `vendor_id`, restrict the Product (type) dropdown to these product_master ids in order
   * (from GET /masters/vendors/:id → `vendor_products` / assigned type ids).
   */
  vendorTypeRestrictionsByVendorId = null,
  /** Booking Details total order value — used as default price for row 0 when product type is "Package". */
  orderTotalDefaultPrice = "",
}) {
  const [addProductLineModalOpen, setAddProductLineModalOpen] = useState(false);
  const [singleProductPriceModalOpen, setSingleProductPriceModalOpen] = useState(false);
  const [priceModalRevert, setPriceModalRevert] = useState(null);

  const configuredVendorProductCount = useMemo(
    () => countConfiguredVendorCatalogLines(vendorPaymentLines),
    [vendorPaymentLines],
  );

  const vendorLinesRef = useRef(vendorPaymentLines);
  vendorLinesRef.current = vendorPaymentLines;
  const priceBaselineRef = useRef({});

  useEffect(() => {
    if (configuredVendorProductCount !== 1) {
      setSingleProductPriceModalOpen(false);
      setPriceModalRevert(null);
      priceBaselineRef.current = {};
    }
  }, [configuredVendorProductCount]);

  const lines = vendorPaymentLines?.length ? vendorPaymentLines : [emptyVendorPaymentLine()];

  const productsForDest = useMemo(
    () => productsForBookingDestination(products, bookingDestination),
    [products, bookingDestination],
  );

  const destinationSet = Boolean(normDestLabel(bookingDestination));
  const hasCatalogueProducts = productsForDest.length > 0;

  const typeMasterById = useMemo(
    () => new Map((productTypes || []).map((t) => [Number(t.id), t])),
    [productTypes],
  );

  /** All master product types (not limited by destination catalogue). */
  const productTypesSorted = useMemo(
    () =>
      [...(productTypes || [])].sort((a, b) =>
        String(a.product_name || "").localeCompare(String(b.product_name || "")),
      ),
    [productTypes],
  );

  function patchVendorLines(c, idx, patch) {
    return patchLine(
      c.vendorPaymentLines?.length ? c.vendorPaymentLines : [emptyVendorPaymentLine()],
      idx,
      patch,
    );
  }

  const grandVendorPaymentTotal = useMemo(
    () => sumVendorProductDetailPriceInputs(vendorPaymentLines),
    [vendorPaymentLines],
  );
  const grandTotalLabel =
    grandVendorPaymentTotal > 0 ? formatCurrency(grandVendorPaymentTotal) : "—";

  const row0PackageDefaultDoneRef = useRef(false);

  useEffect(() => {
    setForm((c) => {
      const raw = c.vendorPaymentLines?.length ? c.vendorPaymentLines : [emptyVendorPaymentLine()];
      let lines = raw;

      if (!row0PackageDefaultDoneRef.current) {
        const line0 = raw[0];
        if (vendorLineProductTypeValue(line0?.product_type_id)) {
          row0PackageDefaultDoneRef.current = true;
        } else if ((productTypes || []).length > 0) {
          const pkgId = packageProductTypeIdString(productTypes);
          if (pkgId) {
            lines = patchLine(lines, 0, { product_type_id: pkgId });
          }
          row0PackageDefaultDoneRef.current = true;
        }
      }

      let touched = lines !== raw;
      const next = lines.map((line, idx) => {
        const tid = vendorLineProductTypeValue(line.product_type_id);
        if (!tid) {
          return line;
        }
        const updated = vendorLineFromProductType(
          products,
          bookingDestination,
          tid,
          passengerCount,
          line,
          vendors,
        );
        const trimmedAmt = String(line.amount ?? "").trim();
        /** Keep any entered unit price when re-syncing (wizard navigation remounts this effect). */
        const merged =
          trimmedAmt !== ""
            ? { ...updated, amount: vendorLineAmountInputValue(line.amount) }
            : {
                ...updated,
                amount: resolveVendorLineDefaultAmount(
                  idx,
                  tid,
                  productTypes,
                  updated.amount,
                  orderTotalDefaultPrice,
                ),
              };
        if (
          merged.product_id !== line.product_id ||
          merged.vendor_id !== line.vendor_id ||
          String(merged.amount ?? "") !== String(line.amount ?? "") ||
          String(merged.quantity ?? "1") !== String(line.quantity ?? "1")
        ) {
          touched = true;
          return merged;
        }
        return line;
      });
      return touched ? { ...c, vendorPaymentLines: next } : c;
    });
  }, [products, bookingDestination, passengerCount, vendors, productTypes, orderTotalDefaultPrice, setForm]);

  return (
    <>
    <div className={cardClassName}>
      <div className="card-header ta-order-section-title-vendorpay">Products</div>
      <div className="card-body">
        {catalogToolbar}
        {destinationSet && hasCatalogueProducts ? (
          <p className="small text-muted mb-2">
            Vendor and product come from the catalogue for the selected product (keeps your saved product when editing;
            otherwise the first match by product name). Price defaults from the catalogue and can be edited.{" "}
            Total order value (Booking Details) equals Total price below (sum of each row’s unit price). You can change
            either: editing a line updates the booking total; editing the booking total adjusts the Package line (first
            row) so the sum matches. Quantity follows traveler
            count when set. Total price is addition of row prices only (not × quantity).
          </p>
        ) : null}
        <div className="table-responsive ta-order-table-wrap">
          <table className="table table-sm ta-order-table align-middle">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const selTid = vendorLineProductTypeValue(line.product_type_id);
                let typeOpts = [...productTypesSorted];
                const lineVid = String(line.vendor_id || "").trim();
                const restrict =
                  lineVid &&
                  vendorTypeRestrictionsByVendorId &&
                  typeof vendorTypeRestrictionsByVendorId === "object"
                    ? vendorTypeRestrictionsByVendorId[lineVid]
                    : null;
                let usedAssignedTypeOrder = false;
                if (Array.isArray(restrict) && restrict.length) {
                  const allow = new Set(restrict.map((x) => Number(x)));
                  const filtered = typeOpts.filter((t) => allow.has(Number(t.id)));
                  if (filtered.length) {
                    typeOpts = filtered;
                    typeOpts.sort((a, b) => {
                      const ia = restrict.indexOf(Number(a.id));
                      const ib = restrict.indexOf(Number(b.id));
                      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
                    });
                    usedAssignedTypeOrder = true;
                  }
                }
                if (selTid && !typeOpts.some((t) => vendorLineProductTypeValue(t.id) === selTid)) {
                  const orphanType = typeMasterById.get(Number(selTid));
                  if (orphanType) {
                    typeOpts = [...typeOpts, orphanType];
                  }
                }
                if (!usedAssignedTypeOrder) {
                  typeOpts.sort((a, b) =>
                    String(a.product_name || "").localeCompare(String(b.product_name || "")),
                  );
                }

                /** Allow unit price as soon as a product is chosen (destination may be filled later). */
                const priceDisabled = !selTid;

                const typeSelectValue = vendorLineProductTypeValue(line.product_type_id);
                const priceInputValue = vendorLineAmountInputValue(line.amount);

                return (
                <tr key={`vpay-${idx}-${typeSelectValue || "x"}-${String(line.product_id || "")}`}>
                  <td style={{ minWidth: "10rem" }}>
                    <label className="form-label visually-hidden" htmlFor={`ta-vpay-ptype-${idx}`}>
                      Product
                    </label>
                    <select
                      id={`ta-vpay-ptype-${idx}`}
                      className="form-select form-select-sm"
                      disabled={productTypesSorted.length === 0 && !typeSelectValue}
                      value={typeSelectValue}
                      onChange={(e) => {
                        const typeId = e.target.value;
                        setForm((c) => {
                          const raw = c.vendorPaymentLines?.length
                            ? c.vendorPaymentLines
                            : [emptyVendorPaymentLine()];
                          const cur = raw[idx] || emptyVendorPaymentLine();
                          const nextLine = vendorLineFromProductType(
                            products,
                            bookingDestination,
                            typeId,
                            passengerCount,
                            cur,
                            vendors,
                          );
                          return {
                            ...c,
                            vendorPaymentLines: patchVendorLines(c, idx, {
                              product_type_id: vendorLineProductTypeValue(nextLine.product_type_id),
                              product_id: String(nextLine.product_id ?? "").trim(),
                              vendor_id: String(nextLine.vendor_id ?? "").trim(),
                              amount: resolveVendorLineDefaultAmount(
                                idx,
                                typeId,
                                productTypes,
                                nextLine.amount,
                                orderTotalDefaultPrice,
                              ),
                              quantity: String(nextLine.quantity ?? "1").trim() || "1",
                            }),
                          };
                        });
                      }}
                    >
                      <option value="">Select</option>
                      {typeOpts.map((t) => (
                        <option key={String(t.id)} value={vendorLineProductTypeValue(t.id)}>
                          {t.product_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="ta-vpay-price-cell" style={{ minWidth: "7.5rem" }}>
                    <label className="form-label visually-hidden" htmlFor={`ta-vpay-price-${idx}`}>
                      Price
                    </label>
                    <AmountFormattedInput
                      id={`ta-vpay-price-${idx}`}
                      className={`form-control form-control-sm${priceDisabled ? "" : " bg-white"}`}
                      disabled={priceDisabled}
                      autoComplete="off"
                      placeholder={selTid ? "Unit price" : "Choose product"}
                      aria-label="Unit price"
                      title={selTid ? "Unit price" : "Choose product"}
                      value={priceInputValue}
                      onFocus={() => {
                        if (configuredVendorProductCount === 1) {
                          priceBaselineRef.current[idx] = String(line.amount ?? "");
                        }
                      }}
                      onBlur={() => {
                        if (configuredVendorProductCount !== 1) {
                          return;
                        }
                        const baseline = priceBaselineRef.current[idx];
                        if (baseline === undefined) {
                          return;
                        }
                        window.setTimeout(() => {
                          const raw = vendorLinesRef.current?.length
                            ? vendorLinesRef.current
                            : [emptyVendorPaymentLine()];
                          const cur = String(raw[idx]?.amount ?? "").trim();
                          if (amountStringsEqualNumerically(cur, baseline)) {
                            return;
                          }
                          setPriceModalRevert({
                            idx,
                            amount: vendorLineAmountInputValue(baseline),
                          });
                          setSingleProductPriceModalOpen(true);
                        }, 0);
                      }}
                      onChange={(plain) =>
                        setForm((c) => ({
                          ...c,
                          vendorPaymentLines: patchVendorLines(c, idx, {
                            amount: vendorLineAmountInputValue(plain),
                          }),
                        }))
                      }
                    />
                  </td>
                  <td className="text-end text-nowrap align-middle">
                    {lines.length > 1 ? (
                      <button
                        type="button"
                        className="btn btn-icon btn-soft-danger btn-sm"
                        aria-label="Remove row"
                        title="Remove row"
                        onClick={() =>
                          setForm((c) => ({
                            ...c,
                            vendorPaymentLines: (c.vendorPaymentLines || []).filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true" className="ta-action-icon">
                          <path d="M3 4h10" />
                          <path d="M6 4V3h4v1" />
                          <path d="M5 4v8M11 4v8" />
                          <rect x="4" y="4" width="8" height="9" rx="1" />
                        </svg>
                      </button>
                    ) : null}
                  </td>
                </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="ta-vpay-grand-total table-light">
                <td className="border-top" />
                <td className="border-top">
                  <span
                    className="small text-muted text-uppercase fw-semibold me-2"
                    title="Sum of each row’s price (addition only, not × quantity)"
                  >
                    Total price
                  </span>
                  <span className="fw-semibold" aria-live="polite">
                    {grandTotalLabel}
                  </span>
                </td>
                <td className="border-top" />
              </tr>
            </tfoot>
          </table>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm mt-3 px-4 fw-semibold"
          onClick={() => setAddProductLineModalOpen(true)}
        >
          Add more
        </button>
      </div>
    </div>
    <ConfirmActionModal
      open={addProductLineModalOpen}
      title="Add product line"
      message={CONFIRM_ADD_PRODUCT_LINE_MESSAGE}
      confirmLabel="Continue"
      onCancel={() => setAddProductLineModalOpen(false)}
      onConfirm={() => {
        setAddProductLineModalOpen(false);
        setForm((c) => ({
          ...c,
          vendorPaymentLines: [...(c.vendorPaymentLines || []), emptyVendorPaymentLine()],
        }));
      }}
    />
    <ConfirmActionModal
      open={singleProductPriceModalOpen}
      title="Modify amount"
      message={CONFIRM_SINGLE_PRODUCT_PRICE_CHANGE_MESSAGE}
      confirmLabel="Continue"
      onCancel={() => {
        if (priceModalRevert != null) {
          const { idx: rIdx, amount: rAmt } = priceModalRevert;
          setForm((c) => ({
            ...c,
            vendorPaymentLines: patchVendorLines(c, rIdx, {
              amount: vendorLineAmountInputValue(rAmt),
            }),
          }));
        }
        setSingleProductPriceModalOpen(false);
        setPriceModalRevert(null);
      }}
      onConfirm={() => {
        setSingleProductPriceModalOpen(false);
        setPriceModalRevert(null);
      }}
    />
    </>
  );
}

export function BookingFormModal({
  open,
  title,
  saveLabel,
  saving,
  onCancel,
  onSubmit,
  formError,
  onFormErrorDismiss = () => {},
  form,
  setForm,
  state,
  customerAutocompleteExtras = {},
  travelerAutocompleteExtras = {},
  catalogToolbar = null,
  apiRequest,
  token,
  mergeCustomersIntoState,
  mergeTravelersIntoState,
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const err = String(formError || "").trim();
    if (!err) {
      return;
    }
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById("ta-booking-form-validation-error");
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      el?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [formError, open]);

  const t0 = form.travelerLines?.[0] || emptyTravelerLine();
  const p0 = form.productLines?.[0] || emptyProductLine();

  const vendorsForModalProductLine = useMemo(() => {
    const masterById = new Map((state.vendors || []).map((v) => [Number(v.id), v]));
    const allowed = vendorIdsEligibleForDestination(state.products, state.vendors, form.destination);
    const ordered = new Map();
    for (const vid of allowed) {
      const m = masterById.get(Number(vid));
      if (m) {
        ordered.set(Number(vid), m);
      }
    }
    const sel = Number(p0.vendor_id);
    if (sel && !ordered.has(sel) && masterById.has(sel)) {
      ordered.set(sel, masterById.get(sel));
    }
    return Array.from(ordered.values()).sort((a, b) =>
      String(a.vendor_name || "").localeCompare(String(b.vendor_name || "")),
    );
  }, [state.vendors, state.products, form.destination, p0.vendor_id]);

  const productsForModalPaymentLine = useMemo(() => {
    const vr = resolveVendorRow(state.vendors, p0.vendor_id);
    const narrowed = productsForVendorPaymentLine(
      state.products,
      form.destination,
      p0.vendor_id,
      vendorAssignedTypeIds(vr),
    );
    if (narrowed.length > 0) {
      return narrowed;
    }
    const dest = productsForBookingDestination(state.products, form.destination);
    if (dest.length > 0) {
      return dest;
    }
    return Array.isArray(state.products) ? state.products : [];
  }, [state.products, state.vendors, form.destination, p0.vendor_id]);

  function updateProductLine0(patch) {
    setForm((current) => {
      const lines = current.productLines?.length ? [...current.productLines] : [emptyProductLine()];
      let row = { ...lines[0], ...patch };
      const quantity = Number(row.quantity || 0);
      const price = parseBookingAmountNumber(row.price);
      row.line_total = quantity && price ? formatAmountPlain(quantity * price) : "0";
      if (!Object.prototype.hasOwnProperty.call(patch, "due_date")) {
        if (
          Object.prototype.hasOwnProperty.call(patch, "invoice_ref_date") ||
          Object.prototype.hasOwnProperty.call(patch, "vendor_id")
        ) {
          const vr = resolveVendorRow(state.vendors, row.vendor_id);
          const inv = String(row.invoice_ref_date ?? "").trim();
          const days = vendorCreditLimitDaysFromRow(vr);
          row.due_date = inv && days != null ? addDaysToIsoDate(inv, days) : "";
        }
      }
      row = inferProductLineTdsPercentFromLegacyAmount(row);
      row = applyProductLineGstCommissionDerived(row, Object.keys(patch));
      lines[0] = row;
      return { ...current, productLines: lines };
    });
  }

  async function handleCustomerChange(value) {
    let nextTravelers = [];
    if (value && apiRequest && token) {
      try {
        const r = await apiRequest(buildTravelersListUrl(1, 100, "", value), { token });
        nextTravelers = Array.isArray(r?.items) ? r.items : [];
        mergeTravelersIntoState?.(nextTravelers);
      } catch {
        nextTravelers = state.travelers.filter((t) => String(t.customer_id) === String(value));
      }
    } else if (value) {
      nextTravelers = state.travelers.filter((t) => String(t.customer_id) === String(value));
    }
    setForm((current) => ({
      ...current,
      customer_id: value,
      travelerLines: patchLine(current.travelerLines?.length ? current.travelerLines : [emptyTravelerLine()], 0, {
        traveler_id: nextTravelers[0] ? String(nextTravelers[0].id) : "",
      }),
    }));
  }

  function handleProductChange(value) {
    const val = String(value).trim();
    const product = state.products.find(
      (item) => String(catalogProductPrimaryId(item) ?? item.product_id ?? "").trim() === val,
    );
    const patch = {
      product_id: value,
      vendor_id: product ? String(product.vendor_id) : "",
      price: product ? String(product.price) : "",
    };
    updateProductLine0(patch);
  }

  return (
    <FormModal
      open={open}
      title={title}
      saveLabel={saveLabel}
      saving={saving}
      size="modal-xl"
      onCancel={onCancel}
      onSubmit={onSubmit}
    >
      <BookingAlertMessage
        id="ta-booking-form-validation-error"
        message={isVendorTaxableCapValidationMessage(formError) ? "" : formError}
        variant="danger"
        onDismiss={onFormErrorDismiss}
      />
      <div className="row g-3">
        <CustomerAutocomplete
          label="Customer"
          value={form.customer_id}
          required
          onChange={handleCustomerChange}
          customers={state.customers}
          apiRequest={apiRequest}
          token={token}
          onResolvedRecord={(c) => mergeCustomersIntoState?.([c])}
          {...customerAutocompleteExtras}
        />
        <TextField
          label="Destination"
          id="ta-booking-form-destination"
          value={form.destination}
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. Dubai, Paris — must match Masters catalogue labels"
          onChange={(value) =>
            setForm((current) => {
              const allowed = productsForBookingDestination(state.products, value);
              const allowedIds = new Set(
                allowed
                  .map((p) => String(catalogProductPrimaryId(p) ?? p.product_id ?? "").trim())
                  .filter(Boolean),
              );
              const allowedVendorIds = vendorIdsEligibleForDestination(
                state.products,
                state.vendors,
                value,
              );
              const lines = current.productLines?.length
                ? [...current.productLines]
                : [emptyProductLine()];
              const row = { ...lines[0] };
              if (row.product_id && !allowedIds.has(String(row.product_id))) {
                row.product_id = "";
                row.vendor_id = "";
                row.price = "";
                row.line_total = "0";
              }
              lines[0] = row;

              const vLines = current.vendorPaymentLines?.length
                ? [...current.vendorPaymentLines]
                : [emptyVendorPaymentLine()];
              const nextVendorLines = vLines.map((line) => {
                const nextDest = String(value || "").trim();
                if (line.product_id && String(line.product_id).trim()) {
                  if (!nextDest || !allowedIds.has(String(line.product_id))) {
                    return {
                      ...line,
                      product_id: "",
                      vendor_id: "",
                      product_type_id: "",
                      amount: "",
                      quantity: "1",
                    };
                  }
                  return line;
                }
                const vid = Number(line.vendor_id);
                if (!vid) {
                  return line;
                }
                if (!nextDest || !allowedVendorIds.has(vid)) {
                  return {
                    ...line,
                    vendor_id: "",
                    product_id: "",
                    product_type_id: "",
                    amount: "",
                    quantity: "1",
                  };
                }
                return line;
              });

              return {
                ...current,
                destination: value,
                productLines: lines,
                vendorPaymentLines: nextVendorLines,
              };
            })
          }
        />
        <TextField
          label="DRC No"
          value={form.drc_no}
          onChange={(value) => setForm((current) => ({ ...current, drc_no: value }))}
        />
        <TextField
          label="Total order value"
          formatAmountOnBlur
          required
          placeholder="e.g. 5000 or 15000"
          value={form.total_amount}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              total_amount: value,
            }))
          }
        />
        <TextField
          label="Travel Start Date"
          type="date"
          value={form.travel_start_date}
          onChange={(value) =>
            setForm((current) => ({ ...current, travel_start_date: value }))
          }
        />
        <TextField
          label="Travel End Date"
          type="date"
          value={form.travel_end_date}
          onChange={(value) =>
            setForm((current) => ({ ...current, travel_end_date: value }))
          }
        />
        <TextField
          label="Estimated Margin"
          type="number"
          step="0.01"
          min="0"
          value={form.estimated_margin == null ? "" : String(form.estimated_margin)}
          onChange={(value) =>
            setForm((current) => ({ ...current, estimated_margin: value }))
          }
        />
        <TravelerAutocomplete
          label="Traveler"
          value={t0.traveler_id}
          required
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              travelerLines: patchLine(
                current.travelerLines?.length ? current.travelerLines : [emptyTravelerLine()],
                0,
                { traveler_id: value },
              ),
            }))
          }
          travelers={state.travelers}
          customers={state.customers}
          customerIdFilter={form.customer_id}
          apiRequest={apiRequest}
          token={token}
          onResolvedRecord={(t) => mergeTravelersIntoState?.([t])}
          disabled={!String(form.customer_id || "").trim()}
          placeholder={
            String(form.customer_id || "").trim()
              ? "Search passenger by name (passenger · customer)…"
              : "Select customer above first"
          }
          {...travelerAutocompleteExtras}
        />
        <TextField
          label="Seat Preference"
          value={t0.seat_preference}
          maxLength={100}
          placeholder="e.g. 12A, window, aisle"
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              travelerLines: patchLine(
                current.travelerLines?.length ? current.travelerLines : [emptyTravelerLine()],
                0,
                { seat_preference: value },
              ),
            }))
          }
        />
        <TextField
          label="Meal Preference"
          value={t0.meal_preference}
          maxLength={100}
          placeholder="e.g. vegetarian, non-veg"
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              travelerLines: patchLine(
                current.travelerLines?.length ? current.travelerLines : [emptyTravelerLine()],
                0,
                { meal_preference: value },
              ),
            }))
          }
        />
        <TextField
          label="Special Request"
          value={t0.special_request}
          placeholder="Optional notes — wheelchair, allergies…"
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              travelerLines: patchLine(
                current.travelerLines?.length ? current.travelerLines : [emptyTravelerLine()],
                0,
                { special_request: value },
              ),
            }))
          }
        />
        <div className="col-12">
          <VendorBookingProductsSection
            vendorPaymentLines={form.vendorPaymentLines}
            setForm={setForm}
            products={state.products}
            productTypes={state.productTypes || []}
            vendors={state.vendors || []}
            bookingDestination={form.destination}
            passengerCount={travelerPassengerCount(form.travelerLines)}
            cardClassName="card mb-0 ta-order-section ta-booking-vendor-products--embedded border"
            catalogToolbar={catalogToolbar}
            orderTotalDefaultPrice={form.total_amount}
          />
        </div>
        <div className="col-12">
          <p className="form-label mb-0 fw-semibold text-muted small text-uppercase">Product line detail</p>
          <p className="small text-muted mb-2">
            After you pick a vendor, products prefer the booking destination; if none match, this vendor’s other
            catalogue rows still appear so you can select a line.
          </p>
        </div>
        <SelectField
          label="Vendor"
          value={p0.vendor_id}
          required
          onChange={(value) => {
            const vendorRow = resolveVendorRow(state.vendors, value);
            let opts = productsForVendorPaymentLine(
              state.products,
              form.destination,
              value,
              vendorAssignedTypeIds(vendorRow),
            );
            if (!opts.length) {
              const dest = productsForBookingDestination(state.products, form.destination);
              opts = dest.length > 0 ? dest : Array.isArray(state.products) ? state.products : [];
            }
            const allowed = new Set(
              opts
                .map((p) => String(catalogProductPrimaryId(p) ?? p.product_id ?? "").trim())
                .filter(Boolean),
            );
            const clearProduct =
              String(p0.product_id || "").trim() && !allowed.has(String(p0.product_id));
            updateProductLine0({
              vendor_id: value,
              ...(clearProduct ? { product_id: "", price: "", line_total: "0" } : {}),
            });
          }}
          options={vendorsForModalProductLine.map((item) => ({
            value: String(item.id),
            label: item.vendor_name,
          }))}
        />
        <SelectField
          label="Product"
          value={p0.product_id}
          required
          onChange={handleProductChange}
          options={productsForModalPaymentLine
            .filter(
              (item) =>
                catalogProductPrimaryId(item) != null &&
                String(catalogProductPrimaryId(item)).trim() !== "",
            )
            .map((item) => ({
              value: String(catalogProductPrimaryId(item)),
              label: catalogProductPickerLabel(item),
            }))}
        />
        <TextField
          label="Invoice No"
          value={p0.invoice_ref_numbers}
          onChange={(value) => updateProductLine0({ invoice_ref_numbers: value })}
        />
        <TextField
          label="Invoice date"
          type="date"
          value={p0.invoice_ref_date}
          onChange={(value) => updateProductLine0({ invoice_ref_date: value })}
        />
        <TextField
          label="Taxable amount"
          formatAmountOnBlur
          value={p0.taxable_amount == null ? "" : String(p0.taxable_amount)}
          onChange={(value) => updateProductLine0({ taxable_amount: value })}
        />
        <TextField
          label="GST %"
          type="number"
          step="0.01"
          min="0"
          value={p0.gst_percent == null ? "" : String(p0.gst_percent)}
          onChange={(value) => updateProductLine0({ gst_percent: value })}
        />
        <TextField
          label="GST amount"
          formatAmountOnBlur
          value={p0.gst_amount == null ? "" : String(p0.gst_amount)}
          onChange={(value) => updateProductLine0({ gst_amount: value })}
          title="Enter amount or use GST % — synced with taxable"
        />
        <TextField
          label="Commission %"
          type="number"
          step="0.01"
          min="0"
          value={p0.commission_percent == null ? "" : String(p0.commission_percent)}
          onChange={(value) => updateProductLine0({ commission_percent: value })}
        />
        <TextField
          label="Commission amount"
          formatAmountOnBlur
          value={p0.commission_amount == null ? "" : String(p0.commission_amount)}
          onChange={(value) => updateProductLine0({ commission_amount: value })}
          title="Enter amount or use Commission % — synced with taxable"
        />
        <TextField
          label="TDS %"
          type="number"
          step="0.01"
          min="0"
          value={p0.tds_percent == null ? "" : String(p0.tds_percent)}
          onChange={(value) =>
            updateProductLine0({
              tds_percent: value,
              ...(String(value ?? "").trim() === "" ? { tds_amount: "" } : {}),
            })
          }
        />
        <TextField
          label="TDS amount"
          formatAmountOnBlur
          value={p0.tds_amount == null ? "" : String(p0.tds_amount)}
          onChange={(value) => updateProductLine0({ tds_amount: value })}
          title="Enter amount or use TDS % — synced with taxable"
        />
        <p className="small text-muted col-12 mb-0">
          GST, commission, and TDS: enter either % or amount; the other field updates from taxable.
        </p>
        <div className="col-12 col-md-6">
          <label className="form-label">Net payable</label>
          <div
            className="form-control-plaintext border rounded px-3 py-2 bg-light small"
            title="Taxable amount + GST amount − TDS − commission amount"
          >
            {p0.net_payable !== "" &&
            p0.net_payable != null &&
            Number.isFinite(parseBookingAmountNumber(p0.net_payable))
              ? formatCurrency(parseBookingAmountNumber(p0.net_payable))
              : "—"}
          </div>
          <span className="small text-muted d-block mt-1">
            Taxable + GST amount − TDS − commission amount
          </span>
        </div>
        <TextField
          label="Due date"
          type="date"
          value={p0.due_date}
          onChange={(value) => updateProductLine0({ due_date: value })}
        />
        <p className="small text-muted col-12">
          Defaults from invoice date plus the vendor&apos;s credit limit (days) when set on the vendor master.
        </p>
        <SelectField
          label="Payment mode"
          value={p0.payment_mode ?? ""}
          onChange={(value) => updateProductLine0({ payment_mode: value })}
          options={paymentMethodFieldOptions(
            state.paymentModes || [],
            p0.payment_mode,
            "Select payment mode",
          )}
        />
        <TextField
          label="Quantity"
          type="number"
          min="1"
          required
          value={p0.quantity}
          onChange={(value) => updateProductLine0({ quantity: value })}
        />
        <TextField
          label="Price"
          formatAmountOnBlur
          required
          value={p0.price}
          onChange={(value) => updateProductLine0({ price: value })}
        />
        <TextField
          label="Line Total"
          formatAmountOnBlur
          value={p0.line_total}
          onChange={(value) => updateProductLine0({ line_total: value })}
        />
        <SelectField
          label="Assign to ATPL member"
          value={String(form.atpl_assigned_user_id ?? "")}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              atpl_assigned_user_id: value,
              atpl_member: Boolean(value),
            }))
          }
          options={[
            { value: "", label: "Not assigned" },
            ...(state.systemUsers || [])
              .filter((u) => u.is_active !== false)
              .map((u) => ({
                value: String(u.id),
                label: [u.name, u.email].filter(Boolean).join(" · ") || `User #${u.id}`,
              })),
          ]}
        />
      </div>
    </FormModal>
  );
}

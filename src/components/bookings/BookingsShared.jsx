import { useEffect, useMemo } from "react";
import { NavLink } from "react-router-dom";
import {
  AlertMessage,
  AutocompleteField,
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

export { formatDate };

/** Shared with booking payment lines and standalone payments UI. */
export const PAYMENT_STATUS_OPTIONS = ["Pending", "Partial", "Paid"];

export function BookingsSubmenu({ links }) {

  return (
    <div className="card">
      <div className="card-body py-3">
        <div className="ta-submenu">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `btn btn-sm ${isActive ? "btn-primary" : "btn-light"}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status, ...rest }) {
  let className = "bg-info-subtle text-info";
  const normalized = (status || "Unknown").toLowerCase();

  if (normalized === "confirmed" || normalized === "paid") {
    className = "bg-success-subtle text-success";
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

/** Product master rows (`product_details`) scoped to a booking destination. */
export function productsForBookingDestination(products, destinationId) {
  const did = String(destinationId ?? "").trim();
  if (!did || !Array.isArray(products)) {
    return [];
  }
  return products.filter((p) => String(p.destination_id) === did);
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
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
 * Opens a printable proforma invoice from a booking-shaped form and catalogue state (draft or saved booking).
 */
export function openProformaInvoicePrintWindow(form, state, bookingId) {
  const customers = state?.customers ?? [];
  const destinations = state?.destinations ?? [];
  const products = state?.products ?? [];

  const customer = customers.find((c) => String(c.id) === String(form.customer_id));
  const customerName = customer
    ? [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || "—"
    : "—";
  const dest = destinations.find((d) => String(d.id) === String(form.destination_id));
  const destinationName = dest?.destination_name || "—";
  const productById = new Map(products.map((p) => [String(p.product_id), p]));

  const proformaNo = String(form.proforma_invoice_number ?? "").trim();
  const proformaDate = String(form.proforma_invoice_date ?? "").trim();
  const bookingRef =
    String(form.drc_no ?? "").trim() ||
    (bookingId != null && String(bookingId).trim() ? `Booking #${bookingId}` : "Draft booking");

  const lineRows = (form.productLines || [])
    .filter((l) => l.product_id && l.vendor_id)
    .map((l) => {
      const p = productById.get(String(l.product_id));
      const desc = p?.product_name || `Product #${l.product_id}`;
      const qty = String(l.quantity || "1").trim() || "1";
      return `<tr>
        <td>${escapeHtmlProforma(desc)}</td>
        <td class="num">${escapeHtmlProforma(qty)}</td>
        <td class="num">${escapeHtmlProforma(formatCurrency(l.price))}</td>
        <td class="num">${escapeHtmlProforma(formatCurrency(l.line_total))}</td>
      </tr>`;
    })
    .join("");

  const payRows = (form.paymentLines || [])
    .filter((l) => l.payment_method && Number(l.amount) > 0)
    .map(
      (l) => `<tr>
        <td>${escapeHtmlProforma(formatCurrency(l.amount))}</td>
        <td>${escapeHtmlProforma(l.payment_method)}</td>
        <td>${escapeHtmlProforma(l.transaction_reference || "—")}</td>
        <td>${escapeHtmlProforma(l.payment_date ? formatDate(l.payment_date) : "—")}</td>
      </tr>`,
    )
    .join("");

  const travelStart = form.travel_start_date ? formatDate(form.travel_start_date) : "—";
  const travelEnd = form.travel_end_date ? formatDate(form.travel_end_date) : "—";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Proforma invoice${proformaNo ? ` — ${escapeHtmlProforma(proformaNo)}` : ""}</title>
  <style>
    body { font-family: system-ui, Segoe UI, sans-serif; margin: 2rem; color: #1a1a1a; }
    h1 { font-size: 1.35rem; margin: 0 0 0.25rem; }
    .sub { color: #555; font-size: 0.9rem; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.9rem; }
    th, td { border: 1px solid #ccc; padding: 0.5rem 0.6rem; text-align: left; }
    th { background: #f4f4f4; }
    td.num, th.num { text-align: right; }
    .totals { margin-top: 1rem; text-align: right; font-size: 1.05rem; font-weight: 600; }
    .meta { margin: 0.75rem 0; font-size: 0.9rem; line-height: 1.5; }
    @media print { body { margin: 1rem; } }
  </style>
</head>
<body>
  <h1>Proforma invoice</h1>
  <div class="sub">This document is not a tax invoice.</div>
  <div class="meta">
    <div><strong>Proforma no.</strong> ${escapeHtmlProforma(proformaNo || "—")}</div>
    <div><strong>Proforma date</strong> ${escapeHtmlProforma(proformaDate ? formatDate(proformaDate) : "—")}</div>
    <div><strong>Booking ref.</strong> ${escapeHtmlProforma(bookingRef)}</div>
    <div><strong>Customer</strong> ${escapeHtmlProforma(customerName)}</div>
    <div><strong>Destination</strong> ${escapeHtmlProforma(destinationName)}</div>
    <div><strong>Travel</strong> ${escapeHtmlProforma(travelStart)} — ${escapeHtmlProforma(travelEnd)}</div>
  </div>
  <table>
    <thead>
      <tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Line total</th></tr>
    </thead>
    <tbody>
      ${lineRows || `<tr><td colspan="4">No product lines yet.</td></tr>`}
    </tbody>
  </table>
  <div class="totals">Total (tour value): ${escapeHtmlProforma(formatCurrency(form.total_amount))}</div>
  ${
    payRows
      ? `<h2 style="font-size:1.1rem;margin-top:2rem;">Customer payments (recorded)</h2>
  <table>
    <thead>
      <tr><th>Amount</th><th>Method</th><th>Reference</th><th>Date</th></tr>
    </thead>
    <tbody>${payRows}</tbody>
  </table>`
      : ""
  }
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

  /** Do not pass `noopener` in the third argument: the spec requires `window.open` to return `null`, so `document.write` never runs. */
  const w = window.open("", "_blank");
  if (w) {
    try {
      w.opener = null;
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      return;
    } catch {
      try {
        w.close();
      } catch {
        /* ignore */
      }
    }
  }

  // Popup blocked or write failed: print from a hidden iframe (same tab, no new window).
  try {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Proforma invoice print preview");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;border:0;opacity:0;pointer-events:none;z-index:-1;";
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
    iframe.contentWindow?.focus();
    const cleanup = () => {
      try {
        iframe.remove();
      } catch {
        /* ignore */
      }
    };
    iframe.contentWindow?.addEventListener("afterprint", cleanup);
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

export function emptyProductLine() {
  return {
    product_id: "",
    vendor_id: "",
    quantity: "1",
    price: "",
    line_total: "0.00",
    invoice_ref_numbers: "",
    invoice_ref_date: "",
    gross_amount: "",
    taxable_amount: "",
    gst_percent: "",
    gst_amount: "",
    commission_percent: "",
    commission_amount: "",
    tds_amount: "",
    net_payable: "",
    minimum_due: "",
    payment_mode: "",
  };
}

function strOrNull(v) {
  const t = String(v ?? "").trim();
  return t ? t : null;
}

function decOrNull(v) {
  if (v === "" || v == null) {
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function emptyPaymentLine() {
  return {
    amount: "",
    payment_method: "",
    transaction_reference: "",
    payment_date: "",
    status: "Pending",
  };
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

/** Number of traveler rows with a passenger selected. */
export function travelerPassengerCount(travelerLines) {
  const lines = travelerLines?.length ? travelerLines : [];
  return lines.filter((l) => String(l.traveler_id ?? "").trim()).length;
}

/** Booking total = sum of Product Details “Total price” (unit price × qty per row). */
export function computedBookingTotalFromProductDetailLines(vendorPaymentLines) {
  const sum = sumVendorProductDetailAmounts(vendorPaymentLines);
  return sum > 0 ? sum.toFixed(2) : "";
}

/** Keeps `total_amount` equal to the sum of Product Details line totals when enabled. */
export function useBookingTotalFromProductDetailsAndTravelers(form, setForm, enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const next = computedBookingTotalFromProductDetailLines(form.vendorPaymentLines);
    setForm((c) => {
      const cur = String(c.total_amount ?? "");
      if (cur === next) {
        return c;
      }
      return { ...c, total_amount: next };
    });
  }, [enabled, form.vendorPaymentLines, setForm]);
}

export function createEmptyBookingForm() {
  return {
    customer_id: "",
    destination_id: "",
    atpl_member: false,
    drc_no: "",
    travel_start_date: "",
    travel_end_date: "",
    estimated_margin: "",
    total_amount: "",
    status: "Pending",
    travelerLines: [emptyTravelerLine()],
    productLines: [emptyProductLine()],
    paymentLines: [emptyPaymentLine()],
    vendorPaymentLines: [emptyVendorPaymentLine()],
    proforma_invoice_number: "",
    proforma_invoice_date: "",
  };
}

export function createDefaultBookingForm(data) {
  const firstCustomer = data.customers[0];
  const firstDestination = data.destinations[0];
  const firstProduct = productsForBookingDestination(
    data.products,
    firstDestination?.id,
  )[0];
  const matchingTravelers = data.travelers.filter(
    (traveler) => traveler.customer_id === firstCustomer?.id,
  );

  return {
    customer_id: firstCustomer ? String(firstCustomer.id) : "",
    destination_id: firstDestination ? String(firstDestination.id) : "",
    atpl_member: false,
    drc_no: "",
    travel_start_date: "",
    travel_end_date: "",
    estimated_margin: "",
    total_amount: firstProduct ? String(firstProduct.price) : "",
    status: "Pending",
    travelerLines: [
      {
        traveler_id: matchingTravelers[0] ? String(matchingTravelers[0].id) : "",
        seat_preference: "",
        meal_preference: "",
        special_request: "",
      },
    ],
    productLines: [
      {
        ...emptyProductLine(),
        product_id: firstProduct ? String(firstProduct.product_id) : "",
        vendor_id: firstProduct ? String(firstProduct.vendor_id) : "",
        quantity: "1",
        price: firstProduct ? String(firstProduct.price) : "",
        line_total: firstProduct ? String(firstProduct.price) : "0.00",
      },
    ],
    paymentLines: [emptyPaymentLine()],
    vendorPaymentLines: [emptyVendorPaymentLine()],
    proforma_invoice_number: "",
    proforma_invoice_date: "",
  };
}

export function createBookingFormFromBooking(booking, options = {}) {
  const catalogueProducts = options.catalogueProducts ?? [];
  const tSrc = booking.travelers?.length ? booking.travelers : [];
  const travelerLines = tSrc.length
    ? tSrc.map((t) => ({
        traveler_id: String(t.traveler_id),
        seat_preference: t.seat_preference || "",
        meal_preference: t.meal_preference || "",
        special_request: t.special_request || "",
      }))
    : [emptyTravelerLine()];

  const pSrc = booking.products?.length ? booking.products : [];
  const productLines = pSrc.length
    ? pSrc.map((p) => ({
        product_id: String(p.product_id),
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
        tds_amount: p.tds_amount != null ? String(p.tds_amount) : "",
        net_payable: p.net_payable != null ? String(p.net_payable) : "",
        minimum_due: p.minimum_due != null ? String(p.minimum_due) : "",
        payment_mode: p.payment_mode != null ? String(p.payment_mode) : "",
      }))
    : [emptyProductLine()];

  const paySrc = booking.payments?.length ? booking.payments : [];
  const paymentLines = paySrc.length
    ? paySrc.map((pay) => ({
        amount: String(pay.amount),
        payment_method: pay.payment_method || "",
        transaction_reference: pay.transaction_reference || "",
        payment_date: pay.payment_date || "",
        status: pay.status || "Pending",
      }))
    : [emptyPaymentLine()];

  const vpaySrc = booking.vendor_payments?.length ? booking.vendor_payments : [];
  const vendorPaymentLines = vpaySrc.length
    ? vpaySrc.map((vp) => {
        const pid =
          vp.product_id !== null && vp.product_id !== undefined ? String(vp.product_id) : "";
        const cat = pid
          ? catalogueProducts.find((p) => String(p.product_id) === pid)
          : null;
        const qtyRaw = Number(vp.quantity);
        const qty = Number.isFinite(qtyRaw) && qtyRaw >= 1 ? Math.floor(qtyRaw) : 1;
        const totalAmt = Number(vp.amount);
        const unit = Number.isFinite(totalAmt) && qty > 0 ? totalAmt / qty : totalAmt;
        const unitStr =
          Number.isFinite(unit) && qty > 0
            ? (Math.round(unit * 100) / 100).toFixed(2)
            : String(vp.amount ?? "");
        return {
          product_type_id:
            cat?.product_type_id !== null && cat?.product_type_id !== undefined
              ? String(cat.product_type_id)
              : "",
          vendor_id: String(vp.vendor_id),
          product_id: pid,
          amount: unitStr,
          quantity: String(qty),
          payment_method: vp.payment_method || "",
          payment_date: vp.payment_date || "",
          status: vp.status || "Pending",
        };
      })
    : [emptyVendorPaymentLine()];

  return {
    id: String(booking.id),
    customer_id: String(booking.customer_id || ""),
    destination_id: String(booking.destination_id || ""),
    atpl_member: Boolean(booking.atpl_member),
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
    proforma_invoice_number:
      booking.proforma_invoice_number != null ? String(booking.proforma_invoice_number) : "",
    proforma_invoice_date: booking.proforma_invoice_date || "",
  };
}

export function buildBookingPayload(form) {
  const travelers = (form.travelerLines || [])
    .filter((l) => l.traveler_id)
    .map((l) => ({
      traveler_id: Number(l.traveler_id),
      seat_preference: l.seat_preference || null,
      meal_preference: l.meal_preference || null,
      special_request: l.special_request || null,
    }));

  const products = (form.productLines || [])
    .filter((l) => l.product_id && l.vendor_id)
    .map((l) => ({
      product_id: Number(l.product_id),
      vendor_id: Number(l.vendor_id),
      quantity: Number(l.quantity),
      price: Number(l.price),
      total_amount: Number(l.line_total),
      vendor_display_name: null,
      invoice_ref_numbers: strOrNull(l.invoice_ref_numbers),
      invoice_ref_date: strOrNull(l.invoice_ref_date) || null,
      gross_amount: decOrNull(l.gross_amount),
      taxable_amount: decOrNull(l.taxable_amount),
      gst_percent: decOrNull(l.gst_percent),
      gst_amount: decOrNull(l.gst_amount),
      commission_percent: decOrNull(l.commission_percent),
      commission_amount: decOrNull(l.commission_amount),
      tds_amount: decOrNull(l.tds_amount),
      net_payable: decOrNull(l.net_payable),
      minimum_due: decOrNull(l.minimum_due),
      payment_mode: strOrNull(l.payment_mode),
    }));

  const payments = (form.paymentLines || [])
    .filter((l) => l.payment_method && l.amount && Number(l.amount) > 0)
    .map((l) => ({
      amount: Number(l.amount),
      payment_method: l.payment_method,
      transaction_reference: l.transaction_reference || null,
      payment_date: l.payment_date || null,
      status: l.status || "Pending",
    }));

  const vendor_payments = (form.vendorPaymentLines || [])
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
      return {
        vendor_id: Number(l.vendor_id),
        product_id: l.product_id ? Number(l.product_id) : null,
        amount: vendorProductDetailLineTotal(l),
        quantity,
        payment_method: String(l.payment_method || "").trim() || "Unspecified",
        payment_date: l.payment_date || null,
        status: l.status || "Pending",
      };
    });

  return {
    customer_id: Number(form.customer_id),
    destination_id: Number(form.destination_id),
    atpl_member: form.atpl_member,
    drc_no: form.drc_no || null,
    travel_start_date: form.travel_start_date || null,
    travel_end_date: form.travel_end_date || null,
    estimated_margin: form.estimated_margin ? Number(form.estimated_margin) : null,
    total_amount: Number(form.total_amount),
    status: form.status,
    proforma_invoice_number: strOrNull(form.proforma_invoice_number),
    proforma_invoice_date: strOrNull(form.proforma_invoice_date) || null,
    travelers,
    products,
    payments,
    vendor_payments,
  };
}

export function validateBookingForm(form) {
  if (!form.customer_id) {
    return "Customer is required.";
  }

  if (!form.destination_id) {
    return "Destination is required.";
  }

  if (!form.status) {
    return "Status is required.";
  }

  const travelers = form.travelerLines || [];
  if (!travelers.some((l) => l.traveler_id)) {
    return "At least one traveler is required.";
  }

  const products = form.productLines || [];
  const validProducts = products.filter((l) => l.product_id && l.vendor_id);
  if (!validProducts.length) {
    return "Product lines: add at least one line with vendor and product.";
  }

  for (const line of validProducts) {
    if (!line.quantity || Number(line.quantity) <= 0) {
      return "Each product line detail needs quantity greater than 0.";
    }
    if (!line.price || Number(line.price) <= 0) {
      return "Each product line detail needs price greater than 0.";
    }
  }

  if (!form.total_amount || Number(form.total_amount) <= 0) {
    return "Total amount must be greater than 0.";
  }

  if (form.travel_start_date && form.travel_end_date && form.travel_end_date < form.travel_start_date) {
    return "Travel end date cannot be earlier than travel start date.";
  }

  if (form.estimated_margin && Number(form.estimated_margin) < 0) {
    return "Estimated margin cannot be negative.";
  }

  for (const line of form.paymentLines || []) {
    if (line.amount && Number(line.amount) > 0 && !line.payment_method?.trim()) {
      return "Payment method is required when customer payment amount is entered.";
    }
  }

  for (const line of form.vendorPaymentLines || []) {
    if (vendorProductDetailLineTotal(line) > 0) {
      if (!line.vendor_id) {
        return "Vendor is required when vendor payment amount is entered.";
      }
      const unit = Number(String(line.amount ?? "").trim());
      const qty = Number(String(line.quantity ?? "1").trim());
      if (!Number.isFinite(unit) || unit <= 0) {
        return "Product Details: each line with a total needs unit price greater than 0.";
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return "Product Details: each line needs quantity greater than 0.";
      }
    }
  }

  const passengerCount = travelerPassengerCount(travelers);
  for (const line of form.vendorPaymentLines || []) {
    if (vendorProductDetailLineTotal(line) <= 0) {
      continue;
    }
    const qty = Number(String(line.quantity ?? "1").trim());
    if (Number.isFinite(qty) && qty > 0 && passengerCount > 0 && qty !== passengerCount) {
      return `Product Details: quantity on each line must match the number of travelers (${passengerCount} passenger${
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
  if (m.startsWith("Product Details:") || m.includes("vendor payment amount")) {
    return 1;
  }
  if (m.startsWith("Product lines:") || m.includes("product line detail")) {
    return 4;
  }
  if (m.includes("Payment method is required")) {
    return 3;
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
 * Vendor IDs that appear on product catalogue rows (`product_details`) for a destination.
 * Names come from the vendors master list.
 */
export function vendorIdsFromProductsForDestination(products, destinationId) {
  const did = String(destinationId ?? "").trim();
  if (!did) {
    return new Set();
  }
  const ids = new Set();
  for (const p of products || []) {
    if (String(p.destination_id) !== did) {
      continue;
    }
    const vid = Number(p.vendor_id);
    if (Number.isFinite(vid)) {
      ids.add(vid);
    }
  }
  return ids;
}

/** Catalogue products for a destination + vendor (vendor payout product picker). */
export function productsForVendorAndDestination(products, destinationId, vendorId) {
  const did = String(destinationId ?? "").trim();
  const vid = Number(vendorId);
  if (!did || !Number.isFinite(vid)) {
    return [];
  }
  return (products || []).filter(
    (p) => String(p.destination_id) === did && Number(p.vendor_id) === vid,
  );
}

/**
 * Vendor payout lines for a booking (API: `vendor_payments`).
 * Used on the booking wizard "Product Details" step and in the list "Add Booking" modal.
 */
export function VendorProductDetailsSection({
  vendorPaymentLines,
  setForm,
  vendors,
  products = [],
  productTypes = [],
  destinationId = "",
  cardClassName = "card mb-0 ta-order-section ta-order-section--wizard-panel",
  /** Optional row of actions (e.g. add product type / vendor / catalogue product on booking). */
  catalogToolbar = null,
}) {
  const lines = vendorPaymentLines?.length ? vendorPaymentLines : [emptyVendorPaymentLine()];

  const catalogueVendorIds = useMemo(
    () => vendorIdsFromProductsForDestination(products, destinationId),
    [products, destinationId],
  );

  const productsForDest = useMemo(
    () => productsForBookingDestination(products, destinationId),
    [products, destinationId],
  );

  /** Vendors tied to the destination catalogue (for legacy rows without product_id). */
  const vendorOptionsForSelect = useMemo(() => {
    const masterById = new Map((vendors || []).map((v) => [Number(v.id), v]));
    const ordered = new Map();
    for (const vid of catalogueVendorIds) {
      const m = masterById.get(vid);
      if (m) {
        ordered.set(vid, m);
      }
    }
    const selectedIds = new Set();
    for (const line of lines) {
      const vid = Number(line.vendor_id);
      if (vid) {
        selectedIds.add(vid);
      }
    }
    for (const vid of selectedIds) {
      if (!ordered.has(vid) && masterById.has(vid)) {
        ordered.set(vid, masterById.get(vid));
      }
    }
    return Array.from(ordered.values()).sort((a, b) =>
      String(a.vendor_name || "").localeCompare(String(b.vendor_name || "")),
    );
  }, [catalogueVendorIds, vendors, lines]);

  const vendorMasterById = useMemo(
    () => new Map((vendors || []).map((v) => [Number(v.id), v])),
    [vendors],
  );

  const destinationSet = Boolean(String(destinationId || "").trim());
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

  return (
    <div className={cardClassName}>
      <div className="card-header ta-order-section-title-vendorpay">Product Details</div>
      <div className="card-body">
        {catalogToolbar}
        {destinationSet && !hasCatalogueProducts ? (
          <p className="small text-muted mb-3 mb-md-2">
            No catalogue products for this destination yet. Add rows under{" "}
            <strong>Masters → Product Details</strong> (product, vendor, and destination) to enable vendor payouts
            here.
          </p>
        ) : null}
        <div className="table-responsive ta-order-table-wrap">
          <table className="table table-sm ta-order-table align-middle">
            <thead>
              <tr>
                <th>Product type</th>
                <th>Vendor</th>
                <th>Product</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Total price</th>
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const selTid = String(line.product_type_id || "").trim();
                const selVid = Number(line.vendor_id);
                let typeOpts = [...productTypesSorted];
                if (selTid && !typeOpts.some((t) => String(t.id) === selTid)) {
                  const orphanType = typeMasterById.get(Number(selTid));
                  if (orphanType) {
                    typeOpts = [...typeOpts, orphanType];
                  }
                }
                typeOpts.sort((a, b) =>
                  String(a.product_name || "").localeCompare(String(b.product_name || "")),
                );

                let productOpts = [];
                if (hasCatalogueProducts || String(line.product_id || "").trim()) {
                  productOpts = [...productsForDest];
                  if (selTid) {
                    productOpts = productOpts.filter((p) => String(p.product_type_id) === selTid);
                  }
                  if (Number.isFinite(selVid) && selVid > 0) {
                    productOpts = productOpts.filter((p) => Number(p.vendor_id) === selVid);
                  }
                  if (!selTid && !(Number.isFinite(selVid) && selVid > 0)) {
                    productOpts = [];
                  }
                }
                const selPid = Number(line.product_id);
                if (selPid && !productOpts.some((p) => Number(p.product_id) === selPid)) {
                  const orphan = (products || []).find((p) => Number(p.product_id) === selPid);
                  if (orphan) {
                    productOpts = [...productOpts, orphan];
                  }
                }
                productOpts.sort((a, b) =>
                  String(a.product_name || "").localeCompare(String(b.product_name || "")),
                );

                const selectedProduct = (products || []).find((p) => Number(p.product_id) === selPid);
                let vendorOpts = [];
                if (selPid && selectedProduct) {
                  const vm = vendorMasterById.get(Number(selectedProduct.vendor_id));
                  if (vm) {
                    vendorOpts = [vm];
                  }
                } else if (selPid && !selectedProduct && Number(line.vendor_id)) {
                  const vm = vendorMasterById.get(Number(line.vendor_id));
                  vendorOpts = vm ? [vm] : [];
                } else {
                  vendorOpts = vendorOptionsForSelect;
                }

                const vendorDisabled =
                  !destinationSet ||
                  (!selPid && vendorOptionsForSelect.length === 0) ||
                  (Boolean(selPid) && vendorOpts.length === 0);

                const typeOrVendorForLine =
                  Boolean(selTid) || (Number.isFinite(selVid) && selVid > 0);
                const priceQtyDisabled = !destinationSet || !typeOrVendorForLine;
                const lineTotalNum = vendorProductDetailLineTotal(line);
                const lineTotalLabel = lineTotalNum > 0 ? formatCurrency(lineTotalNum) : "—";

                return (
                <tr key={`vpay-${idx}`}>
                  <td style={{ minWidth: "10rem" }}>
                    <label className="form-label visually-hidden" htmlFor={`ta-vpay-ptype-${idx}`}>
                      Product type
                    </label>
                    <select
                      id={`ta-vpay-ptype-${idx}`}
                      className="form-select form-select-sm"
                      disabled={productTypesSorted.length === 0 && !line.product_type_id}
                      value={line.product_type_id}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          vendorPaymentLines: patchVendorLines(c, idx, {
                            product_type_id: e.target.value,
                            product_id: "",
                            vendor_id: "",
                            amount: "",
                            quantity: "1",
                          }),
                        }))
                      }
                    >
                      <option value="">Select</option>
                      {typeOpts.map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {t.product_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ minWidth: "11rem" }}>
                    <label className="form-label visually-hidden" htmlFor={`ta-vpay-vendor-${idx}`}>
                      Vendor
                    </label>
                    <select
                      id={`ta-vpay-vendor-${idx}`}
                      className="form-select form-select-sm"
                      disabled={vendorDisabled}
                      value={line.vendor_id}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          vendorPaymentLines: patchVendorLines(c, idx, {
                            vendor_id: e.target.value,
                            product_id: "",
                            amount: "",
                            quantity: "1",
                          }),
                        }))
                      }
                    >
                      <option value="">Select</option>
                      {vendorOpts.map((item) => (
                        <option key={item.id} value={String(item.id)}>
                          {item.vendor_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ minWidth: "12rem" }}>
                    <label className="form-label visually-hidden" htmlFor={`ta-vpay-product-${idx}`}>
                      Product
                    </label>
                    <select
                      id={`ta-vpay-product-${idx}`}
                      className="form-select form-select-sm"
                      disabled={
                        !destinationSet ||
                        (!hasCatalogueProducts && !line.product_id) ||
                        !typeOrVendorForLine
                      }
                      value={line.product_id}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const prod = (products || []).find((p) => String(p.product_id) === String(pid));
                        setForm((c) => ({
                          ...c,
                          vendorPaymentLines: patchVendorLines(c, idx, {
                            product_id: pid,
                            vendor_id: prod ? String(prod.vendor_id) : "",
                            product_type_id: prod ? String(prod.product_type_id) : line.product_type_id,
                            amount: prod && prod.price != null && prod.price !== "" ? String(prod.price) : "",
                            quantity: "1",
                          }),
                        }));
                      }}
                    >
                      <option value="">Select</option>
                      {productOpts.map((p) => (
                        <option key={p.product_id} value={String(p.product_id)}>
                          {p.product_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ minWidth: "7.5rem" }}>
                    <label className="form-label visually-hidden" htmlFor={`ta-vpay-price-${idx}`}>
                      Price
                    </label>
                    <input
                      id={`ta-vpay-price-${idx}`}
                      type="number"
                      className="form-control form-control-sm"
                      step="0.01"
                      min="0"
                      disabled={priceQtyDisabled}
                      placeholder={
                        String(line.product_id || "").trim()
                          ? "Unit price"
                          : "Choose type/vendor/product"
                      }
                      value={line.amount}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          vendorPaymentLines: patchVendorLines(c, idx, { amount: e.target.value }),
                        }))
                      }
                    />
                    <span className="text-muted ta-vpay-date-hint d-block">From catalogue; editable</span>
                  </td>
                  <td style={{ minWidth: "5rem" }}>
                    <label className="form-label visually-hidden" htmlFor={`ta-vpay-qty-${idx}`}>
                      Qty
                    </label>
                    <input
                      id={`ta-vpay-qty-${idx}`}
                      type="number"
                      className="form-control form-control-sm"
                      step="1"
                      min="1"
                      disabled={priceQtyDisabled}
                      value={line.quantity ?? "1"}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          vendorPaymentLines: patchVendorLines(c, idx, { quantity: e.target.value }),
                        }))
                      }
                    />
                  </td>
                  <td style={{ minWidth: "7.5rem" }} className="fw-medium">
                    <span className="visually-hidden">Total price</span>
                    {lineTotalLabel}
                  </td>
                  <td className="text-end text-nowrap">
                    {lines.length > 1 ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() =>
                          setForm((c) => ({
                            ...c,
                            vendorPaymentLines: (c.vendorPaymentLines || []).filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        Remove
                      </button>
                    ) : null}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm mt-3"
          onClick={() =>
            setForm((c) => ({
              ...c,
              vendorPaymentLines: [...(c.vendorPaymentLines || []), emptyVendorPaymentLine()],
            }))
          }
        >
          Add vendor payment row
        </button>
      </div>
    </div>
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
  form,
  setForm,
  state,
  bookingStatusOptions,
  paymentStatusOptions = PAYMENT_STATUS_OPTIONS,
  customerAutocompleteExtras = {},
  destinationAutocompleteExtras = {},
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

  const productsForDestination = useMemo(
    () => productsForBookingDestination(state.products, form.destination_id),
    [state.products, form.destination_id],
  );

  const selectedDestinationLabel = state.destinations.find(
    (d) => String(d.id) === String(form.destination_id),
  )?.destination_name;

  const vendorsForModalProductLine = useMemo(() => {
    const masterById = new Map((state.vendors || []).map((v) => [Number(v.id), v]));
    const allowed = vendorIdsFromProductsForDestination(state.products, form.destination_id);
    const ordered = new Map();
    for (const vid of allowed) {
      const m = masterById.get(vid);
      if (m) {
        ordered.set(vid, m);
      }
    }
    const sel = Number(p0.vendor_id);
    if (sel && !ordered.has(sel) && masterById.has(sel)) {
      ordered.set(sel, masterById.get(sel));
    }
    return Array.from(ordered.values()).sort((a, b) =>
      String(a.vendor_name || "").localeCompare(String(b.vendor_name || "")),
    );
  }, [state.vendors, state.products, form.destination_id, p0.vendor_id]);

  function updateProductLine0(patch) {
    setForm((current) => {
      const lines = current.productLines?.length ? [...current.productLines] : [emptyProductLine()];
      const row = { ...lines[0], ...patch };
      const quantity = Number(row.quantity || 0);
      const price = Number(row.price || 0);
      row.line_total = quantity && price ? (quantity * price).toFixed(2) : "0.00";
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
    const product = state.products.find((item) => String(item.product_id) === String(value));
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
      <AlertMessage id="ta-booking-form-validation-error" message={formError} variant="danger" />
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
        <AutocompleteField
          label="Destination"
          value={form.destination_id}
          required
          onChange={(value) =>
            setForm((current) => {
              const allowed = productsForBookingDestination(state.products, value);
              const allowedIds = new Set(allowed.map((p) => String(p.product_id)));
              const allowedVendorIds = vendorIdsFromProductsForDestination(state.products, value);
              const lines = current.productLines?.length
                ? [...current.productLines]
                : [emptyProductLine()];
              const row = { ...lines[0] };
              if (row.product_id && !allowedIds.has(String(row.product_id))) {
                row.product_id = "";
                row.vendor_id = "";
                row.price = "";
                row.line_total = "0.00";
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
                destination_id: value,
                productLines: lines,
                vendorPaymentLines: nextVendorLines,
              };
            })
          }
          options={state.destinations.map((item) => ({
            value: String(item.id),
            label: item.destination_name,
            searchText: `${item.city || ""} ${item.country || ""}`,
          }))}
          {...destinationAutocompleteExtras}
        />
        <TextField
          label="DRC No"
          value={form.drc_no}
          onChange={(value) => setForm((current) => ({ ...current, drc_no: value }))}
        />
        <TextField
          label="Total Amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          value={form.total_amount}
          onChange={(value) =>
            setForm((current) => ({ ...current, total_amount: value }))
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
          value={form.estimated_margin}
          onChange={(value) =>
            setForm((current) => ({ ...current, estimated_margin: value }))
          }
        />
        <SelectField
          label="Status"
          value={form.status}
          required
          onChange={(value) => setForm((current) => ({ ...current, status: value }))}
          options={bookingStatusOptions.map((status) => ({
            value: status,
            label: status,
          }))}
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
          <VendorProductDetailsSection
            vendorPaymentLines={form.vendorPaymentLines}
            setForm={setForm}
            vendors={state.vendors}
            products={state.products}
            productTypes={state.productTypes || []}
            destinationId={form.destination_id}
            cardClassName="card mb-0 ta-order-section ta-product-details--embedded border"
            catalogToolbar={catalogToolbar}
          />
        </div>
        <div className="col-12">
          <p className="form-label mb-0 fw-semibold text-muted small text-uppercase">Product line detail</p>
          <p className="small text-muted mb-2">
            Vendor and product choices follow the <strong>destination</strong> above: only catalogue rows from Masters →
            Product Details for that destination appear here.
          </p>
        </div>
        <SelectField
          label="Vendor"
          value={p0.vendor_id}
          required
          onChange={(value) =>
            updateProductLine0({
              vendor_id: value,
            })
          }
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
          options={productsForDestination.map((item) => ({
            value: String(item.product_id),
            label: item.product_name,
          }))}
        />
        <TextField
          label="Invoice / ref numbers"
          value={p0.invoice_ref_numbers}
          onChange={(value) => updateProductLine0({ invoice_ref_numbers: value })}
        />
        <TextField
          label="Invoice / ref date"
          type="date"
          value={p0.invoice_ref_date}
          onChange={(value) => updateProductLine0({ invoice_ref_date: value })}
        />
        <TextField
          label="Gross amount"
          type="number"
          step="0.01"
          value={p0.gross_amount}
          onChange={(value) => updateProductLine0({ gross_amount: value })}
        />
        <TextField
          label="Taxable amount"
          type="number"
          step="0.01"
          value={p0.taxable_amount}
          onChange={(value) => updateProductLine0({ taxable_amount: value })}
        />
        <TextField
          label="GST %"
          type="number"
          step="0.01"
          value={p0.gst_percent}
          onChange={(value) => updateProductLine0({ gst_percent: value })}
        />
        <TextField
          label="GST amount"
          type="number"
          step="0.01"
          value={p0.gst_amount}
          onChange={(value) => updateProductLine0({ gst_amount: value })}
        />
        <TextField
          label="Commission %"
          type="number"
          step="0.01"
          value={p0.commission_percent}
          onChange={(value) => updateProductLine0({ commission_percent: value })}
        />
        <TextField
          label="Commission amount"
          type="number"
          step="0.01"
          value={p0.commission_amount}
          onChange={(value) => updateProductLine0({ commission_amount: value })}
        />
        <TextField
          label="TDS amount"
          type="number"
          step="0.01"
          value={p0.tds_amount}
          onChange={(value) => updateProductLine0({ tds_amount: value })}
        />
        <TextField
          label="Net payable"
          type="number"
          step="0.01"
          value={p0.net_payable}
          onChange={(value) => updateProductLine0({ net_payable: value })}
        />
        <TextField
          label="Minimum due"
          type="number"
          step="0.01"
          value={p0.minimum_due}
          onChange={(value) => updateProductLine0({ minimum_due: value })}
        />
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
          type="number"
          step="0.01"
          min="0.01"
          required
          value={p0.price}
          onChange={(value) => updateProductLine0({ price: value })}
        />
        <TextField
          label="Line Total"
          type="number"
          step="0.01"
          value={p0.line_total}
          onChange={(value) => updateProductLine0({ line_total: value })}
        />
        <div className="col-12">
          <div className="form-check">
            <input
              id="booking_atpl_member"
              type="checkbox"
              className="form-check-input"
              checked={form.atpl_member}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  atpl_member: event.target.checked,
                }))
              }
            />
            <label className="form-check-label" htmlFor="booking_atpl_member">
              ATPL member
            </label>
          </div>
        </div>
      </div>
    </FormModal>
  );
}

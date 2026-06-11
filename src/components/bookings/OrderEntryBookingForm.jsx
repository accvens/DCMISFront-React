import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AmountFormattedInput,
  AlertMessage,
  AutocompleteField,
  FormModal,
  SelectField,
  SuccessModal,
  TextField,
} from "../access/AccessShared.jsx";
import {
  buildTravelersListUrl,
  CustomerAutocomplete,
  mergeUniqueById,
  TravelerAutocomplete,
} from "../customers/CustomersShared.jsx";
import { formatAmountPlain } from "../../formatAmount.js";
import { BookingWizardTotalsSection } from "./BookingWizardTotalsSection.jsx";
import {
  VendorBookingProductsSection,
  customerPaymentLineReceivedForPaidProgress,
  addDaysToIsoDate,
  applyProductLineGstCommissionDerived,
  emptyPaymentLine,
  paymentMethodFieldOptions,
  emptyProductLine,
  emptyTravelerLine,
  emptyVendorPaymentLine,
  formatCurrency,
  formatCurrencyAmount,
  formatDate,
  normDestLabel,
  productsForBookingDestination,
  travelerPassengerCount,
  effectiveTourValueNumber,
  productsForVendorPaymentLine,
  vendorCreditLimitDaysFromRow,
  wizardStepForBookingValidationError,
  openProformaInvoicePrintWindow,
  normalizeBookingAmountInput,
  parseBookingAmountNumber,
  isVendorTaxableCapValidationMessage,
  bookingTravelerAutocompleteExcludeIds,
  sumVendorProductDetailAmounts,
  useBookingTotalFromProductLinesAndTravelers,
  useBookingTotalVendorPriceBidirectionalSync,
  validateTravelerPickDuplicateMessage,
  validatePiReceiptDateForBooking,
  SALES_PI_STATUS_OPTIONS,
  normalizePaymentLineStatusForForm,
} from "./BookingsShared.jsx";
import {
  filterCatalogProductsByVendorAssignedTypes,
  mergeVendorRowWithPaymentDetailCache,
  resolveVendorRow,
  vendorAssignedTypeIds,
} from "../../assignedProductTypeIds.js";
import { catalogProductPickerLabel, catalogProductPrimaryId } from "../../catalogProductRow.js";
import {
  extractPaymentCatalogArray,
  mergeVendorPaymentPickerRows,
  vendorPaymentProductSelectGroups,
} from "../../vendorPaymentCatalog.js";
import { BookingWizardToolbar } from "./BookingEditorChrome.jsx";
import { useBookingCatalogCreateModals } from "./useBookingCatalogCreateModals.jsx";
import { useBookingReferenceCreateModals } from "./useBookingReferenceCreateModals.jsx";

/** Prefer vendor-filtered catalogue rows; if that is empty, reuse destination/full pools so the select is never blank when data exists. */
function lineCatalogForVendorPaymentRow(state, destination, vendorId, vendorRow, fallbackProducts) {
  const vendorFiltered = productsForVendorPaymentLine(
    state.products,
    destination,
    vendorId,
    vendorAssignedTypeIds(vendorRow),
  );
  if (vendorFiltered.length > 0) {
    return vendorFiltered;
  }
  if (Array.isArray(fallbackProducts) && fallbackProducts.length > 0) {
    return fallbackProducts;
  }
  return Array.isArray(state.products) ? state.products : [];
}

/** Dedupe key: vendor + booking destination (payment catalogue is destination-scoped on the API). */
function vendorPaymentFetchCacheKey(vendorIdTrim, destination) {
  const d = String(destination ?? "").trim();
  return `${vendorIdTrim}\x1e${d}`;
}

/**
 * Rows for vendor-payment product <select>: prefers GET /masters/vendors/:id/payment-catalogue-products
 * (loaded into cache), merged with masters for labels; falls back to filtered in-memory catalogue.
 */
function pickerCatalogForVendorPaymentLine(
  state,
  destination,
  vendorIdStr,
  vendorRow,
  fallbackProducts,
  vendorPaymentCacheByVendorId,
  masterCatalogByProductId,
) {
  const vKey = String(vendorIdStr || "").trim();
  const mastersList = lineCatalogForVendorPaymentRow(state, destination, vendorIdStr, vendorRow, fallbackProducts);
  const narrowedByAssigned = filterCatalogProductsByVendorAssignedTypes(
    mastersList,
    vendorRow,
    Boolean(vKey),
  );
  const rawCat = vendorPaymentCacheByVendorId[vKey]?.payment_catalogue_products;
  const apiRows =
    rawCat === undefined
      ? undefined
      : Array.isArray(rawCat)
        ? rawCat
        : extractPaymentCatalogArray(rawCat);
  return mergeVendorPaymentPickerRows(apiRows, narrowedByAssigned, masterCatalogByProductId);
}

/** Label for `vendor_products[]` options: user picks product master / type (`vt:…`), not a catalogue `product_id`. */
function vendorProductLinkDropdownLabel(link) {
  if (!link || typeof link !== "object") {
    return "";
  }
  const name = String(link.product_master_name ?? link.productMasterName ?? "").trim();
  if (name) {
    return name;
  }
  const tid = link.product_type_id ?? link.productTypeId;
  const tidStr = tid != null && tid !== "" ? String(tid) : "?";
  return `Type ${tidStr}`;
}

function labelForReadonlyVendorProductLine(
  { line, vendorRow, lineCatalogProducts, state },
) {
  const tid = String(line?.booking_product_type_id || "").trim();
  if (tid) {
    const vp = vendorRow?.vendor_products ?? vendorRow?.vendorProducts;
    const link = Array.isArray(vp)
      ? vp.find((l) => String(l?.product_type_id ?? l?.productTypeId) === tid)
      : null;
    if (link) {
      return vendorProductLinkDropdownLabel(link);
    }
    return `Type ${tid}`;
  }
  const pid = String(line?.product_id || "").trim();
  if (!pid) {
    return "—";
  }
  const fromCatalog = lineCatalogProducts.find(
    (p) => String(catalogProductPrimaryId(p) ?? p.product_id ?? "").trim() === pid,
  );
  const p =
    fromCatalog ||
    (state.products || []).find(
      (x) => String(catalogProductPrimaryId(x) ?? x.product_id ?? "").trim() === pid,
    );
  if (!p) {
    return "—";
  }
  return catalogProductPickerLabel(p);
}

function patchLine(lines, index, patch) {
  const idx = Number(index);
  if (!Number.isFinite(idx)) {
    return lines;
  }
  return lines.map((row, i) => (i === idx ? { ...row, ...patch } : row));
}

function TabIconBooking() {
  return (
    <svg className="ta-booking-tab__svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19.5A2.5 2.5 0 016.5 17H20"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TabIconTravelers() {
  return (
    <svg className="ta-booking-tab__svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TabIconProduct() {
  return (
    <svg className="ta-booking-tab__svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function TabIconCustomerPay() {
  return (
    <svg className="ta-booking-tab__svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.75" />
      <path d="M6 15h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function TabIconVendorPay() {
  return (
    <svg className="ta-booking-tab__svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

function applyProductLinePatchToRow(currentRow, patch, options) {
  let row = { ...currentRow, ...patch };
  if (Object.prototype.hasOwnProperty.call(patch, "product_id")) {
    if (String(patch.product_id ?? "").trim() !== "") {
      row.booking_product_type_id = "";
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, "booking_product_type_id")) {
    if (String(patch.booking_product_type_id ?? "").trim() !== "") {
      row.product_id = "";
    }
  }
  const quantity = Number(row.quantity || 0);
  const price = parseBookingAmountNumber(row.price);
  row.line_total = quantity && price ? formatAmountPlain(quantity * price) : "0";
  if (
    options?.vendorRow &&
    !Object.prototype.hasOwnProperty.call(patch, "due_date") &&
    (Object.prototype.hasOwnProperty.call(patch, "invoice_ref_date") ||
      Object.prototype.hasOwnProperty.call(patch, "vendor_id"))
  ) {
    const inv = String(row.invoice_ref_date ?? "").trim();
    const days = vendorCreditLimitDaysFromRow(options.vendorRow);
    row.due_date = inv && days != null ? addDaysToIsoDate(inv, days) : "";
  }
  row = applyProductLineGstCommissionDerived(row, Object.keys(patch));
  return row;
}

/**
 * When the user changes vendor on a product line, clear product if invalid for the new vendor and
 * recompute GST, due date (invoice + credit days), and line total. Matches the former inline table.
 */
function applyProductLineVendorIdChangeToRow(
  cur,
  vid,
  { state, destination, productLineCatalogProducts, vendorPaymentCacheByVendorId, masterCatalogByProductId },
) {
  const vr = mergeVendorRowWithPaymentDetailCache(
    resolveVendorRow(state.vendors, vid),
    String(vid || "").trim(),
    vendorPaymentCacheByVendorId,
  );
  const opts = pickerCatalogForVendorPaymentLine(
    state,
    destination,
    vid,
    vr,
    productLineCatalogProducts,
    vendorPaymentCacheByVendorId,
    masterCatalogByProductId,
  );
  const allowedIds = new Set(
    opts
      .map((p) => String(catalogProductPrimaryId(p) ?? p.product_id ?? "").trim())
      .filter(Boolean),
  );
  const vprod = vr?.vendor_products ?? vr?.vendorProducts;
  if (Array.isArray(vprod)) {
    for (const lk of vprod) {
      const t = lk?.product_type_id ?? lk?.productTypeId;
      if (t != null && String(t).trim() !== "") {
        allowedIds.add(`vt:${String(t).trim()}`);
      }
    }
  }
  const curPid = String(cur?.product_id || "").trim();
  const curVt = String(cur?.booking_product_type_id || "").trim();
  const curPick = curVt ? `vt:${curVt}` : curPid;
  let row = { ...cur, vendor_id: vid };
  if (curPick && !allowedIds.has(curPick)) {
    row = { ...row, product_id: "", booking_product_type_id: "", price: "" };
  }
  const quantity = Number(row.quantity || 0);
  const price = parseBookingAmountNumber(row.price);
  row.line_total = quantity && price ? formatAmountPlain(quantity * price) : "0";
  row = applyProductLineGstCommissionDerived(row, null);
  const inv = String(row.invoice_ref_date || "").trim();
  const days = vendorCreditLimitDaysFromRow(vr);
  return {
    ...row,
    due_date: inv && days != null ? addDaysToIsoDate(inv, days) : "",
  };
}

const WIZARD_STEPS = [
  {
    id: 0,
    label: "Booking Details",
    labelLines: ["Booking", "Details"],
    hint: "Trip, customer, destination, and amounts",
    Icon: TabIconBooking,
  },
  {
    id: 1,
    label: "Products Services",
    labelLines: ["Products", "Services"],
    hint: "Catalogue lines: type, vendor, product, unit price, qty, line total",
    Icon: TabIconVendorPay,
  },
  {
    id: 2,
    label: "Traveller Details",
    labelLines: ["Traveller", "Details"],
    hint: "Passengers and preferences",
    Icon: TabIconTravelers,
  },
  {
    id: 3,
    label: "Customer Payments",
    labelLines: ["Customer", "Payments"],
    hint: "Receipts from the customer",
    Icon: TabIconCustomerPay,
  },
  {
    id: 4,
    label: "Vendor Payments",
    labelLines: ["Vendor", "Payments"],
    hint: "Booking product lines: vendor, product, qty, price, taxes, and totals",
    Icon: TabIconProduct,
  },
];

/** Index of the last wizard step (step 5 of 5 in the UI). */
export const BOOKING_WIZARD_LAST_STEP_INDEX = WIZARD_STEPS.length - 1;

function clampWizardStep(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  const n = Math.floor(value);
  return Math.max(0, Math.min(BOOKING_WIZARD_LAST_STEP_INDEX, n));
}

/** Two-line table header label (prevents overlap in dense wizard grids). */
function WizardTableThLines({ lines, className = "" }) {
  return (
    <span className={`ta-wizard-th-lines${className ? ` ${className}` : ""}`}>
      {lines.map((line) => (
        <span key={line} className="ta-wizard-th-lines__line">
          {line}
        </span>
      ))}
    </span>
  );
}

/** Customer Payments wizard table — column widths must sum to 100%. */
const CUSTPAY_WIZARD_COL_WIDTHS = [
  "3%",
  "8%",
  "8%",
  "10%",
  "8%",
  "10%",
  "8%",
  "9%",
  "16%",
  "8%",
  "12%",
];

function CustpayWizardColgroup() {
  return (
    <colgroup>
      {CUSTPAY_WIZARD_COL_WIDTHS.map((width, index) => (
        <col key={`custpay-wizard-col-${index}`} style={{ width }} />
      ))}
    </colgroup>
  );
}

export default function OrderEntryBookingForm({
  mode,
  bookingId,
  /** When opening Edit right after Create, restores the tab user was on (0-based). */
  initialWizardStep,
  form,
  setForm,
  state,
  token,
  apiRequest,
  canCreateCustomer = false,
  canCreateTraveler = false,
  canCreateProductType = false,
  setCustomersList,
  setTravelersList,
  setProductsList,
  setVendorsList,
  setProductTypesList,
  paymentModes = [],
  submitting = false,
  submitLabel = "Save",
  savingLabel = "Saving…",
  /** Save booking (POST create / PATCH edit). Receives current wizard step index (0-based) for post-save flow. */
  onSaveBooking,
  onWizardStepChange,
  validationError = "",
}) {
  const [wizardStep, setWizardStep] = useState(() => clampWizardStep(initialWizardStep));
  const [vendorTaxableCapModalDismissed, setVendorTaxableCapModalDismissed] = useState(false);
  const [salesPiModalOpen, setSalesPiModalOpen] = useState(false);
  const [salesPiDraft, setSalesPiDraft] = useState(() => emptyPaymentLine());
  const [salesPiEditIndex, setSalesPiEditIndex] = useState(null);
  const [salesPiModalError, setSalesPiModalError] = useState("");
  const [vendorPayModalOpen, setVendorPayModalOpen] = useState(false);
  const [vendorPayDraft, setVendorPayDraft] = useState(() => emptyProductLine());
  const [vendorPayEditIndex, setVendorPayEditIndex] = useState(null);
  const [vendorPayModalError, setVendorPayModalError] = useState("");
  const [travelerPickError, setTravelerPickError] = useState("");
  const [addTravelerModalOpen, setAddTravelerModalOpen] = useState(false);
  const [addTravelerEditIndex, setAddTravelerEditIndex] = useState(null);
  const [addTravelerForm, setAddTravelerForm] = useState(() => ({
    traveler_id: "",
    pax_type: "CO",
  }));
  const [prefModalOpen, setPrefModalOpen] = useState(false);
  const [prefLineIndex, setPrefLineIndex] = useState(null);
  const [prefForm, setPrefForm] = useState(() => ({
    seat_preference: "",
    meal_preference: "",
    special_request: "",
  }));

  useEffect(() => {
    setWizardStep(clampWizardStep(initialWizardStep));
  }, [mode, bookingId, initialWizardStep]);

  useEffect(() => {
    setVendorTaxableCapModalDismissed(false);
  }, [validationError]);

  useEffect(() => {
    onWizardStepChange?.(wizardStep);
  }, [wizardStep, onWizardStepChange]);

  useEffect(() => {
    setTravelerPickError("");
  }, [form.customer_id]);

  useEffect(() => {
    if (wizardStep !== 2) {
      setTravelerPickError("");
    }
  }, [wizardStep]);

  useEffect(() => {
    const err = String(validationError || "").trim();
    if (!err) {
      return;
    }
    const step = wizardStepForBookingValidationError(err);
    if (step != null) {
      setWizardStep(step);
    }
    if (isVendorTaxableCapValidationMessage(err)) {
      return;
    }
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById("ta-booking-form-validation-error");
      if (!el) {
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [validationError]);

  const travelerLines = form.travelerLines?.length
    ? form.travelerLines
    : [{ ...emptyTravelerLine(), pax_type: "LEAD" }];
  const normalizedTravelerLines = useMemo(
    () =>
      travelerLines.map((l, idx) => ({
        ...emptyTravelerLine(),
        ...l,
        pax_type: String(l?.pax_type || "").trim() ? l.pax_type : idx === 0 ? "LEAD" : "CO",
      })),
    [travelerLines],
  );
  const linePaxTypeForRow = (line, idx) =>
    String(line?.pax_type || "").trim() ? String(line.pax_type).toUpperCase() : idx === 0 ? "LEAD" : "CO";
  const travelerHasAny = useMemo(
    () => normalizedTravelerLines.some((l) => String(l?.traveler_id ?? "").trim()),
    [normalizedTravelerLines],
  );
  const hasLeadPaxElsewhere = useMemo(
    () =>
      normalizedTravelerLines.some((l, idx) => {
        if (!String(l?.traveler_id ?? "").trim()) return false;
        if (addTravelerModalOpen && addTravelerEditIndex != null && Number(addTravelerEditIndex) === idx) {
          return false;
        }
        return linePaxTypeForRow(l, idx) === "LEAD";
      }),
    [normalizedTravelerLines, addTravelerModalOpen, addTravelerEditIndex],
  );
  const hasLeadSelected = useMemo(
    () =>
      normalizedTravelerLines.some(
        (l, idx) => String(l?.traveler_id ?? "").trim() && linePaxTypeForRow(l, idx) === "LEAD",
      ),
    [normalizedTravelerLines],
  );

  const addTravelerSelectedRecord = useMemo(() => {
    const tid = String(addTravelerForm.traveler_id || "").trim();
    if (!tid) return null;
    return (state.travelers || []).find((t) => String(t?.id) === tid) || null;
  }, [addTravelerForm.traveler_id, state.travelers]);

  const addTravelerNationalityLabel = useMemo(() => {
    const tr = addTravelerSelectedRecord;
    if (!tr) return "";
    const fromApi = String(tr.nationality ?? tr.nationality_name ?? "").trim();
    if (fromApi) {
      return fromApi;
    }
    const nid = tr.nationality_country_id ?? tr.nationalityCountryId;
    if (nid == null || String(nid).trim() === "") return "";
    const c = (state.countries || []).find((x) => String(x?.id) === String(nid));
    return c?.name || "";
  }, [addTravelerSelectedRecord, state.countries]);

  const addModalTravelerExcludeIds = useMemo(() => {
    if (!addTravelerModalOpen) {
      return [];
    }
    if (addTravelerEditIndex == null) {
      return bookingTravelerAutocompleteExcludeIds(normalizedTravelerLines, state.travelers, "new");
    }
    if (!String(addTravelerForm.traveler_id || "").trim()) {
      return bookingTravelerAutocompleteExcludeIds(
        normalizedTravelerLines,
        state.travelers,
        Number(addTravelerEditIndex),
      );
    }
    return [];
  }, [
    addTravelerModalOpen,
    addTravelerEditIndex,
    addTravelerForm.traveler_id,
    normalizedTravelerLines,
    state.travelers,
  ]);

  const productLines = form.productLines?.length ? form.productLines : [emptyProductLine()];
  const paymentLines = Array.isArray(form.paymentLines) ? form.paymentLines : [];
  function isMeaningfulSalesPiLine(line) {
    if (!line || typeof line !== "object") {
      return false;
    }
    const invoice = parseBookingAmountNumber(line.invoice_amount);
    const received = parseBookingAmountNumber(line.amount_received);
    // Important: PI number alone does NOT mean it's a real saved record.
    // Some flows prefill PI-001 on an empty placeholder row; we should still show "No record found".
    return Boolean(
      String(line.payment_date ?? "").trim() ||
        String(line.received_on ?? "").trim() ||
        String(line.transaction_reference ?? "").trim() ||
        String(line.payment_method ?? "").trim() ||
        String(line.remark ?? "").trim() ||
        (Number.isFinite(invoice) && invoice > 0) ||
        (Number.isFinite(received) && received > 0),
    );
  }

  function nextSalePiReceiptNo(lines) {
    const base = Array.isArray(lines) ? lines : [];
    let maxSeq = 0;
    for (const row of base) {
      // Include any PI-### already present in the backing array (even placeholder rows),
      // so new numbers always continue from the highest issued sequence.
      const raw = String(row?.sale_pi_receipt_no ?? "").trim();
      const match = /^PI-(\d+)$/i.exec(raw);
      if (!match) {
        continue;
      }
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > maxSeq) {
        maxSeq = n;
      }
    }
    return `PI-${String(maxSeq + 1).padStart(3, "0")}`;
  }

  function ensureUniqueSalePiReceiptNos(lines) {
    const base = Array.isArray(lines) ? lines : [];
    if (!base.length) {
      return base;
    }

    const next = base.map((row) => ({ ...(row || {}) }));
    const used = new Set();
    let maxSeq = 0;

    function parsePi(raw) {
      const match = /^PI-(\d+)$/i.exec(String(raw ?? "").trim());
      if (!match) {
        return "";
      }
      const n = Number(match[1]);
      if (!Number.isFinite(n) || n <= 0) {
        return "";
      }
      return `PI-${String(n).padStart(3, "0")}`;
    }

    // Pass 1: mark duplicates (keep first occurrence), and seed maxSeq from valid unique PI numbers.
    const seen = new Set();
    for (const row of next) {
      if (!isMeaningfulSalesPiLine(row)) {
        continue;
      }
      const normalized = parsePi(row.sale_pi_receipt_no);
      if (!normalized) {
        continue;
      }
      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        row.sale_pi_receipt_no = "";
        continue;
      }
      seen.add(key);
      used.add(key);
      const seqMatch = /^PI-(\d+)$/i.exec(normalized);
      const n = seqMatch ? Number(seqMatch[1]) : NaN;
      if (n > maxSeq) {
        maxSeq = n;
      }
    }

    // Pass 2: assign missing/invalid/duplicate cleared values using strict increment from maxSeq.
    let changed = false;
    for (const row of next) {
      if (!isMeaningfulSalesPiLine(row)) {
        continue;
      }

      const current = parsePi(row.sale_pi_receipt_no);
      if (current) {
        continue;
      }

      maxSeq += 1;
      const assigned = `PI-${String(maxSeq).padStart(3, "0")}`;
      row.sale_pi_receipt_no = assigned;
      used.add(assigned.toLowerCase());
      changed = true;
    }

    return changed ? next : base;
  }

  const visiblePaymentLines = useMemo(() => {
    const base = Array.isArray(form.paymentLines) ? form.paymentLines : [];
    return base
      .map((line, originalIndex) => ({ line, originalIndex }))
      .filter(({ line }) => {
        // Treat the default placeholder row as "no record".
        return isMeaningfulSalesPiLine(line);
      });
  }, [form.paymentLines]);

  function isMeaningfulVendorProductLine(line) {
    if (!line || typeof line !== "object") {
      return false;
    }
    const vendor = String(line.vendor_id ?? "").trim();
    const pid = String(line.product_id ?? "").trim();
    const tid = String(line.booking_product_type_id ?? "").trim();
    if (vendor && (pid || tid)) {
      return true;
    }
    const taxable = parseBookingAmountNumber(line.taxable_amount);
    if (Number.isFinite(taxable) && taxable > 0) {
      return true;
    }
    const lt = parseBookingAmountNumber(line.line_total);
    if (Number.isFinite(lt) && lt > 0) {
      return true;
    }
    if (String(line.invoice_ref_numbers ?? "").trim()) {
      return true;
    }
    if (String(line.invoice_ref_date ?? "").trim()) {
      return true;
    }
    if (String(line.payment_mode ?? "").trim()) {
      return true;
    }
    if (String(line.due_date ?? "").trim()) {
      return true;
    }
    const g = parseBookingAmountNumber(line.gst_amount);
    if (Number.isFinite(g) && g !== 0) {
      return true;
    }
    if (String(line.line_remark ?? "").trim()) {
      return true;
    }
    if (String(line.line_status ?? "").trim() && String(line.line_status).trim() !== "Pending") {
      return true;
    }
    return false;
  }

  const visibleVendorProductLines = useMemo(() => {
    const base = productLines;
    return base
      .map((line, originalIndex) => ({ line, originalIndex }))
      .filter(({ line }) => isMeaningfulVendorProductLine(line));
  }, [productLines]);

  function openSalesPiAddModal() {
    setSalesPiModalError("");
    setSalesPiEditIndex(null);
    setSalesPiDraft({
      ...emptyPaymentLine(),
      payment_id: "",
      // Generated on save (keeps PI numbers unique & monotonic).
      sale_pi_receipt_no: "",
    });
    setSalesPiModalOpen(true);
  }

  function openSalesPiEditModal(index) {
    const base = Array.isArray(form.paymentLines) ? form.paymentLines : [];
    const row = base[index];
    if (!row) {
      return;
    }
    setSalesPiModalError("");
    setSalesPiEditIndex(index);
    setSalesPiDraft({ ...row });
    setSalesPiModalOpen(true);
  }

  function closeSalesPiModal() {
    setSalesPiModalOpen(false);
    setSalesPiEditIndex(null);
    setSalesPiDraft(emptyPaymentLine());
    setSalesPiModalError("");
  }

  function openVendorPayAddModal() {
    setVendorPayModalError("");
    setVendorPayEditIndex(null);
    setVendorPayDraft(emptyProductLine());
    setVendorPayModalOpen(true);
  }

  function openVendorPayEditModal(index) {
    const base = form.productLines?.length ? form.productLines : [];
    const row = base[index];
    if (!row) {
      return;
    }
    setVendorPayModalError("");
    setVendorPayEditIndex(index);
    setVendorPayDraft({ ...row });
    setVendorPayModalOpen(true);
    const vid = String(row.vendor_id || "").trim();
    if (vid && apiRequest && token) {
      fetchVendorDetailForPaymentStep(vid, { force: false, destination: form.destination });
    }
  }

  function closeVendorPayModal() {
    setVendorPayModalOpen(false);
    setVendorPayEditIndex(null);
    setVendorPayDraft(emptyProductLine());
    setVendorPayModalError("");
  }

  function saveVendorPayDraft(event) {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    const vid = String(vendorPayDraft.vendor_id || "").trim();
    const hasProduct =
      String(vendorPayDraft.product_id || "").trim() || String(vendorPayDraft.booking_product_type_id || "").trim();
    if (!vid) {
      setVendorPayModalError("Vendor is required.");
      return;
    }
    if (!hasProduct) {
      setVendorPayModalError("Product is required.");
      return;
    }
    const vRow = mergeVendorRowWithPaymentDetailCache(
      resolveVendorRow(state.vendors, vendorPayDraft.vendor_id),
      vid,
      vendorPaymentCacheByVendorId,
    );
    let finalRow = { ...vendorPayDraft };
    const q = Number(finalRow.quantity || 0);
    const pr = parseBookingAmountNumber(finalRow.price);
    finalRow.line_total = q && pr ? formatAmountPlain(q * pr) : "0";
    if (!String(finalRow.due_date || "").trim()) {
      const inv = String(finalRow.invoice_ref_date || "").trim();
      const days = vendorCreditLimitDaysFromRow(vRow);
      if (inv && days != null) {
        const d = addDaysToIsoDate(inv, days);
        if (d) {
          finalRow = { ...finalRow, due_date: d };
        }
      }
    }
    finalRow = applyProductLineGstCommissionDerived(finalRow, null);

    // User-friendly budget validation: vendor invoice taxable total must not exceed
    // (total order value − profit amount) = effective tour value after margin.
    const cap = effectiveTourValueNumber(form.total_amount, form.estimated_margin);
    if (cap != null && Number.isFinite(cap) && cap >= 0) {
      const base = form.productLines?.length ? form.productLines : [];
      const editing =
        vendorPayEditIndex != null &&
        Number.isFinite(Number(vendorPayEditIndex)) &&
        base[Number(vendorPayEditIndex)];
      const prevTaxable = editing ? parseBookingAmountNumber(base[Number(vendorPayEditIndex)]?.taxable_amount) : 0;
      const nextTaxable = parseBookingAmountNumber(finalRow.taxable_amount);
      const baseSum = base.reduce((sum, row, idx) => {
        if (editing && idx === Number(vendorPayEditIndex)) {
          return sum;
        }
        return sum + parseBookingAmountNumber(row?.taxable_amount);
      }, 0);
      const nextSum = baseSum + (Number.isFinite(nextTaxable) ? nextTaxable : 0);
      const capR = Math.round(Number(cap) * 100) / 100;
      const nextR = Math.round(Number(nextSum) * 100) / 100;
      // Allow equality; only block when exceeded.
      if (Number.isFinite(capR) && Number.isFinite(nextR) && nextR > capR + 1e-6) {
        setVendorPayModalError(
          `Vendor invoice total cannot be greater than ${formatCurrency(capR)} (total order value minus profit). Current taxable after this line would be ${formatCurrency(nextR)}.`,
        );
        return;
      }
      // Silence unused (helps future edits if we need prevTaxable).
      void prevTaxable;
    }

    setForm((c) => {
      const base = c.productLines?.length ? c.productLines : [];
      const next = base.map((r) => ({ ...r }));
      const editing =
        vendorPayEditIndex != null && Number.isFinite(Number(vendorPayEditIndex)) && next[vendorPayEditIndex];
      if (editing) {
        next[vendorPayEditIndex] = finalRow;
      } else {
        const placeholderIndex = next.findIndex((row) => !isMeaningfulVendorProductLine(row));
        if (placeholderIndex >= 0) {
          next[placeholderIndex] = finalRow;
        } else {
          next.push(finalRow);
        }
      }
      return { ...c, productLines: next };
    });
    closeVendorPayModal();
  }

  async function saveSalesPiDraft(event) {
    // This modal lives inside the booking screen; prevent the submit event from
    // bubbling to the parent booking form (which can trigger navigation/save).
    event?.stopPropagation?.();
    const piDateErr = validatePiReceiptDateForBooking(form, salesPiDraft.payment_date);
    if (piDateErr) {
      setSalesPiModalError(piDateErr);
      return;
    }

    const draftInvNum = parseBookingAmountNumber(salesPiDraft.invoice_amount);
    const draftLegacyNum = parseBookingAmountNumber(salesPiDraft.amount);
    const draftAmountNum =
      Number.isFinite(draftInvNum) && draftInvNum > 0
        ? draftInvNum
        : Number.isFinite(draftLegacyNum) && draftLegacyNum > 0
          ? draftLegacyNum
          : 0;
    const receivedForLine = parseBookingAmountNumber(salesPiDraft.amount_received);
    const receivedLineNum = Number.isFinite(receivedForLine) && receivedForLine >= 0 ? receivedForLine : 0;
    if (receivedLineNum > draftAmountNum + 1e-6) {
      setSalesPiModalError(
        `Amount received (${formatCurrency(receivedLineNum)}) must be less than or equal to the amount (${formatCurrency(
          draftAmountNum,
        )}).`,
      );
      return;
    }

    // Validation: Customer invoice total cannot exceed booking total order value.
    // Compare (existing PI total excluding the row being edited) + (draft amount) ≤ booking total.
    const bookingTotalNum = Number(normalizeBookingAmountInput(form.total_amount)) || 0;
    const editingIndex =
      salesPiEditIndex != null && Number.isFinite(Number(salesPiEditIndex)) ? Number(salesPiEditIndex) : -1;
    const existingTotalExcludingEdit = (visiblePaymentLines || []).reduce((sum, { line, originalIndex }) => {
      if (originalIndex === editingIndex) {
        return sum;
      }
      const inv = parseBookingAmountNumber(line?.invoice_amount);
      if (Number.isFinite(inv) && inv > 0) {
        return sum + inv;
      }
      const legacy = parseBookingAmountNumber(line?.amount);
      return sum + (Number.isFinite(legacy) && legacy > 0 ? legacy : 0);
    }, 0);
    const nextInvoiceTotal = existingTotalExcludingEdit + draftAmountNum;
    if (Number.isFinite(bookingTotalNum) && bookingTotalNum > 0 && nextInvoiceTotal > bookingTotalNum + 1e-6) {
      setSalesPiModalError(
        `Customer total amount (${formatCurrency(nextInvoiceTotal)}) cannot be greater than Total order value (${formatCurrency(bookingTotalNum)}).`,
      );
      return;
    }

    let reservedPi = "";
    const isEditing = salesPiEditIndex != null && Number.isFinite(Number(salesPiEditIndex));
    if (!isEditing && !String(salesPiDraft.sale_pi_receipt_no || "").trim()) {
      try {
        const resp = await apiRequest("/sale-pi/next", { token });
        reservedPi = String(resp?.sale_pi_receipt_no ?? "").trim();
      } catch (err) {
        setSalesPiModalError(err?.message || "Unable to reserve receipt number.");
        return;
      }
    }

    setForm((c) => {
      const base = Array.isArray(c.paymentLines) ? c.paymentLines : [];
      const next = base.map((row) => ({ ...row }));
      const editing =
        salesPiEditIndex != null && Number.isFinite(Number(salesPiEditIndex)) && next[salesPiEditIndex];
      const ensuredReceiptNo = editing
        ? String(next[salesPiEditIndex]?.sale_pi_receipt_no ?? "").trim() ||
          String(salesPiDraft.sale_pi_receipt_no || "").trim()
        : reservedPi || "";

      const normalizedDraft = {
        ...salesPiDraft,
        sale_pi_receipt_no: ensuredReceiptNo,
      };

      if (editing) {
        next[salesPiEditIndex] = normalizedDraft;
      } else {
        const placeholderIndex = next.findIndex((row) => !isMeaningfulSalesPiLine(row));
        if (placeholderIndex >= 0) {
          next[placeholderIndex] = normalizedDraft;
        } else {
          next.push(normalizedDraft);
        }
      }
      return {
        ...c,
        paymentLines: next,
      };
    });

    closeSalesPiModal();
  }

  const customerPaymentSummary = useMemo(() => {
    const rows = visiblePaymentLines.map((x) => x.line);
    const received = rows.reduce((sum, l) => sum + customerPaymentLineReceivedForPaidProgress(l), 0);
    const piTotal = rows.reduce((sum, l) => {
      const inv = parseBookingAmountNumber(l.invoice_amount);
      if (Number.isFinite(inv) && inv !== 0) {
        return sum + inv;
      }
      const legacy = parseBookingAmountNumber(l.amount);
      return sum + (Number.isFinite(legacy) && legacy !== 0 ? legacy : 0);
    }, 0);
    const tour = Number(normalizeBookingAmountInput(form.total_amount)) || 0;
    return {
      received,
      piTotal,
      outstanding: Math.max(0, tour - received),
      tour,
    };
  }, [visiblePaymentLines, form.total_amount]);

  const estimatedProfitAmountDisplay = useMemo(() => {
    const total = Number(normalizeBookingAmountInput(form.total_amount));
    const marginRaw = String(form.estimated_margin ?? "").trim();
    if (!Number.isFinite(total) || total <= 0 || marginRaw === "") {
      return "—";
    }
    const pct = Number(marginRaw);
    if (!Number.isFinite(pct) || pct < 0) {
      return "—";
    }
    return formatCurrency((total * pct) / 100);
  }, [form.total_amount, form.estimated_margin]);

  const userEditedBookingTotalRef = useRef(false);
  const vendorCatalogCtxForBookingTotal = useMemo(
    () => ({
      products: state.products,
      productTypes: state.productTypes || [],
      vendors: state.vendors || [],
      bookingDestination: form.destination,
      passengerCount: travelerPassengerCount(form.travelerLines),
    }),
    [state.products, state.productTypes, state.vendors, form.destination, form.travelerLines],
  );
  useBookingTotalFromProductLinesAndTravelers(form, setForm, true);
  useBookingTotalVendorPriceBidirectionalSync(
    form,
    setForm,
    userEditedBookingTotalRef,
    vendorCatalogCtxForBookingTotal,
  );

  const {
    renderModals,
    customerAutocompleteExtras,
    travelerAutocompleteExtrasForRow,
  } = useBookingReferenceCreateModals({
    token,
    apiRequest,
    canCreateCustomer,
    canCreateTraveler,
    customers: state.customers,
    setCustomers: setCustomersList,
    selectedCustomerId: form.customer_id,
    onCustomerCreated: (c) => {
      setForm((current) => ({
        ...current,
        customer_id: String(c.id),
        travelerLines: [{ ...emptyTravelerLine(), pax_type: "LEAD" }],
      }));
    },
    onTravelerCreated: (t, rowIndex) => {
      const newIdRaw = t?.id ?? t?.traveler_id ?? t?.travelerId;
      const newId = newIdRaw == null ? "" : String(newIdRaw).trim();
      // Add newly created traveler to the travelers list so it can be displayed as selected
      setTravelersList((prev) => mergeUniqueById(prev, [t]));

      setForm((current) => {
        const baseLines = current.travelerLines?.length
          ? current.travelerLines
          : [{ ...emptyTravelerLine(), pax_type: "LEAD" }];
        let targetRowIndex =
          rowIndex == null ? null : Number.isFinite(Number(rowIndex)) ? Number(rowIndex) : null;

        // If rowIndex is null, prefer any existing empty row; otherwise add one.
        if (targetRowIndex == null) {
          const emptyRowIndex = baseLines.findIndex((line) => !String(line.traveler_id || "").trim());
          if (emptyRowIndex !== -1) {
            // Found an empty row, use it
            targetRowIndex = emptyRowIndex;
          } else {
            // No empty row yet — add a Co PAX row and select the created traveler there.
            const newLines = [...baseLines, { ...emptyTravelerLine(), pax_type: "CO" }];
            targetRowIndex = newLines.length - 1;
            return {
              ...current,
              travelerLines: patchLine(newLines, targetRowIndex, { traveler_id: newId }),
            };
          }
        }

        // If the target row doesn't exist yet (e.g. Lead only but modal rowIndex=1),
        // grow the array so patchLine can actually set the selection.
        let lines = baseLines;
        if (targetRowIndex >= lines.length) {
          const next = [...lines];
          while (next.length <= targetRowIndex) {
            next.push({ ...emptyTravelerLine(), pax_type: "CO" });
          }
          lines = next;
        }

        return {
          ...current,
          travelerLines: patchLine(lines, targetRowIndex, { traveler_id: newId }),
        };
      });
    },
  });

  const {
    renderCatalogModals,
    openProductType: openCreateProductTypeModal,
    lastCreatedProductTypeId,
    consumeLastCreatedProductTypeId,
    openVendor: openCreateVendorModal,
    lastCreatedVendorId,
    consumeLastCreatedVendorId,
    openCatalogProduct: openCreateCatalogProductModal,
    lastCreatedProductId,
    consumeLastCreatedProductId,
  } = useBookingCatalogCreateModals({
    token,
    apiRequest,
    bookingDestination: form.destination,
    productTypes: state.productTypes,
    setProductTypes: setProductTypesList,
    vendors: state.vendors,
    setVendors: setVendorsList,
    setProducts: setProductsList,
    canCreateProductType,
  });

  async function handleCustomerChange(value) {
    let nextTravelers = [];
    if (value) {
      try {
        const r = await apiRequest(buildTravelersListUrl(1, 100, "", value), { token });
        nextTravelers = Array.isArray(r?.items) ? r.items : [];
        setTravelersList((prev) => {
          const other = prev.filter((t) => String(t.customer_id) !== String(value));
          return mergeUniqueById(other, nextTravelers);
        });
      } catch {
        nextTravelers = state.travelers.filter((t) => String(t.customer_id) === String(value));
      }
    }
    setForm((current) => ({
      ...current,
      customer_id: value,
      travelerLines: [{ ...emptyTravelerLine(), pax_type: "LEAD" }],
    }));
  }

  const selectedCustomer = state.customers.find(
    (c) => String(c.id) === String(form.customer_id),
  );

  const travelersForBookingCustomer = useMemo(() => {
    const cid = String(form.customer_id || "").trim();
    if (!cid) {
      return [];
    }
    return state.travelers.filter((t) => String(t.customer_id) === cid);
  }, [form.customer_id, state.travelers]);

  const travelersById = useMemo(() => {
    const m = new Map();
    for (const t of state.travelers || []) {
      if (t && t.id != null) {
        m.set(String(t.id), t);
      }
    }
    return m;
  }, [state.travelers]);

  // Guardrail: ensure selected traveler ids always belong to the selected customer.
  // This prevents backend 400 "Traveler X is invalid for this customer" when stale selections exist.
  useEffect(() => {
    const cid = String(form.customer_id || "").trim();
    if (!cid) {
      return;
    }
    const allowed = new Set(travelersForBookingCustomer.map((t) => String(t.id)));
    const lines = form.travelerLines || [];
    if (!Array.isArray(lines) || lines.length === 0) {
      return;
    }
    let touched = false;
    const next = lines.map((l, idx) => {
      const tid = String(l?.traveler_id ?? "").trim();
      if (!tid) {
        return String(l?.pax_type || "").trim() ? l : { ...l, pax_type: idx === 0 ? "LEAD" : "CO" };
      }
      if (allowed.has(tid)) {
        return String(l?.pax_type || "").trim() ? l : { ...l, pax_type: idx === 0 ? "LEAD" : "CO" };
      }
      touched = true;
      return {
        ...l,
        traveler_id: "",
        pax_type: String(l?.pax_type || "").trim() ? l.pax_type : idx === 0 ? "LEAD" : "CO",
      };
    });
    if (touched) {
      setForm((c) => ({ ...c, travelerLines: next }));
    }
  }, [form.customer_id, form.travelerLines, travelersForBookingCustomer, setForm]);

  const productsForDestination = useMemo(
    () => productsForBookingDestination(state.products, form.destination),
    [state.products, form.destination],
  );

  /** Vendor Payment step: prefer products matching destination; if none, list entire catalogue so selects are usable. */
  const productLineCatalogProducts = useMemo(() => {
    if (productsForDestination.length > 0) {
      return productsForDestination;
    }
    if (!Array.isArray(state.products) || state.products.length === 0) {
      return [];
    }
    return [...state.products].sort((a, b) =>
      String(a.product_name || "").localeCompare(String(b.product_name || "")),
    );
  }, [productsForDestination, state.products]);

  /** All master vendors: a booking can include multiple vendor lines; do not filter the vendor list by destination. */
  const productLineCatalogVendors = useMemo(() => {
    if (!Array.isArray(state.vendors) || state.vendors.length === 0) {
      return [];
    }
    return [...state.vendors].sort((a, b) =>
      String(a.vendor_name || "").localeCompare(String(b.vendor_name || "")),
    );
  }, [state.vendors]);

  const bookingDestNorm = useMemo(() => normDestLabel(form.destination), [form.destination]);

  const masterCatalogByProductId = useMemo(() => {
    const m = new Map();
    for (const p of state.products || []) {
      const id = String(catalogProductPrimaryId(p) ?? p?.product_id ?? "").trim();
      if (id) {
        m.set(id, p);
      }
    }
    return m;
  }, [state.products]);

  useEffect(() => {
    if (!vendorPayModalOpen) {
      return;
    }
    const idRaw = lastCreatedProductId;
    const pid = idRaw == null ? "" : String(idRaw).trim();
    if (!pid) {
      return;
    }
    const created = masterCatalogByProductId.get(pid);
    setVendorPayDraft((cur) => {
      const patch = {
        product_id: pid,
        booking_product_type_id: "",
        vendor_id:
          created != null && (created.vendor_id ?? created.vendorId) != null
            ? String(created.vendor_id ?? created.vendorId)
            : cur.vendor_id,
        price:
          created != null && created.price != null && created.price !== ""
            ? String(created.price)
            : cur.price ?? "",
      };
      return applyProductLinePatchToRow(cur, patch, {});
    });
    consumeLastCreatedProductId?.();
  }, [
    vendorPayModalOpen,
    lastCreatedProductId,
    consumeLastCreatedProductId,
    masterCatalogByProductId,
    setVendorPayDraft,
  ]);

  /**
   * Dedupe GET payment-catalogue-products (response includes vendor detail + rows; destination in query).
   */
  const vendorDetailFetchedRef = useRef(new Set());
  /** Per vendor: `vendor_products` + `payment_catalogue_products` from GET .../payment-catalogue-products. */
  const [vendorPaymentCacheByVendorId, setVendorPaymentCacheByVendorId] = useState({});

  useEffect(() => {
    if (!vendorPayModalOpen) {
      return;
    }
    const id = lastCreatedVendorId;
    if (!id) {
      return;
    }
    setVendorPayDraft((cur) =>
      applyProductLineVendorIdChangeToRow(cur, String(id), {
        state,
        destination: form.destination,
        productLineCatalogProducts,
        vendorPaymentCacheByVendorId,
        masterCatalogByProductId,
      }),
    );
    consumeLastCreatedVendorId?.();
  }, [
    vendorPayModalOpen,
    lastCreatedVendorId,
    consumeLastCreatedVendorId,
    state,
    form.destination,
    productLineCatalogProducts,
    vendorPaymentCacheByVendorId,
    masterCatalogByProductId,
  ]);

  const fetchVendorDetailForPaymentStep = useCallback(
    (vendorIdRaw, { force = false, strictRunKeys = null, getCancelled, destination } = {}) => {
      const vTrim = String(vendorIdRaw || "").trim();
      if (!vTrim || !apiRequest || !token) {
        return;
      }
      const normDest = String(destination ?? "").trim();
      const ck = vendorPaymentFetchCacheKey(vTrim, normDest);
      if (force) {
        vendorDetailFetchedRef.current.delete(ck);
      }
      if (!force && vendorDetailFetchedRef.current.has(ck)) {
        return;
      }
      vendorDetailFetchedRef.current.add(ck);
      if (Array.isArray(strictRunKeys)) {
        strictRunKeys.push(ck);
      }
      const destQ = normDest ? `?destination=${encodeURIComponent(normDest)}` : "";
      apiRequest(
        `/masters/vendors/${encodeURIComponent(vTrim)}/payment-catalogue-products${destQ}`,
        { token },
      )
        .then((body) => {
          if (getCancelled?.()) {
            return;
          }
          let links = [];
          let catalogArr = [];
          if (Array.isArray(body)) {
            catalogArr = body;
          } else if (body && typeof body === "object") {
            const vprod = body.vendor_products ?? body.vendorProducts;
            links = Array.isArray(vprod) ? vprod : [];
            const rawPay = body.payment_catalogue_products ?? body.paymentCatalogueProducts;
            if (Array.isArray(rawPay)) {
              catalogArr = rawPay;
            } else {
              catalogArr = extractPaymentCatalogArray(body);
            }
          }
          let vendorMeta = {};
          if (body && typeof body === "object" && !Array.isArray(body)) {
            vendorMeta = {
              id: body.id,
              vendor_name: body.vendor_name,
              address: body.address,
              country_id: body.country_id,
              country: body.country,
              gst_number: body.gst_number,
              bank_account_number: body.bank_account_number,
              bank_ifsc: body.bank_ifsc,
              bank_branch: body.bank_branch,
              credit_limit_days: body.credit_limit_days,
            };
          }
          setVendorPaymentCacheByVendorId((prev) => ({
            ...prev,
            [vTrim]: {
              ...vendorMeta,
              vendor_products: links,
              payment_catalogue_products: catalogArr,
            },
          }));
        })
        .catch(() => {
          if (getCancelled?.()) {
            return;
          }
          vendorDetailFetchedRef.current.delete(ck);
        });
    },
    [apiRequest, token],
  );

  useEffect(() => {
    if (!vendorPayModalOpen) {
      return;
    }
    const idRaw = lastCreatedProductTypeId;
    const tid = idRaw == null ? "" : String(idRaw).trim();
    if (!tid) {
      return;
    }
    setVendorPayDraft((cur) =>
      applyProductLinePatchToRow(cur, { booking_product_type_id: tid, product_id: "", price: "" }, {}),
    );
    const vid = String(vendorPayDraft?.vendor_id || "").trim();
    if (vid) {
      // If we auto-assigned this new type to the selected vendor, refresh vendor_products cache so the picker shows it.
      fetchVendorDetailForPaymentStep(vid, { force: true, destination: form.destination });
    }
    consumeLastCreatedProductTypeId?.();
  }, [
    vendorPayModalOpen,
    lastCreatedProductTypeId,
    consumeLastCreatedProductTypeId,
    setVendorPayDraft,
    vendorPayDraft?.vendor_id,
    fetchVendorDetailForPaymentStep,
    form.destination,
  ]);

  useEffect(() => {
    if (wizardStep !== 4 || !apiRequest || !token) {
      return;
    }
    let cancelled = false;
    /** Keys claimed this run; released on cleanup so React Strict Mode remount can fetch again. */
    const keysStartedThisRun = [];
    const lines = form.productLines?.length ? form.productLines : [emptyProductLine()];
    for (const line of lines) {
      const vid = String(line.vendor_id || "").trim();
      if (!vid) {
        continue;
      }
      fetchVendorDetailForPaymentStep(vid, {
        force: false,
        strictRunKeys: keysStartedThisRun,
        getCancelled: () => cancelled,
        destination: form.destination,
      });
    }
    return () => {
      cancelled = true;
      for (const k of keysStartedThisRun) {
        vendorDetailFetchedRef.current.delete(k);
      }
    };
  }, [wizardStep, form.productLines, form.destination, apiRequest, token, fetchVendorDetailForPaymentStep]);

  /** Per vendor id: assigned type id order from GET /masters/vendors/:id (for Products step type dropdown). */
  const vendorTypeRestrictionsByVendorId = useMemo(() => {
    const m = {};
    for (const [k, entry] of Object.entries(vendorPaymentCacheByVendorId)) {
      const links = entry?.vendor_products ?? entry?.vendorProducts;
      let ids = [];
      if (Array.isArray(links) && links.length) {
        ids = links
          .map((row) => Number(row?.product_type_id ?? row?.productTypeId))
          .filter((x) => Number.isFinite(x));
      }
      if (ids.length) {
        m[String(k).trim()] = ids;
      }
    }
    return m;
  }, [vendorPaymentCacheByVendorId]);

  useEffect(() => {
    if (!apiRequest || !token) {
      return;
    }
    const seen = new Set();
    for (const line of form.productLines?.length ? form.productLines : []) {
      const vid = String(line.vendor_id || "").trim();
      if (vid && !seen.has(vid)) {
        seen.add(vid);
        fetchVendorDetailForPaymentStep(vid, { force: false, destination: form.destination });
      }
    }
    for (const line of form.vendorPaymentLines?.length ? form.vendorPaymentLines : []) {
      const vid = String(line.vendor_id || "").trim();
      if (vid && !seen.has(vid)) {
        seen.add(vid);
        fetchVendorDetailForPaymentStep(vid, { force: false, destination: form.destination });
      }
    }
  }, [form.productLines, form.vendorPaymentLines, form.destination, apiRequest, token, fetchVendorDetailForPaymentStep]);

  /** When vendor payment catalogue fetch adds `credit_limit_days`, fill blank due dates from invoice date + credit days. */
  useEffect(() => {
    setForm((current) => {
      const lines = current.productLines?.length ? current.productLines : [];
      if (!lines.length) {
        return current;
      }
      let changed = false;
      const next = lines.map((line) => {
        const vid = String(line.vendor_id || "").trim();
        const inv = String(line.invoice_ref_date || "").trim();
        if (!vid || !inv || String(line.due_date || "").trim() !== "") {
          return line;
        }
        const vr = mergeVendorRowWithPaymentDetailCache(
          resolveVendorRow(state.vendors, vid),
          vid,
          vendorPaymentCacheByVendorId,
        );
        const days = vendorCreditLimitDaysFromRow(vr);
        if (days == null) {
          return line;
        }
        const computed = addDaysToIsoDate(inv, days);
        if (!computed) {
          return line;
        }
        changed = true;
        return { ...line, due_date: computed };
      });
      return changed ? { ...current, productLines: next } : current;
    });
  }, [vendorPaymentCacheByVendorId, state.vendors, setForm]);

  const prevDestinationStrRef = useRef(undefined);
  useEffect(() => {
    const did = String(form.destination || "").trim();
    if (prevDestinationStrRef.current === undefined) {
      prevDestinationStrRef.current = did;
      return;
    }
    if (prevDestinationStrRef.current === did) {
      return;
    }
    prevDestinationStrRef.current = did;

    setVendorPaymentCacheByVendorId((prev) => {
      const next = { ...prev };
      let touched = false;
      for (const k of Object.keys(next)) {
        const e = next[k];
        if (e && typeof e === "object" && "payment_catalogue_products" in e) {
          touched = true;
          const { payment_catalogue_products: _removed, ...rest } = e;
          next[k] = rest;
        }
      }
      return touched ? next : prev;
    });
    vendorDetailFetchedRef.current.clear();

    const allowed = productsForBookingDestination(state.products, did);
    const allowedIds = new Set(allowed.map((p) => String(p.product_id)));

    setForm((c) => {
      const lines = c.productLines?.length ? c.productLines : [emptyProductLine()];
      let changed = false;
      const nextLines = lines.map((line) => {
        if (!line.product_id) {
          return line;
        }
        if (!did || !allowedIds.has(String(line.product_id))) {
          changed = true;
          return { ...line, product_id: "", vendor_id: "", price: "", line_total: "0" };
        }
        return line;
      });

      const vLines = c.vendorPaymentLines?.length ? c.vendorPaymentLines : [emptyVendorPaymentLine()];
      let vChanged = false;
      const nextVendorLines = vLines.map((line) => {
        if (line.product_id && String(line.product_id).trim()) {
          if (!did || !allowedIds.has(String(line.product_id))) {
            vChanged = true;
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
        return line;
      });

      if (!changed && !vChanged) {
        return c;
      }
      return {
        ...c,
        ...(changed ? { productLines: nextLines } : {}),
        ...(vChanged ? { vendorPaymentLines: nextVendorLines } : {}),
      };
    });
  }, [form.destination, state.products, state.vendors, setForm]);

  const lastStepIndex = WIZARD_STEPS.length - 1;

  const showVendorTaxableCapModal = Boolean(
    String(validationError || "").trim() &&
      isVendorTaxableCapValidationMessage(validationError) &&
      !vendorTaxableCapModalDismissed,
  );

  const productLineTotals = useMemo(() => {
    const sum = (key) => productLines.reduce((a, l) => a + parseBookingAmountNumber(l[key]), 0);
    return {
      taxable: sum("taxable_amount"),
      gst: sum("gst_amount"),
      commission: sum("commission_amount"),
      tds: sum("tds_amount"),
      net: sum("net_payable"),
      lineTotal: sum("line_total"),
    };
  }, [productLines]);

  const customerPaymentReceivedTotal = useMemo(
    () => paymentLines.reduce((a, l) => a + customerPaymentLineReceivedForPaidProgress(l), 0),
    [paymentLines],
  );

  const effectiveTourValueNumeric = useMemo(
    () => effectiveTourValueNumber(form.total_amount, form.estimated_margin),
    [form.total_amount, form.estimated_margin],
  );

  /**
   * Vendor progress should match the API cap check (taxable vs available budget).
   * Do not fall back to other totals, otherwise the bar can show values even when taxable is blank.
   */
  const vendorLineTotalForWizardProgress = useMemo(() => productLineTotals.taxable, [productLineTotals.taxable]);

  const vendorProgressVsLabel = String(form.estimated_margin ?? "").trim() ? "net after margin" : "order total";

  return (
    <div className="ta-order-entry ta-order-entry--editor">
      <div
        className={`card border-0 shadow-sm mb-3 mb-md-4 ta-booking-wizard-stack ta-booking-wizard-stack--step-${wizardStep}`}
      >
        <div className="card-body py-2 px-0 pb-2 ta-booking-wizard-stack__tabstrip ta-booking-wizard-tabstrip ta-booking-tabs-rail ta-booking-wizard-tabstrip--reference">
          <div className="ta-booking-wizard-tabstrip__grid">
            <nav className="ta-booking-wizard-tabstrip__steps-nav" role="tablist" aria-label="Booking workflow">
              {WIZARD_STEPS.map((step, index) => {
                const active = wizardStep === index;
                const done = wizardStep > index;
                return (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    title={step.hint}
                    aria-selected={active}
                    aria-current={active ? "step" : undefined}
                    className={`ta-booking-tab ta-booking-tab--step-${index} ${active ? "ta-booking-tab--active" : ""} ${done && !active ? "ta-booking-tab--done" : ""}`}
                    onClick={() => setWizardStep(index)}
                  >
                    <span className="ta-booking-tab__step">{index + 1}</span>
                    <span className="ta-booking-tab__label" aria-label={step.label}>
                      {step.labelLines.map((line) => (
                        <span key={line} className="ta-booking-tab__label-line">
                          {line}
                        </span>
                      ))}
                    </span>
                  </button>
                );
              })}
            </nav>
            <BookingWizardTotalsSection
              customerReceivedTotal={customerPaymentReceivedTotal}
              totalTourValue={form.total_amount}
              vendorLineTotalSum={vendorLineTotalForWizardProgress}
              effectiveTourValue={effectiveTourValueNumeric}
              vendorProgressVsLabel={vendorProgressVsLabel}
            />
          </div>
        </div>
        <div className="card-body px-0 pb-3 pt-3 ta-booking-wizard-stack__panel ta-booking-wizard-panel">
      {wizardStep === 0 ? (
      <div className="card mb-0 ta-order-section ta-order-section--wizard-panel">
        <div className="card-header ta-order-section-title">Booking Details</div>
        <div className="card-body">
          <div className="row g-3 ta-booking-details-form">
            <CustomerAutocomplete
              {...customerAutocompleteExtras}
              label="Customer / account"
              placeholder="Select customer or type to add new"
              value={form.customer_id}
              required
              onChange={handleCustomerChange}
              customers={state.customers}
              apiRequest={apiRequest}
              token={token}
              onResolvedRecord={(c) =>
                setCustomersList((prev) => mergeUniqueById(prev, [c]))
              }
              wrapperClassName="col-12 col-lg-4"
            />
            <TextField
              label="Contact no"
              value={
                selectedCustomer?.contact_number?.trim()
                  ? selectedCustomer.contact_number
                  : ""
              }
              readOnly
              placeholder="—"
              wrapperClassName="col-12 col-lg-4"
              onChange={() => {}}
            />
            <TextField
              label="DRC no. (TravoCRM)"
              value={form.drc_no}
              maxLength={100}
              autoComplete="off"
              placeholder="e.g. DRC-2026-A01"
              title="Reference shown on booking list and proforma invoice; must be unique per booking"
              wrapperClassName="col-12 col-lg-4"
              onChange={(value) => setForm((c) => ({ ...c, drc_no: value }))}
            />
            <TextField
              label="Travel destination"
              id="ta-order-entry-destination"
              value={form.destination}
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="Destination name — must match Masters catalogue labels"
              wrapperClassName="col-12 col-lg-4"
              onChange={(value) => setForm((c) => ({ ...c, destination: value }))}
            />
            <TextField
              label="From date"
              type="date"
              value={form.travel_start_date}
              wrapperClassName="col-12 col-lg-4"
              onChange={(value) => setForm((c) => ({ ...c, travel_start_date: value }))}
            />
            <TextField
              label="To date"
              type="date"
              value={form.travel_end_date}
              wrapperClassName="col-12 col-lg-4"
              onChange={(value) => setForm((c) => ({ ...c, travel_end_date: value }))}
            />
            <TextField
              label="Total order value (INR)"
              id="ta-order-total-order-value"
              formatAmountOnBlur
              required
              placeholder="e.g. 5000 or 15000"
              value={form.total_amount}
              wrapperClassName="col-12 col-lg-4"
              onChange={(value) => {
                userEditedBookingTotalRef.current = true;
                setForm((c) => ({ ...c, total_amount: value }));
              }}
            />
            <div className="col-12 col-lg-4">
              <label className="form-label" htmlFor="ta-order-estimated-margin-pct">
                Estimated margin (%)
                {estimatedProfitAmountDisplay !== "—" ? (
                  <span className="text-muted fw-normal">
                    {" "}
                    (profit {estimatedProfitAmountDisplay})
                  </span>
                ) : null}
              </label>
              <input
                id="ta-order-estimated-margin-pct"
                className="form-control"
                type="number"
                step="0.01"
                min={0}
                max={100}
                required
                title="Enter a number from 0 to 100 (decimals allowed, e.g. 12.5)"
                value={form.estimated_margin == null ? "" : String(form.estimated_margin)}
                onChange={(e) =>
                  setForm((c) => ({ ...c, estimated_margin: e.target.value }))
                }
              />
            </div>
            <SelectField
              label="Assigned to"
              value={String(form.atpl_assigned_user_id ?? "")}
              wrapperClassName="col-12 col-lg-4"
              onChange={(value) =>
                setForm((c) => ({
                  ...c,
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
        </div>
      </div>
      ) : null}

      {wizardStep === 2 ? (
      <div className="card mb-0 ta-order-section ta-order-section--wizard-panel ta-order-section--travelers">
        <div className="card-body pt-3">
          {!String(form.customer_id || "").trim() ? (
            <p className="small text-warning mb-2">
              Choose a <strong>customer</strong> on Booking Details before selecting travelers.
            </p>
          ) : null}
          {String(form.customer_id || "").trim() && travelersForBookingCustomer.length === 0 ? (
            <p className="small text-warning mb-2">
              No traveler profiles exist for this customer yet. Use{" "}
              <strong>Create traveler</strong> from the traveler search (if available) or{" "}
              <strong>Manage Travelers</strong> in the menu.
            </p>
          ) : null}

          {travelerPickError ? (
            <AlertMessage
              message={travelerPickError}
              variant="danger"
              autoHideAfterMs={6000}
              onAutoHide={() => setTravelerPickError("")}
            />
          ) : null}

          <div className="ta-order-table-wrap ta-travelers-table-wrap">
            <table className="table table-sm align-middle ta-order-table ta-travelers-table ta-travelers-table--booking-wizard mb-0">
              <thead>
                <tr>
                  <th scope="col" className="ta-travelers-col-name">
                    Name
                  </th>
                  <th scope="col">Phone</th>
                  <th scope="col">DOB</th>
                  <th scope="col">Passport No</th>
                  <th scope="col">Passport Expiry</th>
                  <th scope="col">Name on Passport</th>
                  <th scope="col">PAN</th>
                  <th scope="col">Nationality</th>
                  <th className="ta-tcol-actions" scope="col" aria-label="Row actions" />
                </tr>
              </thead>
              <tbody>
                {!travelerHasAny ? (
                  <tr>
                    <td colSpan={9} className="text-center text-muted small py-3">
                      No record found.
                    </td>
                  </tr>
                ) : null}
                {normalizedTravelerLines
                  .filter((l) => String(l?.traveler_id ?? "").trim())
                  .map((line) => {
                    const actualIndex = normalizedTravelerLines.indexOf(line);
                    const isLead = String(line.pax_type || "").toUpperCase() === "LEAD";
                    const tr = travelersById.get(String(line.traveler_id)) || null;
                    const trName =
                      tr
                        ? [tr.first_name, tr.last_name].filter(Boolean).join(" ").trim() || `Traveler #${tr.id}`
                        : `Traveler #${line.traveler_id}`;
                    const passNo = String(tr?.passport_number || "").trim() || "—";
                    const passNameOnDoc = String(tr?.name_as_per_passport || "").trim() || "—";
                    const passExpiry = tr?.passport_expiry_date || tr?.passport_expiry
                      ? String(tr.passport_expiry_date || tr.passport_expiry)
                      : "";
                    const passValidity =
                      passExpiry && passExpiry !== "null" ? formatDate(passExpiry) : "—";
                    const dob = tr?.dob ? formatDate(tr.dob) : "—";
                    const nat = String(tr?.nationality || "").trim() || "—";
                    const pan = String(tr?.pan_number || "").trim() || "—";
                    const contact = String(tr?.contact_number || "").trim() || "—";
                    return (
                      <tr key={`tr-${String(line.traveler_id)}-${actualIndex}`}>
                        <td className="small ta-travelers-col-name">
                          <div
                            className="fw-semibold text-body d-flex align-items-baseline flex-wrap gap-1"
                            title={`${trName} ${isLead ? "(L)" : "(C)"}`}
                          >
                            <span className="text-truncate">{trName}</span>
                            <span className="text-muted small fw-normal flex-shrink-0">
                              {isLead ? "(L)" : "(C)"}
                            </span>
                          </div>
                        </td>
                        <td className="small text-nowrap">{contact}</td>
                        <td className="small text-nowrap">{dob}</td>
                        <td className="small text-break">{passNo}</td>
                        <td className="small text-nowrap">{passValidity}</td>
                        <td className="small text-break" title={passNameOnDoc !== "—" ? passNameOnDoc : undefined}>
                          {passNameOnDoc}
                        </td>
                        <td className="small text-nowrap text-uppercase">{pan}</td>
                        <td className="small">{nat}</td>
                        <td className="text-end text-nowrap ta-tcol-actions align-middle">
                          <button
                            type="button"
                            className="btn btn-icon btn-soft-info btn-sm me-1"
                            title="Preferences (seat, meal, special)"
                            aria-label="Open traveler preferences"
                            onClick={() => {
                              setPrefLineIndex(actualIndex);
                              setPrefForm({
                                seat_preference: line.seat_preference || "",
                                meal_preference: line.meal_preference || "",
                                special_request: line.special_request || "",
                              });
                              setPrefModalOpen(true);
                            }}
                          >
                            <svg viewBox="0 0 16 16" aria-hidden="true" className="ta-action-icon">
                              <path d="M2 3.5h12v1.2H2V3.5zm0 3.4h9.2v1.2H2V6.9zm0 3.3h6.5v1.2H2v-1.2z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="btn btn-icon btn-soft-primary btn-sm me-1"
                            title="Edit traveler"
                            aria-label="Edit traveler row"
                            onClick={() => {
                              setTravelerPickError("");
                              setAddTravelerEditIndex(actualIndex);
                              setAddTravelerForm({
                                traveler_id: String(line.traveler_id || ""),
                                pax_type: isLead ? "LEAD" : "CO",
                              });
                              setAddTravelerModalOpen(true);
                            }}
                          >
                            <svg viewBox="0 0 16 16" aria-hidden="true" className="ta-action-icon">
                              <path d="M3 11.5 3.5 9l6-6 2.5 2.5-6 6L3 11.5z" />
                              <path d="M2 13.5h12" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="btn btn-icon btn-soft-danger btn-sm"
                            aria-label="Remove traveler row"
                            title="Remove row"
                            disabled={normalizedTravelerLines.length <= 1}
                            onClick={() =>
                              setForm((c) => {
                                const base = c.travelerLines?.length
                                  ? c.travelerLines
                                  : [{ ...emptyTravelerLine(), pax_type: "LEAD" }];
                                const next = base.filter((_, i) => i !== actualIndex);
                                if (!next.length) {
                                  return { ...c, travelerLines: [{ ...emptyTravelerLine(), pax_type: "LEAD" }] };
                                }
                                const hasLead = next.some(
                                  (l) => String(l?.pax_type || "").toUpperCase() === "LEAD",
                                );
                                const repaired = hasLead
                                  ? next
                                  : [{ ...next[0], pax_type: "LEAD" }, ...next.slice(1)];
                                return { ...c, travelerLines: repaired };
                              })
                            }
                          >
                            <svg viewBox="0 0 16 16" aria-hidden="true" className="ta-action-icon">
                              <path d="M3 4h10" />
                              <path d="M6 4V3h4v1" />
                              <path d="M5 4v8M11 4v8" />
                              <rect x="4" y="4" width="8" height="9" rx="1" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="ta-travelers-add-pax">
            <button
              type="button"
              className="btn btn-link btn-sm p-0 border-0 shadow-none fw-semibold text-decoration-underline"
              disabled={!String(form.customer_id || "").trim()}
              onClick={() => {
                setTravelerPickError("");
                setAddTravelerEditIndex(null);
                setAddTravelerForm({
                  traveler_id: "",
                  pax_type: hasLeadSelected ? "CO" : "LEAD",
                });
                setAddTravelerModalOpen(true);
              }}
            >
              Add PAX
            </button>
          </div>
          <FormModal
            open={addTravelerModalOpen}
            title={addTravelerEditIndex == null ? "Add Traveler" : "Edit Traveler"}
            saveLabel={addTravelerEditIndex == null ? "Add" : "Update"}
            saving={false}
            onCancel={() => {
              setAddTravelerModalOpen(false);
            }}
            onSubmit={(e) => {
              e.preventDefault();
              const tid = String(addTravelerForm.traveler_id || "").trim();
              if (!tid) {
                setTravelerPickError("Traveler is required.");
                return;
              }
              const nextType = String(addTravelerForm.pax_type || "").toUpperCase() === "LEAD" ? "LEAD" : "CO";
              if (nextType === "LEAD" && hasLeadPaxElsewhere) {
                setTravelerPickError("Booking must have exactly one Lead PAX.");
                return;
              }
              const base = form.travelerLines?.length
                ? form.travelerLines
                : [{ ...emptyTravelerLine(), pax_type: "LEAD" }];
              const insertAt =
                addTravelerEditIndex != null && Number.isFinite(Number(addTravelerEditIndex))
                  ? Number(addTravelerEditIndex)
                  : (() => {
                      const emptyIdx = base.findIndex((l) => !String(l?.traveler_id ?? "").trim());
                      return emptyIdx === -1 ? base.length : emptyIdx;
                    })();
              const dupMsg = validateTravelerPickDuplicateMessage(base, state.travelers, insertAt, tid);
              if (dupMsg) {
                setTravelerPickError(dupMsg);
                return;
              }
              setTravelerPickError("");
              setForm((c) => {
                const b = c.travelerLines?.length ? c.travelerLines : [{ ...emptyTravelerLine(), pax_type: "LEAD" }];
                const at =
                  addTravelerEditIndex != null && Number.isFinite(Number(addTravelerEditIndex))
                    ? Number(addTravelerEditIndex)
                    : (() => {
                        const emptyIdx = b.findIndex((l) => !String(l?.traveler_id ?? "").trim());
                        return emptyIdx === -1 ? b.length : emptyIdx;
                      })();
                let next = b;
                if (at === b.length) {
                  next = [...b, { ...emptyTravelerLine(), pax_type: "CO" }];
                }
                const prev = next[at] || emptyTravelerLine();
                next = patchLine(next, at, {
                  traveler_id: tid,
                  pax_type: nextType,
                  seat_preference: prev.seat_preference || "",
                  meal_preference: prev.meal_preference || "",
                  special_request: prev.special_request || "",
                });
                if (nextType === "LEAD") {
                  next = next.map((l, i) => (i === at ? { ...l, pax_type: "LEAD" } : { ...l, pax_type: "CO" }));
                }
                return { ...c, travelerLines: next };
              });
              setAddTravelerEditIndex(null);
              setAddTravelerModalOpen(false);
            }}
          >
            <div className="row g-3">
              <div className="col-12 col-md-8">
                {addTravelerEditIndex != null && String(addTravelerForm.traveler_id || "").trim() ? (
                  <>
                    <label className="form-label">Traveler</label>
                    <div className="form-control form-control-sm bg-body-secondary border text-body d-flex align-items-center flex-wrap py-2">
                      {(() => {
                        const tid = String(addTravelerForm.traveler_id || "").trim();
                        const t = addTravelerSelectedRecord || travelersById.get(tid);
                        return t
                          ? [t.first_name, t.last_name].filter(Boolean).join(" ").trim() || `Traveler #${t.id}`
                          : `Traveler #${tid}`;
                      })()}
                    </div>
                  </>
                ) : (
                  <TravelerAutocomplete
                    label="Traveler"
                    value={addTravelerForm.traveler_id}
                    onChange={(value) => setAddTravelerForm((c) => ({ ...c, traveler_id: value }))}
                    travelers={state.travelers}
                    customers={state.customers}
                    customerIdFilter={form.customer_id}
                    apiRequest={apiRequest}
                    token={token}
                    disabled={!String(form.customer_id || "").trim()}
                    placeholder={
                      String(form.customer_id || "").trim()
                        ? "Search passenger by name…"
                        : "Select a customer in Booking Details first"
                    }
                    inputClassName="form-control form-control-sm"
                    onResolvedRecord={(t) => setTravelersList((prev) => mergeUniqueById(prev, [t]))}
                    excludeTravelerIds={addModalTravelerExcludeIds}
                    {...travelerAutocompleteExtrasForRow(
                      addTravelerEditIndex != null && Number.isFinite(Number(addTravelerEditIndex))
                        ? Number(addTravelerEditIndex)
                        : null,
                    )}
                  />
                )}
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">PAX type</label>
                <div className="btn-group w-100" role="group" aria-label="PAX type">
                  <button
                    type="button"
                    className={`btn btn-sm ${String(addTravelerForm.pax_type || "").toUpperCase() === "LEAD" ? "btn-primary" : "btn-outline-primary"}`}
                    disabled={hasLeadPaxElsewhere && String(addTravelerForm.pax_type || "").toUpperCase() !== "LEAD"}
                    onClick={() => setAddTravelerForm((c) => ({ ...c, pax_type: "LEAD" }))}
                  >
                    Lead PAX
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${String(addTravelerForm.pax_type || "").toUpperCase() !== "LEAD" ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => setAddTravelerForm((c) => ({ ...c, pax_type: "CO" }))}
                  >
                    Co PAX
                  </button>
                </div>
              </div>
              {addTravelerSelectedRecord ? (
                <div className="col-12">
                  <div className="border rounded bg-light-subtle p-3">
                    <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
                      <div className="fw-semibold">
                        {[addTravelerSelectedRecord.first_name, addTravelerSelectedRecord.last_name]
                          .filter(Boolean)
                          .join(" ")
                          .trim() || `Traveler #${addTravelerSelectedRecord.id}`}
                      </div>
                      <div className="text-muted small">ID: #{addTravelerSelectedRecord.id}</div>
                    </div>
                    <div className="row g-2 mt-1 small">
                      <div className="col-12 col-md-4">
                        <div className="text-muted">Email</div>
                        <div className="text-body">{addTravelerSelectedRecord.email || "—"}</div>
                      </div>
                      <div className="col-12 col-md-4">
                        <div className="text-muted">Contact</div>
                        <div className="text-body">{addTravelerSelectedRecord.contact_number || "—"}</div>
                      </div>
                      <div className="col-12 col-md-4">
                        <div className="text-muted">Gender</div>
                        <div className="text-body">{addTravelerSelectedRecord.gender || "—"}</div>
                      </div>
                      <div className="col-12 col-md-4">
                        <div className="text-muted">DOB</div>
                        <div className="text-body">{addTravelerSelectedRecord.dob || "—"}</div>
                      </div>
                      <div className="col-12 col-md-4">
                        <div className="text-muted">Passport No</div>
                        <div className="text-body text-break">
                          {String(addTravelerSelectedRecord.passport_number || "").trim() || "—"}
                        </div>
                      </div>
                      <div className="col-12 col-md-4">
                        <div className="text-muted">Name as per passport</div>
                        <div className="text-body text-break">
                          {String(addTravelerSelectedRecord.name_as_per_passport || "").trim() || "—"}
                        </div>
                      </div>
                      <div className="col-12 col-md-4">
                        <div className="text-muted">Passport validity</div>
                        <div className="text-body">
                          {addTravelerSelectedRecord.passport_expiry_date ||
                            addTravelerSelectedRecord.passport_expiry ||
                            "—"}
                        </div>
                      </div>
                      <div className="col-12 col-md-4">
                        <div className="text-muted">PAN</div>
                        <div className="text-body">{addTravelerSelectedRecord.pan_number || "—"}</div>
                      </div>
                      <div className="col-12 col-md-4">
                        <div className="text-muted">Aadhaar</div>
                        <div className="text-body">
                          {(() => {
                            const d = String(addTravelerSelectedRecord.aadhaar_number || "").replace(/\D/g, "");
                            if (d.length === 12) {
                              return `**** **** ${d.slice(-4)}`;
                            }
                            return String(addTravelerSelectedRecord.aadhaar_number || "").trim() || "—";
                          })()}
                        </div>
                      </div>
                      <div className="col-12 col-md-4">
                        <div className="text-muted">Nationality</div>
                        <div className="text-body">{addTravelerNationalityLabel || "—"}</div>
                      </div>
                      <div className="col-12">
                        <div className="text-muted">Address</div>
                        <div className="text-body text-break">
                          {String(addTravelerSelectedRecord.address || "").trim() || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </FormModal>
          <FormModal
            open={prefModalOpen}
            title="Traveler preferences"
            saveLabel="Save"
            saving={false}
            onCancel={() => {
              setPrefModalOpen(false);
              setPrefLineIndex(null);
            }}
            onSubmit={(e) => {
              e.preventDefault();
              if (prefLineIndex == null || !Number.isFinite(Number(prefLineIndex))) {
                return;
              }
              setForm((c) => {
                const base = c.travelerLines?.length ? c.travelerLines : [];
                const at = Number(prefLineIndex);
                if (at < 0 || at >= base.length) return c;
                const next = patchLine(base, at, {
                  seat_preference: prefForm.seat_preference || "",
                  meal_preference: prefForm.meal_preference || "",
                  special_request: prefForm.special_request || "",
                });
                return { ...c, travelerLines: next };
              });
              setPrefModalOpen(false);
              setPrefLineIndex(null);
            }}
          >
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <TextField
                  label="Seat"
                  value={prefForm.seat_preference}
                  onChange={(value) => setPrefForm((c) => ({ ...c, seat_preference: value }))}
                />
              </div>
              <div className="col-12 col-md-6">
                <TextField
                  label="Meal"
                  value={prefForm.meal_preference}
                  onChange={(value) => setPrefForm((c) => ({ ...c, meal_preference: value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Special request</label>
                <textarea
                  className="form-control form-control-sm"
                  rows={3}
                  value={prefForm.special_request}
                  onChange={(e) => setPrefForm((c) => ({ ...c, special_request: e.target.value }))}
                />
              </div>
            </div>
          </FormModal>
        </div>
      </div>
      ) : null}

      {wizardStep === 1 ? (
        <VendorBookingProductsSection
          vendorPaymentLines={form.vendorPaymentLines}
          setForm={setForm}
          products={state.products}
          productTypes={state.productTypes || []}
          vendors={state.vendors || []}
          bookingDestination={form.destination}
          passengerCount={travelerPassengerCount(form.travelerLines)}
          vendorTypeRestrictionsByVendorId={vendorTypeRestrictionsByVendorId}
          orderTotalDefaultPrice={form.total_amount}
        />
      ) : null}

      {wizardStep === 4 ? (
        <div className="card mb-0 ta-order-section ta-order-section--wizard-panel ta-order-section--vendorpay">
          <div className="card-body px-0 pb-4 pt-3">
            {!String(form.destination || "").trim() ? (
              <p className="small text-muted mb-2 px-3 px-md-0">
                No destination on Booking Details yet — vendor and product lists show the full catalogue. Set a
                destination to filter rows to matching tour locations.
              </p>
            ) : null}
            <div
              className="ta-order-table-wrap ta-order-vendor-grid-wrap ta-vpay-table-wrap"
              role="region"
              aria-label="Vendor payment booking lines"
            >
              <table className="table table-sm ta-order-table ta-order-vendor-line-table ta-vpay-table--booking-wizard align-middle mb-0">
                <colgroup>
                  <col className="ta-vpay-col-idx" />
                  <col className="ta-vpay-col-vendor" />
                  <col className="ta-vpay-col-product" />
                  <col className="ta-vpay-col-inv-no" />
                  <col className="ta-vpay-col-inv-date" />
                  <col className="ta-vpay-col-amount" />
                  <col className="ta-vpay-col-gst-pct" />
                  <col className="ta-vpay-col-gst-amt" />
                  <col className="ta-vpay-col-tds" />
                  <col className="ta-vpay-col-comm" />
                  <col className="ta-vpay-col-net" />
                  <col className="ta-vpay-col-due" />
                  <col className="ta-vpay-col-mode" />
                  <col className="ta-vpay-col-remarks" />
                  <col className="ta-vpay-col-action" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th className="ta-vcol-fk" scope="col">
                      <WizardTableThLines lines={["Vendors", "Name"]} />
                    </th>
                    <th className="ta-vcol-fk" scope="col">
                      <WizardTableThLines lines={["Products", "& Services"]} />
                    </th>
                    <th className="ta-vcol-ref" scope="col">
                      <WizardTableThLines lines={["Invoice", "No"]} />
                    </th>
                    <th className="ta-vcol-date" scope="col">
                      <WizardTableThLines lines={["Invoice", "Date"]} />
                    </th>
                    <th className="ta-vcol-num text-end" scope="col">
                      <WizardTableThLines lines={["Taxable Amount", "(₹)"]} />
                    </th>
                    <th className="ta-vcol-pct text-end" scope="col">
                      GST(%)
                    </th>
                    <th className="ta-vcol-num text-end" scope="col">
                      <WizardTableThLines lines={["GST", "(₹)"]} />
                    </th>
                    <th className="ta-vcol-num text-end" scope="col">
                      TDS (₹)
                    </th>
                    <th className="ta-vcol-num text-end" scope="col">
                      Comm. (₹)
                    </th>
                    <th className="ta-vcol-num text-end" scope="col">
                      <WizardTableThLines lines={["Net Payable", "(₹)"]} />
                    </th>
                    <th className="ta-vcol-date" scope="col">
                      <WizardTableThLines lines={["Due", "Date"]} />
                    </th>
                    <th className="ta-vcol-mode" scope="col">
                      <WizardTableThLines lines={["Mode of", "Payment"]} />
                    </th>
                    <th className="ta-vcol-remarks" scope="col">
                      <WizardTableThLines lines={["Remarks", "& Status"]} />
                    </th>
                    <th className="ta-vcol-action text-end" scope="col" aria-label="Row actions" />
                  </tr>
                </thead>
                <tbody>
                  {visibleVendorProductLines.length ? (
                    visibleVendorProductLines.map(({ line, originalIndex }, idx) => {
                      const vid = String(line.vendor_id || "").trim();
                      const vendorRowForLine = mergeVendorRowWithPaymentDetailCache(
                        resolveVendorRow(state.vendors, line.vendor_id),
                        vid,
                        vendorPaymentCacheByVendorId,
                      );
                      const lineCatalogProducts = pickerCatalogForVendorPaymentLine(
                        state,
                        form.destination,
                        line.vendor_id,
                        vendorRowForLine,
                        productLineCatalogProducts,
                        vendorPaymentCacheByVendorId,
                        masterCatalogByProductId,
                      );
                      const vName =
                        productLineCatalogVendors.find((v) => String(v.id) === String(line.vendor_id))
                          ?.vendor_name || (vid || "—");
                      const pLabel = labelForReadonlyVendorProductLine({
                        line,
                        vendorRow: vendorRowForLine,
                        lineCatalogProducts,
                        state,
                      });
                      const invNo = String(line.invoice_ref_numbers || "").trim();
                      const invD = String(line.invoice_ref_date || "").trim();
                      const taxN = parseBookingAmountNumber(line.taxable_amount);
                      const gstP = String(line.gst_percent ?? "").trim();
                      const gstA = parseBookingAmountNumber(line.gst_amount);
                      const cA = parseBookingAmountNumber(line.commission_amount);
                      const tdsA = parseBookingAmountNumber(line.tds_amount);
                      const netN = parseBookingAmountNumber(line.net_payable);
                      const dueD = String(line.due_date || "").trim();
                      const pm = String(line.payment_mode || "").trim();
                      const pmList = paymentMethodFieldOptions(paymentModes, line.payment_mode, "—");
                      const pmLabel = pm ? pmList.find((o) => o.value === pm)?.label || pm : "—";
                      const status = normalizePaymentLineStatusForForm(line.line_status) || "";
                      const remark = String(line.line_remark || "").trim();
                      const remarksStatus = [remark, status].filter(Boolean).join(" · ") || "—";
                      return (
                        <tr key={`vpr-${originalIndex}`}>
                          <td className="small text-nowrap align-middle">{idx + 1}</td>
                          <td className="ta-vcol-fk small align-middle">{vName || "—"}</td>
                          <td className="ta-vcol-fk small align-middle">{pLabel}</td>
                          <td className="ta-vcol-ref small align-middle">{invNo || "—"}</td>
                          <td className="ta-vcol-date small align-middle text-nowrap">
                            {invD ? formatDate(invD) : "—"}
                          </td>
                          <td className="ta-vcol-num small text-end align-middle">
                            {Number.isFinite(taxN) ? formatCurrencyAmount(taxN) : "—"}
                          </td>
                          <td className="ta-vcol-pct small text-end align-middle">
                            {gstP ? (gstP.includes("%") ? gstP : `${gstP}%`) : "—"}
                          </td>
                          <td className="ta-vcol-num small text-end align-middle">
                            {Number.isFinite(gstA) ? formatCurrencyAmount(gstA) : "—"}
                          </td>
                          <td className="ta-vcol-num small text-end align-middle">
                            {Number.isFinite(tdsA) ? formatCurrencyAmount(tdsA) : "—"}
                          </td>
                          <td className="ta-vcol-num small text-end align-middle">
                            {Number.isFinite(cA) ? formatCurrencyAmount(cA) : "—"}
                          </td>
                          <td className="ta-vcol-num small text-end align-middle">
                            {Number.isFinite(netN) ? formatCurrencyAmount(netN) : "—"}
                          </td>
                          <td className="ta-vcol-date small align-middle text-nowrap">
                            {dueD ? formatDate(dueD) : "—"}
                          </td>
                          <td className="ta-vcol-mode small align-middle">{pmLabel}</td>
                          <td
                            className="ta-vcol-remarks small align-middle"
                            title={remarksStatus !== "—" ? remarksStatus : undefined}
                          >
                            {remarksStatus.length > 40 ? `${remarksStatus.slice(0, 37)}…` : remarksStatus}
                          </td>
                          <td className="ta-vcol-action text-end text-nowrap align-middle">
                            <div className="ta-table-actions justify-content-end">
                              <button
                                type="button"
                                className="btn btn-icon btn-soft-primary btn-sm"
                                aria-label="Edit vendor payment line"
                                title="Edit"
                                onClick={() => openVendorPayEditModal(originalIndex)}
                              >
                                <svg viewBox="0 0 16 16" aria-hidden="true" className="ta-action-icon">
                                  <path d="M3 11.5 3.5 9l6-6 2.5 2.5-6 6L3 11.5z" />
                                  <path d="M2 13.5h12" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                className="btn btn-icon btn-soft-danger btn-sm"
                                aria-label="Remove vendor payment line"
                                title="Remove row"
                                onClick={() =>
                                  setForm((c) => {
                                    const base = c.productLines?.length ? c.productLines : [];
                                    const next = base.filter((_, i) => i !== originalIndex);
                                    const meaningful = next.filter((row) => isMeaningfulVendorProductLine(row));
                                    return { ...c, productLines: meaningful.length ? next : [] };
                                  })
                                }
                              >
                                <svg viewBox="0 0 16 16" aria-hidden="true" className="ta-action-icon">
                                  <path d="M3 4h10" />
                                  <path d="M6 4V3h4v1" />
                                  <path d="M5 4v8M11 4v8" />
                                  <rect x="4" y="4" width="8" height="9" rx="1" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={15} className="text-center text-muted small py-4">
                        No record found.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="ta-vpay-table-tfoot">
                  <tr className="ta-vpay-totals-row">
                    <td colSpan={5} className="fw-semibold">
                      Total
                    </td>
                    <td className="ta-vcol-num text-end fw-semibold">
                      {formatCurrencyAmount(productLineTotals.taxable)}
                    </td>
                    <td className="ta-vcol-pct" />
                    <td className="ta-vcol-num text-end fw-semibold">
                      {formatCurrencyAmount(productLineTotals.gst)}
                    </td>
                    <td className="ta-vcol-num text-end fw-semibold">
                      {formatCurrencyAmount(productLineTotals.tds)}
                    </td>
                    <td className="ta-vcol-num text-end fw-semibold">
                      {formatCurrencyAmount(productLineTotals.commission)}
                    </td>
                    <td className="ta-vcol-num text-end fw-semibold">
                      {formatCurrencyAmount(productLineTotals.net)}
                    </td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="ta-vpay-add-invoice">
              <button
                type="button"
                className="btn btn-link btn-sm p-0 border-0 shadow-none fw-semibold text-decoration-underline"
                onClick={openVendorPayAddModal}
              >
                + Add Invoice
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {wizardStep === 3 ? (
        <div className="card mb-0 ta-order-section ta-order-section--wizard-panel ta-order-section--custpay">
          <div className="card-body px-0 pb-4 pt-3">
            <div className="row g-4 align-items-start">
              <div className="col-12 min-w-0">
                <div className="ta-order-table-wrap ta-order-custpay-table-wrap">
                  <table className="table table-sm ta-order-table ta-custpay-table ta-custpay-table--booking-wizard align-middle mb-0">
                    <CustpayWizardColgroup />
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th className="ta-custpay-col-sale-pi" scope="col">
                          PI No.
                        </th>
                        <th className="ta-custpay-col-pi" scope="col">
                          PI Date *
                        </th>
                        <th className="ta-custpay-col-amount text-end" scope="col">
                          Amount (₹)
                        </th>
                        <th className="ta-custpay-col-received" scope="col">
                          Received On
                        </th>
                        <th className="ta-custpay-col-amt-received text-end" scope="col">
                          <WizardTableThLines lines={["Amt Received", "(₹)"]} />
                        </th>
                        <th className="ta-custpay-col-balance text-end" scope="col">
                          Balance (₹)
                        </th>
                        <th className="ta-custpay-col-mode" scope="col">
                          <WizardTableThLines lines={["Mode of", "payment"]} />
                        </th>
                        <th className="ta-custpay-col-utr" scope="col">
                          <WizardTableThLines lines={["UTR / Cash", "Rcpt / Ref"]} />
                        </th>
                        <th className="ta-custpay-col-remarks" scope="col">
                          Remarks
                        </th>
                        <th className="ta-custpay-col-action text-end" scope="col" aria-label="Row actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePaymentLines.length ? (
                        visiblePaymentLines.map(({ line, originalIndex }, idx) => {
                          const invoiceNum = parseBookingAmountNumber(line.invoice_amount);
                          const legacyAmountNum = parseBookingAmountNumber(line.amount);
                          const displayInvoiceNum =
                            Number.isFinite(invoiceNum) && invoiceNum !== 0
                              ? invoiceNum
                              : Number.isFinite(legacyAmountNum) && legacyAmountNum !== 0
                                ? legacyAmountNum
                                : 0;
                          const receivedNum = parseBookingAmountNumber(line.amount_received);
                          const piDate = String(line.payment_date || "").trim();
                          const receivedOn = String(line.received_on || "").trim();
                          const ref = String(line.transaction_reference || "").trim();
                          const method = String(line.payment_method || "").trim();
                          const rem = String(line.remark || "").trim();
                          const lineBalance =
                            Number.isFinite(displayInvoiceNum) && Number.isFinite(receivedNum)
                              ? Math.max(0, displayInvoiceNum - receivedNum)
                              : null;
                          const piNo = (() => {
                            const pi = String(line.sale_pi_receipt_no ?? "").trim();
                            if (pi) {
                              return pi;
                            }
                            const pid = String(line.payment_id ?? "").trim();
                            return pid ? `PAY-${pid}` : "—";
                          })();
                          return (
                            <tr key={`pay-${idx}`}>
                              <td className="small align-middle">{idx + 1}</td>
                              <td className="ta-custpay-col-sale-pi small font-monospace align-middle">
                                {piNo}
                              </td>
                              <td className="ta-custpay-col-pi small">
                                {piDate ? formatDate(piDate) : "—"}
                              </td>
                              <td className="ta-custpay-col-amount small text-end">
                                {Number.isFinite(displayInvoiceNum) && displayInvoiceNum !== 0
                                  ? formatCurrencyAmount(displayInvoiceNum)
                                  : "—"}
                              </td>
                              <td className="ta-custpay-col-received small">
                                {receivedOn ? formatDate(receivedOn) : "—"}
                              </td>
                              <td className="ta-custpay-col-amt-received small text-end">
                                {Number.isFinite(receivedNum) && receivedNum !== 0
                                  ? formatCurrencyAmount(receivedNum)
                                  : "—"}
                              </td>
                              <td className="ta-custpay-col-balance small text-end">
                                {lineBalance != null ? formatCurrencyAmount(lineBalance) : "—"}
                              </td>
                              <td className="ta-custpay-col-mode small">{method || "—"}</td>
                              <td className="ta-custpay-col-utr small">{ref || "—"}</td>
                              <td
                                className="ta-custpay-col-remarks small text-break"
                                title={rem || undefined}
                              >
                                {rem
                                  ? rem.length > 40
                                    ? `${rem.slice(0, 37)}…`
                                    : rem
                                  : "—"}
                              </td>
                              <td className="text-end align-middle ta-custpay-col-action ta-tcol-actions">
                                <div className="ta-table-actions justify-content-end">
                                  <button
                                    type="button"
                                    className="btn btn-icon btn-outline-secondary btn-sm"
                                    aria-label="Print or preview proforma"
                                    title="Proforma"
                                    onClick={() =>
                                      openProformaInvoicePrintWindow(form, state, bookingId, {
                                        customerPaymentLineIndex: originalIndex,
                                      })
                                    }
                                  >
                                    <svg viewBox="0 0 16 16" aria-hidden="true" className="ta-action-icon">
                                      <path d="M5 2h6v3H5z" />
                                      <path d="M4 6h8v8H4z" />
                                      <path d="M6 9h4v4H6z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-icon btn-soft-primary btn-sm"
                                    aria-label="Edit Sales PI row"
                                    title="Edit"
                                    onClick={() => openSalesPiEditModal(originalIndex)}
                                  >
                                    <svg viewBox="0 0 16 16" aria-hidden="true" className="ta-action-icon">
                                      <path d="M3 11.5 3.5 9l6-6 2.5 2.5-6 6L3 11.5z" />
                                      <path d="M2 13.5h12" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-icon btn-soft-danger btn-sm"
                                    aria-label="Remove Sales PI row"
                                    title="Remove row"
                                    onClick={() =>
                                      setForm((c) => {
                                        const base = Array.isArray(c.paymentLines) ? c.paymentLines : [];
                                        const next = base.filter((_, i) => i !== originalIndex);
                                        const meaningful = next.filter((row) => isMeaningfulSalesPiLine(row));
                                        return {
                                          ...c,
                                          paymentLines: meaningful.length
                                            ? meaningful
                                            : [],
                                        };
                                      })
                                    }
                                  >
                                    <svg viewBox="0 0 16 16" aria-hidden="true" className="ta-action-icon">
                                      <path d="M3 4h10" />
                                      <path d="M6 4V3h4v1" />
                                      <path d="M5 4v8M11 4v8" />
                                      <rect x="4" y="4" width="8" height="9" rx="1" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={11} className="text-center text-muted small py-4">
                            No record found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="ta-custpay-table-tfoot">
                      <tr className="ta-custpay-totals-row">
                        <td />
                        <td colSpan={2} className="fw-semibold">
                          Total
                        </td>
                        <td className="ta-custpay-col-amount text-end fw-semibold">
                          {formatCurrencyAmount(customerPaymentSummary.piTotal)}
                        </td>
                        <td />
                        <td className="ta-custpay-col-amt-received text-end fw-semibold">
                          {formatCurrencyAmount(customerPaymentSummary.received)}
                        </td>
                        <td className="ta-custpay-col-balance text-end fw-semibold">
                          {formatCurrencyAmount(
                            Math.max(0, customerPaymentSummary.piTotal - customerPaymentSummary.received),
                          )}
                        </td>
                        <td />
                        <td />
                        <td />
                        <td className="ta-custpay-col-action" />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="ta-custpay-add-new">
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 border-0 shadow-none fw-semibold text-decoration-underline"
                    onClick={openSalesPiAddModal}
                  >
                    + Add Proforma
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <FormModal
        open={salesPiModalOpen}
        title={salesPiEditIndex != null ? "Update Sales PI" : "Add Sales PI"}
        saveLabel={salesPiEditIndex != null ? "Update" : "Add"}
        saving={false}
        onCancel={closeSalesPiModal}
        onSubmit={saveSalesPiDraft}
        size="modal-lg"
        scrollableBody
      >
        <AlertMessage
          message={salesPiModalError}
          variant="danger"
          autoHideAfterMs={3000}
          onAutoHide={() => setSalesPiModalError("")}
        />
        <div className="row g-3">
          {salesPiEditIndex != null ? (
            <div className="col-12 col-md-6">
              <label className="form-label">Receipt no.</label>
              <div className="small font-monospace text-body bg-light border rounded px-2 py-2">
                {(() => {
                  const pi = String(salesPiDraft.sale_pi_receipt_no || "").trim();
                  const pid = String(salesPiDraft.payment_id || "").trim();
                  if (pi) {
                    return pi;
                  }
                  return pid ? `PAY-${pid}` : "—";
                })()}
              </div>
            </div>
          ) : null}
          <TextField
            label="PI / Receipt date *"
            type="date"
            required
            value={salesPiDraft.payment_date}
            onChange={(value) => setSalesPiDraft((c) => ({ ...c, payment_date: value }))}
          />
          <div className="col-12 col-md-6">
            <label className="form-label">Amount</label>
            <AmountFormattedInput
              className="form-control"
              value={salesPiDraft.invoice_amount}
              aria-label="PI or invoice amount"
              onChange={(plain) => setSalesPiDraft((c) => ({ ...c, invoice_amount: plain }))}
            />
          </div>
          <TextField
            label="UTR / Rcpt / Ref"
            value={salesPiDraft.transaction_reference}
            onChange={(value) => setSalesPiDraft((c) => ({ ...c, transaction_reference: value }))}
          />
          <div className="col-12 col-md-6">
            <label className="form-label">Amount recvd</label>
            <AmountFormattedInput
              className="form-control"
              value={salesPiDraft.amount_received}
              aria-label="Amount received"
              onChange={(plain) => setSalesPiDraft((c) => ({ ...c, amount_received: plain }))}
            />
          </div>
          <TextField
            label="Recvd on (date)"
            type="date"
            value={salesPiDraft.received_on}
            onChange={(value) => setSalesPiDraft((c) => ({ ...c, received_on: value }))}
          />
          <div className="col-12 col-md-6">
            <label className="form-label">Mode of payment</label>
            <select
              className="form-select"
              value={salesPiDraft.payment_method}
              onChange={(e) => setSalesPiDraft((c) => ({ ...c, payment_method: e.target.value }))}
            >
              {paymentMethodFieldOptions(paymentModes, salesPiDraft.payment_method).map((opt) => (
                <option key={`salespi-${opt.value}-${opt.label}`} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={normalizePaymentLineStatusForForm(salesPiDraft.status)}
              onChange={(e) => setSalesPiDraft((c) => ({ ...c, status: e.target.value }))}
            >
              {SALES_PI_STATUS_OPTIONS.map((s) => (
                <option key={`salespi-st-${s}`} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="ta-sales-pi-remark">
              Remark
            </label>
            <textarea
              id="ta-sales-pi-remark"
              className="form-control"
              rows={2}
              maxLength={2000}
              placeholder="Optional note for this Sales PI line"
              value={salesPiDraft.remark ?? ""}
              onChange={(e) => setSalesPiDraft((c) => ({ ...c, remark: e.target.value }))}
            />
          </div>
        </div>
      </FormModal>

      <FormModal
        open={vendorPayModalOpen}
        title={vendorPayEditIndex != null ? "Update vendor payment" : "Add vendor payment"}
        saveLabel={vendorPayEditIndex != null ? "Update" : "Add"}
        saving={false}
        onCancel={closeVendorPayModal}
        onSubmit={saveVendorPayDraft}
        size="modal-xl"
        scrollableBody
      >
        <AlertMessage
          message={vendorPayModalError}
          variant="danger"
          autoHideAfterMs={5000}
          onAutoHide={() => setVendorPayModalError("")}
        />
        {(() => {
          const vidM = String(vendorPayDraft.vendor_id || "").trim();
          const vendorRowForLine = mergeVendorRowWithPaymentDetailCache(
            resolveVendorRow(state.vendors, vendorPayDraft.vendor_id),
            vidM,
            vendorPaymentCacheByVendorId,
          );
          const lineCatalogProductsM = pickerCatalogForVendorPaymentLine(
            state,
            form.destination,
            vendorPayDraft.vendor_id,
            vendorRowForLine,
            productLineCatalogProducts,
            vendorPaymentCacheByVendorId,
            masterCatalogByProductId,
          );
          const line = vendorPayDraft;
          return (
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="ta-vp-modal-vendor">
                  Vendor <span className="text-danger">*</span>
                </label>
                <AutocompleteField
                  label=""
                  hideLabel
                  value={line.vendor_id === "" || line.vendor_id == null ? "" : String(line.vendor_id)}
                  required
                  placeholder="Type vendor name…"
                  wrapperClassName="col-12"
                  inputClassName="form-control"
                  options={[
                    ...(productLineCatalogVendors || []).map((v) => ({
                      value: String(v.id),
                      label: v.vendor_name,
                      searchText: String(v.gst_number || ""),
                    })),
                  ]}
                  addNewLabel={canCreateProductType ? (q) => `Create vendor "${q}"` : undefined}
                  onAddNew={canCreateProductType ? (q) => openCreateVendorModal?.(q) : undefined}
                  onChange={(vid) => {
                    setVendorPayDraft((cur) =>
                      applyProductLineVendorIdChangeToRow(cur, vid, {
                        state,
                        destination: form.destination,
                        productLineCatalogProducts,
                        vendorPaymentCacheByVendorId,
                        masterCatalogByProductId,
                      }),
                    );
                    const vTrim = String(vid || "").trim();
                    if (vTrim && apiRequest && token) {
                      fetchVendorDetailForPaymentStep(vTrim, { force: true, destination: form.destination });
                    }
                  }}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="ta-vp-modal-product">
                  Product <span className="text-danger">*</span>
                </label>
                <AutocompleteField
                  label=""
                  hideLabel
                  disabled={!vidM}
                  placeholder={!vidM ? "Select vendor first" : "Type product name…"}
                  wrapperClassName="col-12"
                  inputClassName="form-control"
                  value={(() => {
                    const t = String(line.booking_product_type_id || "").trim();
                    if (t) {
                      return `vt:${t}`;
                    }
                    return line.product_id === "" || line.product_id == null ? "" : String(line.product_id);
                  })()}
                  required
                  options={[
                    ...(() => {
                      const vpRaw = vendorRowForLine?.vendor_products ?? vendorRowForLine?.vendorProducts;
                      const vpLinks = Array.isArray(vpRaw) ? vpRaw : [];
                      return (vpLinks || [])
                        .map((link, li) => {
                          const tid = link?.product_type_id ?? link?.productTypeId;
                          if (tid == null || String(tid).trim() === "") {
                            return null;
                          }
                          const vopt = `vt:${String(tid).trim()}`;
                          return { value: vopt, label: vendorProductLinkDropdownLabel(link) };
                        })
                        .filter(Boolean);
                    })(),
                    ...(lineCatalogProductsM || [])
                      .map((item) => {
                        const raw =
                          catalogProductPrimaryId(item) ?? item?.product_id ?? item?.productId ?? item?.id;
                        const pid = raw == null ? "" : String(raw).trim();
                        if (!pid) {
                          return null;
                        }
                        return {
                          value: pid,
                          label: catalogProductPickerLabel(item),
                          searchText: `${item?.product_name || ""} ${item?.vendor_name || ""}`,
                        };
                      })
                      .filter(Boolean),
                  ]}
                  addNewLabel={canCreateProductType ? (q) => `Create product "${q}"` : undefined}
                  onAddNew={canCreateProductType ? (q) => openCreateProductTypeModal?.(q, { vendorId: vidM }) : undefined}
                  onChange={(valRaw) => {
                    const val = String(valRaw || "").trim();
                    if (!val) {
                      setVendorPayDraft((cur) =>
                        applyProductLinePatchToRow(cur, { product_id: "", booking_product_type_id: "", price: "" }, {}),
                      );
                      return;
                    }
                    if (val.startsWith("vt:")) {
                      const tid = val.slice(3).trim();
                      setVendorPayDraft((cur) =>
                        applyProductLinePatchToRow(
                          cur,
                          { booking_product_type_id: tid, product_id: "", vendor_id: cur.vendor_id, price: "" },
                          {},
                        ),
                      );
                      return;
                    }
                    setVendorPayDraft((cur) => {
                      const fromCatalog = lineCatalogProductsM.find(
                        (p) => String(catalogProductPrimaryId(p) ?? p.product_id ?? "").trim() === val,
                      );
                      const product =
                        fromCatalog ||
                        state.products.find(
                          (p) => String(catalogProductPrimaryId(p) ?? p.product_id ?? "").trim() === val,
                        );
                      const patch = {
                        product_id: val,
                        booking_product_type_id: "",
                        vendor_id: product
                          ? String(product.vendor_id ?? product.vendorId ?? cur.vendor_id ?? "")
                          : cur.vendor_id,
                        price:
                          product != null && product.price != null && product.price !== "" ? String(product.price) : "",
                      };
                      return applyProductLinePatchToRow(cur, patch, { vendorRow: vendorRowForLine });
                    });
                  }}
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Invoice No</label>
                <input
                  className="form-control"
                  value={line.invoice_ref_numbers}
                  onChange={(e) =>
                    setVendorPayDraft((cur) =>
                      applyProductLinePatchToRow(cur, { invoice_ref_numbers: e.target.value }, {}),
                    )
                  }
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Invoice date</label>
                <input
                  type="date"
                  className="form-control"
                  value={line.invoice_ref_date}
                  onChange={(e) =>
                    setVendorPayDraft((cur) =>
                      applyProductLinePatchToRow(
                        cur,
                        { invoice_ref_date: e.target.value },
                        { vendorRow: vendorRowForLine },
                      ),
                    )
                  }
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Taxable</label>
                <AmountFormattedInput
                  className="form-control"
                  value={line.taxable_amount == null ? "" : String(line.taxable_amount)}
                  onChange={(plain) =>
                    setVendorPayDraft((cur) => applyProductLinePatchToRow(cur, { taxable_amount: plain }, {}))
                  }
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">GST %</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="form-control"
                  value={line.gst_percent == null ? "" : String(line.gst_percent)}
                  onChange={(e) =>
                    setVendorPayDraft((cur) => applyProductLinePatchToRow(cur, { gst_percent: e.target.value }, {}))
                  }
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">GST amt</label>
                <AmountFormattedInput
                  className="form-control"
                  value={line.gst_amount == null ? "" : String(line.gst_amount)}
                  title="Enter amount or use GST % — values sync with taxable"
                  onChange={(plain) =>
                    setVendorPayDraft((cur) => applyProductLinePatchToRow(cur, { gst_amount: plain }, {}))
                  }
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Comm %</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="form-control"
                  value={line.commission_percent == null ? "" : String(line.commission_percent)}
                  onChange={(e) =>
                    setVendorPayDraft((cur) =>
                      applyProductLinePatchToRow(cur, { commission_percent: e.target.value }, {}),
                    )
                  }
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Comm amt</label>
                <AmountFormattedInput
                  className="form-control"
                  value={line.commission_amount == null ? "" : String(line.commission_amount)}
                  title="Enter amount or use Comm % — values sync with taxable"
                  onChange={(plain) =>
                    setVendorPayDraft((cur) => applyProductLinePatchToRow(cur, { commission_amount: plain }, {}))
                  }
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">TDS %</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="form-control"
                  value={line.tds_percent == null ? "" : String(line.tds_percent)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setVendorPayDraft((cur) =>
                      applyProductLinePatchToRow(
                        cur,
                        {
                          tds_percent: v,
                          ...(String(v ?? "").trim() === "" ? { tds_amount: "" } : {}),
                        },
                        {},
                      ),
                    );
                  }}
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">TDS amt</label>
                <AmountFormattedInput
                  className="form-control"
                  value={line.tds_amount == null ? "" : String(line.tds_amount)}
                  title="Enter amount or use TDS % — values sync with taxable"
                  onChange={(plain) =>
                    setVendorPayDraft((cur) => applyProductLinePatchToRow(cur, { tds_amount: plain }, {}))
                  }
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Net pay</label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  className="form-control bg-light"
                  value={
                    line.net_payable !== "" &&
                    line.net_payable != null &&
                    Number.isFinite(parseBookingAmountNumber(line.net_payable))
                      ? formatCurrency(parseBookingAmountNumber(line.net_payable))
                      : ""
                  }
                />
              </div>
              <div className="col-12 col-md-4">
                <TextField
                  label="Due date"
                  type="date"
                  value={line.due_date ?? ""}
                  onChange={(value) =>
                    setVendorPayDraft((cur) => applyProductLinePatchToRow(cur, { due_date: value }, {}))
                  }
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label" htmlFor="ta-vp-modal-pay-mode">
                  Pay mode
                </label>
                <select
                  id="ta-vp-modal-pay-mode"
                  className="form-select"
                  value={line.payment_mode ?? ""}
                  onChange={(e) =>
                    setVendorPayDraft((cur) =>
                      applyProductLinePatchToRow(cur, { payment_mode: e.target.value }, {}),
                    )
                  }
                >
                  {paymentMethodFieldOptions(paymentModes, line.payment_mode, "Select payment mode").map(
                    (opt) => (
                      <option key={`vp-m-${opt.value}-${opt.label}`} value={opt.value}>
                        {opt.label}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="ta-vp-modal-line-remark">
                  Remark
                </label>
                <textarea
                  id="ta-vp-modal-line-remark"
                  className="form-control"
                  rows={2}
                  maxLength={2000}
                  placeholder="Optional note for this vendor line"
                  value={line.line_remark ?? ""}
                  onChange={(e) =>
                    setVendorPayDraft((cur) =>
                      applyProductLinePatchToRow(cur, { line_remark: e.target.value }, {}),
                    )
                  }
                />
              </div>
            </div>
          );
        })()}
      </FormModal>
        </div>
        <div className="card-body py-2 px-0 ta-booking-wizard-stack__toolbar ta-booking-wizard-toolbar-strip">
          <BookingWizardToolbar
            submitting={submitting}
            submitLabel={submitLabel}
            savingLabel={savingLabel}
            onSave={() => onSaveBooking?.(wizardStep)}
            previousDisabled={wizardStep <= 0}
            nextDisabled={wizardStep >= lastStepIndex}
            onPrevious={() => setWizardStep((s) => Math.max(0, s - 1))}
            onNext={() => setWizardStep((s) => Math.min(lastStepIndex, s + 1))}
            stepIndex={wizardStep}
            stepCount={WIZARD_STEPS.length}
            stepLabel={WIZARD_STEPS[wizardStep]?.label}
          />
        </div>
      </div>

      {renderModals()}
      {renderCatalogModals()}
      <SuccessModal
        open={showVendorTaxableCapModal}
        title="Invalid vendor amounts"
        message={String(validationError || "").trim()}
        onClose={() => setVendorTaxableCapModalDismissed(true)}
        autoCloseAfterMs={0}
      />
    </div>
  );
}

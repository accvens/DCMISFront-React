import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AmountFormattedInput,
  ConfirmActionModal,
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
import {
  PAYMENT_STATUS_OPTIONS,
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
  normDestLabel,
  productsForBookingDestination,
  travelerPassengerCount,
  effectiveTourValueNumber,
  vendorIdsEligibleForDestination,
  productsForVendorPaymentLine,
  vendorCreditLimitDaysFromRow,
  wizardStepForBookingValidationError,
  openProformaInvoicePrintWindow,
  formatSalePiReceiptSequential,
  normalizeCustomerPaymentSalePiReceiptNos,
  normalizeBookingAmountInput,
  parseBookingAmountNumber,
  CONFIRM_ADD_PRODUCT_LINE_MESSAGE,
  isVendorTaxableCapValidationMessage,
  useBookingTotalVendorPriceBidirectionalSync,
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

function patchLine(lines, index, patch) {
  return lines.map((row, i) => (i === index ? { ...row, ...patch } : row));
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

function updateProductLine(setForm, index, patch, options) {
  setForm((current) => {
    const lines = [...(current.productLines?.length ? current.productLines : [emptyProductLine()])];
    let row = { ...lines[index], ...patch };
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
    lines[index] = row;
    return { ...current, productLines: lines };
  });
}

/** Customer % collected vs booking total — higher is better. */
function customerReceivedProgressToneClass(percent) {
  const p = Number(percent);
  if (!Number.isFinite(p) || p < 0) {
    return "ta-booking-pay-progress__fill--red";
  }
  if (p < 50) {
    return "ta-booking-pay-progress__fill--red";
  }
  if (p < 90) {
    return "ta-booking-pay-progress__fill--yellow";
  }
  return "ta-booking-pay-progress__fill--green";
}

/** Vendor line total vs net after margin — higher alignment is better (capped at 100% in UI). */
function vendorLineProgressToneClass(percent) {
  const p = Number(percent);
  if (!Number.isFinite(p) || p < 0) {
    return "ta-booking-pay-progress__fill--red";
  }
  if (p < 60) {
    return "ta-booking-pay-progress__fill--red";
  }
  if (p < 85) {
    return "ta-booking-pay-progress__fill--yellow";
  }
  return "ta-booking-pay-progress__fill--green";
}

function BookingWizardPaymentProgress({
  customerReceivedTotal,
  totalTourValue,
  vendorLineTotalSum,
  effectiveTourValue,
}) {
  const tv = Number(normalizeBookingAmountInput(String(totalTourValue ?? "")));
  const hasTotalTour = Number.isFinite(tv) && tv > 0;
  const customerPct = hasTotalTour
    ? Math.min(100, Math.max(0, (Number(customerReceivedTotal) / tv) * 100))
    : 0;

  const ev = effectiveTourValue;
  const hasEffective = ev != null && Number.isFinite(ev) && ev > 0;
  const vendorPct = hasEffective
    ? Math.min(100, Math.max(0, (Number(vendorLineTotalSum) / ev) * 100))
    : 0;

  return (
    <div className="ta-booking-wizard-pay-progress" aria-label="Payment progress vs booking totals">
      <div className="ta-booking-pay-progress__item ta-booking-pay-progress__item--order-total">
        <div className="ta-booking-pay-progress__head">
          <span className="ta-booking-pay-progress__title">Total order value</span>
          <span className="ta-booking-pay-progress__pct" title="From Booking Details">
            {hasTotalTour ? formatCurrency(tv) : "—"}
          </span>
        </div>
      </div>
      <div className="ta-booking-pay-progress__item">
        <div className="ta-booking-pay-progress__head">
          <span className="ta-booking-pay-progress__title">Payment received</span>
          <span className="ta-booking-pay-progress__pct">{hasTotalTour ? `${Math.round(customerPct)}%` : "—"}</span>
        </div>
        <div className="ta-booking-pay-progress__sub small text-muted">
          vs booking total
          {hasTotalTour ? (
            <>
              {" "}
              · {formatCurrency(customerReceivedTotal)} / {formatCurrency(tv)}
              <span className="d-block mt-1">Received amount counts only rows with status Paid.</span>
            </>
          ) : null}
        </div>
        <div
          className="ta-booking-pay-progress__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(customerPct)}
          aria-label="Customer payment received (Paid lines only) as percent of booking total"
        >
          <div
            className={`ta-booking-pay-progress__fill ${customerReceivedProgressToneClass(customerPct)}`}
            style={{ width: `${customerPct}%` }}
          />
        </div>
      </div>
      <div className="ta-booking-pay-progress__item">
        <div className="ta-booking-pay-progress__head">
          <span className="ta-booking-pay-progress__title">Vendor payment (line total)</span>
          <span className="ta-booking-pay-progress__pct">{hasEffective ? `${Math.round(vendorPct)}%` : "—"}</span>
        </div>
        <div className="ta-booking-pay-progress__sub small text-muted">
          vs net after margin
          {hasEffective ? (
            <>
              {" "}
              · {formatCurrency(vendorLineTotalSum)} / {formatCurrency(ev)}
            </>
          ) : null}
        </div>
        <div
          className="ta-booking-pay-progress__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(vendorPct)}
          aria-label="Vendor line totals as percent of net after margin"
        >
          <div
            className={`ta-booking-pay-progress__fill ${vendorLineProgressToneClass(vendorPct)}`}
            style={{ width: `${vendorPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

const WIZARD_STEPS = [
  { id: 0, label: "Booking Details", hint: "Trip, customer, destination, and amounts", Icon: TabIconBooking },
  {
    id: 1,
    label: "Products",
    hint: "Catalogue lines: type, vendor, product, unit price, qty, line total",
    Icon: TabIconVendorPay,
  },
  { id: 2, label: "Traveler Details", hint: "Passengers and preferences", Icon: TabIconTravelers },
  { id: 3, label: "Customer Payment", hint: "Receipts from the customer", Icon: TabIconCustomerPay },
  {
    id: 4,
    label: "Vendor Payment",
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

export default function OrderEntryBookingForm({
  mode,
  bookingId,
  /** When opening Edit right after Create, restores the tab user was on (0-based). */
  initialWizardStep,
  form,
  setForm,
  state,
  paymentStatusOptions = PAYMENT_STATUS_OPTIONS,
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
  submitLabel = "Save booking",
  savingLabel = "Saving…",
  onWizardStepChange,
  validationError = "",
}) {
  const [wizardStep, setWizardStep] = useState(() => clampWizardStep(initialWizardStep));
  const [addVendorPaymentProductLineModalOpen, setAddVendorPaymentProductLineModalOpen] = useState(false);
  const [vendorTaxableCapModalDismissed, setVendorTaxableCapModalDismissed] = useState(false);

  useEffect(() => {
    setWizardStep(clampWizardStep(initialWizardStep));
  }, [mode, bookingId, initialWizardStep]);

  useEffect(() => {
    setAddVendorPaymentProductLineModalOpen(false);
  }, [wizardStep]);

  useEffect(() => {
    setVendorTaxableCapModalDismissed(false);
  }, [validationError]);

  useEffect(() => {
    onWizardStepChange?.(wizardStep);
  }, [wizardStep, onWizardStepChange]);

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

  const travelerLines = form.travelerLines?.length ? form.travelerLines : [emptyTravelerLine()];
  const leadTravelerLine = travelerLines[0] || emptyTravelerLine();
  const productLines = form.productLines?.length ? form.productLines : [emptyProductLine()];
  const paymentLines = form.paymentLines?.length ? form.paymentLines : [emptyPaymentLine()];

  const customerPaymentSummary = useMemo(() => {
    const received = paymentLines.reduce((sum, l) => sum + customerPaymentLineReceivedForPaidProgress(l), 0);
    const piTotal = paymentLines.reduce((sum, l) => sum + parseBookingAmountNumber(l.invoice_amount), 0);
    const tour = Number(normalizeBookingAmountInput(form.total_amount)) || 0;
    return {
      received,
      piTotal,
      outstanding: Math.max(0, tour - received),
      tour,
    };
  }, [paymentLines, form.total_amount]);

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
    travelers: state.travelers,
    setTravelers: setTravelersList,
    selectedCustomerId: form.customer_id,
    onCustomerCreated: (c) => {
      setForm((current) => ({
        ...current,
        customer_id: String(c.id),
        travelerLines: [emptyTravelerLine()],
      }));
    },
    onTravelerCreated: (t, rowIndex) => {
      if (rowIndex == null) {
        return;
      }
      setForm((current) => ({
        ...current,
        travelerLines: patchLine(
          current.travelerLines?.length ? current.travelerLines : [emptyTravelerLine()],
          rowIndex,
          { traveler_id: String(t.id) },
        ),
      }));
    },
  });

  const { renderCatalogModals, catalogMasterToolbar } = useBookingCatalogCreateModals({
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
      travelerLines: [emptyTravelerLine()],
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

  const productLineCatalogVendors = useMemo(() => {
    const masterById = new Map((state.vendors || []).map((v) => [Number(v.id), v]));
    const ids = vendorIdsEligibleForDestination(state.products, state.vendors, form.destination);
    for (const line of productLines) {
      const v = Number(line.vendor_id);
      if (v && masterById.has(v)) {
        ids.add(v);
      }
    }
    const list = Array.from(ids)
      .map((id) => masterById.get(Number(id)))
      .filter(Boolean)
      .sort((a, b) => String(a.vendor_name || "").localeCompare(String(b.vendor_name || "")));
    if (list.length > 0) {
      return list;
    }
    if (!Array.isArray(state.vendors) || state.vendors.length === 0) {
      return [];
    }
    return [...state.vendors].sort((a, b) =>
      String(a.vendor_name || "").localeCompare(String(b.vendor_name || "")),
    );
  }, [state.vendors, state.products, form.destination, productLines]);

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

  /**
   * Dedupe GET payment-catalogue-products (response includes vendor detail + rows; destination in query).
   */
  const vendorDetailFetchedRef = useRef(new Set());
  /** Per vendor: `vendor_products` + `payment_catalogue_products` from GET .../payment-catalogue-products. */
  const [vendorPaymentCacheByVendorId, setVendorPaymentCacheByVendorId] = useState({});

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
    const allowedVendorIds = vendorIdsEligibleForDestination(state.products, state.vendors, did);

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
        const vid = Number(line.vendor_id);
        if (!vid) {
          return line;
        }
        if (!did || !allowedVendorIds.has(vid)) {
          vChanged = true;
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

  return (
    <div className="ta-order-entry ta-order-entry--editor">
      <div className="card border-0 shadow-sm mb-3 mb-md-4 ta-booking-wizard-stack">
        <div className="card-body py-3 px-2 px-md-4 pb-3 ta-booking-wizard-tabstrip ta-booking-tabs-rail">
          <div className="ta-booking-wizard-tabstrip__row">
            <nav
              className="ta-booking-tabs ta-booking-tabs--main"
              role="tablist"
              aria-label="Booking workflow"
            >
              {WIZARD_STEPS.map((step, index) => {
                const active = wizardStep === index;
                const done = wizardStep > index;
                const Icon = step.Icon;
                return (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    title={step.hint}
                    aria-selected={active}
                    aria-current={active ? "step" : undefined}
                    className={`ta-booking-tab ${active ? "ta-booking-tab--active" : ""} ${done && !active ? "ta-booking-tab--done" : ""}`}
                    onClick={() => setWizardStep(index)}
                  >
                    <span className="ta-booking-tab__rail" aria-hidden="true" />
                    <span className="ta-booking-tab__step">{index + 1}</span>
                    <span className="ta-booking-tab__icon">
                      <Icon />
                    </span>
                    <span className="ta-booking-tab__label">{step.label}</span>
                  </button>
                );
              })}
            </nav>
            <BookingWizardPaymentProgress
              customerReceivedTotal={customerPaymentReceivedTotal}
              totalTourValue={form.total_amount}
              vendorLineTotalSum={productLineTotals.lineTotal}
              effectiveTourValue={effectiveTourValueNumeric}
            />
          </div>
        </div>
        <div className="card-body px-3 px-md-4 pb-3 pt-2 ta-booking-wizard-panel">
      {wizardStep === 0 ? (
      <div className="card mb-0 ta-order-section ta-order-section--wizard-panel">
        <div className="card-header ta-order-section-title">Booking Details</div>
        <div className="card-body">
          <div className="row g-3">
            <CustomerAutocomplete
              label="Customer"
              value={form.customer_id}
              required
              onChange={handleCustomerChange}
              customers={state.customers}
              apiRequest={apiRequest}
              token={token}
              onResolvedRecord={(c) =>
                setCustomersList((prev) => mergeUniqueById(prev, [c]))
              }
              {...customerAutocompleteExtras}
            />
            <div className="col-12 col-md-6">
              <label className="form-label text-muted small mb-0">Client name</label>
              <div className="form-control-plaintext border rounded px-3 py-2 bg-light">
                {selectedCustomer
                  ? [selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(" ") || "—"
                  : "—"}
              </div>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label text-muted small mb-0">Contact</label>
              <div className="form-control-plaintext border rounded px-3 py-2 bg-light">
                {selectedCustomer?.contact_number?.trim() ? selectedCustomer.contact_number : "—"}
              </div>
            </div>
            <TextField
              label="Destination"
              id="ta-order-entry-destination"
              value={form.destination}
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="Destination name — must match Masters catalogue labels"
              onChange={(value) => setForm((c) => ({ ...c, destination: value }))}
            />
            <TextField
              label="DRC No"
              value={form.drc_no}
              onChange={(value) => setForm((c) => ({ ...c, drc_no: value }))}
            />
            <TextField
              label="Travel start date"
              type="date"
              value={form.travel_start_date}
              onChange={(value) => setForm((c) => ({ ...c, travel_start_date: value }))}
            />
            <TextField
              label="Travel end date"
              type="date"
              value={form.travel_end_date}
              onChange={(value) => setForm((c) => ({ ...c, travel_end_date: value }))}
            />
            <TextField
              label="Total order value"
              id="ta-order-total-order-value"
              formatAmountOnBlur
              required
              placeholder="e.g. 5000 or 15000"
              value={form.total_amount}
              onChange={(value) => {
                userEditedBookingTotalRef.current = true;
                setForm((c) => ({ ...c, total_amount: value }));
              }}
            />
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="ta-order-estimated-margin-pct">
                {mode === "create" ? (
                  <>
                    Estimated margin
                    {estimatedProfitAmountDisplay !== "—" ? (
                      <span className="text-muted fw-normal">
                        {" "}
                        (profit amount {estimatedProfitAmountDisplay})
                      </span>
                    ) : null}
                  </>
                ) : (
                  <>
                    Estimated margin %{" "}
                    <span className="text-muted fw-normal">(profit amount {estimatedProfitAmountDisplay})</span>
                  </>
                )}
              </label>
              <input
                id="ta-order-estimated-margin-pct"
                className="form-control"
                type="number"
                step="0.01"
                min="0"
                value={form.estimated_margin == null ? "" : String(form.estimated_margin)}
                onChange={(e) =>
                  setForm((c) => ({ ...c, estimated_margin: e.target.value }))
                }
              />
            </div>
            <SelectField
              label="Assign to ATPL member"
              value={String(form.atpl_assigned_user_id ?? "")}
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
      <div className="card mb-0 ta-order-section ta-order-section--wizard-panel">
        <div className="card-header ta-order-section-title-alt">Traveler Details</div>
        <div className="card-body">
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

          <div className="border rounded mb-4 ta-traveler-lead-block overflow-hidden">
            <div className="p-3">
              <h3 className="h6 mb-1 text-body fw-bold">Lead PAX (SPOC)</h3>
              <div className="form-control-plaintext border rounded px-3 py-2 bg-white small mb-3">
                <div className="fw-medium text-body">
                  {selectedCustomer
                    ? [selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(" ") || "—"
                    : "—"}
                </div>
                {selectedCustomer?.email?.trim() ? (
                  <div className="text-muted mt-1">{selectedCustomer.email}</div>
                ) : null}
                {selectedCustomer?.contact_number?.trim() ? (
                  <div className="text-muted mt-1">{selectedCustomer.contact_number}</div>
                ) : null}
              </div>

              <div className="row g-2">
                <div className="col-12 col-md-4">
                  <label className="form-label small mb-0" htmlFor="ta-seat-lead">
                    Seat
                  </label>
                  <input
                    id="ta-seat-lead"
                    className="form-control form-control-sm"
                    value={leadTravelerLine.seat_preference}
                    maxLength={100}
                    placeholder="e.g. 12A, window"
                    autoComplete="off"
                    onChange={(e) =>
                      setForm((c) => ({
                        ...c,
                        travelerLines: patchLine(
                          c.travelerLines?.length ? c.travelerLines : [emptyTravelerLine()],
                          0,
                          { seat_preference: e.target.value },
                        ),
                      }))
                    }
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small mb-0" htmlFor="ta-meal-lead">
                    Meal
                  </label>
                  <input
                    id="ta-meal-lead"
                    className="form-control form-control-sm"
                    value={leadTravelerLine.meal_preference}
                    maxLength={100}
                    placeholder="e.g. vegetarian"
                    autoComplete="off"
                    onChange={(e) =>
                      setForm((c) => ({
                        ...c,
                        travelerLines: patchLine(
                          c.travelerLines?.length ? c.travelerLines : [emptyTravelerLine()],
                          0,
                          { meal_preference: e.target.value },
                        ),
                      }))
                    }
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small mb-0" htmlFor="ta-special-lead">
                    Special request
                  </label>
                  <textarea
                    id="ta-special-lead"
                    className="form-control form-control-sm ta-traveler-special-input"
                    rows={2}
                    value={leadTravelerLine.special_request}
                    placeholder="Optional — wheelchair, allergies, notes…"
                    onChange={(e) =>
                      setForm((c) => ({
                        ...c,
                        travelerLines: patchLine(
                          c.travelerLines?.length ? c.travelerLines : [emptyTravelerLine()],
                          0,
                          { special_request: e.target.value },
                        ),
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <h3 className="h6 mb-1 text-body">Co PAX</h3>
          <p className="small text-muted mb-2">
            Traveler profiles for additional passengers (each profile only once).
          </p>
          <div className="table-responsive ta-order-table-wrap">
            <table className="table table-sm align-middle ta-order-table ta-travelers-table">
              <thead>
                <tr>
                  <th className="ta-tcol-traveler" scope="col">
                    Traveler
                    <span className="ta-th-hint d-block fw-normal text-muted">Passenger · customer</span>
                  </th>
                  <th className="ta-tcol-seat" scope="col" title="Seat preference (e.g. number, window, aisle)">
                    Seat
                  </th>
                  <th className="ta-tcol-meal" scope="col" title="Meal preference (e.g. vegetarian, non-veg)">
                    Meal
                  </th>
                  <th className="ta-tcol-special" scope="col">
                    Special request
                  </th>
                  <th className="ta-tcol-actions" scope="col" aria-label="Row actions" />
                </tr>
              </thead>
              <tbody>
                {travelerLines.length <= 1 ? (
                  <tr>
                    <td colSpan={5} className="text-muted small py-3">
                      No Co PAX yet. Use <strong>Add more</strong> below to add another traveler.
                    </td>
                  </tr>
                ) : (
                  travelerLines.slice(1).map((line, j) => {
                    const idx = j + 1;
                    const excludeTravelerIds = travelerLines
                      .map((l, i) =>
                        i !== idx && String(l.traveler_id || "").trim() ? String(l.traveler_id) : null,
                      )
                      .filter(Boolean);
                    return (
                      <tr key={`tr-${idx}`}>
                        <td className="ta-tcol-traveler">
                          <TravelerAutocomplete
                            label=""
                            value={line.traveler_id}
                            onChange={(value) =>
                              setForm((c) => ({
                                ...c,
                                travelerLines: patchLine(
                                  c.travelerLines?.length ? c.travelerLines : [emptyTravelerLine()],
                                  idx,
                                  { traveler_id: value },
                                ),
                              }))
                            }
                            travelers={state.travelers}
                            customers={state.customers}
                            customerIdFilter={form.customer_id}
                            apiRequest={apiRequest}
                            token={token}
                            onResolvedRecord={(t) => setTravelersList((prev) => mergeUniqueById(prev, [t]))}
                            wrapperClassName="mb-0 col-12 ta-traveler-ac-wrap"
                            disabled={!String(form.customer_id || "").trim()}
                            placeholder={
                              String(form.customer_id || "").trim()
                                ? "Search passenger by name…"
                                : "Select a customer in Booking Details first"
                            }
                            inputClassName="form-control form-control-sm"
                            {...travelerAutocompleteExtrasForRow(idx)}
                            excludeTravelerIds={excludeTravelerIds}
                          />
                        </td>
                        <td className="ta-tcol-seat">
                          <label className="visually-hidden" htmlFor={`ta-seat-${idx}`}>
                            Co PAX seat row {j + 1}
                          </label>
                          <input
                            id={`ta-seat-${idx}`}
                            className="form-control form-control-sm"
                            value={line.seat_preference}
                            maxLength={100}
                            placeholder="e.g. 12A, window"
                            autoComplete="off"
                            onChange={(e) =>
                              setForm((c) => ({
                                ...c,
                                travelerLines: patchLine(
                                  c.travelerLines?.length ? c.travelerLines : [emptyTravelerLine()],
                                  idx,
                                  { seat_preference: e.target.value },
                                ),
                              }))
                            }
                          />
                        </td>
                        <td className="ta-tcol-meal">
                          <label className="visually-hidden" htmlFor={`ta-meal-${idx}`}>
                            Co PAX meal row {j + 1}
                          </label>
                          <input
                            id={`ta-meal-${idx}`}
                            className="form-control form-control-sm"
                            value={line.meal_preference}
                            maxLength={100}
                            placeholder="e.g. vegetarian"
                            autoComplete="off"
                            onChange={(e) =>
                              setForm((c) => ({
                                ...c,
                                travelerLines: patchLine(
                                  c.travelerLines?.length ? c.travelerLines : [emptyTravelerLine()],
                                  idx,
                                  { meal_preference: e.target.value },
                                ),
                              }))
                            }
                          />
                        </td>
                        <td className="ta-tcol-special">
                          <label className="visually-hidden" htmlFor={`ta-special-${idx}`}>
                            Co PAX special request row {j + 1}
                          </label>
                          <textarea
                            id={`ta-special-${idx}`}
                            className="form-control form-control-sm ta-traveler-special-input"
                            rows={2}
                            value={line.special_request}
                            placeholder="Optional — wheelchair, allergies, notes…"
                            onChange={(e) =>
                              setForm((c) => ({
                                ...c,
                                travelerLines: patchLine(
                                  c.travelerLines?.length ? c.travelerLines : [emptyTravelerLine()],
                                  idx,
                                  { special_request: e.target.value },
                                ),
                              }))
                            }
                          />
                        </td>
                        <td className="text-end text-nowrap ta-tcol-actions align-middle">
                          <button
                            type="button"
                            className="btn btn-icon btn-soft-danger btn-sm"
                            aria-label="Remove Co PAX row"
                            title="Remove row"
                            onClick={() =>
                              setForm((c) => ({
                                ...c,
                                travelerLines: (c.travelerLines || []).filter((_, i) => i !== idx),
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
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm mt-2 px-4 fw-semibold"
            onClick={() =>
              setForm((c) => ({
                ...c,
                travelerLines: [...(c.travelerLines || []), emptyTravelerLine()],
              }))
            }
          >
            Add more
          </button>
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
          catalogToolbar={catalogMasterToolbar}
          vendorTypeRestrictionsByVendorId={vendorTypeRestrictionsByVendorId}
          orderTotalDefaultPrice={form.total_amount}
        />
      ) : null}

      {wizardStep === 4 ? (
        <div className="card mb-0 ta-order-section ta-order-section--wizard-panel">
            <div className="card-header ta-order-section-title-alt">Vendor Payment</div>
            <div className="card-body">
              {!String(form.destination || "").trim() ? (
                <p className="small text-muted mb-2 mb-md-0">
                  No destination on Booking Details yet — vendor and product lists show the full catalogue. Set a
                  destination to filter rows to matching tour locations.
                </p>
              ) : productsForDestination.length === 0 && productLineCatalogProducts.length > 0 ? (
                <p className="small text-muted mb-2 mb-md-0">
                  No catalogue products match this destination exactly — showing all products. Add or align product
                  destinations under Masters if you need a strict match.
                </p>
              ) : null}
              <div
                className="table-responsive ta-order-table-wrap ta-order-vendor-grid-wrap"
                role="region"
                aria-label="Vendor payment booking lines"
              >
                <table className="table table-sm ta-order-table ta-order-line-table ta-order-vendor-line-table">
                  <thead>
                    <tr>
                      <th className="ta-vcol-fk">
                        Vendor <span className="text-danger">*</span>
                      </th>
                      <th className="ta-vcol-fk">
                        Product <span className="text-danger">*</span>
                      </th>
                      <th className="ta-vcol-ref">Invoice No</th>
                      <th className="ta-vcol-date">Invoice date</th>
                      <th className="ta-vcol-num">Taxable</th>
                      <th className="ta-vcol-pct">GST %</th>
                      <th className="ta-vcol-num">GST amt</th>
                      <th className="ta-vcol-pct">Comm %</th>
                      <th className="ta-vcol-num">Comm amt</th>
                      <th className="ta-vcol-pct">TDS %</th>
                      <th className="ta-vcol-num">TDS amt</th>
                      <th className="ta-vcol-num" title="Taxable + GST amount − TDS − commission amount">
                        Net pay
                      </th>
                      <th className="ta-vcol-date">Due date</th>
                      <th className="ta-vcol-mode">Pay mode</th>
                      <th className="ta-vcol-action" />
                    </tr>
                  </thead>
                  <tbody>
                    {productLines.map((line, idx) => {
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
                      return (
                      <tr key={`pr-${idx}`}>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={line.vendor_id === "" || line.vendor_id == null ? "" : String(line.vendor_id)}
                            onChange={(e) => {
                              const vid = e.target.value;
                              const vr = mergeVendorRowWithPaymentDetailCache(
                                resolveVendorRow(state.vendors, vid),
                                String(vid || "").trim(),
                                vendorPaymentCacheByVendorId,
                              );
                              const opts = pickerCatalogForVendorPaymentLine(
                                state,
                                form.destination,
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
                              setForm((current) => {
                                const lines = [
                                  ...(current.productLines?.length ? current.productLines : [emptyProductLine()]),
                                ];
                                const cur = lines[idx];
                                const curPid = String(cur?.product_id || "").trim();
                                const curVt = String(cur?.booking_product_type_id || "").trim();
                                const curPick = curVt ? `vt:${curVt}` : curPid;
                                let row = { ...cur, vendor_id: vid };
                                if (curPick && !allowedIds.has(curPick)) {
                                  row = { ...row, product_id: "", booking_product_type_id: "", price: "" };
                                }
                                const quantity = Number(row.quantity || 0);
                                const price = parseBookingAmountNumber(row.price);
                                row.line_total =
                                  quantity && price ? formatAmountPlain(quantity * price) : "0";
                                row = applyProductLineGstCommissionDerived(row, null);
                                const inv = String(row.invoice_ref_date || "").trim();
                                const days = vendorCreditLimitDaysFromRow(vr);
                                row = {
                                  ...row,
                                  due_date: inv && days != null ? addDaysToIsoDate(inv, days) : "",
                                };
                                lines[idx] = row;
                                return { ...current, productLines: lines };
                              });
                              const vTrim = String(vid || "").trim();
                              if (vTrim && apiRequest && token) {
                                fetchVendorDetailForPaymentStep(vTrim, {
                                  force: true,
                                  destination: form.destination,
                                });
                              }
                            }}
                          >
                            <option value="">Select</option>
                            {productLineCatalogVendors.map((item) => (
                              <option key={item.id} value={String(item.id)}>
                                {item.vendor_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            disabled={!vid}
                            value={(() => {
                              const t = String(line.booking_product_type_id || "").trim();
                              if (t) {
                                return `vt:${t}`;
                              }
                              return line.product_id === "" || line.product_id == null
                                ? ""
                                : String(line.product_id);
                            })()}
                            onChange={(e) => {
                              const val = String(e.target.value).trim();
                              if (!val) {
                                updateProductLine(setForm, idx, {
                                  product_id: "",
                                  booking_product_type_id: "",
                                  price: "",
                                });
                                return;
                              }
                              if (val.startsWith("vt:")) {
                                const tid = val.slice(3).trim();
                                updateProductLine(setForm, idx, {
                                  booking_product_type_id: tid,
                                  product_id: "",
                                  vendor_id: line.vendor_id,
                                  price: "",
                                });
                                return;
                              }
                              const fromCatalog = lineCatalogProducts.find(
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
                                  ? String(product.vendor_id ?? product.vendorId ?? line.vendor_id ?? "")
                                  : line.vendor_id,
                                price:
                                  product != null && product.price != null && product.price !== ""
                                    ? String(product.price)
                                    : "",
                              };
                              updateProductLine(setForm, idx, patch);
                            }}
                          >
                            <option value="">{!vid ? "Select vendor first" : "Select product"}</option>
                            {(() => {
                              const vpRaw =
                                vendorRowForLine?.vendor_products ?? vendorRowForLine?.vendorProducts;
                              const vpLinks = Array.isArray(vpRaw) ? vpRaw : [];
                              const groups = vendorPaymentProductSelectGroups(
                                lineCatalogProducts,
                                vendorRowForLine,
                                state.productTypes,
                              );
                              const renderOption = (item, keyPrefix) => {
                                const raw =
                                  catalogProductPrimaryId(item) ??
                                  item?.product_id ??
                                  item?.productId ??
                                  item?.id;
                                if (raw == null || String(raw).trim() === "") {
                                  return null;
                                }
                                const pid = String(raw);
                                return (
                                  <option key={`${keyPrefix}-${pid}`} value={pid}>
                                    {catalogProductPickerLabel(item)}
                                  </option>
                                );
                              };
                              const catalogueNodes = groups.flatMap((g) => {
                                if (g.label == null) {
                                  return (g.items || []).map((item, i) => renderOption(item, `flat-${i}`));
                                }
                                if (!g.items || g.items.length === 0) {
                                  return [];
                                }
                                const label = String(g.label || "").trim() || "Products";
                                return [
                                  <optgroup key={g.key} label={label}>
                                    {g.items
                                      .map((item, i) => renderOption(item, `${g.key}-${i}`))
                                      .filter(Boolean)}
                                  </optgroup>,
                                ];
                              });
                              const vendorTypeNodes =
                                vid && vpLinks.length > 0
                                  ? vpLinks
                                      .map((link, li) => {
                                        const tid = link?.product_type_id ?? link?.productTypeId;
                                        if (tid == null || String(tid).trim() === "") {
                                          return null;
                                        }
                                        const vopt = `vt:${String(tid).trim()}`;
                                        return (
                                          <option key={`ta-vp-row-${link?.id ?? li}`} value={vopt}>
                                            {vendorProductLinkDropdownLabel(link)}
                                          </option>
                                        );
                                      })
                                      .filter(Boolean)
                                  : [];
                              return [...vendorTypeNodes, ...catalogueNodes];
                            })()}
                          </select>
                        </td>
                        <td>
                          <input
                            className="form-control form-control-sm"
                            value={line.invoice_ref_numbers}
                            onChange={(e) =>
                              updateProductLine(setForm, idx, { invoice_ref_numbers: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            value={line.invoice_ref_date}
                            onChange={(e) =>
                              updateProductLine(
                                setForm,
                                idx,
                                { invoice_ref_date: e.target.value },
                                { vendorRow: vendorRowForLine },
                              )
                            }
                          />
                        </td>
                        <td>
                          <AmountFormattedInput
                            className="form-control form-control-sm"
                            value={line.taxable_amount == null ? "" : String(line.taxable_amount)}
                            aria-label={`Taxable amount row ${idx + 1}`}
                            onChange={(plain) => updateProductLine(setForm, idx, { taxable_amount: plain })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control form-control-sm"
                            value={line.gst_percent == null ? "" : String(line.gst_percent)}
                            onChange={(e) => updateProductLine(setForm, idx, { gst_percent: e.target.value })}
                          />
                        </td>
                        <td>
                          <AmountFormattedInput
                            className="form-control form-control-sm"
                            aria-label={`GST amount row ${idx + 1}`}
                            title="Enter amount or use GST % — values sync with taxable"
                            value={line.gst_amount == null ? "" : String(line.gst_amount)}
                            onChange={(plain) => updateProductLine(setForm, idx, { gst_amount: plain })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control form-control-sm"
                            value={line.commission_percent == null ? "" : String(line.commission_percent)}
                            onChange={(e) =>
                              updateProductLine(setForm, idx, { commission_percent: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <AmountFormattedInput
                            className="form-control form-control-sm"
                            aria-label={`Commission amount row ${idx + 1}`}
                            title="Enter amount or use Comm % — values sync with taxable"
                            value={line.commission_amount == null ? "" : String(line.commission_amount)}
                            onChange={(plain) =>
                              updateProductLine(setForm, idx, { commission_amount: plain })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control form-control-sm"
                            value={line.tds_percent == null ? "" : String(line.tds_percent)}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateProductLine(setForm, idx, {
                                tds_percent: v,
                                ...(String(v ?? "").trim() === "" ? { tds_amount: "" } : {}),
                              });
                            }}
                          />
                        </td>
                        <td>
                          <AmountFormattedInput
                            className="form-control form-control-sm"
                            aria-label={`TDS amount row ${idx + 1}`}
                            title="Enter amount or use TDS % — values sync with taxable"
                            value={line.tds_amount == null ? "" : String(line.tds_amount)}
                            onChange={(plain) => updateProductLine(setForm, idx, { tds_amount: plain })}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            readOnly
                            tabIndex={-1}
                            className="form-control form-control-sm bg-light"
                            value={
                              line.net_payable !== "" &&
                              line.net_payable != null &&
                              Number.isFinite(parseBookingAmountNumber(line.net_payable))
                                ? formatCurrency(parseBookingAmountNumber(line.net_payable))
                                : ""
                            }
                            title="Taxable amount + GST amount − TDS − commission amount"
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            value={line.due_date ?? ""}
                            onChange={(e) => updateProductLine(setForm, idx, { due_date: e.target.value })}
                          />
                        </td>
                        <td>
                          <label className="form-label visually-hidden" htmlFor={`ta-prod-pay-mode-${idx}`}>
                            Pay mode
                          </label>
                          <select
                            id={`ta-prod-pay-mode-${idx}`}
                            className="form-select form-select-sm"
                            value={line.payment_mode ?? ""}
                            onChange={(e) =>
                              updateProductLine(setForm, idx, { payment_mode: e.target.value })
                            }
                          >
                            {paymentMethodFieldOptions(
                              paymentModes,
                              line.payment_mode,
                              "Select payment mode",
                            ).map((opt) => (
                              <option key={`${idx}-${opt.value}-${opt.label}`} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="text-end text-nowrap align-middle">
                          {productLines.length > 1 ? (
                            <button
                              type="button"
                              className="btn btn-icon btn-soft-danger btn-sm"
                              aria-label="Remove product line"
                              title="Remove row"
                              onClick={() =>
                                setForm((c) => ({
                                  ...c,
                                  productLines: (c.productLines || []).filter((_, i) => i !== idx),
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
                  <tfoot className="ta-order-vendor-line-tfoot">
                    <tr>
                      <td colSpan={4} className="fw-semibold text-end small">
                        Totals
                      </td>
                      <td className="small fw-medium text-end ta-vcol-num">
                        {formatCurrency(productLineTotals.taxable)}
                      </td>
                      <td className="ta-vcol-pct" />
                      <td className="small fw-medium text-end ta-vcol-num">
                        {formatCurrency(productLineTotals.gst)}
                      </td>
                      <td className="ta-vcol-pct" />
                      <td className="small fw-medium text-end ta-vcol-num">
                        {formatCurrency(productLineTotals.commission)}
                      </td>
                      <td className="ta-vcol-pct" />
                      <td className="small fw-medium text-end ta-vcol-num">
                        {formatCurrency(productLineTotals.tds)}
                      </td>
                      <td className="small fw-medium text-end ta-vcol-num">
                        {formatCurrency(productLineTotals.net)}
                      </td>
                      <td className="small fw-medium text-end ta-vcol-date text-muted">—</td>
                      <td className="ta-vcol-mode" />
                      <td className="ta-vcol-action" />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm mt-3 px-4 fw-semibold"
                onClick={() => setAddVendorPaymentProductLineModalOpen(true)}
              >
                Add more
              </button>
            </div>
          </div>
      ) : null}

      {wizardStep === 3 ? (
        <div className="card mb-0 ta-order-section ta-order-section--wizard-panel">
          <div className="card-header ta-order-section-title-pay">Customer Payment (Sales PI)</div>
          <div className="card-body px-3 px-md-4 pb-4">
            <p className="ta-card-muted small mb-4 mb-lg-3 lh-sm">
              <strong>Sale PI / Rcpt no.</strong> defaults to <strong>PI-001</strong>, <strong>PI-002</strong>, … by row order
              (read-only). Use <strong>Add more</strong> for additional lines. Enter <strong>PI / Rcpt date</strong>{" "}
              and amounts as needed; <strong>Proforma</strong> opens the printable layout for that row.
            </p>
            <div className="row g-4 align-items-start">
              <div className="col-12 col-xl-8 min-w-0">
                <div className="table-responsive ta-order-table-wrap ta-order-custpay-table-wrap rounded border">
                  <table className="table table-sm ta-order-table ta-custpay-table align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="text-muted text-nowrap" scope="col">
                          #
                        </th>
                        <th className="text-nowrap ta-custpay-col-sale-pi" scope="col">
                          Sale PI / Rcpt no.
                        </th>
                        <th className="text-nowrap ta-custpay-col-pi" scope="col">
                          PI / Rcpt date *
                        </th>
                        <th className="text-nowrap ta-custpay-col-amount" scope="col">
                          Amount
                        </th>
                        <th className="text-center text-nowrap" scope="col" aria-label="Proforma print">
                          Proforma
                        </th>
                        <th
                          className="text-nowrap ta-custpay-received-head ta-custpay-received-start"
                          scope="col"
                        >
                          UTR / Rcpt / Ref
                        </th>
                        <th className="text-nowrap ta-custpay-received-head ta-custpay-col-amount" scope="col">
                          Amount recvd
                        </th>
                        <th className="text-nowrap ta-custpay-received-head ta-custpay-col-received" scope="col">
                          Recvd on (date)
                        </th>
                        <th className="text-nowrap ta-custpay-received-head ta-custpay-col-mode" scope="col">
                          Mode of payment
                        </th>
                        <th className="ta-custpay-col-status" scope="col">
                          Status
                        </th>
                        <th className="text-end text-nowrap" scope="col" aria-label="Row actions" style={{ width: "3rem" }} />
                      </tr>
                    </thead>
                    <tbody>
                      {paymentLines.map((line, idx) => (
                        <tr key={`pay-${idx}`}>
                          <td className="text-muted small text-nowrap align-middle">{idx + 1}</td>
                          <td className="ta-custpay-col-sale-pi align-middle">
                            <span
                              className="d-inline-block w-100 small font-monospace text-body bg-light border rounded px-2 py-1 ta-custpay-sale-pi-readonly"
                              title="Sale PI / receipt number (PI-001, PI-002, …) by row order"
                            >
                              {String(line.sale_pi_receipt_no ?? "").trim() || formatSalePiReceiptSequential(idx)}
                            </span>
                          </td>
                          <td className="ta-custpay-col-pi">
                            <label className="visually-hidden" htmlFor={`ta-custpay-pi-date-${idx}`}>
                              PI or receipt date row {idx + 1}
                            </label>
                            <input
                              id={`ta-custpay-pi-date-${idx}`}
                              type="date"
                              className="form-control form-control-sm"
                              value={line.payment_date}
                              onChange={(e) =>
                                setForm((c) => ({
                                  ...c,
                                  paymentLines: patchLine(
                                    c.paymentLines?.length ? c.paymentLines : [emptyPaymentLine()],
                                    idx,
                                    { payment_date: e.target.value },
                                  ),
                                }))
                              }
                            />
                          </td>
                          <td className="ta-custpay-col-amount">
                            <label className="visually-hidden" htmlFor={`ta-custpay-invoice-amt-${idx}`}>
                              PI or invoice amount row {idx + 1}
                            </label>
                            <AmountFormattedInput
                              id={`ta-custpay-invoice-amt-${idx}`}
                              className="form-control form-control-sm"
                              value={line.invoice_amount}
                              aria-label={`PI or invoice amount row ${idx + 1}`}
                              onChange={(plain) =>
                                setForm((c) => ({
                                  ...c,
                                  paymentLines: patchLine(
                                    c.paymentLines?.length ? c.paymentLines : [emptyPaymentLine()],
                                    idx,
                                    { invoice_amount: plain },
                                  ),
                                }))
                              }
                            />
                          </td>
                          <td className="text-center align-middle text-nowrap">
                            <button
                              type="button"
                              className="btn btn-icon btn-outline-secondary btn-sm"
                              aria-label="Print or preview proforma"
                              title="Print / preview proforma"
                              onClick={() =>
                                openProformaInvoicePrintWindow(form, state, bookingId, {
                                  customerPaymentLineIndex: idx,
                                })
                              }
                            >
                              <svg viewBox="0 0 16 16" aria-hidden="true" className="ta-action-icon">
                                <path d="M5 2h6v3H5z" />
                                <path d="M4 6h8v8H4z" />
                                <path d="M6 9h4v4H6z" />
                              </svg>
                            </button>
                          </td>
                          <td className="ta-custpay-received-cell ta-custpay-received-start">
                            <label className="visually-hidden" htmlFor={`ta-custpay-utr-${idx}`}>
                              UTR or receipt reference row {idx + 1}
                            </label>
                            <input
                              id={`ta-custpay-utr-${idx}`}
                              className="form-control form-control-sm"
                              value={line.transaction_reference}
                              onChange={(e) =>
                                setForm((c) => ({
                                  ...c,
                                  paymentLines: patchLine(
                                    c.paymentLines?.length ? c.paymentLines : [emptyPaymentLine()],
                                    idx,
                                    { transaction_reference: e.target.value },
                                  ),
                                }))
                              }
                            />
                          </td>
                          <td className="ta-custpay-received-cell ta-custpay-col-amount">
                            <label className="visually-hidden" htmlFor={`ta-custpay-amt-received-${idx}`}>
                              Amount received row {idx + 1}
                            </label>
                            <AmountFormattedInput
                              id={`ta-custpay-amt-received-${idx}`}
                              className="form-control form-control-sm"
                              value={line.amount_received}
                              aria-label={`Amount received row ${idx + 1}`}
                              onChange={(plain) =>
                                setForm((c) => ({
                                  ...c,
                                  paymentLines: patchLine(
                                    c.paymentLines?.length ? c.paymentLines : [emptyPaymentLine()],
                                    idx,
                                    { amount_received: plain },
                                  ),
                                }))
                              }
                            />
                          </td>
                          <td className="ta-custpay-received-cell ta-custpay-col-received">
                            <label className="visually-hidden" htmlFor={`ta-custpay-received-on-${idx}`}>
                              Received on date row {idx + 1}
                            </label>
                            <input
                              id={`ta-custpay-received-on-${idx}`}
                              type="date"
                              className="form-control form-control-sm"
                              value={line.received_on}
                              onChange={(e) =>
                                setForm((c) => ({
                                  ...c,
                                  paymentLines: patchLine(
                                    c.paymentLines?.length ? c.paymentLines : [emptyPaymentLine()],
                                    idx,
                                    { received_on: e.target.value },
                                  ),
                                }))
                              }
                            />
                          </td>
                          <td className="ta-custpay-received-cell ta-custpay-col-mode">
                            <label className="form-label visually-hidden" htmlFor={`ta-custpay-method-${idx}`}>
                              Mode of payment
                            </label>
                            <select
                              id={`ta-custpay-method-${idx}`}
                              className="form-select form-select-sm"
                              value={line.payment_method}
                              onChange={(e) =>
                                setForm((c) => ({
                                  ...c,
                                  paymentLines: patchLine(
                                    c.paymentLines?.length ? c.paymentLines : [emptyPaymentLine()],
                                    idx,
                                    { payment_method: e.target.value },
                                  ),
                                }))
                              }
                            >
                              {paymentMethodFieldOptions(paymentModes, line.payment_method).map((opt) => (
                                <option key={`${idx}-${opt.value}-${opt.label}`} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="ta-custpay-col-status">
                            <select
                              className="form-select form-select-sm"
                              value={line.status}
                              onChange={(e) =>
                                setForm((c) => ({
                                  ...c,
                                  paymentLines: patchLine(
                                    c.paymentLines?.length ? c.paymentLines : [emptyPaymentLine()],
                                    idx,
                                    { status: e.target.value },
                                  ),
                                }))
                              }
                            >
                              {paymentStatusOptions.map((s) => (
                                <option key={`cust-pay-st-${idx}-${s}`} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="text-end text-nowrap align-middle ps-1" style={{ width: "3rem" }}>
                            {paymentLines.length > 1 ? (
                              <button
                                type="button"
                                className="btn btn-icon btn-soft-danger btn-sm"
                                aria-label="Remove payment row"
                                title="Remove row"
                                onClick={() =>
                                  setForm((c) => {
                                    const next = (c.paymentLines || []).filter((_, i) => i !== idx);
                                    return {
                                      ...c,
                                      paymentLines: normalizeCustomerPaymentSalePiReceiptNos(next),
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
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="ta-custpay-table-tfoot table-light">
                      <tr className="ta-custpay-totals-row">
                        <td colSpan={3} className="text-end fw-semibold small text-muted">
                          Total
                        </td>
                        <td className="ta-custpay-col-amount text-end font-monospace fw-semibold">
                          {formatCurrency(customerPaymentSummary.piTotal)}
                        </td>
                        <td aria-hidden="true" />
                        <td className="ta-custpay-received-cell ta-custpay-received-start" />
                        <td className="ta-custpay-col-amount ta-custpay-received-cell text-end font-monospace fw-semibold">
                          {formatCurrency(customerPaymentSummary.received)}
                        </td>
                        <td className="ta-custpay-received-cell ta-custpay-col-received" />
                        <td className="ta-custpay-received-cell ta-custpay-col-mode" />
                        <td className="ta-custpay-col-status" />
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm mt-4 px-4 fw-semibold"
                  onClick={() =>
                    setForm((c) => {
                      const base = c.paymentLines?.length ? c.paymentLines : [emptyPaymentLine()];
                      const next = [...base, emptyPaymentLine()];
                      return {
                        ...c,
                        paymentLines: normalizeCustomerPaymentSalePiReceiptNos(next),
                      };
                    })
                  }
                >
                  Add more
                </button>
              </div>
              <div className="col-12 col-xl-4 min-w-0">
                <div className="ta-custpay-summary-panel overflow-hidden">
                  <div className="px-3 py-2 border-bottom bg-light ta-custpay-summary-head">
                    <div className="small text-uppercase text-muted fw-semibold mb-0">Payment summary</div>
                  </div>
                  <div className="ta-custpay-summary-metric ta-custpay-summary-metric--highlight">
                    <div className="small text-muted mb-1">Tour value (booking)</div>
                    <div className="fs-6 fw-semibold font-monospace text-body">
                      {formatCurrency(customerPaymentSummary.tour)}
                    </div>
                  </div>
                  <div className="ta-custpay-summary-metric">
                    <div className="small text-muted mb-1">Total Amount</div>
                    <div className="fs-6 fw-semibold font-monospace text-body">
                      {formatCurrency(customerPaymentSummary.piTotal)}
                    </div>
                  </div>
                  <div className="ta-custpay-summary-metric">
                    <div className="small text-muted mb-1">Total Amount recvd</div>
                    <div className="fs-6 fw-semibold font-monospace text-success">
                      {formatCurrency(customerPaymentSummary.received)}
                    </div>
                    <div className="small text-muted mt-1 mb-0">Paid status rows only</div>
                  </div>
                  <div className="ta-custpay-summary-metric ta-custpay-summary-metric--alert">
                    <div className="small text-muted mb-1">Outstanding</div>
                    <div className="fs-6 fw-semibold font-monospace text-body">
                      {formatCurrency(customerPaymentSummary.outstanding)}
                    </div>
                    <div className="small text-muted mt-1 mb-0">Tour value minus paid receipts</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
        </div>
        <div className="card-body py-2 px-2 px-md-4 ta-booking-wizard-toolbar-strip">
          <BookingWizardToolbar
            submitting={submitting}
            submitLabel={submitLabel}
            savingLabel={savingLabel}
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
      <ConfirmActionModal
        open={addVendorPaymentProductLineModalOpen}
        title="Add product line"
        message={CONFIRM_ADD_PRODUCT_LINE_MESSAGE}
        confirmLabel="Continue"
        onCancel={() => setAddVendorPaymentProductLineModalOpen(false)}
        onConfirm={() => {
          setAddVendorPaymentProductLineModalOpen(false);
          setForm((c) => ({
            ...c,
            productLines: [...(c.productLines || []), emptyProductLine()],
          }));
        }}
      />
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

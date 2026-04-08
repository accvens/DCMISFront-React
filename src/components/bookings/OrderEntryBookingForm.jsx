import { useEffect, useMemo, useRef, useState } from "react";
import { AutocompleteField, SelectField, TextField } from "../access/AccessShared.jsx";
import {
  buildTravelersListUrl,
  CustomerAutocomplete,
  mergeUniqueById,
  TravelerAutocomplete,
} from "../customers/CustomersShared.jsx";
import {
  PAYMENT_STATUS_OPTIONS,
  VendorProductDetailsSection,
  emptyPaymentLine,
  paymentMethodFieldOptions,
  emptyProductLine,
  emptyTravelerLine,
  emptyVendorPaymentLine,
  formatCurrency,
  productsForBookingDestination,
  useBookingTotalFromProductDetailsAndTravelers,
  vendorIdsFromProductsForDestination,
  wizardStepForBookingValidationError,
  openProformaInvoicePrintWindow,
} from "./BookingsShared.jsx";
import { BookingWizardToolbar } from "./BookingEditorChrome.jsx";
import { useBookingCatalogCreateModals } from "./useBookingCatalogCreateModals.jsx";
import { useBookingReferenceCreateModals } from "./useBookingReferenceCreateModals.jsx";

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

function updateProductLine(setForm, index, patch) {
  setForm((current) => {
    const lines = [...(current.productLines?.length ? current.productLines : [emptyProductLine()])];
    const row = { ...lines[index], ...patch };
    const quantity = Number(row.quantity || 0);
    const price = Number(row.price || 0);
    row.line_total = quantity && price ? (quantity * price).toFixed(2) : "0.00";
    lines[index] = row;
    return { ...current, productLines: lines };
  });
}

function effectiveTourValueNumber(totalAmount, estimatedMarginRaw) {
  const total = Number(totalAmount);
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

function paymentProgressToneClass(percent) {
  if (percent < 50) {
    return "ta-booking-pay-progress__fill--green";
  }
  if (percent <= 70) {
    return "ta-booking-pay-progress__fill--yellow";
  }
  return "ta-booking-pay-progress__fill--red";
}

function BookingWizardPaymentProgress({
  customerReceivedTotal,
  totalTourValue,
  vendorLineTotalSum,
  effectiveTourValue,
}) {
  const tv = Number(totalTourValue);
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
    <div className="ta-booking-wizard-pay-progress" aria-label="Payment progress vs tour value">
      <div className="ta-booking-pay-progress__item">
        <div className="ta-booking-pay-progress__head">
          <span className="ta-booking-pay-progress__title">Payment received</span>
          <span className="ta-booking-pay-progress__pct">{hasTotalTour ? `${Math.round(customerPct)}%` : "—"}</span>
        </div>
        <div className="ta-booking-pay-progress__sub small text-muted">
          vs total tour value
          {hasTotalTour ? (
            <>
              {" "}
              · {formatCurrency(customerReceivedTotal)} / {formatCurrency(tv)}
            </>
          ) : null}
        </div>
        <div
          className="ta-booking-pay-progress__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(customerPct)}
          aria-label="Customer payment received as percent of total tour value"
        >
          <div
            className={`ta-booking-pay-progress__fill ${paymentProgressToneClass(customerPct)}`}
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
          vs effective tour value
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
          aria-label="Vendor line totals as percent of effective tour value"
        >
          <div
            className={`ta-booking-pay-progress__fill ${paymentProgressToneClass(vendorPct)}`}
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
    label: "Product Details",
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

export default function OrderEntryBookingForm({
  mode,
  bookingId,
  form,
  setForm,
  state,
  bookingStatusOptions,
  paymentStatusOptions = PAYMENT_STATUS_OPTIONS,
  token,
  apiRequest,
  canCreateCustomer = false,
  canCreateDestination = false,
  canCreateTraveler = false,
  canCreateProductType = false,
  canCreateCatalogProduct = false,
  canCreateVendor = false,
  setCustomersList,
  setDestinationsList,
  setTravelersList,
  setProductsList,
  setVendorsList,
  setProductTypesList,
  paymentModes = [],
  submitting = false,
  submitLabel = "Save Booking",
  savingLabel = "Saving…",
  onWizardStepChange,
  validationError = "",
}) {
  const [wizardStep, setWizardStep] = useState(0);

  useEffect(() => {
    setWizardStep(0);
  }, [mode, bookingId]);

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
  const productLines = form.productLines?.length ? form.productLines : [emptyProductLine()];
  const paymentLines = form.paymentLines?.length ? form.paymentLines : [emptyPaymentLine()];

  useBookingTotalFromProductDetailsAndTravelers(form, setForm, true);

  const totalTourValueDisplay = useMemo(() => {
    const n = Number(form.total_amount);
    return Number.isFinite(n) && n > 0 ? formatCurrency(n) : "—";
  }, [form.total_amount]);

  const estimatedProfitAmountDisplay = useMemo(() => {
    const total = Number(form.total_amount);
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

  const effectiveTourValueDisplay = useMemo(() => {
    const total = Number(form.total_amount);
    if (!Number.isFinite(total) || total <= 0) {
      return "—";
    }
    const marginRaw = String(form.estimated_margin ?? "").trim();
    if (marginRaw === "") {
      return formatCurrency(total);
    }
    const pct = Number(marginRaw);
    if (!Number.isFinite(pct) || pct < 0) {
      return "—";
    }
    return formatCurrency(total * (1 - pct / 100));
  }, [form.total_amount, form.estimated_margin]);

  const {
    renderModals,
    customerAutocompleteExtras,
    destinationAutocompleteExtras,
    travelerAutocompleteExtrasForRow,
  } = useBookingReferenceCreateModals({
    token,
    apiRequest,
    canCreateCustomer,
    canCreateDestination,
    canCreateTraveler,
    customers: state.customers,
    setCustomers: setCustomersList,
    destinations: state.destinations,
    setDestinations: setDestinationsList,
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
    onDestinationCreated: (d) => {
      setForm((current) => ({ ...current, destination_id: String(d.id) }));
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
    destinationId: form.destination_id,
    productTypes: state.productTypes,
    setProductTypes: setProductTypesList,
    vendors: state.vendors,
    setVendors: setVendorsList,
    setProducts: setProductsList,
    canCreateProductType,
    canCreateCatalogProduct,
    canCreateVendor,
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
      travelerLines: nextTravelers.length
        ? [
            {
              traveler_id: String(nextTravelers[0].id),
              seat_preference: "",
              meal_preference: "",
              special_request: "",
            },
          ]
        : [emptyTravelerLine()],
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

  const destinationOptions = state.destinations.map((d) => ({
    value: String(d.id),
    label: d.destination_name,
    searchText: `${d.city || ""} ${d.country || ""}`,
  }));

  const productsForDestination = useMemo(
    () => productsForBookingDestination(state.products, form.destination_id),
    [state.products, form.destination_id],
  );

  const selectedDestinationLabel = state.destinations.find(
    (d) => String(d.id) === String(form.destination_id),
  )?.destination_name;

  const prevDestinationIdRef = useRef(undefined);
  useEffect(() => {
    const did = String(form.destination_id || "").trim();
    if (prevDestinationIdRef.current === undefined) {
      prevDestinationIdRef.current = did;
      return;
    }
    if (prevDestinationIdRef.current === did) {
      return;
    }
    prevDestinationIdRef.current = did;

    const allowed = productsForBookingDestination(state.products, did);
    const allowedIds = new Set(allowed.map((p) => String(p.product_id)));
    const allowedVendorIds = vendorIdsFromProductsForDestination(state.products, did);

    setForm((c) => {
      const lines = c.productLines?.length ? c.productLines : [emptyProductLine()];
      let changed = false;
      const nextLines = lines.map((line) => {
        if (!line.product_id) {
          return line;
        }
        if (!did || !allowedIds.has(String(line.product_id))) {
          changed = true;
          return { ...line, product_id: "", vendor_id: "", price: "", line_total: "0.00" };
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
  }, [form.destination_id, state.products, setForm]);

  const lastStepIndex = WIZARD_STEPS.length - 1;

  const productLineTotals = useMemo(() => {
    const sum = (key) => productLines.reduce((a, l) => a + (Number(l[key]) || 0), 0);
    const qtySum = productLines.reduce((a, l) => a + (Number(l.quantity) || 0), 0);
    return {
      gross: sum("gross_amount"),
      taxable: sum("taxable_amount"),
      gst: sum("gst_amount"),
      commission: sum("commission_amount"),
      tds: sum("tds_amount"),
      net: sum("net_payable"),
      minDue: sum("minimum_due"),
      lineTotal: sum("line_total"),
      qty: qtySum,
    };
  }, [productLines]);

  const customerPaymentReceivedTotal = useMemo(
    () => paymentLines.reduce((a, l) => a + (Number(l.amount) || 0), 0),
    [paymentLines],
  );

  const effectiveTourValueNumeric = useMemo(
    () => effectiveTourValueNumber(form.total_amount, form.estimated_margin),
    [form.total_amount, form.estimated_margin],
  );

  const vendorsForProductLineSelect = useMemo(() => {
    const masterById = new Map((state.vendors || []).map((v) => [Number(v.id), v]));
    const allowed = vendorIdsFromProductsForDestination(state.products, form.destination_id);
    const ordered = new Map();
    for (const vid of allowed) {
      const m = masterById.get(vid);
      if (m) {
        ordered.set(vid, m);
      }
    }
    for (const line of productLines) {
      const vid = Number(line.vendor_id);
      if (vid && !ordered.has(vid) && masterById.has(vid)) {
        ordered.set(vid, masterById.get(vid));
      }
    }
    return Array.from(ordered.values()).sort((a, b) =>
      String(a.vendor_name || "").localeCompare(String(b.vendor_name || "")),
    );
  }, [state.vendors, state.products, form.destination_id, productLines]);

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
            <AutocompleteField
              label="Destination"
              value={form.destination_id}
              required
              onChange={(value) => setForm((c) => ({ ...c, destination_id: value }))}
              options={destinationOptions}
              {...destinationAutocompleteExtras}
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
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="ta-order-total-tour-value-ro">
                Total tour value
              </label>
              <div
                id="ta-order-total-tour-value-ro"
                className="form-control-plaintext border rounded px-3 py-2 bg-light fw-medium"
                aria-live="polite"
              >
                {totalTourValueDisplay}
              </div>
              <span className="small text-muted d-block mt-1">
                Read only — sum of Product Details <strong>Total price</strong> (same as booking total amount)
              </span>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="ta-order-estimated-margin-pct">
                Estimated margin %{" "}
                <span className="text-muted fw-normal">(profit amount {estimatedProfitAmountDisplay})</span>
              </label>
              <input
                id="ta-order-estimated-margin-pct"
                className="form-control"
                type="number"
                step="0.01"
                value={form.estimated_margin}
                onChange={(e) => setForm((c) => ({ ...c, estimated_margin: e.target.value }))}
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="ta-order-effective-tour-value-ro">
                Effective tour value
              </label>
              <div
                id="ta-order-effective-tour-value-ro"
                className="form-control-plaintext border rounded px-3 py-2 bg-light fw-medium"
                aria-live="polite"
              >
                {effectiveTourValueDisplay}
              </div>
              <span className="small text-muted d-block mt-1">
                Read only — tour value less estimated profit; if margin % is empty, same as total tour value
              </span>
            </div>
            <SelectField
              label="Status"
              value={form.status}
              required
              onChange={(value) => setForm((c) => ({ ...c, status: value }))}
              options={bookingStatusOptions.map((s) => ({ value: s, label: s }))}
            />
            <div className="col-12 col-md-6 d-flex align-items-end">
              <div className="form-check mb-2">
                <input
                  id="order_atpl"
                  type="checkbox"
                  className="form-check-input"
                  checked={form.atpl_member}
                  onChange={(e) => setForm((c) => ({ ...c, atpl_member: e.target.checked }))}
                />
                <label className="form-check-label" htmlFor="order_atpl">
                  ATPL member
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {wizardStep === 2 ? (
      <div className="card mb-0 ta-order-section ta-order-section--wizard-panel">
        <div className="card-header ta-order-section-title-alt">Traveler Details</div>
        <div className="card-body">
          <p className="ta-card-muted small mb-2">
            Each row is one <strong>passenger</strong>. The traveler field shows{" "}
            <span className="text-body">passenger · customer account</span> so you can tell who is traveling on whose
            booking. Seat and meal are short text preferences (for example window, vegetarian); special requests can be
            longer notes.
          </p>
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
                {travelerLines.map((line, idx) => (
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
                        onResolvedRecord={(t) =>
                          setTravelersList((prev) => mergeUniqueById(prev, [t]))
                        }
                        wrapperClassName="mb-0 col-12 ta-traveler-ac-wrap"
                        disabled={!String(form.customer_id || "").trim()}
                        placeholder={
                          String(form.customer_id || "").trim()
                            ? "Search passenger by name…"
                            : "Select a customer in Booking Details first"
                        }
                        inputClassName="form-control form-control-sm"
                        {...travelerAutocompleteExtrasForRow(idx)}
                      />
                    </td>
                    <td className="ta-tcol-seat">
                      <label className="visually-hidden" htmlFor={`ta-seat-${idx}`}>
                        Seat preference row {idx + 1}
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
                        Meal preference row {idx + 1}
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
                        Special request row {idx + 1}
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
                    <td className="text-end ta-tcol-actions align-middle">
                      {travelerLines.length > 1 ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() =>
                            setForm((c) => ({
                              ...c,
                              travelerLines: (c.travelerLines || []).filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          Remove
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm mt-2"
            onClick={() =>
              setForm((c) => ({
                ...c,
                travelerLines: [...(c.travelerLines || []), emptyTravelerLine()],
              }))
            }
          >
            Add traveler row
          </button>
        </div>
      </div>
      ) : null}

      {wizardStep === 1 ? (
        <VendorProductDetailsSection
          vendorPaymentLines={form.vendorPaymentLines}
          setForm={setForm}
          vendors={state.vendors}
          products={state.products}
          productTypes={state.productTypes || []}
          destinationId={form.destination_id}
          catalogToolbar={catalogMasterToolbar}
        />
      ) : null}

      {wizardStep === 4 ? (
        <div className="card mb-0 ta-order-section ta-order-section--wizard-panel">
            <div className="card-header ta-order-section-title-alt">Vendor Payment</div>
            <div className="card-body">
              <p className="ta-card-muted small mb-2">
                Booking lines for vendor payment (vendor, product, quantity, price, taxes). Options come from{" "}
                <strong>Product details</strong> for the destination set in Booking Details
                {selectedDestinationLabel ? (
                  <>
                    {" "}
                    (<span className="text-body">{selectedDestinationLabel}</span>)
                  </>
                ) : null}
                . Scroll sideways for invoice and tax columns. Vendor and product are required; other columns are
                optional.
              </p>
              {!String(form.destination_id || "").trim() ? (
                <p className="small text-warning mb-2 mb-md-0">
                  Choose a destination in Booking Details to load matching products.
                </p>
              ) : productsForDestination.length === 0 ? (
                <p className="small text-muted mb-2 mb-md-0">
                  No product catalogue rows for this destination yet. Add them under Product details (masters).
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
                      <th className="ta-vcol-ref">Invoice / ref</th>
                      <th className="ta-vcol-date">Ref date</th>
                      <th className="ta-vcol-num">Gross</th>
                      <th className="ta-vcol-num">Taxable</th>
                      <th className="ta-vcol-pct">GST %</th>
                      <th className="ta-vcol-num">GST amt</th>
                      <th className="ta-vcol-pct">Comm %</th>
                      <th className="ta-vcol-num">Comm amt</th>
                      <th className="ta-vcol-num">TDS</th>
                      <th className="ta-vcol-num">Net pay</th>
                      <th className="ta-vcol-num">Min due</th>
                      <th className="ta-vcol-mode">Pay mode</th>
                      <th className="ta-vcol-qty">Qty</th>
                      <th className="ta-vcol-num">Price</th>
                      <th className="ta-vcol-num">Line total</th>
                      <th className="ta-vcol-action" />
                    </tr>
                  </thead>
                  <tbody>
                    {productLines.map((line, idx) => (
                      <tr key={`pr-${idx}`}>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={line.vendor_id}
                            onChange={(e) => {
                              const vid = e.target.value;
                              updateProductLine(setForm, idx, {
                                vendor_id: vid,
                              });
                            }}
                          >
                            <option value="">Select</option>
                            {vendorsForProductLineSelect.map((item) => (
                              <option key={item.id} value={String(item.id)}>
                                {item.vendor_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={line.product_id}
                            onChange={(e) => {
                              const product = state.products.find(
                                (p) => String(p.product_id) === String(e.target.value),
                              );
                              const patch = {
                                product_id: e.target.value,
                                vendor_id: product ? String(product.vendor_id) : line.vendor_id,
                                price: product ? String(product.price) : "",
                              };
                              updateProductLine(setForm, idx, patch);
                            }}
                          >
                            <option value="">Select</option>
                            {productsForDestination.map((item) => (
                              <option key={item.product_id} value={String(item.product_id)}>
                                {item.product_name}
                              </option>
                            ))}
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
                              updateProductLine(setForm, idx, { invoice_ref_date: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control form-control-sm"
                            value={line.gross_amount}
                            onChange={(e) => updateProductLine(setForm, idx, { gross_amount: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control form-control-sm"
                            value={line.taxable_amount}
                            onChange={(e) => updateProductLine(setForm, idx, { taxable_amount: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control form-control-sm"
                            value={line.gst_percent}
                            onChange={(e) => updateProductLine(setForm, idx, { gst_percent: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control form-control-sm"
                            value={line.gst_amount}
                            onChange={(e) => updateProductLine(setForm, idx, { gst_amount: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control form-control-sm"
                            value={line.commission_percent}
                            onChange={(e) =>
                              updateProductLine(setForm, idx, { commission_percent: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control form-control-sm"
                            value={line.commission_amount}
                            onChange={(e) =>
                              updateProductLine(setForm, idx, { commission_amount: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control form-control-sm"
                            value={line.tds_amount}
                            onChange={(e) => updateProductLine(setForm, idx, { tds_amount: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control form-control-sm"
                            value={line.net_payable}
                            onChange={(e) => updateProductLine(setForm, idx, { net_payable: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control form-control-sm"
                            value={line.minimum_due}
                            onChange={(e) => updateProductLine(setForm, idx, { minimum_due: e.target.value })}
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
                        <td>
                          <input
                            type="number"
                            min="1"
                            className="form-control form-control-sm"
                            value={line.quantity}
                            onChange={(e) => updateProductLine(setForm, idx, { quantity: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control form-control-sm"
                            value={line.price}
                            onChange={(e) => updateProductLine(setForm, idx, { price: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            readOnly
                            className="form-control form-control-sm bg-light"
                            value={line.line_total}
                          />
                        </td>
                        <td className="text-end text-nowrap">
                          {productLines.length > 1 ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() =>
                                setForm((c) => ({
                                  ...c,
                                  productLines: (c.productLines || []).filter((_, i) => i !== idx),
                                }))
                              }
                            >
                              Remove
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="ta-order-vendor-line-tfoot">
                    <tr>
                      <td colSpan={4} className="fw-semibold text-end small">
                        Totals
                      </td>
                      <td className="small fw-medium text-end ta-vcol-num">
                        {formatCurrency(productLineTotals.gross)}
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
                      <td className="small fw-medium text-end ta-vcol-num">
                        {formatCurrency(productLineTotals.tds)}
                      </td>
                      <td className="small fw-medium text-end ta-vcol-num">
                        {formatCurrency(productLineTotals.net)}
                      </td>
                      <td className="small fw-medium text-end ta-vcol-num">
                        {formatCurrency(productLineTotals.minDue)}
                      </td>
                      <td className="ta-vcol-mode" />
                      <td className="small fw-medium text-center ta-vcol-qty">
                        {productLineTotals.qty || "—"}
                      </td>
                      <td className="ta-vcol-num" />
                      <td className="small fw-medium text-end ta-vcol-num">
                        {formatCurrency(productLineTotals.lineTotal)}
                      </td>
                      <td className="ta-vcol-action" />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm mt-3"
                onClick={() =>
                  setForm((c) => ({
                    ...c,
                    productLines: [...(c.productLines || []), emptyProductLine()],
                  }))
                }
              >
                Add product line
              </button>
            </div>
          </div>
      ) : null}

      {wizardStep === 3 ? (
        <div className="card mb-0 ta-order-section ta-order-section--wizard-panel">
          <div className="card-header ta-order-section-title-pay">Customer Payment</div>
          <div className="card-body">
            <p className="ta-card-muted small mb-3">
              Record amounts received from the customer (method, reference, date, and status).
            </p>
            <div className="border rounded-2 p-3 mb-4 bg-body-secondary bg-opacity-25">
              <h3 className="h6 mb-2">Proforma invoice</h3>
              <p className="ta-card-muted small mb-3 mb-md-2">
                Issue a proforma for the customer using the booking lines and payments below. Save the booking to store
                the proforma number and date.
              </p>
              <div className="row g-2 align-items-end">
                <div className="col-12 col-md-4">
                  <label className="form-label small mb-1" htmlFor="ta-proforma-invoice-number">
                    Proforma invoice no.
                  </label>
                  <input
                    id="ta-proforma-invoice-number"
                    type="text"
                    className="form-control form-control-sm"
                    autoComplete="off"
                    placeholder="e.g. PI-2026-0142"
                    value={form.proforma_invoice_number ?? ""}
                    onChange={(e) =>
                      setForm((c) => ({
                        ...c,
                        proforma_invoice_number: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small mb-1" htmlFor="ta-proforma-invoice-date">
                    Proforma date
                  </label>
                  <input
                    id="ta-proforma-invoice-date"
                    type="date"
                    className="form-control form-control-sm"
                    value={form.proforma_invoice_date ?? ""}
                    onChange={(e) =>
                      setForm((c) => ({
                        ...c,
                        proforma_invoice_date: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="col-12 col-md-4">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm w-100"
                    onClick={() => openProformaInvoicePrintWindow(form, state, bookingId)}
                  >
                    Print / preview proforma
                  </button>
                </div>
              </div>
            </div>
            <div className="table-responsive ta-order-table-wrap">
              <table className="table table-sm ta-order-table">
                <thead>
                  <tr>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {paymentLines.map((line, idx) => (
                    <tr key={`pay-${idx}`}>
                      <td>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          step="0.01"
                          min="0"
                          value={line.amount}
                          onChange={(e) =>
                            setForm((c) => ({
                              ...c,
                              paymentLines: patchLine(
                                c.paymentLines?.length ? c.paymentLines : [emptyPaymentLine()],
                                idx,
                                { amount: e.target.value },
                              ),
                            }))
                          }
                        />
                      </td>
                      <td>
                        <label className="form-label visually-hidden" htmlFor={`ta-custpay-method-${idx}`}>
                          Payment method
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
                      <td>
                        <input
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
                      <td>
                        <input
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
                      <td>
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
                      <td className="text-end">
                        {paymentLines.length > 1 ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() =>
                              setForm((c) => ({
                                ...c,
                                paymentLines: (c.paymentLines || []).filter((_, i) => i !== idx),
                              }))
                            }
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm mt-3"
              onClick={() =>
                setForm((c) => ({
                  ...c,
                  paymentLines: [...(c.paymentLines || []), emptyPaymentLine()],
                }))
              }
            >
              Add payment row
            </button>
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
    </div>
  );
}

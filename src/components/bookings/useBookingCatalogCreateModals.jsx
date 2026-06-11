import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FormModal, SelectField, TextField } from "../access/AccessShared.jsx";
import { parseAmountNumeric } from "../../formatAmount.js";
import { BookingAlertMessage } from "./BookingAlertMessage.jsx";

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

function emptyProductTypeForm() {
  return { product_name: "", description: "" };
}

function emptyVendorForm() {
  return {
    vendor_name: "",
    address: "",
    country_id: "",
    gst_number: "",
    bank_account_number: "",
    bank_ifsc: "",
    bank_branch: "",
    credit_limit_days: "",
  };
}

function emptyCatalogProductForm() {
  return { product_name: "", product_type_id: "", vendor_id: "", price: "" };
}

function validateProductType(f) {
  if (!String(f.product_name || "").trim()) {
    return "Product name is required.";
  }
  return "";
}

function validateVendor(f) {
  if (!String(f.vendor_name || "").trim()) {
    return "Vendor name is required.";
  }
  const creditRaw = String(f.credit_limit_days ?? "").trim();
  if (creditRaw !== "") {
    const n = Number(creditRaw);
    if (!Number.isFinite(n) || n < 0 || n > 3650) {
      return "Credit limit in days must be a whole number between 0 and 3650.";
    }
  }
  return "";
}

function validateCatalogProduct(f, bookingDestination) {
  if (!String(bookingDestination || "").trim()) {
    return "Enter a destination on Booking Details before adding a catalogue product.";
  }
  if (!String(f.product_name || "").trim()) {
    return "Product name is required.";
  }
  if (!f.product_type_id) {
    return "Product is required.";
  }
  if (!f.vendor_id) {
    return "Vendor is required.";
  }
  const price = parseAmountNumeric(f.price);
  if (!Number.isFinite(price) || price < 0) {
    return "Price must be a valid amount (0 or greater).";
  }
  return "";
}

/**
 * Modals to create a master product type while editing a booking (toolbar: Add Product).
 * Vendor / catalogue-product modals remain in this hook for reuse but are not opened from the booking UI.
 */
export function useBookingCatalogCreateModals({
  token,
  apiRequest,
  bookingDestination,
  productTypes,
  setProductTypes,
  vendors,
  setVendors,
  setProducts,
  canCreateProductType = false,
}) {
  const [ptOpen, setPtOpen] = useState(false);
  const [ptForm, setPtForm] = useState(emptyProductTypeForm());
  const [ptErr, setPtErr] = useState("");
  const [ptSaving, setPtSaving] = useState(false);
  const [lastCreatedProductTypeId, setLastCreatedProductTypeId] = useState(null);
  const [ptAssignVendorId, setPtAssignVendorId] = useState("");

  const [vOpen, setVOpen] = useState(false);
  const [vForm, setVForm] = useState(emptyVendorForm());
  const [vErr, setVErr] = useState("");
  const [vSaving, setVSaving] = useState(false);
  const [lastCreatedVendorId, setLastCreatedVendorId] = useState(null);

  const [vendorTypeRows, setVendorTypeRows] = useState([]);
  const [vendorTypeRowsLoading, setVendorTypeRowsLoading] = useState(false);
  const [vendorTypeRowsError, setVendorTypeRowsError] = useState("");
  const [assignedVendorProductTypeIds, setAssignedVendorProductTypeIds] = useState([]);
  const [vendorTypeFilter, setVendorTypeFilter] = useState("");

  const [prOpen, setPrOpen] = useState(false);
  const [prForm, setPrForm] = useState(emptyCatalogProductForm());
  const [prErr, setPrErr] = useState("");
  const [prSuccess, setPrSuccess] = useState("");
  const [prSaving, setPrSaving] = useState(false);
  const [lastCreatedProductId, setLastCreatedProductId] = useState(null);

  const [countries, setCountries] = useState([]);

  const countryOptions = useMemo(
    () => [
      { value: "", label: "—" },
      ...countries.map((c) => ({ value: String(c.id), label: c.name || `Country #${c.id}` })),
    ],
    [countries],
  );

  useEffect(() => {
    let active = true;
    apiRequest("/masters/countries/options", { token })
      .then((co) => {
        if (!active) {
          return;
        }
        setCountries(Array.isArray(co) ? co : []);
      })
      .catch(() => {
        if (active) {
          setCountries([]);
        }
      });
    return () => {
      active = false;
    };
  }, [apiRequest, token]);

  const openProductType = useCallback((prefillProductName = "", { vendorId = "" } = {}) => {
    if (!canCreateProductType) {
      return;
    }
    setPtAssignVendorId(String(vendorId || "").trim());
    setPtForm({ ...emptyProductTypeForm(), product_name: String(prefillProductName || "").trim() });
    setPtErr("");
    setPtOpen(true);
  }, [canCreateProductType]);

  const consumeLastCreatedProductTypeId = useCallback(() => {
    setLastCreatedProductTypeId(null);
  }, []);

  const openVendor = useCallback((prefillVendorName = "") => {
    setVForm({ ...emptyVendorForm(), vendor_name: String(prefillVendorName || "").trim() });
    setVErr("");
    setVendorTypeRows([]);
    setVendorTypeRowsError("");
    setAssignedVendorProductTypeIds([]);
    setVendorTypeFilter("");
    setVOpen(true);
  }, []);

  const consumeLastCreatedVendorId = useCallback(() => {
    setLastCreatedVendorId(null);
  }, []);

  useEffect(() => {
    if (!vOpen) {
      return undefined;
    }
    let active = true;
    setVendorTypeRowsLoading(true);
    setVendorTypeRowsError("");
    setVendorTypeFilter("");
    apiRequest("/masters/vendors/product-type-assignment-catalog", { token })
      .then((rows) => {
        if (!active) {
          return;
        }
        setVendorTypeRows(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setVendorTypeRows([]);
        setVendorTypeRowsError(err?.message || "Unable to load products.");
      })
      .finally(() => {
        if (active) {
          setVendorTypeRowsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [apiRequest, token, vOpen]);

  const filteredVendorTypes = useMemo(() => {
    const q = norm(vendorTypeFilter);
    if (!q) {
      return vendorTypeRows;
    }
    return vendorTypeRows.filter((row) => {
      const hay = [row.type_name, row.description, String(row.product_type_id)].map(norm).join(" ");
      return hay.includes(q);
    });
  }, [vendorTypeFilter, vendorTypeRows]);

  function toggleVendorProductType(id) {
    const tid = Number(id);
    if (!Number.isFinite(tid) || tid <= 0) {
      return;
    }
    setAssignedVendorProductTypeIds((prev) =>
      prev.includes(tid) ? prev.filter((x) => x !== tid) : [...prev, tid].sort((a, b) => a - b),
    );
  }

  function selectAllShownVendorProductTypes() {
    setAssignedVendorProductTypeIds((prev) => {
      const next = new Set(prev);
      for (const r of filteredVendorTypes) {
        next.add(Number(r.product_type_id));
      }
      return Array.from(next).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
    });
  }

  function clearVendorProductTypeSelection() {
    setAssignedVendorProductTypeIds([]);
  }

  const openCatalogProduct = useCallback(
    (prefillProductName = "", { vendorId = "", productTypeId = "" } = {}) => {
      setPrErr("");
      setPrSuccess("");
      setPrForm({
        ...emptyCatalogProductForm(),
        product_name: String(prefillProductName || "").trim(),
        vendor_id: vendorId == null ? "" : String(vendorId),
        product_type_id: productTypeId == null ? "" : String(productTypeId),
      });
      setPrOpen(true);
    },
    [],
  );

  const consumeLastCreatedProductId = useCallback(() => {
    setLastCreatedProductId(null);
  }, []);

  async function submitProductType(e) {
    e.preventDefault();
    e.stopPropagation();
    setPtErr("");
    const ve = validateProductType(ptForm);
    if (ve) {
      setPtErr(ve);
      return;
    }
    setPtSaving(true);
    try {
      const created = await apiRequest("/masters/product-types", {
        method: "POST",
        token,
        body: {
          product_name: ptForm.product_name.trim(),
          description: ptForm.description.trim() || null,
        },
      });
      setProductTypes((list) =>
        [...list, created].sort((a, b) =>
          String(a.product_name || "").localeCompare(String(b.product_name || "")),
        ),
      );
      const createdId = created?.id ?? null;
      const vendorIdTrim = String(ptAssignVendorId || "").trim();
      if (createdId && vendorIdTrim) {
        try {
          const currentVendor = await apiRequest(`/masters/vendors/${encodeURIComponent(vendorIdTrim)}`, { token });
          const existingLinks = currentVendor?.vendor_products ?? currentVendor?.vendorProducts ?? [];
          const existingIds = (Array.isArray(existingLinks) ? existingLinks : [])
            .map((x) => x?.product_type_id ?? x?.productTypeId)
            .map((x) => (x == null ? "" : String(x).trim()))
            .filter(Boolean)
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n) && n > 0);
          const nextAssigned = Array.from(new Set([...existingIds, Number(createdId)])).filter(
            (n) => Number.isFinite(n) && n > 0,
          );
          await apiRequest(`/masters/vendors/${encodeURIComponent(vendorIdTrim)}`, {
            method: "PATCH",
            token,
            body: {
              vendor_name: String(currentVendor?.vendor_name || currentVendor?.vendorName || "").trim(),
              address: String(currentVendor?.address || "").trim() || null,
              country_id: currentVendor?.country_id ? Number(currentVendor.country_id) : null,
              gst_number: String(currentVendor?.gst_number || currentVendor?.gstNumber || "").trim() || null,
              bank_account_number:
                String(currentVendor?.bank_account_number || currentVendor?.bankAccountNumber || "").trim() || null,
              bank_ifsc: String(currentVendor?.bank_ifsc || currentVendor?.bankIfsc || "").trim() || null,
              bank_branch: String(currentVendor?.bank_branch || currentVendor?.bankBranch || "").trim() || null,
              credit_limit_days:
                currentVendor?.credit_limit_days == null ? null : Number(currentVendor.credit_limit_days),
              assigned_product_type_ids: nextAssigned,
            },
          });
        } catch {
          // If assignment fails (permissions/network), still keep the product type created.
        }
      }
      setLastCreatedProductTypeId(created?.id ?? null);
      setPtOpen(false);
      setPtForm(emptyProductTypeForm());
      setPtAssignVendorId("");
    } catch (err) {
      setPtErr(err.message || "Unable to create product.");
    } finally {
      setPtSaving(false);
    }
  }

  async function submitVendor(e) {
    e.preventDefault();
    e.stopPropagation();
    setVErr("");
    const ve = validateVendor(vForm);
    if (ve) {
      setVErr(ve);
      return;
    }
    const creditRaw = String(vForm.credit_limit_days ?? "").trim();
    let credit_limit_days = null;
    if (creditRaw !== "") {
      credit_limit_days = Math.trunc(Number(creditRaw));
    }
    setVSaving(true);
    try {
      const created = await apiRequest("/masters/vendors", {
        method: "POST",
        token,
        body: {
          vendor_name: vForm.vendor_name.trim(),
          address: vForm.address.trim() || null,
          country_id: vForm.country_id ? Number(vForm.country_id) : null,
          gst_number: vForm.gst_number.trim() || null,
          bank_account_number: vForm.bank_account_number.trim() || null,
          bank_ifsc: vForm.bank_ifsc.trim() || null,
          bank_branch: vForm.bank_branch.trim() || null,
          credit_limit_days,
          assigned_product_type_ids: assignedVendorProductTypeIds,
        },
      });
      setVendors((list) =>
        [...list, created].sort((a, b) =>
          String(a.vendor_name || "").localeCompare(String(b.vendor_name || "")),
        ),
      );
      setLastCreatedVendorId(created?.id ?? null);
      setVOpen(false);
      setVForm(emptyVendorForm());
      setVendorTypeRows([]);
      setVendorTypeRowsError("");
      setAssignedVendorProductTypeIds([]);
      setVendorTypeFilter("");
    } catch (err) {
      setVErr(err.message || "Unable to create vendor.");
    } finally {
      setVSaving(false);
    }
  }

  async function submitCatalogProduct(e) {
    e.preventDefault();
    e.stopPropagation();
    setPrErr("");
    setPrSuccess("");
    const ve = validateCatalogProduct(prForm, bookingDestination);
    if (ve) {
      setPrErr(ve);
      return;
    }
    setPrSaving(true);
    try {
      const created = await apiRequest("/masters/products", {
        method: "POST",
        token,
        body: {
          product_name: prForm.product_name.trim(),
          product_type_id: Number(prForm.product_type_id),
          destination: String(bookingDestination || "").trim(),
          vendor_id: Number(prForm.vendor_id),
          price: parseAmountNumeric(prForm.price),
        },
      });
      setProducts((list) => [...list, created]);
      setLastCreatedProductId(created?.id ?? created?.product_id ?? null);
      setPrForm(emptyCatalogProductForm());
      setPrSuccess("Product added to the catalogue. Add another here, or click Cancel to return to the booking.");
    } catch (err) {
      setPrErr(err.message || "Unable to create product.");
    } finally {
      setPrSaving(false);
    }
  }

  const typeOptionsForProduct = [
    { value: "", label: "Select product" },
    ...(productTypes || []).map((t) => ({
      value: String(t.id),
      label: t.product_name,
    })),
  ];

  const vendorOptionsForProduct = [
    { value: "", label: "Select vendor" },
    ...(vendors || []).map((v) => ({
      value: String(v.id),
      label: v.vendor_name,
    })),
  ];

  const renderCatalogModals = () =>
    createPortal(
      <>
        {ptOpen ? (
          <FormModal
            open
            title="Create product"
            saveLabel="Create"
            saving={ptSaving}
            onCancel={() => {
              setPtOpen(false);
              setPtForm(emptyProductTypeForm());
              setPtErr("");
            }}
            onSubmit={submitProductType}
          >
            <BookingAlertMessage message={ptErr} variant="danger" onDismiss={() => setPtErr("")} />
            <div className="row g-3">
              <TextField
                label="Product name"
                value={ptForm.product_name}
                required
                onChange={(val) => setPtForm((c) => ({ ...c, product_name: val }))}
              />
              <TextField
                label="Description"
                value={ptForm.description}
                onChange={(val) => setPtForm((c) => ({ ...c, description: val }))}
              />
            </div>
          </FormModal>
        ) : null}

        {vOpen ? (
          <FormModal
            open
            title="Create vendor"
            saveLabel="Create"
            saving={vSaving}
            size="modal-lg"
            scrollableBody
            onCancel={() => {
              setVOpen(false);
              setVForm(emptyVendorForm());
              setVErr("");
              setVendorTypeRows([]);
              setVendorTypeRowsError("");
              setAssignedVendorProductTypeIds([]);
              setVendorTypeFilter("");
            }}
            onSubmit={submitVendor}
          >
            <BookingAlertMessage message={vErr} variant="danger" onDismiss={() => setVErr("")} />
            <div className="row g-3">
              <TextField
                label="Vendor name"
                value={vForm.vendor_name}
                required
                onChange={(val) => setVForm((c) => ({ ...c, vendor_name: val }))}
              />
              <div className="col-12">
                <label className="form-label" htmlFor="ta-catalog-vendor-address">
                  Address
                </label>
                <textarea
                  id="ta-catalog-vendor-address"
                  className="form-control"
                  rows={3}
                  value={vForm.address}
                  onChange={(e) => setVForm((c) => ({ ...c, address: e.target.value }))}
                  placeholder="Street, area, postal code…"
                />
              </div>
              <SelectField
                label="Country"
                value={vForm.country_id}
                onChange={(val) => setVForm((c) => ({ ...c, country_id: val }))}
                options={countryOptions}
              />
              <TextField
                label="GST number"
                value={vForm.gst_number}
                maxLength={50}
                onChange={(val) => setVForm((c) => ({ ...c, gst_number: val }))}
              />
              <TextField
                label="Credit limit (days)"
                type="number"
                min={0}
                max={3650}
                step={1}
                value={vForm.credit_limit_days}
                placeholder="e.g. 10 — due date = invoice date + days"
                onChange={(val) => setVForm((c) => ({ ...c, credit_limit_days: val }))}
              />
            </div>

            <section
              className="border rounded-3 p-3 p-md-4 mt-3 mb-0 bg-light"
              aria-labelledby="ta-catalog-vendor-bank-heading"
            >
              <h2 id="ta-catalog-vendor-bank-heading" className="h6 fw-semibold mb-1">
                Bank details
              </h2>
              <p className="small text-muted mb-3 mb-md-4">
                Payout / settlement account for this vendor (optional).
              </p>
              <div className="row g-3">
                <TextField
                  label="Account number"
                  value={vForm.bank_account_number}
                  maxLength={34}
                  onChange={(val) => setVForm((c) => ({ ...c, bank_account_number: val }))}
                />
                <TextField
                  label="IFSC code"
                  value={vForm.bank_ifsc}
                  maxLength={20}
                  onChange={(val) => setVForm((c) => ({ ...c, bank_ifsc: val }))}
                />
                <TextField
                  label="Branch"
                  value={vForm.bank_branch}
                  maxLength={200}
                  onChange={(val) => setVForm((c) => ({ ...c, bank_branch: val }))}
                />
              </div>
            </section>

            <hr className="my-4" />
            <fieldset className="border-0 p-0 m-0">
              <legend className="form-label fw-semibold mb-2">Product</legend>
              <BookingAlertMessage
                message={vendorTypeRowsError}
                variant="danger"
                onDismiss={() => setVendorTypeRowsError("")}
              />
              <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
                <div className="flex-grow-1" style={{ minWidth: "12rem" }}>
                  <label className="form-label small mb-0" htmlFor="ta-catalog-vendor-type-filter">
                    Filter
                  </label>
                  <input
                    id="ta-catalog-vendor-type-filter"
                    type="search"
                    className="form-control form-control-sm"
                    placeholder="Name, description, ID"
                    value={vendorTypeFilter}
                    onChange={(e) => setVendorTypeFilter(e.target.value)}
                    disabled={vendorTypeRowsLoading || !vendorTypeRows.length}
                    autoComplete="off"
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm text-nowrap"
                  disabled={vendorTypeRowsLoading || !filteredVendorTypes.length}
                  onClick={selectAllShownVendorProductTypes}
                >
                  Select all shown
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm text-nowrap"
                  disabled={!assignedVendorProductTypeIds.length}
                  onClick={clearVendorProductTypeSelection}
                >
                  Clear
                </button>
              </div>
              <p className="small text-muted mb-2" aria-live="polite">
                Selected: {assignedVendorProductTypeIds.length}
                {vendorTypeFilter.trim()
                  ? ` · ${filteredVendorTypes.length} / ${vendorTypeRows.length}`
                  : ""}
              </p>
              {vendorTypeRowsLoading ? (
                <div className="small text-muted">Loading products…</div>
              ) : (
                <div
                  className="border rounded bg-light p-2 ta-vendor-type-assign"
                  style={{ maxHeight: "min(50vh, 22rem)", overflowY: "auto" }}
                >
                  {vendorTypeRows.length ? (
                    filteredVendorTypes.length ? (
                      <div className="row row-cols-1 row-cols-md-3 g-2 small">
                        {filteredVendorTypes.map((row) => {
                          const tid = Number(row.product_type_id);
                          const checked = assignedVendorProductTypeIds.includes(tid);
                          const cbId = `ta-catalog-vendor-pt-${tid}`;
                          const titleTip = row.description ? String(row.description) : undefined;
                          return (
                            <div key={cbId} className="col">
                              <div className="d-flex align-items-center gap-2 rounded border bg-white px-2 py-1 h-100">
                                <input
                                  id={cbId}
                                  type="checkbox"
                                  className="form-check-input flex-shrink-0 m-0 mt-0"
                                  checked={checked}
                                  onChange={() => toggleVendorProductType(row.product_type_id)}
                                  aria-label={`${row.type_name}, product ${tid}`}
                                />
                                <label
                                  className="mb-0 flex-grow-1 min-w-0"
                                  htmlFor={cbId}
                                  style={{ cursor: "pointer" }}
                                  title={titleTip}
                                >
                                  <span className="fw-medium text-body text-truncate d-block">{row.type_name}</span>
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-muted small mb-0 px-1">No products match the filter.</p>
                    )
                  ) : (
                    <p className="text-muted small mb-0 px-1">
                      No products yet. Add them under <strong>Masters → Manage Product</strong>.
                    </p>
                  )}
                </div>
              )}
            </fieldset>
          </FormModal>
        ) : null}

        {prOpen ? (
          <FormModal
            open
            title="Create catalogue product"
            saveLabel="Create"
            saving={prSaving}
            onCancel={() => {
              setPrOpen(false);
              setPrForm(emptyCatalogProductForm());
              setPrErr("");
              setPrSuccess("");
            }}
            onSubmit={submitCatalogProduct}
          >
            <BookingAlertMessage message={prErr} variant="danger" onDismiss={() => setPrErr("")} />
            <BookingAlertMessage message={prSuccess} variant="success" onDismiss={() => setPrSuccess("")} />
            <div className="row g-3">
              <TextField
                label="Product name"
                value={prForm.product_name}
                required
                onChange={(val) => setPrForm((c) => ({ ...c, product_name: val }))}
              />
              <SelectField
                label="Product"
                value={prForm.product_type_id}
                required
                onChange={(val) => setPrForm((c) => ({ ...c, product_type_id: val }))}
                options={typeOptionsForProduct}
              />
              <SelectField
                label="Vendor"
                value={prForm.vendor_id}
                required
                onChange={(val) => setPrForm((c) => ({ ...c, vendor_id: val }))}
                options={vendorOptionsForProduct}
              />
              <TextField
                label="Price"
                formatAmountOnBlur
                value={prForm.price}
                required
                onChange={(val) => setPrForm((c) => ({ ...c, price: val }))}
              />
            </div>
          </FormModal>
        ) : null}
      </>,
      document.body,
    );

  return {
    renderCatalogModals,
    openProductType,
    lastCreatedProductTypeId,
    consumeLastCreatedProductTypeId,
    openVendor,
    lastCreatedVendorId,
    consumeLastCreatedVendorId,
    openCatalogProduct,
    lastCreatedProductId,
    consumeLastCreatedProductId,
  };
}

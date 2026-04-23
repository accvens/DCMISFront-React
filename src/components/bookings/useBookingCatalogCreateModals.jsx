import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FormModal, SelectField, TextField } from "../access/AccessShared.jsx";
import { parseAmountNumeric } from "../../formatAmount.js";
import { BookingAlertMessage } from "./BookingAlertMessage.jsx";

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
 * Modals to create a master product while editing a booking (toolbar: Add Product).
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

  const [vOpen, setVOpen] = useState(false);
  const [vForm, setVForm] = useState(emptyVendorForm());
  const [vErr, setVErr] = useState("");
  const [vSaving, setVSaving] = useState(false);

  const [prOpen, setPrOpen] = useState(false);
  const [prForm, setPrForm] = useState(emptyCatalogProductForm());
  const [prErr, setPrErr] = useState("");
  const [prSuccess, setPrSuccess] = useState("");
  const [prSaving, setPrSaving] = useState(false);

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

  const openProductType = useCallback(() => {
    setPtForm(emptyProductTypeForm());
    setPtErr("");
    setPtOpen(true);
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
      setPtOpen(false);
      setPtForm(emptyProductTypeForm());
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
        },
      });
      setVendors((list) =>
        [...list, created].sort((a, b) =>
          String(a.vendor_name || "").localeCompare(String(b.vendor_name || "")),
        ),
      );
      setVOpen(false);
      setVForm(emptyVendorForm());
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
    catalogMasterToolbar: canCreateProductType ? (
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={openProductType}>
          Add Product
        </button>
      </div>
    ) : null,
  };
}

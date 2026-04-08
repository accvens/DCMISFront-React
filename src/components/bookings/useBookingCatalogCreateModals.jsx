import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertMessage, FormModal, SelectField, TextField } from "../access/AccessShared.jsx";

function emptyProductTypeForm() {
  return { product_name: "", description: "" };
}

function emptyVendorForm() {
  return { vendor_name: "", vendor_type_id: "", city: "", country_id: "" };
}

function emptyCatalogProductForm() {
  return { product_name: "", product_type_id: "", vendor_id: "", price: "" };
}

function validateProductType(f) {
  if (!String(f.product_name || "").trim()) {
    return "Product type name is required.";
  }
  return "";
}

function validateVendor(f) {
  if (!String(f.vendor_name || "").trim()) {
    return "Vendor name is required.";
  }
  return "";
}

function validateCatalogProduct(f, destinationId) {
  if (!String(destinationId || "").trim()) {
    return "Choose a destination on Booking Details before adding a catalogue product.";
  }
  if (!String(f.product_name || "").trim()) {
    return "Product name is required.";
  }
  if (!f.product_type_id) {
    return "Product type is required.";
  }
  if (!f.vendor_id) {
    return "Vendor is required.";
  }
  const price = Number(f.price);
  if (!Number.isFinite(price) || price < 0) {
    return "Price must be a valid amount (0 or greater).";
  }
  return "";
}

/**
 * Modals to create product type, catalogue product, or vendor while editing a booking.
 * Gated by parent (typically `create_product_type` permission).
 */
export function useBookingCatalogCreateModals({
  token,
  apiRequest,
  destinationId,
  productTypes,
  setProductTypes,
  vendors,
  setVendors,
  setProducts,
  canCreateProductType = false,
  canCreateCatalogProduct = false,
  canCreateVendor = false,
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
  const [vendorTypes, setVendorTypes] = useState([]);

  const countryOptions = useMemo(
    () => [
      { value: "", label: "—" },
      ...countries.map((c) => ({ value: String(c.id), label: c.name || `Country #${c.id}` })),
    ],
    [countries],
  );

  const vendorTypeOptions = useMemo(
    () => [
      { value: "", label: "—" },
      ...vendorTypes.map((t) => ({ value: String(t.id), label: t.name || `Type #${t.id}` })),
    ],
    [vendorTypes],
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest("/masters/countries/options", { token }),
      apiRequest("/masters/vendor-types/options", { token }),
    ])
      .then(([co, vt]) => {
        if (!active) {
          return;
        }
        setCountries(Array.isArray(co) ? co : []);
        setVendorTypes(Array.isArray(vt) ? vt : []);
      })
      .catch(() => {
        if (active) {
          setCountries([]);
          setVendorTypes([]);
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

  const openVendor = useCallback(() => {
    setVForm(emptyVendorForm());
    setVErr("");
    setVOpen(true);
  }, []);

  const openCatalogProduct = useCallback(() => {
    setPrForm(emptyCatalogProductForm());
    setPrErr("");
    setPrSuccess("");
    setPrOpen(true);
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
      setPtErr(err.message || "Unable to create product type.");
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
    setVSaving(true);
    try {
      const created = await apiRequest("/masters/vendors", {
        method: "POST",
        token,
        body: {
          vendor_name: vForm.vendor_name.trim(),
          vendor_type_id: vForm.vendor_type_id ? Number(vForm.vendor_type_id) : null,
          city: vForm.city.trim() || null,
          country_id: vForm.country_id ? Number(vForm.country_id) : null,
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
    const ve = validateCatalogProduct(prForm, destinationId);
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
          destination_id: Number(destinationId),
          vendor_id: Number(prForm.vendor_id),
          price: Number(prForm.price),
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
    { value: "", label: "Select product type" },
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
            title="Create product type"
            saveLabel="Create"
            saving={ptSaving}
            onCancel={() => {
              setPtOpen(false);
              setPtForm(emptyProductTypeForm());
              setPtErr("");
            }}
            onSubmit={submitProductType}
          >
            <AlertMessage message={ptErr} variant="danger" />
            <div className="row g-3">
              <TextField
                label="Product type name"
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
            onCancel={() => {
              setVOpen(false);
              setVForm(emptyVendorForm());
              setVErr("");
            }}
            onSubmit={submitVendor}
          >
            <AlertMessage message={vErr} variant="danger" />
            <div className="row g-3">
              <TextField
                label="Vendor name"
                value={vForm.vendor_name}
                required
                onChange={(val) => setVForm((c) => ({ ...c, vendor_name: val }))}
              />
              <SelectField
                label="Vendor type"
                value={vForm.vendor_type_id}
                onChange={(val) => setVForm((c) => ({ ...c, vendor_type_id: val }))}
                options={vendorTypeOptions}
              />
              <TextField
                label="City"
                value={vForm.city}
                onChange={(val) => setVForm((c) => ({ ...c, city: val }))}
              />
              <SelectField
                label="Country"
                value={vForm.country_id}
                onChange={(val) => setVForm((c) => ({ ...c, country_id: val }))}
                options={countryOptions}
              />
            </div>
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
            <AlertMessage message={prErr} variant="danger" />
            <AlertMessage message={prSuccess} variant="success" />
            <div className="row g-3">
              <TextField
                label="Product name"
                value={prForm.product_name}
                required
                onChange={(val) => setPrForm((c) => ({ ...c, product_name: val }))}
              />
              <SelectField
                label="Product type"
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
                type="number"
                step="0.01"
                min="0"
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

  const showBar = canCreateProductType || canCreateCatalogProduct || canCreateVendor;

  return {
    renderCatalogModals,
    catalogMasterToolbar: showBar ? (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          {canCreateProductType ? (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={openProductType}>
              Add product type
            </button>
          ) : null}
          {canCreateVendor ? (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={openVendor}>
              Add vendor
            </button>
          ) : null}
          {canCreateCatalogProduct ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={openCatalogProduct}
              disabled={!String(destinationId || "").trim()}
              title={
                !String(destinationId || "").trim()
                  ? "Select a destination in Booking Details first"
                  : undefined
              }
            >
              Add catalogue product
            </button>
          ) : null}
        </div>
      ) : null,
  };
}

import { useEffect, useMemo, useState } from "react";
import {
  AlertMessage,
  CardLoader,
  ConfirmDeleteModal,
  FormModal,
  ManageCard,
  PaginationBar,
  SelectField,
  SimpleTable,
  SuccessModal,
  TextField,
} from "../access/AccessShared.jsx";
import { createMap, formatCurrency } from "./BookingsShared.jsx";

function createEmptyProductForm() {
  return {
    product_id: "",
    product_name: "",
    product_type_id: "",
    destination_id: "",
    vendor_id: "",
    price: "",
  };
}

function validateProductForm(form) {
  if (!String(form.product_name || "").trim()) {
    return "Product name is required.";
  }
  if (!form.product_type_id) {
    return "Product type is required.";
  }
  if (!form.destination_id) {
    return "Destination is required.";
  }
  if (!form.vendor_id) {
    return "Vendor is required.";
  }
  const price = Number(form.price);
  if (!Number.isFinite(price) || price < 0) {
    return "Price must be a valid amount (0 or greater).";
  }
  return "";
}

function ManageProductDetailsPage({ token, apiRequest, canCreate, canUpdate, canDelete }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refsLoading, setRefsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refsError, setRefsError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [productTypes, setProductTypes] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState(createEmptyProductForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);

  const typeMap = useMemo(() => createMap(productTypes, "id"), [productTypes]);
  const destinationMap = useMemo(() => createMap(destinations, "id"), [destinations]);
  const vendorMap = useMemo(() => createMap(vendors, "id"), [vendors]);

  function resolveTypeName(productTypeId) {
    const row = typeMap[productTypeId] ?? typeMap[String(productTypeId)] ?? typeMap[Number(productTypeId)];
    return row?.product_name?.trim() || "—";
  }

  function resolveDestinationName(destinationId) {
    const row =
      destinationMap[destinationId] ??
      destinationMap[String(destinationId)] ??
      destinationMap[Number(destinationId)];
    return row?.destination_name?.trim() || "—";
  }

  function resolveVendorName(vendorId) {
    const row = vendorMap[vendorId] ?? vendorMap[String(vendorId)] ?? vendorMap[Number(vendorId)];
    return row?.vendor_name?.trim() || "—";
  }

  const typeOptions = useMemo(
    () => [
      { value: "", label: "Select product type" },
      ...productTypes.map((item) => ({
        value: String(item.id),
        label: item.product_name,
      })),
    ],
    [productTypes],
  );

  const destinationOptions = useMemo(
    () => [
      { value: "", label: "Select destination" },
      ...destinations.map((item) => ({
        value: String(item.id),
        label: item.destination_name,
      })),
    ],
    [destinations],
  );

  const vendorOptions = useMemo(
    () => [
      { value: "", label: "Select vendor" },
      ...vendors.map((item) => ({
        value: String(item.id),
        label: item.vendor_name,
      })),
    ],
    [vendors],
  );

  useEffect(() => {
    document.title = "Product Details | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setRefsLoading(true);
    setRefsError("");

    async function fetchAllMasterPages(path) {
      const acc = [];
      let page = 1;
      for (;;) {
        const res = await apiRequest(`${path}?page=${page}&page_size=100`, { token });
        const items = res?.items ?? [];
        acc.push(...items);
        const totalPages = Math.max(1, Number(res?.total_pages ?? 1));
        if (page >= totalPages || items.length === 0) {
          break;
        }
        page += 1;
      }
      return acc;
    }

    (async () => {
      try {
        const [typesItems, destItems, vendItems] = await Promise.all([
          fetchAllMasterPages("/masters/product-types"),
          fetchAllMasterPages("/masters/destinations"),
          fetchAllMasterPages("/masters/vendors"),
        ]);
        if (!active) {
          return;
        }
        setProductTypes(typesItems);
        setDestinations(destItems);
        setVendors(vendItems);
      } catch (requestError) {
        if (!active) {
          return;
        }
        setRefsError(requestError.message || "Unable to load reference data.");
      } finally {
        if (active) {
          setRefsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [apiRequest, token]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    apiRequest(`/masters/products?page=${page}&page_size=${pageSize}`, { token })
      .then((response) => {
        if (!active) {
          return;
        }
        setPageData(response);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setError(requestError.message || "Unable to load products.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiRequest, page, pageSize, refreshKey, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const validationError = validateProductForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    const isEditing = Boolean(form.product_id);

    try {
      await apiRequest(
        form.product_id ? `/masters/products/${form.product_id}` : "/masters/products",
        {
          method: form.product_id ? "PATCH" : "POST",
          token,
          body: {
            product_name: form.product_name.trim(),
            product_type_id: Number(form.product_type_id),
            destination_id: Number(form.destination_id),
            vendor_id: Number(form.vendor_id),
            price: Number(form.price),
          },
        },
      );
      setForm(createEmptyProductForm());
      setModalOpen(false);
      setPage(1);
      setRefreshKey((current) => current + 1);
      setSuccessModal({
        title: isEditing ? "Product Updated" : "Product Created",
        message: isEditing ? "Product updated successfully." : "Product created successfully.",
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productId) {
    try {
      await apiRequest(`/masters/products/${productId}`, { method: "DELETE", token });
      setDeleteTarget(null);
      if ((pageData?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete product.");
    }
  }

  return (
    <>
      <AlertMessage message={error} variant="danger" />
      <AlertMessage message={refsError} variant="warning" />
      <ManageCard
        title="Product Details"
        subtitle="Catalogue rows used on the booking Product Details step (destination, vendor, type, and price)."
        actionLabel={canCreate ? "Add Product" : undefined}
        onAction={
          canCreate
            ? () => {
                setForm(createEmptyProductForm());
                setFormError("");
                setModalOpen(true);
              }
            : undefined
        }
      >
        {loading ? (
          <CardLoader message="Loading products..." />
        ) : (
          <>
            <SimpleTable
              columns={["ID", "Product", "Type", "Destination", "Vendor", "Price", "Actions"]}
              rows={(pageData?.items || []).map((item) => [
                `#${item.product_id}`,
                item.product_name,
                resolveTypeName(item.product_type_id),
                resolveDestinationName(item.destination_id),
                resolveVendorName(item.vendor_id),
                formatCurrency(item.price),
                <div key={`product-actions-${item.product_id}`} className="ta-table-actions">
                  {canUpdate ? (
                    <button
                      type="button"
                      className="btn btn-icon btn-soft-primary btn-sm"
                      aria-label="Edit product"
                      onClick={() => {
                        setForm({
                          product_id: String(item.product_id),
                          product_name: item.product_name || "",
                          product_type_id: String(item.product_type_id),
                          destination_id: String(item.destination_id),
                          vendor_id: String(item.vendor_id),
                          price:
                            item.price !== null && item.price !== undefined ? String(item.price) : "",
                        });
                        setFormError("");
                        setModalOpen(true);
                      }}
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true" className="ta-action-icon">
                        <path d="M3 11.5 3.5 9l6-6 2.5 2.5-6 6L3 11.5z" />
                        <path d="M2 13.5h12" />
                      </svg>
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      className="btn btn-icon btn-soft-danger btn-sm"
                      aria-label="Delete product"
                      onClick={() =>
                        setDeleteTarget({
                          id: item.product_id,
                          label: item.product_name,
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
                  {!canUpdate && !canDelete ? "-" : null}
                </div>,
              ])}
              sortable
              emptyMessage="No products found."
            />
            <PaginationBar
              pageData={pageData}
              onSelectPage={setPage}
              pageSize={pageSize}
              onPageSizeChange={(value) => {
                setPage(1);
                setPageSize(value);
              }}
            />
          </>
        )}
      </ManageCard>
      <FormModal
        open={modalOpen}
        title={form.product_id ? "Update Product" : "Add Product"}
        saveLabel={form.product_id ? "Update Product" : "Create Product"}
        saving={saving}
        onCancel={() => {
          setModalOpen(false);
          setForm(createEmptyProductForm());
          setFormError("");
        }}
        onSubmit={handleSubmit}
      >
        <AlertMessage message={formError} variant="danger" />
        <div className="row g-3">
          <TextField
            label="Product name"
            value={form.product_name}
            required
            onChange={(value) => setForm((current) => ({ ...current, product_name: value }))}
          />
          <SelectField
            label="Product type"
            value={form.product_type_id}
            required
            onChange={(value) => setForm((current) => ({ ...current, product_type_id: value }))}
            options={typeOptions}
          />
          <SelectField
            label="Destination"
            value={form.destination_id}
            required
            onChange={(value) => setForm((current) => ({ ...current, destination_id: value }))}
            options={destinationOptions}
          />
          <SelectField
            label="Vendor"
            value={form.vendor_id}
            required
            onChange={(value) => setForm((current) => ({ ...current, vendor_id: value }))}
            options={vendorOptions}
          />
          <TextField
            label="Price"
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            required
            onChange={(value) => setForm((current) => ({ ...current, price: value }))}
          />
        </div>
      </FormModal>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Product"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete Product"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget.id)}
      />
      <SuccessModal
        open={Boolean(successModal)}
        title={successModal?.title || ""}
        message={successModal?.message || ""}
        onClose={() => setSuccessModal(null)}
      />
    </>
  );
}

export default ManageProductDetailsPage;

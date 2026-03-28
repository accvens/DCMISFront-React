import { useEffect, useState } from "react";
import {
  AlertMessage,
  CardLoader,
  ConfirmDeleteModal,
  FormModal,
  ManageCard,
  PaginationBar,
  SimpleTable,
  SuccessModal,
  TextField,
} from "../access/AccessShared.jsx";

function createEmptyProductTypeForm() {
  return {
    id: "",
    product_name: "",
    description: "",
  };
}

function ManageProductTypesPage({ token, apiRequest, canCreate, canUpdate, canDelete }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [form, setForm] = useState(createEmptyProductTypeForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);

  useEffect(() => {
    document.title = "Manage Product Type | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    apiRequest(`/masters/product-types?page=${page}&page_size=${pageSize}`, { token })
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
        setError(requestError.message || "Unable to load product types.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiRequest, page, pageSize, refreshKey, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    if (!form.product_name.trim()) {
      setFormError("Product name is required.");
      return;
    }
    setSaving(true);
    const isEditing = Boolean(form.id);

    try {
      await apiRequest(
        form.id ? `/masters/product-types/${form.id}` : "/masters/product-types",
        {
          method: form.id ? "PATCH" : "POST",
          token,
          body: {
            product_name: form.product_name.trim(),
            description: form.description.trim() || null,
          },
        },
      );
      setForm(createEmptyProductTypeForm());
      setModalOpen(false);
      setPage(1);
      setRefreshKey((current) => current + 1);
      setSuccessModal({
        title: isEditing ? "Product Type Updated" : "Product Type Created",
        message: isEditing
          ? "Product type updated successfully."
          : "Product type created successfully.",
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save product type.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productTypeId) {
    try {
      await apiRequest(`/masters/product-types/${productTypeId}`, { method: "DELETE", token });
      setDeleteTarget(null);
      if ((pageData?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete product type.");
    }
  }

  return (
    <>
      <AlertMessage message={error} variant="danger" />
      <ManageCard
        title="Manage Product Type"
        subtitle="Create and maintain product type masters."
        actionLabel={canCreate ? "Add Product Type" : undefined}
        onAction={
          canCreate
            ? () => {
                setForm(createEmptyProductTypeForm());
                setFormError("");
                setModalOpen(true);
              }
            : undefined
        }
      >
        {loading ? (
          <CardLoader message="Loading product types..." />
        ) : (
          <>
            <SimpleTable
              columns={["ID", "Product Name", "Description", "Actions"]}
              rows={(pageData?.items || []).map((item) => [
                `#${item.id}`,
                item.product_name,
                item.description || "-",
                <div key={`product-type-actions-${item.id}`} className="ta-table-actions">
                  {canUpdate ? (
                    <button
                      type="button"
                      className="btn btn-icon btn-soft-primary btn-sm"
                      aria-label="Edit product type"
                      onClick={() => {
                        setForm({
                          id: String(item.id),
                          product_name: item.product_name || "",
                          description: item.description || "",
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
                      aria-label="Delete product type"
                      onClick={() =>
                        setDeleteTarget({
                          id: item.id,
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
              emptyMessage="No product types found."
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
        title={form.id ? "Update Product Type" : "Add Product Type"}
        saveLabel={form.id ? "Update Product Type" : "Create Product Type"}
        saving={saving}
        onCancel={() => {
          setModalOpen(false);
          setForm(createEmptyProductTypeForm());
          setFormError("");
        }}
        onSubmit={handleSubmit}
      >
        <AlertMessage message={formError} variant="danger" />
        <div className="row g-3">
          <TextField
            label="Product Name"
            value={form.product_name}
            required
            onChange={(value) => setForm((current) => ({ ...current, product_name: value }))}
          />
          <div className="col-12">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              rows="3"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </div>
        </div>
      </FormModal>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Product Type"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete Product Type"
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

export default ManageProductTypesPage;

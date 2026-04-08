import { useEffect, useState } from "react";
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
  formatDateTime,
} from "../access/AccessShared.jsx";

function emptyForm() {
  return {
    id: "",
    name: "",
    sort_order: "0",
    is_active: "true",
  };
}

/**
 * Generic CRUD for /masters/{slug} lookup tables (countries, vendor-types, traveler-types, visa-types).
 */
function ManageLookupMasterPage({
  token,
  apiRequest,
  slug,
  title,
  documentTitle,
  canCreate,
  canUpdate,
  canDelete,
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);

  const basePath = `/masters/${slug}`;

  useEffect(() => {
    document.title = documentTitle || `${title} | Master | Travel Agency`;
  }, [documentTitle, title]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    apiRequest(`${basePath}?page=${page}&page_size=${pageSize}`, { token })
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
        setError(requestError.message || `Unable to load ${title.toLowerCase()}.`);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiRequest, basePath, page, pageSize, refreshKey, token, title]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    if (!String(form.name || "").trim()) {
      setFormError("Name is required.");
      return;
    }
    const sortNum = Number(form.sort_order);
    if (!Number.isFinite(sortNum)) {
      setFormError("Sort order must be a number.");
      return;
    }
    setSaving(true);
    const isEditing = Boolean(form.id);

    try {
      await apiRequest(form.id ? `${basePath}/${form.id}` : basePath, {
        method: form.id ? "PATCH" : "POST",
        token,
        body: {
          name: form.name.trim(),
          sort_order: sortNum,
          is_active: form.is_active === "true",
        },
      });
      setForm(emptyForm());
      setModalOpen(false);
      setPage(1);
      setRefreshKey((current) => current + 1);
      setSuccessModal({
        title: isEditing ? `${title} updated` : `${title} created`,
        message: isEditing ? "Saved successfully." : "Created successfully.",
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await apiRequest(`${basePath}/${id}`, { method: "DELETE", token });
      setDeleteTarget(null);
      if ((pageData?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete.");
    }
  }

  return (
    <>
      <AlertMessage message={error} variant="danger" />
      <ManageCard
        title={title}
        subtitle={`Maintain values used in dropdowns across the app.`}
        actionLabel={canCreate ? `Add ${title.replace(/s$/, "")}` : undefined}
        onAction={
          canCreate
            ? () => {
                setForm(emptyForm());
                setFormError("");
                setModalOpen(true);
              }
            : undefined
        }
      >
        {loading ? (
          <CardLoader message={`Loading ${title.toLowerCase()}…`} />
        ) : (
          <>
            <SimpleTable
              columns={["ID", "Name", "Sort", "Active", "Created", "Actions"]}
              rows={(pageData?.items || []).map((item) => [
                `#${item.id}`,
                item.name || "—",
                String(item.sort_order ?? ""),
                item.is_active ? "Yes" : "No",
                formatDateTime(item.created_at),
                <div key={`lk-actions-${item.id}`} className="ta-table-actions">
                  {canUpdate ? (
                    <button
                      type="button"
                      className="btn btn-icon btn-soft-primary btn-sm"
                      aria-label="Edit"
                      onClick={() => {
                        setForm({
                          id: String(item.id),
                          name: item.name || "",
                          sort_order: String(item.sort_order ?? 0),
                          is_active: item.is_active ? "true" : "false",
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
                      aria-label="Delete"
                      onClick={() =>
                        setDeleteTarget({
                          id: item.id,
                          label: item.name || `#${item.id}`,
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
                  {!canUpdate && !canDelete ? "—" : null}
                </div>,
              ])}
              sortable
              emptyMessage={`No ${title.toLowerCase()} found.`}
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
        title={form.id ? `Update ${title.replace(/s$/, "")}` : `Add ${title.replace(/s$/, "")}`}
        saveLabel={form.id ? "Save" : "Create"}
        saving={saving}
        onCancel={() => {
          setModalOpen(false);
          setForm(emptyForm());
          setFormError("");
        }}
        onSubmit={handleSubmit}
      >
        <AlertMessage message={formError} variant="danger" />
        <div className="row g-3">
          <TextField
            label="Name"
            value={form.name}
            required
            onChange={(value) => setForm((current) => ({ ...current, name: value }))}
          />
          <TextField
            label="Sort order"
            value={form.sort_order}
            required
            onChange={(value) => setForm((current) => ({ ...current, sort_order: value }))}
          />
          <SelectField
            label="Active"
            value={form.is_active}
            onChange={(value) => setForm((current) => ({ ...current, is_active: value }))}
            options={[
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ]}
          />
        </div>
      </FormModal>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title={`Delete ${title.replace(/s$/, "")}`}
        message={deleteTarget ? `Delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete"
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

export default ManageLookupMasterPage;

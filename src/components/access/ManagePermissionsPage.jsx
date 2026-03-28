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
  createEmptyPermissionForm,
  formatDateTime,
  validateNamedSlugForm,
} from "./AccessShared.jsx";

function ManagePermissionsPage({ token, apiRequest }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [form, setForm] = useState(createEmptyPermissionForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);

  useEffect(() => {
    document.title = "Manage Permission | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    apiRequest(`/permissions?page=${page}&page_size=${pageSize}`, { token })
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
        setError(requestError.message || "Unable to load permissions.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiRequest, page, pageSize, refreshKey, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const validationError = validateNamedSlugForm(
      form.permission_name,
      form.slug,
      "Permission",
    );
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    const isEditing = Boolean(form.id);

    try {
      await apiRequest(form.id ? `/permissions/${form.id}` : "/permissions", {
        method: form.id ? "PATCH" : "POST",
        token,
        body: {
          permission_name: form.permission_name.trim(),
          slug: form.slug.trim(),
        },
      });
      setForm(createEmptyPermissionForm());
      setModalOpen(false);
      setPage(1);
      setRefreshKey((current) => current + 1);
      setSuccessModal({
        title: isEditing ? "Permission Updated" : "Permission Created",
        message: isEditing
          ? "Permission updated successfully."
          : "Permission created successfully.",
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save permission.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(permissionId) {
    try {
      await apiRequest(`/permissions/${permissionId}`, { method: "DELETE", token });
      setDeleteTarget(null);
      if (String(form.id) === String(permissionId)) {
        setForm(createEmptyPermissionForm());
      }
      if ((pageData?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete permission.");
    }
  }

  return (
    <>
      <AlertMessage message={error} variant="danger" />
      <ManageCard
        title="Manage Permission"
        subtitle="Create or update permission slugs used by the API."
        actionLabel="Add Permission"
        onAction={() => {
          setForm(createEmptyPermissionForm());
          setFormError("");
          setModalOpen(true);
        }}
      >
        {loading ? (
          <CardLoader message="Loading permissions..." />
        ) : (
          <>
            <SimpleTable
              columns={["ID", "Permission", "Slug", "Created", "Actions"]}
              rows={(pageData?.items || []).map((item) => [
                `#${item.id}`,
                item.permission_name,
                item.slug,
              formatDateTime(item.created_at),
              <div key={`permission-actions-${item.id}`} className="ta-table-actions">
                <button
                  type="button"
                  className="btn btn-icon btn-soft-primary btn-sm"
                  aria-label="Edit permission"
                  onClick={() => {
                    setForm({
                      id: String(item.id),
                      permission_name: item.permission_name,
                      slug: item.slug,
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
                <button
                  type="button"
                  className="btn btn-icon btn-soft-danger btn-sm"
                  aria-label="Delete permission"
                  onClick={() =>
                    setDeleteTarget({
                      id: item.id,
                      label: item.permission_name,
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
              </div>,
              ])}
              emptyMessage="No permissions found."
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
        title={form.id ? "Update Permission" : "Add Permission"}
        saveLabel={form.id ? "Update Permission" : "Create Permission"}
        saving={saving}
        onCancel={() => {
          setModalOpen(false);
          setForm(createEmptyPermissionForm());
          setFormError("");
        }}
        onSubmit={handleSubmit}
      >
        <AlertMessage message={formError} variant="danger" />
        <div className="row g-3">
          <TextField
            label="Permission Name"
            value={form.permission_name}
            required
            onChange={(value) =>
              setForm((current) => ({ ...current, permission_name: value }))
            }
          />
          <TextField
            label="Slug"
            value={form.slug}
            required
            onChange={(value) => setForm((current) => ({ ...current, slug: value }))}
          />
        </div>
      </FormModal>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Permission"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete Permission"
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

export default ManagePermissionsPage;

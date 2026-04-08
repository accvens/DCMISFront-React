import { useEffect, useState } from "react";
import {
  AlertMessage,
  CardLoader,
  CheckboxMultiField,
  ConfirmDeleteModal,
  FormModal,
  getPermissionGroups,
  ManageCard,
  PaginationBar,
  SimpleTable,
  SuccessModal,
  TextField,
  createEmptyRoleForm,
  formatDateTime,
  validateNamedSlugForm,
} from "./AccessShared.jsx";

function ManageRolesPage({ token, apiRequest }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [permissionOptions, setPermissionOptions] = useState([]);
  const [form, setForm] = useState(createEmptyRoleForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);

  useEffect(() => {
    document.title = "Manage Role | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([
      apiRequest(`/roles?page=${page}&page_size=${pageSize}`, { token }),
      apiRequest("/permissions?page=1&page_size=100", { token }),
    ])
      .then(([rolesResponse, permissionsResponse]) => {
        if (!active) return;
        setPageData(rolesResponse);
        setPermissionOptions(permissionsResponse?.items || []);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message || "Unable to load roles.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiRequest, page, pageSize, refreshKey, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const validationError = validateNamedSlugForm(form.role_name, form.slug, "Role");
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    const isEditing = Boolean(form.id);

    try {
      const rolePayload = {
        role_name: form.role_name.trim(),
        slug: form.slug.trim(),
      };
      const roleResponse = await apiRequest(form.id ? `/roles/${form.id}` : "/roles", {
        method: form.id ? "PATCH" : "POST",
        token,
        body: rolePayload,
      });
      const roleId = roleResponse?.id != null ? Number(roleResponse.id) || roleResponse.id : (form.id ? Number(form.id) || form.id : null);
      let permissionsOk = true;
      let permissionError = "";
      if (roleId != null && roleId !== "") {
        const permissionIds = [...new Set((form.permission_ids || []).map((id) => Number(id)).filter((n) => !Number.isNaN(n)))];
        try {
          await apiRequest(`/roles/${roleId}/permissions`, {
            method: "PATCH",
            token,
            body: { permission_ids: permissionIds },
          });
        } catch (permErr) {
          permissionError = permErr?.message || "Permissions update failed";
          permissionsOk = false;
        }
      }
      setForm(createEmptyRoleForm());
      setModalOpen(false);
      setPage(1);
      setRefreshKey((current) => current + 1);
      if (permissionError) {
        setError(permissionError);
      } else {
        setError("");
      }
      setSuccessModal({
        title: isEditing ? "Role Updated" : "Role Created",
        message:
          (isEditing ? "Role updated successfully." : "Role created successfully.") +
          (permissionsOk
            ? ""
            : ` Permissions could not be updated${permissionError ? `: ${permissionError}` : ""} — edit the role to set them again.`),
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save role.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(roleId) {
    try {
      await apiRequest(`/roles/${roleId}`, { method: "DELETE", token });
      setDeleteTarget(null);
      if (String(form.id) === String(roleId)) {
        setForm(createEmptyRoleForm());
      }
      if ((pageData?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete role.");
    }
  }
  function toggleGroupPermissions(groupPermissionIds, selectAll) {
    const cleanedIds = (groupPermissionIds || [])
      .map((id) => Number(id))
      .filter((n) => !Number.isNaN(n));

    setForm((current) => {
      const currentIds = new Set(
        (current.permission_ids || [])
          .map((id) => Number(id))
          .filter((n) => !Number.isNaN(n)),
      );

      if (selectAll) {
        for (const id of cleanedIds) {
          currentIds.add(id);
        }
      } else {
        for (const id of cleanedIds) {
          currentIds.delete(id);
        }
      }

      return {
        ...current,
        permission_ids: Array.from(currentIds),
      };
    });
  }

  return (
    <>
      <AlertMessage message={error} variant="danger" />
      <ManageCard
        title="Manage Role"
        subtitle="Create or update application roles."
        actionLabel="Add Role"
        onAction={() => {
          setForm(createEmptyRoleForm());
          setFormError("");
          setError("");
          setModalOpen(true);
        }}
      >
        {loading ? (
          <CardLoader message="Loading roles..." />
        ) : (
          <>
            <SimpleTable
              columns={["ID", "Role", "Slug", "Created", "Actions"]}
              rows={(pageData?.items || []).map((item) => [
                `#${item.id}`,
                item.role_name,
                item.slug,
                formatDateTime(item.created_at),
                <div key={`role-actions-${item.id}`} className="ta-table-actions">
                  <button
                    type="button"
                    className="btn btn-icon btn-soft-primary btn-sm"
                    aria-label="Edit role"
                    onClick={() => {
                      setForm({
                        id: String(item.id),
                        role_name: item.role_name,
                        slug: item.slug,
                        permission_ids: (item.permissions || []).map((p) => Number(p.id)),
                      });
                      setFormError("");
                      setError("");
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
                    aria-label="Delete role"
                    onClick={() =>
                      setDeleteTarget({
                        id: item.id,
                        label: item.role_name,
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
              sortable
              emptyMessage="No roles found."
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
        title={form.id ? "Update Role" : "Add Role"}
        saveLabel={form.id ? "Update Role" : "Create Role"}
        saving={saving}
        scrollableBody
        onCancel={() => {
          setModalOpen(false);
          setForm(createEmptyRoleForm());
          setFormError("");
        }}
        onSubmit={handleSubmit}
      >
        <AlertMessage message={formError} variant="danger" />
        <div className="row g-3">
          <TextField
            label="Role Name"
            value={form.role_name}
            required
            onChange={(value) => setForm((current) => ({ ...current, role_name: value }))}
          />
          <TextField
            label="Slug"
            value={form.slug}
            required
            onChange={(value) => setForm((current) => ({ ...current, slug: value }))}
          />
          {permissionOptions.length > 0 ? (
            <div className="col-12">
              <label className="form-label mb-2">Permissions</label>
              <div className="ta-permission-groups">
                {getPermissionGroups(permissionOptions).map(({ groupLabel, permissions }) => (
                  <div key={groupLabel} className="ta-permission-group">
                    <div className="ta-permission-group-title d-flex justify-content-between align-items-center">
                      <span>{groupLabel}</span>
                      {(() => {
                        const selectedSet = new Set(
                          (form.permission_ids || [])
                            .map((id) => Number(id))
                            .filter((n) => !Number.isNaN(n)),
                        );
                        const groupIds = permissions
                          .map((p) => Number(p.id))
                          .filter((n) => !Number.isNaN(n));
                        const allSelected =
                          groupIds.length > 0 &&
                          groupIds.every((id) => selectedSet.has(id));

                        return (
                          <button
                            type="button"
                            className="btn btn-sm ta-permission-group-toggle-btn"
                            aria-label={allSelected ? "Unselect group" : "Select group"}
                            onClick={() => toggleGroupPermissions(groupIds, !allSelected)}
                          >
                            {allSelected ? (
                              <svg
                                viewBox="0 0 16 16"
                                aria-hidden="true"
                                className="ta-permission-group-icon"
                              >
                                <rect
                                  x="2"
                                  y="2"
                                  width="12"
                                  height="12"
                                  rx="2"
                                  ry="2"
                                ></rect>
                                <path d="M5 8h6" strokeWidth="1.6"></path>
                              </svg>
                            ) : (
                              <svg
                                viewBox="0 0 16 16"
                                aria-hidden="true"
                                className="ta-permission-group-icon"
                              >
                                <rect
                                  x="2"
                                  y="2"
                                  width="12"
                                  height="12"
                                  rx="2"
                                  ry="2"
                                ></rect>
                                <path d="M5 8h6M8 5v6" strokeWidth="1.6"></path>
                              </svg>
                            )}
                          </button>
                        );
                      })()}
                    </div>
                    <CheckboxMultiField
                      label=""
                      compact
                      options={permissions.map((p) => ({
                        value: Number(p.id),
                        label: p.permission_name,
                      }))}
                      selectedValues={(form.permission_ids || []).map(Number)}
                      onToggle={(id) => {
                        const numId = Number(id);
                        if (Number.isNaN(numId)) return;
                        setForm((current) => {
                          const ids = (current.permission_ids || []).map(Number);
                          const next = ids.includes(numId) ? ids.filter((x) => x !== numId) : [...ids, numId];
                          return { ...current, permission_ids: next };
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="col-12">
              <label className="form-label">Permissions</label>
              <p className="ta-card-muted mb-0 small">No permissions available. Add permissions in Manage Permission first.</p>
            </div>
          )}
        </div>
      </FormModal>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Role"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete Role"
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

export default ManageRolesPage;

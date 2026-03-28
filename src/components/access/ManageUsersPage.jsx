import { useEffect, useState } from "react";
import {
  AlertMessage,
  CardLoader,
  CheckboxMultiField,
  ConfirmDeleteModal,
  FileField,
  FormModal,
  ManageCard,
  PaginationBar,
  SelectField,
  SimpleTable,
  SuccessModal,
  TextField,
  createEmptyUserForm,
  formatDateTime,
  validateUserForm,
} from "./AccessShared.jsx";

function ManageUsersPage({ token, apiRequest }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [roleOptions, setRoleOptions] = useState([]);
  const [form, setForm] = useState(createEmptyUserForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);

  useEffect(() => {
    document.title = "Manage User | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([
      apiRequest(`/users?page=${page}&page_size=${pageSize}`, { token }),
      apiRequest("/roles?page=1&page_size=100", { token }),
    ])
      .then(([usersPage, rolesResponse]) => {
        if (!active) {
          return;
        }
        setPageData(usersPage);
        setRoleOptions(rolesResponse.items || []);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setError(requestError.message || "Unable to load users.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiRequest, page, pageSize, refreshKey, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const validationError = validateUserForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    const isEditing = Boolean(form.id);

    try {
      const formData = new FormData();
      formData.append("name", form.name.trim());
      formData.append("email", form.email.trim());
      formData.append("contact", form.contact.trim() || "");
      formData.append("gender", form.gender || "");
      if (!form.id || form.password) {
        formData.append("password", form.password);
      }
      form.role_ids.forEach((roleId) => {
        formData.append("role_ids", roleId);
      });
      if (form.image_file) {
        formData.append("image", form.image_file, form.image_file.name || "avatar.png");
      }

      await apiRequest(form.id ? `/users/${form.id}` : "/users", {
        method: form.id ? "PATCH" : "POST",
        token,
        body: formData,
      });

      setForm(createEmptyUserForm());
      setModalOpen(false);
      setPage(1);
      setRefreshKey((current) => current + 1);
      setSuccessModal({
        title: isEditing ? "User Updated" : "User Created",
        message: isEditing ? "User updated successfully." : "User created successfully.",
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save user.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(userId) {
    try {
      await apiRequest(`/users/${userId}`, { method: "DELETE", token });
      setDeleteTarget(null);
      if ((pageData?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete user.");
    }
  }

  function toggleRoleSelection(roleId) {
    setForm((current) => ({
      ...current,
      role_ids: current.role_ids.includes(roleId)
        ? current.role_ids.filter((value) => value !== roleId)
        : [...current.role_ids, roleId],
    }));
  }

  return (
    <>
      <AlertMessage message={error} variant="danger" />
      <ManageCard
        title="Manage User"
        subtitle="Create system users and assign one or more roles."
        actionLabel="Add User"
        onAction={() => {
          setForm(createEmptyUserForm());
          setFormError("");
          setModalOpen(true);
        }}
      >
        {loading ? (
          <CardLoader message="Loading users..." />
        ) : (
          <>
            <SimpleTable
              columns={["ID", "Name", "Email", "Contact", "Roles", "Created", "Actions"]}
              rows={(pageData?.items || []).map((item) => [
                `#${item.id}`,
                item.name,
                item.email,
                item.contact || "-",
                item.roles?.length ? item.roles.join(", ") : "-",
                formatDateTime(item.created_at),
                <div key={`user-actions-${item.id}`} className="ta-table-actions">
                  <button
                    type="button"
                    className="btn btn-icon btn-soft-primary btn-sm"
                    aria-label="Edit user"
                    onClick={() => {
                      const selectedRoleIds = (item.roles || [])
                        .map((roleName) =>
                          roleOptions.find((role) => role.role_name === roleName),
                        )
                        .filter(Boolean)
                        .map((role) => String(role.id));

                      setForm({
                        id: String(item.id),
                        name: item.name || "",
                        email: item.email || "",
                        contact: item.contact || "",
                        gender: item.gender || "",
                        password: "",
                        role_ids: selectedRoleIds,
                        image_file: null,
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
                    aria-label="Delete user"
                    onClick={() =>
                      setDeleteTarget({
                        id: item.id,
                        label: item.name,
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
              emptyMessage="No users found."
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
        title={form.id ? "Update User" : "Add User"}
        saveLabel={form.id ? "Update User" : "Create User"}
        saving={saving}
        size="modal-lg"
        onCancel={() => {
          setModalOpen(false);
          setForm(createEmptyUserForm());
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
            label="Email"
            type="email"
            value={form.email}
            required
            onChange={(value) => setForm((current) => ({ ...current, email: value }))}
          />
          <TextField
            label="Contact"
            value={form.contact}
            onChange={(value) => setForm((current) => ({ ...current, contact: value }))}
          />
          <SelectField
            label="Gender"
            value={form.gender}
            required
            onChange={(value) => setForm((current) => ({ ...current, gender: value }))}
            options={[
              { value: "", label: "Select gender" },
              { value: "Male", label: "Male" },
              { value: "Female", label: "Female" },
              { value: "Other", label: "Other" },
            ]}
          />
          <TextField
            label="Password"
            type="password"
            value={form.password}
            required={!form.id}
            onChange={(value) => setForm((current) => ({ ...current, password: value }))}
          />
          <FileField
            label="Avatar Image"
            onChange={(file) => setForm((current) => ({ ...current, image_file: file }))}
          />
          <CheckboxMultiField
            label="Assign Roles"
            options={roleOptions.map((role) => ({
              value: String(role.id),
              label: role.role_name,
            }))}
            selectedValues={form.role_ids}
            onToggle={toggleRoleSelection}
          />
        </div>
      </FormModal>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete User"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete User"
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

export default ManageUsersPage;

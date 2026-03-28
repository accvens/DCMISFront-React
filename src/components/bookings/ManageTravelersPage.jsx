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

function createEmptyTravelerForm() {
  return {
    id: "",
    customer_id: "",
    first_name: "",
    last_name: "",
    gender: "",
    dob: "",
    nationality: "",
    contact_number: "",
    email: "",
    traveler_type: "",
  };
}

function validateTravelerForm(form) {
  if (!form.customer_id) {
    return "Customer is required.";
  }

  if (!String(form.first_name || "").trim()) {
    return "First name is required.";
  }

  if (!form.gender) {
    return "Gender is required.";
  }

  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "Enter a valid email address.";
  }

  return "";
}

function ManageTravelersPage({ token, apiRequest, canCreate, canUpdate, canDelete }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(createEmptyTravelerForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);

  useEffect(() => {
    document.title = "Manage Traveler | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([
      apiRequest(`/travelers?page=${page}&page_size=${pageSize}`, { token }),
      apiRequest("/customers?page=1&page_size=100", { token }),
    ])
      .then(([travelersResponse, customersResponse]) => {
        if (!active) {
          return;
        }
        setPageData(travelersResponse);
        setCustomers(customersResponse.items || []);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setError(requestError.message || "Unable to load travelers.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiRequest, page, pageSize, refreshKey, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const validationError = validateTravelerForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    const isEditing = Boolean(form.id);

    try {
      await apiRequest(form.id ? `/travelers/${form.id}` : "/travelers", {
        method: form.id ? "PATCH" : "POST",
        token,
        body: {
          customer_id: Number(form.customer_id),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || null,
          gender: form.gender || null,
          dob: form.dob || null,
          nationality: form.nationality.trim() || null,
          contact_number: form.contact_number.trim() || null,
          email: form.email.trim() || null,
          traveler_type: form.traveler_type.trim() || null,
        },
      });
      setForm(createEmptyTravelerForm());
      setModalOpen(false);
      setPage(1);
      setRefreshKey((current) => current + 1);
      setSuccessModal({
        title: isEditing ? "Traveler Updated" : "Traveler Created",
        message: isEditing ? "Traveler updated successfully." : "Traveler created successfully.",
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save traveler.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(travelerId) {
    try {
      await apiRequest(`/travelers/${travelerId}`, { method: "DELETE", token });
      setDeleteTarget(null);
      if ((pageData?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete traveler.");
    }
  }

  return (
    <>
      <AlertMessage message={error} variant="danger" />
      <ManageCard
        title="Manage Traveler"
        subtitle="Create and maintain traveler records linked to customers."
        actionLabel={canCreate ? "Add Traveler" : undefined}
        onAction={
          canCreate
            ? () => {
                setForm({
                  ...createEmptyTravelerForm(),
                  customer_id: customers[0] ? String(customers[0].id) : "",
                });
                setFormError("");
                setModalOpen(true);
              }
            : undefined
        }
      >
        {loading ? (
          <CardLoader message="Loading travelers..." />
        ) : (
          <>
            <SimpleTable
              columns={["ID", "Traveler", "Customer", "Type", "Email", "Created", "Actions"]}
              rows={(pageData?.items || []).map((item) => [
                `#${item.id}`,
                `${item.first_name} ${item.last_name || ""}`.trim(),
                (() => {
                  const c = customers.find((customer) => String(customer.id) === String(item.customer_id));
                  return c ? [c.first_name, c.last_name].filter(Boolean).join(" ") || c.customer_id : null;
                })() || `Customer #${item.customer_id}`,
                item.traveler_type || "-",
                item.email || "-",
                formatDateTime(item.created_at),
                <div key={`traveler-actions-${item.id}`} className="ta-table-actions">
                  {canUpdate ? (
                    <button
                      type="button"
                      className="btn btn-icon btn-soft-primary btn-sm"
                      aria-label="Edit traveler"
                      onClick={() => {
                        setForm({
                          id: String(item.id),
                          customer_id: String(item.customer_id || ""),
                          first_name: item.first_name || "",
                          last_name: item.last_name || "",
                          gender: item.gender || "",
                          dob: item.dob || "",
                          nationality: item.nationality || "",
                          contact_number: item.contact_number || "",
                          email: item.email || "",
                          traveler_type: item.traveler_type || "",
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
                      aria-label="Delete traveler"
                      onClick={() =>
                        setDeleteTarget({
                          id: item.id,
                          label: `${item.first_name} ${item.last_name || ""}`.trim(),
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
              emptyMessage="No travelers found."
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
        title={form.id ? "Update Traveler" : "Add Traveler"}
        saveLabel={form.id ? "Update Traveler" : "Create Traveler"}
        saving={saving}
        size="modal-lg"
        onCancel={() => {
          setModalOpen(false);
          setForm(createEmptyTravelerForm());
          setFormError("");
        }}
        onSubmit={handleSubmit}
      >
        <AlertMessage message={formError} variant="danger" />
        <div className="row g-3">
          <SelectField
            label="Customer"
            value={form.customer_id}
            required
            onChange={(value) => setForm((current) => ({ ...current, customer_id: value }))}
            options={customers.map((item) => ({
              value: String(item.id),
              label: [item.first_name, item.last_name].filter(Boolean).join(" ") || item.customer_id || item.email || "Customer",
            }))}
          />
          <TextField
            label="First Name"
            value={form.first_name}
            required
            onChange={(value) => setForm((current) => ({ ...current, first_name: value }))}
          />
          <TextField
            label="Last Name"
            value={form.last_name}
            onChange={(value) => setForm((current) => ({ ...current, last_name: value }))}
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
            label="Date of Birth"
            type="date"
            value={form.dob}
            onChange={(value) => setForm((current) => ({ ...current, dob: value }))}
          />
          <TextField
            label="Nationality"
            value={form.nationality}
            onChange={(value) => setForm((current) => ({ ...current, nationality: value }))}
          />
          <TextField
            label="Contact Number"
            value={form.contact_number}
            onChange={(value) => setForm((current) => ({ ...current, contact_number: value }))}
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => setForm((current) => ({ ...current, email: value }))}
          />
          <TextField
            label="Traveler Type"
            value={form.traveler_type}
            onChange={(value) => setForm((current) => ({ ...current, traveler_type: value }))}
          />
        </div>
      </FormModal>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Traveler"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete Traveler"
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

export default ManageTravelersPage;

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
  formatDateTime,
} from "../access/AccessShared.jsx";

function createEmptyVisaForm() {
  return {
    id: "",
    traveler_id: "",
    country: "",
    visa_type: "",
    visa_number: "",
    issue_date: "",
    expiry_date: "",
    status: "",
  };
}

function validateVisaForm(form) {
  if (!form.traveler_id) {
    return "Traveler is required.";
  }
  return "";
}

function ManageVisaDetailsPage({ token, apiRequest, canCreate, canUpdate, canDelete }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [travelers, setTravelers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(createEmptyVisaForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);

  useEffect(() => {
    document.title = "Visa Details | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([
      apiRequest(`/visas?page=${page}&page_size=${pageSize}`, { token }),
      // Backend pagination validates page_size <= 100
      apiRequest("/travelers?page=1&page_size=100", { token }),
      apiRequest("/customers?page=1&page_size=100", { token }),
    ])
      .then(([visasResponse, travelersResponse, customersResponse]) => {
        if (!active) return;
        setPageData(visasResponse);
        setTravelers(travelersResponse.items || []);
        setCustomers(customersResponse.items || []);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message || "Unable to load visa details.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiRequest, page, pageSize, refreshKey, token]);

  const travelerOptions = useMemo(() => {
    const customerById = new Map(customers.map((c) => [String(c.id), c]));
    return travelers.map((t) => {
      const customer = customerById.get(String(t.customer_id));
      const customerLabel = customer
        ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.customer_id
        : `Customer #${t.customer_id}`;
      return {
        value: String(t.id),
        label: `${[t.first_name, t.last_name].filter(Boolean).join(" ") || `Traveler #${t.id}`} — ${customerLabel}`,
      };
    });
  }, [customers, travelers]);

  function resolveTravelerLabel(travelerId) {
    const t = travelers.find((item) => String(item.id) === String(travelerId));
    if (!t) return `Traveler #${travelerId}`;
    return [t.first_name, t.last_name].filter(Boolean).join(" ") || `Traveler #${travelerId}`;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const validationError = validateVisaForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    const isEditing = Boolean(form.id);

    try {
      await apiRequest(form.id ? `/visas/${form.id}` : "/visas", {
        method: form.id ? "PATCH" : "POST",
        token,
        body: {
          traveler_id: Number(form.traveler_id),
          country: form.country.trim() || null,
          visa_type: form.visa_type.trim() || null,
          visa_number: form.visa_number.trim() || null,
          issue_date: form.issue_date || null,
          expiry_date: form.expiry_date || null,
          status: form.status.trim() || null,
        },
      });
      setForm(createEmptyVisaForm());
      setModalOpen(false);
      setPage(1);
      setRefreshKey((current) => current + 1);
      setSuccessModal({
        title: isEditing ? "Visa Updated" : "Visa Created",
        message: isEditing ? "Visa updated successfully." : "Visa created successfully.",
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save visa.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(visaId) {
    try {
      await apiRequest(`/visas/${visaId}`, { method: "DELETE", token });
      setDeleteTarget(null);
      if ((pageData?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete visa.");
    }
  }

  return (
    <>
      <AlertMessage message={error} variant="danger" />
      <ManageCard
        title="Visa Details"
        subtitle="Create and maintain visa details linked to travelers."
        actionLabel={canCreate ? "Add Visa" : undefined}
        onAction={
          canCreate
            ? () => {
                setForm({
                  ...createEmptyVisaForm(),
                  traveler_id: travelerOptions[0]?.value || "",
                });
                setFormError("");
                setModalOpen(true);
              }
            : undefined
        }
      >
        {loading ? (
          <CardLoader message="Loading visa details..." />
        ) : (
          <>
            <SimpleTable
              columns={["ID", "Traveler", "Country", "Type", "Visa No", "Issue", "Expiry", "Status", "Created", "Actions"]}
              rows={(pageData?.items || []).map((item) => [
                `#${item.id}`,
                resolveTravelerLabel(item.traveler_id),
                item.country || "-",
                item.visa_type || "-",
                item.visa_number || "-",
                item.issue_date || "-",
                item.expiry_date || "-",
                item.status || "-",
                formatDateTime(item.created_at),
                <div key={`visa-actions-${item.id}`} className="ta-table-actions">
                  {canUpdate ? (
                    <button
                      type="button"
                      className="btn btn-icon btn-soft-primary btn-sm"
                      aria-label="Edit visa"
                      onClick={() => {
                        setForm({
                          id: String(item.id),
                          traveler_id: String(item.traveler_id || ""),
                          country: item.country || "",
                          visa_type: item.visa_type || "",
                          visa_number: item.visa_number || "",
                          issue_date: item.issue_date || "",
                          expiry_date: item.expiry_date || "",
                          status: item.status || "",
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
                      aria-label="Delete visa"
                      onClick={() =>
                        setDeleteTarget({
                          id: item.id,
                          label: item.visa_number || `Visa #${item.id}`,
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
              emptyMessage="No visa details found."
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
        title={form.id ? "Update Visa" : "Add Visa"}
        saveLabel={form.id ? "Update Visa" : "Create Visa"}
        saving={saving}
        size="modal-lg"
        onCancel={() => {
          setModalOpen(false);
          setForm(createEmptyVisaForm());
          setFormError("");
        }}
        onSubmit={handleSubmit}
      >
        <AlertMessage message={formError} variant="danger" />
        <div className="row g-3">
          <SelectField
            label="Traveler"
            value={form.traveler_id}
            required
            onChange={(value) => setForm((current) => ({ ...current, traveler_id: value }))}
            options={travelerOptions}
          />
          <TextField
            label="Country"
            value={form.country}
            onChange={(value) => setForm((current) => ({ ...current, country: value }))}
          />
          <TextField
            label="Visa Type"
            value={form.visa_type}
            onChange={(value) => setForm((current) => ({ ...current, visa_type: value }))}
          />
          <TextField
            label="Visa Number"
            value={form.visa_number}
            onChange={(value) => setForm((current) => ({ ...current, visa_number: value }))}
          />
          <TextField
            label="Issue Date"
            type="date"
            value={form.issue_date}
            onChange={(value) => setForm((current) => ({ ...current, issue_date: value }))}
          />
          <TextField
            label="Expiry Date"
            type="date"
            value={form.expiry_date}
            onChange={(value) => setForm((current) => ({ ...current, expiry_date: value }))}
          />
          <TextField
            label="Status"
            value={form.status}
            onChange={(value) => setForm((current) => ({ ...current, status: value }))}
          />
        </div>
      </FormModal>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Visa"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete Visa"
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

export default ManageVisaDetailsPage;

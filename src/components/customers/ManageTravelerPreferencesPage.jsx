import { useEffect, useState } from "react";
import {
  AlertMessage,
  CardLoader,
  ConfirmDeleteModal,
  FormModal,
  ListSearchInput,
  ManageCard,
  PaginationBar,
  SimpleTable,
  SuccessModal,
  TextField,
  formatDateTime,
  useDebouncedValue,
} from "../access/AccessShared.jsx";
import { buildPagedSearchUrl, CustomerAutocomplete } from "./CustomersShared.jsx";

function createEmptyPreferenceForm() {
  return {
    id: "",
    customer_id: "",
    meal_preference: "",
    seat_preference: "",
    hotel_category: "",
    special_request: "",
  };
}

function validatePreferenceForm(form) {
  if (!form.customer_id) {
    return "Customer is required.";
  }
  return "";
}

function ManageTravelerPreferencesPage({ token, apiRequest, canCreate, canUpdate, canDelete }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(createEmptyPreferenceForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 400);

  useEffect(() => {
    document.title = "Traveler Preferences | Travel Agency";
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([
      apiRequest(buildPagedSearchUrl("/travel-preferences", page, pageSize, debouncedSearch), { token }),
      // Backend pagination validates page_size <= 100
      apiRequest("/customers?page=1&page_size=100", { token }),
    ])
      .then(([prefsResponse, customersResponse]) => {
        if (!active) return;
        setPageData(prefsResponse);
        setCustomers(customersResponse.items || []);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message || "Unable to load traveler preferences.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiRequest, page, pageSize, debouncedSearch, refreshKey, token]);

  function resolveCustomerLabel(customerId) {
    const c = customers.find((item) => String(item.id) === String(customerId));
    if (!c) return `Customer #${customerId}`;
    return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.customer_id || `Customer #${customerId}`;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const validationError = validatePreferenceForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    const isEditing = Boolean(form.id);

    try {
      await apiRequest(form.id ? `/travel-preferences/${form.id}` : "/travel-preferences", {
        method: form.id ? "PATCH" : "POST",
        token,
        body: {
          customer_id: Number(form.customer_id),
          meal_preference: form.meal_preference.trim() || null,
          seat_preference: form.seat_preference.trim() || null,
          hotel_category: form.hotel_category.trim() || null,
          special_request: form.special_request.trim() || null,
        },
      });
      setForm(createEmptyPreferenceForm());
      setModalOpen(false);
      setPage(1);
      setRefreshKey((current) => current + 1);
      setSuccessModal({
        title: isEditing ? "Preferences Updated" : "Preferences Created",
        message: isEditing ? "Preferences updated successfully." : "Preferences created successfully.",
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save preferences.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(preferenceId) {
    try {
      await apiRequest(`/travel-preferences/${preferenceId}`, { method: "DELETE", token });
      setDeleteTarget(null);
      if ((pageData?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete preferences.");
    }
  }

  return (
    <>
      <AlertMessage message={error} variant="danger" />
      <ManageCard
        title="Traveler Preferences"
        subtitle="Store travel preference settings linked to customers."
        toolbarExtra={
          <ListSearchInput
            id="travel-preferences-list-search"
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search customer, meal, seat, hotel, special request..."
          />
        }
        actionLabel={canCreate ? "Add Preference" : undefined}
        onAction={
          canCreate
            ? () => {
                setForm(createEmptyPreferenceForm());
                setFormError("");
                setModalOpen(true);
              }
            : undefined
        }
      >
        {loading ? (
          <CardLoader message="Loading preferences..." />
        ) : (
          <>
            <SimpleTable
              columns={["ID", "Customer", "Meal", "Seat", "Hotel", "Special Request", "Created", "Actions"]}
              rows={(pageData?.items || []).map((item) => [
                `#${item.id}`,
                resolveCustomerLabel(item.customer_id),
                item.meal_preference || "-",
                item.seat_preference || "-",
                item.hotel_category || "-",
                item.special_request || "-",
                formatDateTime(item.created_at),
                <div key={`pref-actions-${item.id}`} className="ta-table-actions">
                  {canUpdate ? (
                    <button
                      type="button"
                      className="btn btn-icon btn-soft-primary btn-sm"
                      aria-label="Edit preferences"
                      onClick={() => {
                        setForm({
                          id: String(item.id),
                          customer_id: String(item.customer_id || ""),
                          meal_preference: item.meal_preference || "",
                          seat_preference: item.seat_preference || "",
                          hotel_category: item.hotel_category || "",
                          special_request: item.special_request || "",
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
                      aria-label="Delete preferences"
                      onClick={() =>
                        setDeleteTarget({
                          id: item.id,
                          label: `Preference #${item.id}`,
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
              emptyMessage="No preferences found."
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
        title={form.id ? "Update Preferences" : "Add Preferences"}
        saveLabel={form.id ? "Update Preferences" : "Create Preferences"}
        saving={saving}
        size="modal-lg"
        onCancel={() => {
          setModalOpen(false);
          setForm(createEmptyPreferenceForm());
          setFormError("");
        }}
        onSubmit={handleSubmit}
      >
        <AlertMessage message={formError} variant="danger" />
        <div className="row g-3">
          <CustomerAutocomplete
            label="Customer"
            value={form.customer_id}
            required
            onChange={(value) => setForm((current) => ({ ...current, customer_id: value }))}
            apiRequest={apiRequest}
            token={token}
          />
          <TextField
            label="Meal Preference"
            value={form.meal_preference}
            onChange={(value) => setForm((current) => ({ ...current, meal_preference: value }))}
          />
          <TextField
            label="Seat Preference"
            value={form.seat_preference}
            onChange={(value) => setForm((current) => ({ ...current, seat_preference: value }))}
          />
          <TextField
            label="Hotel Category"
            value={form.hotel_category}
            onChange={(value) => setForm((current) => ({ ...current, hotel_category: value }))}
          />
          <div className="col-12">
            <label className="form-label">Special Request</label>
            <textarea
              className="form-control"
              rows="3"
              value={form.special_request}
              onChange={(event) =>
                setForm((current) => ({ ...current, special_request: event.target.value }))
              }
            />
          </div>
        </div>
      </FormModal>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Preferences"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete Preferences"
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

export default ManageTravelerPreferencesPage;


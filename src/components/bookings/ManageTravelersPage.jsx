import { useEffect, useMemo, useState } from "react";
import {
  AlertMessage,
  AutocompleteField,
  CardLoader,
  ConfirmDeleteModal,
  FormModal,
  ListSearchInput,
  ManageCard,
  PaginationBar,
  SelectField,
  SimpleTable,
  SuccessModal,
  TextField,
  formatDateTime,
  useDebouncedValue,
} from "../access/AccessShared.jsx";
import { buildPagedSearchUrl, CustomerAutocomplete } from "../customers/CustomersShared.jsx";

function createEmptyTravelerForm() {
  return {
    id: "",
    customer_id: "",
    first_name: "",
    last_name: "",
    gender: "",
    dob: "",
    nationality_country_id: "",
    contact_number: "",
    email: "",
    traveler_type_id: "",
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
  const [pageSize, setPageSize] = useState(100);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [form, setForm] = useState(createEmptyTravelerForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);
  const [countries, setCountries] = useState([]);
  const [travelerTypes, setTravelerTypes] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 400);

  const countryOptions = useMemo(
    () => [
      { value: "", label: "—" },
      ...countries.map((c) => ({ value: String(c.id), label: c.name || `Country #${c.id}` })),
    ],
    [countries],
  );

  const travelerTypeOptions = useMemo(
    () => [
      { value: "", label: "—" },
      ...travelerTypes.map((t) => ({ value: String(t.id), label: t.name || `Type #${t.id}` })),
    ],
    [travelerTypes],
  );

  useEffect(() => {
    document.title = "Manage Traveler | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest("/masters/countries/options", { token }),
      apiRequest("/masters/traveler-types/options", { token }),
    ])
      .then(([co, tt]) => {
        if (!active) {
          return;
        }
        setCountries(Array.isArray(co) ? co : []);
        setTravelerTypes(Array.isArray(tt) ? tt : []);
      })
      .catch(() => {
        if (active) {
          setCountries([]);
          setTravelerTypes([]);
        }
      });
    return () => {
      active = false;
    };
  }, [apiRequest, token]);

  useEffect(() => {
    setPage(1);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    apiRequest(buildPagedSearchUrl("/travelers", page, pageSize, debouncedSearch), { token })
      .then((travelersResponse) => {
        if (!active) {
          return;
        }
        setPageData(travelersResponse);
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
  }, [apiRequest, page, pageSize, debouncedSearch, refreshKey, token]);

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
          nationality_country_id: form.nationality_country_id ? Number(form.nationality_country_id) : null,
          contact_number: form.contact_number.trim() || null,
          email: form.email.trim() || null,
          traveler_type_id: form.traveler_type_id ? Number(form.traveler_type_id) : null,
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
        toolbarExtra={
          <ListSearchInput
            id="travelers-list-search"
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search name, email, phone, nationality, traveler type..."
          />
        }
        actionLabel={canCreate ? "Add Traveler" : undefined}
        onAction={
          canCreate
            ? () => {
                setForm(createEmptyTravelerForm());
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
                [item.customer_first_name, item.customer_last_name].filter(Boolean).join(" ").trim() ||
                  item.customer_ref ||
                  `Customer #${item.customer_id}`,
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
                          nationality_country_id:
                            item.nationality_country_id != null ? String(item.nationality_country_id) : "",
                          contact_number: item.contact_number || "",
                          email: item.email || "",
                          traveler_type_id:
                            item.traveler_type_id != null ? String(item.traveler_type_id) : "",
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
              sortable
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
          <CustomerAutocomplete
            label="Customer"
            value={form.customer_id}
            required
            onChange={(value) => setForm((current) => ({ ...current, customer_id: value }))}
            apiRequest={apiRequest}
            token={token}
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
          <AutocompleteField
            label="Nationality (country)"
            value={form.nationality_country_id}
            placeholder="Type to search countries…"
            onChange={(value) => setForm((current) => ({ ...current, nationality_country_id: value }))}
            options={countryOptions}
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
          <AutocompleteField
            label="Traveler Type"
            value={form.traveler_type_id}
            placeholder="Type to search types…"
            onChange={(value) => setForm((current) => ({ ...current, traveler_type_id: value }))}
            options={travelerTypeOptions}
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

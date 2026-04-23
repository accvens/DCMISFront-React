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
  SimpleTable,
  SuccessModal,
  TextField,
  formatDateTime,
  useDebouncedValue,
} from "../access/AccessShared.jsx";
import {
  buildPagedSearchUrl,
  CustomerAutocomplete,
  TravelerAutocomplete,
} from "./CustomersShared.jsx";

function createEmptyPassportForm() {
  return {
    id: "",
    customer_id: "",
    traveler_id: "",
    passport_number: "",
    issue_country_id: "",
    issue_date: "",
    expiry_date: "",
    place_of_issue: "",
  };
}

function validatePassportForm(form) {
  if (!form.traveler_id) {
    return "Traveler is required.";
  }
  if (!String(form.passport_number || "").trim()) {
    return "Passport number is required.";
  }
  return "";
}

function ManagePassportDetailsPage({ token, apiRequest, canCreate, canUpdate, canDelete }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [travelers, setTravelers] = useState([]);
  const [form, setForm] = useState(createEmptyPassportForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);
  const [countries, setCountries] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 400);

  const countryOptions = useMemo(
    () => [
      { value: "", label: "—" },
      ...countries.map((c) => ({ value: String(c.id), label: c.name || `Country #${c.id}` })),
    ],
    [countries],
  );

  useEffect(() => {
    document.title = "Passport Details | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    apiRequest("/masters/countries/options", { token })
      .then((data) => {
        if (!active) {
          return;
        }
        setCountries(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) {
          setCountries([]);
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

    Promise.all([
      apiRequest(buildPagedSearchUrl("/passports", page, pageSize, debouncedSearch), { token }),
      // Backend pagination validates page_size <= 500
      apiRequest("/travelers?page=1&page_size=100", { token }),
    ])
      .then(([passportsResponse, travelersResponse]) => {
        if (!active) return;
        setPageData(passportsResponse);
        setTravelers(travelersResponse.items || []);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message || "Unable to load passport details.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiRequest, page, pageSize, debouncedSearch, refreshKey, token]);

  function resolveTravelerLabel(travelerId) {
    const t = travelers.find((item) => String(item.id) === String(travelerId));
    if (!t) return `Traveler #${travelerId}`;
    return [t.first_name, t.last_name].filter(Boolean).join(" ") || `Traveler #${travelerId}`;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const validationError = validatePassportForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    const isEditing = Boolean(form.id);

    try {
      await apiRequest(form.id ? `/passports/${form.id}` : "/passports", {
        method: form.id ? "PATCH" : "POST",
        token,
        body: {
          traveler_id: Number(form.traveler_id),
          passport_number: form.passport_number.trim(),
          issue_country_id: form.issue_country_id ? Number(form.issue_country_id) : null,
          issue_date: form.issue_date || null,
          expiry_date: form.expiry_date || null,
          place_of_issue: form.place_of_issue.trim() || null,
        },
      });
      setForm(createEmptyPassportForm());
      setModalOpen(false);
      setPage(1);
      setRefreshKey((current) => current + 1);
      setSuccessModal({
        title: isEditing ? "Passport Updated" : "Passport Created",
        message: isEditing ? "Passport updated successfully." : "Passport created successfully.",
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save passport.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(passportId) {
    try {
      await apiRequest(`/passports/${passportId}`, { method: "DELETE", token });
      setDeleteTarget(null);
      if ((pageData?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete passport.");
    }
  }

  return (
    <>
      <AlertMessage message={error} variant="danger" />
      <ManageCard
        title="Passport Details"
        subtitle="Create and maintain passport details linked to travelers."
        toolbarExtra={
          <ListSearchInput
            id="passports-list-search"
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search traveler, customer, passport number, country..."
          />
        }
        actionLabel={canCreate ? "Add Passport" : undefined}
        onAction={
          canCreate
            ? () => {
                setForm(createEmptyPassportForm());
                setFormError("");
                setModalOpen(true);
              }
            : undefined
        }
      >
        {loading ? (
          <CardLoader message="Loading passport details..." />
        ) : (
          <>
            <SimpleTable
              columns={[
                "ID",
                "Traveler",
                "Passport No",
                "Issue Country",
                "Issue Date",
                "Expiry Date",
                "Place",
                "Created",
                "Actions",
              ]}
              rows={(pageData?.items || []).map((item) => [
                `#${item.id}`,
                resolveTravelerLabel(item.traveler_id),
                item.passport_number || "-",
                item.issue_country || "-",
                item.issue_date || "-",
                item.expiry_date || "-",
                item.place_of_issue || "-",
                formatDateTime(item.created_at),
                <div key={`passport-actions-${item.id}`} className="ta-table-actions">
                  {canUpdate ? (
                    <button
                      type="button"
                      className="btn btn-icon btn-soft-primary btn-sm"
                      aria-label="Edit passport"
                      onClick={() => {
                        const t = travelers.find((tr) => String(tr.id) === String(item.traveler_id));
                        const open = (customerId) => {
                          setForm({
                            id: String(item.id),
                            customer_id: customerId,
                            traveler_id: String(item.traveler_id || ""),
                            passport_number: item.passport_number || "",
                            issue_country_id:
                              item.issue_country_id != null ? String(item.issue_country_id) : "",
                            issue_date: item.issue_date || "",
                            expiry_date: item.expiry_date || "",
                            place_of_issue: item.place_of_issue || "",
                          });
                          setFormError("");
                          setModalOpen(true);
                        };
                        if (t) {
                          open(String(t.customer_id || ""));
                          return;
                        }
                        apiRequest(`/travelers/${item.traveler_id}`, { token })
                          .then((trow) => {
                            open(trow?.customer_id != null ? String(trow.customer_id) : "");
                          })
                          .catch(() => {
                            open("");
                          });
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
                      aria-label="Delete passport"
                      onClick={() =>
                        setDeleteTarget({
                          id: item.id,
                          label: item.passport_number || `Passport #${item.id}`,
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
              emptyMessage="No passport details found."
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
        title={form.id ? "Update Passport" : "Add Passport"}
        saveLabel={form.id ? "Update Passport" : "Create Passport"}
        saving={saving}
        size="modal-lg"
        onCancel={() => {
          setModalOpen(false);
          setForm(createEmptyPassportForm());
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
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                customer_id: value,
                traveler_id: String(value) === String(current.customer_id) ? current.traveler_id : "",
              }))
            }
            apiRequest={apiRequest}
            token={token}
          />
          <TravelerAutocomplete
            label="Traveler"
            value={form.traveler_id}
            required
            disabled={!String(form.customer_id || "").trim()}
            placeholder={String(form.customer_id || "").trim() ? undefined : "Select a customer first"}
            customerIdFilter={form.customer_id}
            onChange={(value) => setForm((current) => ({ ...current, traveler_id: value }))}
            apiRequest={apiRequest}
            token={token}
          />
          <TextField
            label="Passport Number"
            value={form.passport_number}
            required
            onChange={(value) => setForm((current) => ({ ...current, passport_number: value }))}
          />
          <AutocompleteField
            label="Issue Country"
            value={form.issue_country_id}
            placeholder="Type to search countries…"
            onChange={(value) => setForm((current) => ({ ...current, issue_country_id: value }))}
            options={countryOptions}
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
            label="Place of Issue"
            value={form.place_of_issue}
            onChange={(value) => setForm((current) => ({ ...current, place_of_issue: value }))}
          />
        </div>
      </FormModal>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Passport"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete Passport"
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

export default ManagePassportDetailsPage;

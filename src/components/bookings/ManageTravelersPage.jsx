import { useEffect, useMemo, useState } from "react";
import {
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
import { BookingAlertMessage } from "./BookingAlertMessage.jsx";
import {
  buildPagedSearchUrl,
  CustomerAutocomplete,
  parseOptionalTenDigitMobile,
  validateOptionalTenDigitContact,
} from "../customers/CustomersShared.jsx";

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
    pan_number: "",
    aadhaar_number: "",
    passport_number: "",
    name_as_per_passport: "",
    passport_expiry_date: "",
    address: "",
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

  const contactErr = validateOptionalTenDigitContact(form.contact_number);
  if (contactErr) {
    return contactErr;
  }

  const pan = String(form.pan_number || "").trim();
  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(pan)) {
    return "Enter a valid PAN Number (e.g. ABCDE1234F).";
  }

  const aadDigits = String(form.aadhaar_number || "").replace(/\D/g, "");
  if (String(form.aadhaar_number || "").trim() && aadDigits.length !== 12) {
    return "Aadhaar number must be exactly 12 digits.";
  }

  const passNum = String(form.passport_number || "").trim();
  const passName = String(form.name_as_per_passport || "").trim();
  const passExpiry = String(form.passport_expiry_date || "").trim();
  if ((passName || passExpiry) && !passNum) {
    return "Passport number is required when passport name or expiry date is filled in.";
  }

  return "";
}

function ManageTravelersPage({ token, apiRequest, canCreate, canUpdate, canDelete }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [form, setForm] = useState(createEmptyTravelerForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);
  const [countries, setCountries] = useState([]);
  const [customerFilterId, setCustomerFilterId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 400);

  const countryOptions = useMemo(
    () => countries.map((c) => ({ value: String(c.id), label: c.name || `Country #${c.id}` })),
    [countries],
  );


  useEffect(() => {
    document.title = "Manage Traveler | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest("/masters/countries/options", { token }),
    ])
      .then(([co]) => {
        if (!active) {
          return;
        }
        setCountries(Array.isArray(co) ? co : []);
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
  }, [searchInput, customerFilterId]);

  function buildTravelerListUrl() {
    const base = buildPagedSearchUrl("/travelers", page, pageSize, debouncedSearch);
    const cid = String(customerFilterId || "").trim();
    if (!cid) {
      return base;
    }
    return `${base}&customer_id=${encodeURIComponent(cid)}`;
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    apiRequest(buildTravelerListUrl(), { token })
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
  }, [apiRequest, page, pageSize, debouncedSearch, refreshKey, token, customerFilterId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const isEditing = Boolean(form.id);
    if (!isEditing && !canCreate) {
      setFormError("You do not have permission to add travelers.");
      return;
    }
    if (isEditing && !canUpdate) {
      setFormError("You do not have permission to update travelers.");
      return;
    }
    const validationError = validateTravelerForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);

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
          contact_number: parseOptionalTenDigitMobile(form.contact_number),
          email: form.email.trim() || null,
          pan_number: form.pan_number.trim() || null,
          aadhaar_number: (() => {
            const d = String(form.aadhaar_number || "").replace(/\D/g, "");
            return d.length === 12 ? d : null;
          })(),
          address: form.address.trim() || null,
          passport_number: String(form.passport_number || "").trim() || null,
          passport_expiry_date: String(form.passport_expiry_date || "").trim() || null,
          name_as_per_passport: String(form.name_as_per_passport || "").trim() || null,
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
    if (!canDelete) {
      setError("You do not have permission to delete travelers.");
      return;
    }
    const id = Number(travelerId);
    if (!Number.isFinite(id) || id <= 0) {
      setError("Invalid traveler id. Refresh the page and try again.");
      return;
    }
    setError("");
    setDeleteBusy(true);
    try {
      await apiRequest(`/travelers/${id}`, { method: "DELETE", token });
      setDeleteTarget(null);
      if ((pageData?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete traveler.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <BookingAlertMessage message={error} variant="danger" onDismiss={() => setError("")} />
      <ManageCard
        title="Manage Traveler"
        subtitle=""
        toolbarExtra={
          <div className="ta-travelers-toolbar">
            <CustomerAutocomplete
              value={customerFilterId}
              onChange={(value) => setCustomerFilterId(value)}
              customers={[]}
              apiRequest={apiRequest}
              token={token}
              required={false}
              wrapperClassName="ta-travelers-toolbar__customer"
              inputClassName="form-control form-control-sm"
            />
            <div className="ta-travelers-toolbar__search">
              <ListSearchInput
                id="travelers-list-search"
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Search name, email, phone, nationality, PAN, Aadhaar, passport, address..."
              />
            </div>
            {String(customerFilterId || "").trim() ? (
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={() => setCustomerFilterId("")}
                title="Clear customer filter"
              >
                Clear
              </button>
            ) : null}
            {canCreate ? (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setForm(createEmptyTravelerForm());
                  setFormError("");
                  setModalOpen(true);
                }}
              >
                Add Traveler
              </button>
            ) : null}
          </div>
        }
      >
        {loading ? (
          <CardLoader message="Loading travelers..." />
        ) : (
          <>
            <SimpleTable
              columns={["ID", "Traveler", "Customer", "Email", "Created", "Actions"]}
              rows={(pageData?.items || []).map((item) => [
                `#${item.id}`,
                `${item.first_name} ${item.last_name || ""}`.trim(),
                [item.customer_first_name, item.customer_last_name].filter(Boolean).join(" ").trim() ||
                  item.customer_ref ||
                  `Customer #${item.customer_id}`,
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
                          pan_number: item.pan_number || "",
                          aadhaar_number: item.aadhaar_number || "",
                          passport_number: item.passport_number || "",
                          name_as_per_passport: item.name_as_per_passport || "",
                          passport_expiry_date: item.passport_expiry_date || "",
                          address: item.address || "",
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
        <BookingAlertMessage message={formError} variant="danger" onDismiss={() => setFormError("")} />
        <div className="row g-3">
          <CustomerAutocomplete
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
            label="Contact number"
            value={form.contact_number}
            inputMode="numeric"
            maxLength={15}
            autoComplete="tel"
            title="Enter a 10-digit mobile number (optional +91), or leave blank"
            onChange={(value) => setForm((current) => ({ ...current, contact_number: value }))}
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => setForm((current) => ({ ...current, email: value }))}
          />
          <TextField
            label="PAN Number"
            value={form.pan_number}
            maxLength={20}
            placeholder="e.g. ABCDE1234F"
            onChange={(value) => setForm((current) => ({ ...current, pan_number: value }))}
          />
          <TextField
            label="Aadhaar number"
            value={form.aadhaar_number}
            inputMode="numeric"
            maxLength={14}
            placeholder="12 digits (spaces optional)"
            title="12-digit Aadhaar; spaces are ignored"
            onChange={(value) => setForm((current) => ({ ...current, aadhaar_number: value }))}
          />
          <TextField
            label="Passport No"
            value={form.passport_number}
            maxLength={100}
            onChange={(value) => setForm((current) => ({ ...current, passport_number: value }))}
          />
          <TextField
            label="Name as per passport"
            value={form.name_as_per_passport}
            maxLength={250}
            onChange={(value) => setForm((current) => ({ ...current, name_as_per_passport: value }))}
          />
          <TextField
            label="Passport validity (expiry)"
            type="date"
            value={form.passport_expiry_date}
            onChange={(value) => setForm((current) => ({ ...current, passport_expiry_date: value }))}
          />
          <div className="col-12 col-md-6">
            <label className="form-label">Address</label>
            <textarea
              className="form-control"
              rows={2}
              value={form.address}
              onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))}
            />
          </div>
        </div>
      </FormModal>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Traveler"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete Traveler"
        saving={deleteBusy}
        onCancel={() => {
          if (!deleteBusy) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={() => {
          if (deleteTarget) {
            void handleDelete(deleteTarget.id);
          }
        }}
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

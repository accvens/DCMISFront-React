import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertMessage,
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
import { buildPagedSearchUrl, createEmptyCustomerForm, validateCustomerForm } from "./CustomersShared.jsx";
import {
  createBookingFormFromBooking,
  formatCurrency,
  openProformaInvoicePrintWindow,
} from "../bookings/BookingsShared.jsx";

function ManageCustomersPage({
  token,
  apiRequest,
  canCreate,
  canUpdate,
  canDelete,
  canAccessBookings = false,
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const deleteIdRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [form, setForm] = useState(createEmptyCustomerForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);
  const [countries, setCountries] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 400);
  const [proformaPickerOpen, setProformaPickerOpen] = useState(false);
  const [proformaPickerOptions, setProformaPickerOptions] = useState([]);
  const [proformaPickerBookingId, setProformaPickerBookingId] = useState("");
  const [proformaBusy, setProformaBusy] = useState(false);
  const [proformaHint, setProformaHint] = useState("");

  const countryOptions = useMemo(
    () => [
      { value: "", label: "—" },
      ...countries.map((c) => ({ value: String(c.id), label: c.name || `Country #${c.id}` })),
    ],
    [countries],
  );

  useEffect(() => {
    document.title = "Manage Customer | Travel Agency";
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

    apiRequest(buildPagedSearchUrl("/customers", page, pageSize, debouncedSearch), { token })
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
        setError(requestError.message || "Unable to load customers.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiRequest, page, pageSize, debouncedSearch, refreshKey, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const validationError = validateCustomerForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    const isEditing = Boolean(form.id);

    try {
      await apiRequest(form.id ? `/customers/${form.id}` : "/customers", {
        method: form.id ? "PATCH" : "POST",
        token,
        body: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim() || null,
          contact_number: form.contact_number.trim() || null,
          gender: form.gender || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          country_id: form.country_id ? Number(form.country_id) : null,
        },
      });
      setForm(createEmptyCustomerForm());
      setModalOpen(false);
      setPage(1);
      setRefreshKey((current) => current + 1);
      setSuccessModal({
        title: isEditing ? "Customer Updated" : "Customer Created",
        message: isEditing ? "Customer updated successfully." : "Customer created successfully.",
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save customer.");
    } finally {
      setSaving(false);
    }
  }

  async function printProformaForBooking(bookingId) {
    const [booking, productsRes, destinationsRes] = await Promise.all([
      apiRequest(`/bookings/${bookingId}`, { token }),
      apiRequest("/products?page=1&page_size=500", { token }),
      apiRequest("/destinations?page=1&page_size=200", { token }),
    ]);
    const products = productsRes.items || [];
    const destinations = destinationsRes.items || [];
    const formFromBooking = createBookingFormFromBooking(booking, { catalogueProducts: products });
    openProformaInvoicePrintWindow(formFromBooking, { customers: [form], destinations, products }, booking.id);
  }

  async function handleProformaInvoiceClick() {
    if (!form.id) {
      return;
    }
    setProformaHint("");
    setFormError("");
    setProformaBusy(true);
    try {
      const res = await apiRequest(
        `/bookings?page=1&page_size=100&customer_id=${encodeURIComponent(form.id)}`,
        { token },
      );
      const items = res?.items || [];
      if (items.length === 0) {
        setProformaHint(
          "This customer has no bookings yet. Create a booking under Bookings, then print the proforma from here or while editing the booking.",
        );
        return;
      }
      const sorted = [...items].sort((a, b) => Number(b.id) - Number(a.id));
      if (sorted.length === 1) {
        await printProformaForBooking(sorted[0].id);
        return;
      }
      setProformaPickerOptions(
        sorted.map((b) => ({
          value: String(b.id),
          label: `#${b.id}${b.drc_no ? ` · ${b.drc_no}` : ""} · ${b.travel_start_date || "—"} · ${formatCurrency(b.total_amount)}`,
        })),
      );
      setProformaPickerBookingId(String(sorted[0].id));
      setProformaPickerOpen(true);
    } catch (requestError) {
      setFormError(requestError.message || "Unable to load bookings for this customer.");
    } finally {
      setProformaBusy(false);
    }
  }

  async function handleProformaPickerSubmit(event) {
    event.preventDefault();
    if (!proformaPickerBookingId) {
      return;
    }
    setProformaBusy(true);
    setFormError("");
    try {
      await printProformaForBooking(Number(proformaPickerBookingId));
      setProformaPickerOpen(false);
    } catch (requestError) {
      setFormError(requestError.message || "Unable to open proforma invoice.");
    } finally {
      setProformaBusy(false);
    }
  }

  async function handleDelete(customerId) {
    const id = customerId ?? deleteIdRef.current;
    if (id == null || id === "") {
      return;
    }
    const numId = Number(id);
    if (Number.isNaN(numId)) {
      setError("Invalid customer id.");
      return;
    }
    setError("");
    try {
      await apiRequest(`/customers/${numId}`, { method: "DELETE", token });
      setDeleteTarget(null);
      deleteIdRef.current = null;
      if ((pageData?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete customer.");
    }
  }

  return (
    <>
      <AlertMessage message={error} variant="danger" />
      <ManageCard
        title="Manage Customer"
        subtitle="Create and maintain customer records."
        toolbarExtra={
          <ListSearchInput
            id="customers-list-search"
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search name, customer ID, email, phone, country..."
          />
        }
        actionLabel={canCreate ? "Add Customer" : undefined}
        onAction={
          canCreate
            ? () => {
                setForm(createEmptyCustomerForm());
                setFormError("");
                setProformaHint("");
                setModalOpen(true);
              }
            : undefined
        }
      >
        {loading ? (
          <CardLoader message="Loading customers..." />
        ) : (
          <>
            <SimpleTable
              columns={["ID", "Customer ID", "First Name", "Last Name", "Email", "Contact", "City", "Country", "Created", "Actions"]}
              rows={(pageData?.items || []).map((item) => [
                `#${item.id}`,
                item.customer_id || "-",
                item.first_name || "-",
                item.last_name || "-",
                item.email || "-",
                item.contact_number || "-",
                item.city || "-",
                item.country || "-",
                formatDateTime(item.created_at),
                <div key={`customer-actions-${item.id}`} className="ta-table-actions">
                  {canUpdate ? (
                    <button
                      type="button"
                      className="btn btn-icon btn-soft-primary btn-sm"
                      aria-label="Edit customer"
                      onClick={() => {
                        setForm({
                          id: String(item.id),
                          customer_id: item.customer_id || "",
                          first_name: item.first_name || "",
                          last_name: item.last_name || "",
                          email: item.email || "",
                          contact_number: item.contact_number || "",
                          gender: item.gender || "",
                          address: item.address || "",
                          city: item.city || "",
                          country_id: item.country_id != null ? String(item.country_id) : "",
                        });
                        setFormError("");
                        setProformaHint("");
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
                      aria-label="Delete customer"
                      onClick={() => {
                        deleteIdRef.current = item.id;
                        setDeleteTarget({
                          id: item.id,
                          label: [item.first_name, item.last_name].filter(Boolean).join(" ") || item.customer_id || item.email || "Customer",
                        });
                        setError("");
                      }}
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
              emptyMessage="No customers found."
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
        title={form.id ? "Update Customer" : "Add Customer"}
        saveLabel={form.id ? "Update Customer" : "Create Customer"}
        saving={saving}
        size="modal-lg"
        onCancel={() => {
          setModalOpen(false);
          setForm(createEmptyCustomerForm());
          setFormError("");
          setProformaHint("");
        }}
        onSubmit={handleSubmit}
      >
        <AlertMessage message={formError} variant="danger" />
        <div className="row g-3">
          {form.id && form.customer_id ? (
            <div className="col-12">
              <label className="form-label">Customer ID</label>
              <p className="form-control-plaintext text-muted mb-0">{form.customer_id}</p>
            </div>
          ) : null}
          {form.id && canAccessBookings ? (
            <div className="col-12">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                disabled={proformaBusy}
                onClick={handleProformaInvoiceClick}
              >
                {proformaBusy && !proformaPickerOpen ? "Loading…" : "Print proforma invoice"}
              </button>
              {proformaHint ? <p className="small text-muted mt-2 mb-0">{proformaHint}</p> : null}
            </div>
          ) : null}
          <TextField
            label="First Name"
            value={form.first_name}
            required
            onChange={(value) => setForm((current) => ({ ...current, first_name: value }))}
          />
          <TextField
            label="Last Name"
            value={form.last_name}
            required
            onChange={(value) => setForm((current) => ({ ...current, last_name: value }))}
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => setForm((current) => ({ ...current, email: value }))}
          />
          <TextField
            label="Contact Number"
            value={form.contact_number}
            onChange={(value) => setForm((current) => ({ ...current, contact_number: value }))}
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
            label="City"
            value={form.city}
            onChange={(value) => setForm((current) => ({ ...current, city: value }))}
          />
          <SelectField
            label="Country"
            value={form.country_id}
            onChange={(value) => setForm((current) => ({ ...current, country_id: value }))}
            options={countryOptions}
          />
          <div className="col-12">
            <label className="form-label">Address</label>
            <textarea
              className="form-control"
              rows="3"
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({ ...current, address: event.target.value }))
              }
            />
          </div>
        </div>
      </FormModal>
      <FormModal
        open={proformaPickerOpen}
        title="Print proforma invoice"
        saveLabel="Print"
        saving={proformaBusy}
        onCancel={() => {
          setProformaPickerOpen(false);
          setProformaPickerOptions([]);
          setProformaPickerBookingId("");
        }}
        onSubmit={handleProformaPickerSubmit}
      >
        <p className="small text-muted mb-3">
          Choose which booking to use for the proforma (product lines, payments, and totals come from that booking).
        </p>
        <SelectField
          label="Booking"
          value={proformaPickerBookingId}
          required
          onChange={setProformaPickerBookingId}
          options={proformaPickerOptions}
        />
      </FormModal>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Customer"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete Customer"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget?.id ?? deleteIdRef.current)}
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

export default ManageCustomersPage;

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
} from "../access/AccessShared.jsx";
import {
  StatusBadge,
  createDefaultVendorPaymentForm,
  createEmptyVendorPaymentForm,
  createMap,
  formatCurrency,
  validateVendorPaymentForm,
} from "./PaymentsShared.jsx";

function VendorPaymentsPage({ token, apiRequest, paymentStatusOptions }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [state, setState] = useState({
    loading: true,
    error: "",
    vendorPaymentsPage: null,
    bookings: [],
    vendors: [],
  });
  const [form, setForm] = useState(createEmptyVendorPaymentForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);

  useEffect(() => {
    document.title = "Vendor Payments | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));

    Promise.all([
      apiRequest(`/vendor-payments?page=${page}&page_size=${pageSize}`, { token }),
      apiRequest("/bookings?page=1&page_size=100", { token }),
      apiRequest("/masters/vendors?page=1&page_size=100", { token }),
    ])
      .then(([vendorPaymentsPage, bookings, vendors]) => {
        if (!active) {
          return;
        }
        setState({
          loading: false,
          error: "",
          vendorPaymentsPage,
          bookings: bookings.items,
          vendors: vendors.items,
        });
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setState((current) => ({
          ...current,
          loading: false,
          error: requestError.message || "Unable to load vendor payment data.",
        }));
      });

    return () => {
      active = false;
    };
  }, [apiRequest, page, pageSize, refreshKey, token]);

  useEffect(() => {
    if (!state.bookings.length || !state.vendors.length || form.booking_id) {
      return;
    }
    setForm(createDefaultVendorPaymentForm(state.bookings, state.vendors));
  }, [form.booking_id, state.bookings, state.vendors]);

  const bookingMap = useMemo(() => createMap(state.bookings, "id"), [state.bookings]);
  const vendorMap = useMemo(() => createMap(state.vendors, "id"), [state.vendors]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const validationError = validateVendorPaymentForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    const isEditing = Boolean(form.id);

    try {
      await apiRequest(form.id ? `/vendor-payments/${form.id}` : "/vendor-payments", {
        method: form.id ? "PATCH" : "POST",
        token,
        body: {
          booking_id: Number(form.booking_id),
          vendor_id: Number(form.vendor_id),
          amount: Number(form.amount),
          payment_method: form.payment_method.trim(),
          payment_date: form.payment_date || null,
          status: form.status,
        },
      });
      setModalOpen(false);
      setForm(createDefaultVendorPaymentForm(state.bookings, state.vendors));
      setPage(1);
      setRefreshKey((current) => current + 1);
      setSuccessModal({
        title: isEditing ? "Vendor Payment Updated" : "Vendor Payment Created",
        message: isEditing
          ? "Vendor payment updated successfully."
          : "Vendor payment created successfully.",
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save vendor payment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await apiRequest(`/vendor-payments/${id}`, { method: "DELETE", token });
      if ((state.vendorPaymentsPage?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
      setDeleteTarget(null);
    } catch (requestError) {
      setState((current) => ({
        ...current,
        error: requestError.message || "Unable to delete vendor payment.",
      }));
    }
  }

  return (
    <>
      <AlertMessage message={state.error} variant="danger" />
      <ManageCard
        title="Vendor Payments"
        subtitle="Create, update, and delete vendor payments with popup forms."
        actionLabel="Add Vendor Payment"
        onAction={() => {
          setForm(createDefaultVendorPaymentForm(state.bookings, state.vendors));
          setFormError("");
          setModalOpen(true);
        }}
      >
        {state.loading ? (
          <CardLoader message="Loading vendor payments..." />
        ) : (
          <>
            <SimpleTable
              columns={[
                "ID",
                "Booking",
                "Vendor",
                "Method",
                "Amount",
                "Status",
                "Actions",
              ]}
              rows={(state.vendorPaymentsPage?.items || []).map((payment) => [
                `#${payment.id}`,
                bookingMap[payment.booking_id]?.drc_no || `Booking #${payment.booking_id}`,
                vendorMap[payment.vendor_id]?.vendor_name || `Vendor #${payment.vendor_id}`,
                payment.payment_method,
                <span key={`vendor-amt-${payment.id}`} data-sort={String(payment.amount ?? "")}>
                  {formatCurrency(payment.amount)}
                </span>,
                <StatusBadge
                  key={`vendor-${payment.id}`}
                  status={payment.status}
                  data-sort={payment.status || ""}
                />,
                <div key={`vendor-payment-actions-${payment.id}`} className="ta-table-actions">
                  <button
                    type="button"
                    className="btn btn-icon btn-soft-primary btn-sm"
                    aria-label="Edit vendor payment"
                    onClick={() => {
                      setForm({
                        id: String(payment.id),
                        booking_id: String(payment.booking_id),
                        vendor_id: String(payment.vendor_id),
                        amount: String(payment.amount),
                        payment_method: payment.payment_method,
                        payment_date: payment.payment_date || "",
                        status: payment.status,
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
                    aria-label="Delete vendor payment"
                    onClick={() =>
                      setDeleteTarget({
                        id: payment.id,
                        label: `vendor payment #${payment.id}`,
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
              emptyMessage="No vendor payments found."
            />
            <PaginationBar
              pageData={state.vendorPaymentsPage}
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
        title={form.id ? "Update Vendor Payment" : "Add Vendor Payment"}
        saveLabel={form.id ? "Update Vendor Payment" : "Create Vendor Payment"}
        saving={saving}
        onCancel={() => {
          setModalOpen(false);
          setForm(createDefaultVendorPaymentForm(state.bookings, state.vendors));
          setFormError("");
        }}
        onSubmit={handleSubmit}
      >
        <AlertMessage message={formError} variant="danger" />
        <div className="row g-3">
          <SelectField
            label="Booking"
            value={form.booking_id}
            required
            onChange={(value) => setForm((current) => ({ ...current, booking_id: value }))}
            options={state.bookings.map((item) => ({
              value: String(item.id),
              label: item.drc_no || `Booking #${item.id}`,
            }))}
          />
          <SelectField
            label="Vendor"
            value={form.vendor_id}
            required
            onChange={(value) => setForm((current) => ({ ...current, vendor_id: value }))}
            options={state.vendors.map((item) => ({
              value: String(item.id),
              label: item.vendor_name,
            }))}
          />
          <TextField
            label="Amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={form.amount}
            onChange={(value) => setForm((current) => ({ ...current, amount: value }))}
          />
          <TextField
            label="Payment Method"
            value={form.payment_method}
            required
            onChange={(value) =>
              setForm((current) => ({ ...current, payment_method: value }))
            }
          />
          <TextField
            label="Payment Date"
            type="date"
            value={form.payment_date}
            onChange={(value) =>
              setForm((current) => ({ ...current, payment_date: value }))
            }
          />
          <SelectField
            label="Status"
            value={form.status}
            required
            onChange={(value) => setForm((current) => ({ ...current, status: value }))}
            options={paymentStatusOptions.map((status) => ({
              value: status,
              label: status,
            }))}
          />
        </div>
      </FormModal>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Vendor Payment"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete Vendor Payment"
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

export default VendorPaymentsPage;

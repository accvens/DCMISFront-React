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
  createDefaultPaymentForm,
  createEmptyPaymentForm,
  createMap,
  formatCurrency,
  parseAmountNumeric,
  validatePaymentForm,
} from "./PaymentsShared.jsx";
import {
  normalizePaymentLineStatusForForm,
  paymentMethodFieldOptions,
} from "../bookings/BookingsShared.jsx";

function CustomerPaymentsPage({ token, apiRequest, paymentStatusOptions }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [state, setState] = useState({
    loading: true,
    error: "",
    paymentsPage: null,
    bookings: [],
    paymentModes: [],
  });
  const [form, setForm] = useState(createEmptyPaymentForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);

  useEffect(() => {
    document.title = "Customer Payments | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));

    Promise.all([
      apiRequest(`/payments?page=${page}&page_size=${pageSize}`, { token }),
      apiRequest("/bookings?page=1&page_size=100", { token }),
      apiRequest("/masters/payment-modes?page=1&page_size=100", { token }).catch(() => ({ items: [] })),
    ])
      .then(([paymentsPage, bookings, paymentModes]) => {
        if (!active) {
          return;
        }
        setState({
          loading: false,
          error: "",
          paymentsPage,
          bookings: bookings.items,
          paymentModes: paymentModes.items || [],
        });
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setState((current) => ({
          ...current,
          loading: false,
          error: requestError.message || "Unable to load payment data.",
        }));
      });

    return () => {
      active = false;
    };
  }, [apiRequest, page, pageSize, refreshKey, token]);

  useEffect(() => {
    if (!state.bookings.length || form.booking_id) {
      return;
    }
    setForm(createDefaultPaymentForm(state.bookings));
  }, [form.booking_id, state.bookings]);

  const bookingMap = useMemo(() => createMap(state.bookings, "id"), [state.bookings]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const validationError = validatePaymentForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    const isEditing = Boolean(form.id);

    try {
      await apiRequest(form.id ? `/payments/${form.id}` : "/payments", {
        method: form.id ? "PATCH" : "POST",
        token,
        body: {
          booking_id: Number(form.booking_id),
          amount: parseAmountNumeric(form.amount),
          payment_method: form.payment_method.trim(),
          transaction_reference: form.transaction_reference.trim() || null,
          payment_date: form.payment_date || null,
          status: form.status,
        },
      });
      setModalOpen(false);
      setForm(createDefaultPaymentForm(state.bookings));
      setPage(1);
      setRefreshKey((current) => current + 1);
      setSuccessModal({
        title: isEditing ? "Customer Payment Updated" : "Customer Payment Created",
        message: isEditing
          ? "Customer payment updated successfully."
          : "Customer payment created successfully.",
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save payment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await apiRequest(`/payments/${id}`, { method: "DELETE", token });
      if ((state.paymentsPage?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
      setDeleteTarget(null);
    } catch (requestError) {
      setState((current) => ({
        ...current,
        error: requestError.message || "Unable to delete payment.",
      }));
    }
  }

  return (
    <>
      <AlertMessage message={state.error} variant="danger" />
      <ManageCard
        title="Customer Payments"
        subtitle="Create, update, and delete customer payments with popup forms."
        actionLabel="Add Customer Payment"
        onAction={() => {
          setForm(createDefaultPaymentForm(state.bookings));
          setFormError("");
          setModalOpen(true);
        }}
      >
        {state.loading ? (
          <CardLoader message="Loading payments..." />
        ) : (
          <>
            <SimpleTable
              columns={["ID", "Booking", "Method", "Amount", "Status", "Actions"]}
              rows={(state.paymentsPage?.items || []).map((payment) => [
                `#${payment.id}`,
                bookingMap[payment.booking_id]?.drc_no || `Booking #${payment.booking_id}`,
                payment.payment_method,
                <span key={`customer-amt-${payment.id}`} data-sort={String(payment.amount ?? "")}>
                  {formatCurrency(payment.amount)}
                </span>,
                <StatusBadge
                  key={`customer-${payment.id}`}
                  status={payment.status}
                  data-sort={payment.status || ""}
                />,
                <div key={`payment-actions-${payment.id}`} className="ta-table-actions">
                  <button
                    type="button"
                    className="btn btn-icon btn-soft-primary btn-sm"
                    aria-label="Edit payment"
                    onClick={() => {
                      setForm({
                        id: String(payment.id),
                        booking_id: String(payment.booking_id),
                        amount: String(payment.amount),
                        payment_method: payment.payment_method,
                        transaction_reference: payment.transaction_reference || "",
                        payment_date: payment.payment_date || "",
                        status: normalizePaymentLineStatusForForm(payment.status),
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
                    aria-label="Delete payment"
                    onClick={() =>
                      setDeleteTarget({
                        id: payment.id,
                        label: `payment #${payment.id}`,
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
              emptyMessage="No payments found."
            />
            <PaginationBar
              pageData={state.paymentsPage}
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
        title={form.id ? "Update Customer Payment" : "Add Customer Payment"}
        saveLabel={form.id ? "Update Payment" : "Create Payment"}
        saving={saving}
        onCancel={() => {
          setModalOpen(false);
          setForm(createDefaultPaymentForm(state.bookings));
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
          <TextField
            label="Amount"
            formatAmountOnBlur
            required
            value={form.amount}
            onChange={(value) => setForm((current) => ({ ...current, amount: value }))}
          />
          <SelectField
            label="Payment method"
            value={form.payment_method}
            required
            onChange={(value) => setForm((current) => ({ ...current, payment_method: value }))}
            options={paymentMethodFieldOptions(state.paymentModes, form.payment_method)}
          />
          <TextField
            label="Transaction Reference"
            value={form.transaction_reference}
            onChange={(value) =>
              setForm((current) => ({ ...current, transaction_reference: value }))
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
        title="Delete Payment"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete Payment"
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

export default CustomerPaymentsPage;

import { useEffect, useState } from "react";
import {
  AlertMessage,
  CardLoader,
  ConfirmDeleteModal,
  FormModal,
  ManageCard,
  PaginationBar,
  SimpleTable,
  SuccessModal,
  TextField,
} from "../access/AccessShared.jsx";

function createEmptyPaymentModeForm() {
  return {
    id: "",
    payment_mode_name: "",
    description: "",
  };
}

function ManagePaymentModesPage({ token, apiRequest, canCreate, canUpdate, canDelete }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [form, setForm] = useState(createEmptyPaymentModeForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);

  useEffect(() => {
    document.title = "Manage Payment Mode | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    apiRequest(
      `/masters/payment-modes?page=${page}&page_size=${pageSize}`,
      { token },
    )
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
        setError(requestError.message || "Unable to load payment modes.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiRequest, page, pageSize, refreshKey, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    if (!form.payment_mode_name.trim()) {
      setFormError("Payment mode name is required.");
      return;
    }
    setSaving(true);
    const isEditing = Boolean(form.id);

    try {
      await apiRequest(
        form.id ? `/masters/payment-modes/${form.id}` : "/masters/payment-modes",
        {
          method: form.id ? "PATCH" : "POST",
          token,
          body: {
            payment_mode_name: form.payment_mode_name.trim(),
            description: form.description.trim() || null,
          },
        },
      );
      setForm(createEmptyPaymentModeForm());
      setModalOpen(false);
      setPage(1);
      setRefreshKey((current) => current + 1);
      setSuccessModal({
        title: isEditing ? "Payment Mode Updated" : "Payment Mode Created",
        message: isEditing
          ? "Payment mode updated successfully."
          : "Payment mode created successfully.",
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save payment mode.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(paymentModeId) {
    try {
      await apiRequest(`/masters/payment-modes/${paymentModeId}`, { method: "DELETE", token });
      setDeleteTarget(null);
      if ((pageData?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete payment mode.");
    }
  }

  return (
    <>
      <AlertMessage message={error} variant="danger" />
      <ManageCard
        title="Manage Payment Mode"
        subtitle="Create and maintain payment mode masters."
        actionLabel={canCreate ? "Add Payment Mode" : undefined}
        onAction={
          canCreate
            ? () => {
                setForm(createEmptyPaymentModeForm());
                setFormError("");
                setModalOpen(true);
              }
            : undefined
        }
      >
        {loading ? (
          <CardLoader message="Loading payment modes..." />
        ) : (
          <>
            <SimpleTable
              columns={["ID", "Payment Mode", "Description", "Actions"]}
              rows={(pageData?.items || []).map((item) => [
                `#${item.id}`,
                item.payment_mode_name,
                item.description || "-",
                <div key={`payment-mode-actions-${item.id}`} className="ta-table-actions">
                  {canUpdate ? (
                    <button
                      type="button"
                      className="btn btn-icon btn-soft-primary btn-sm"
                      aria-label="Edit payment mode"
                      onClick={() => {
                        setForm({
                          id: String(item.id),
                          payment_mode_name: item.payment_mode_name || "",
                          description: item.description || "",
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
                      aria-label="Delete payment mode"
                      onClick={() =>
                        setDeleteTarget({
                          id: item.id,
                          label: item.payment_mode_name,
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
              emptyMessage="No payment modes found."
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
        title={form.id ? "Update Payment Mode" : "Add Payment Mode"}
        saveLabel={form.id ? "Update Payment Mode" : "Create Payment Mode"}
        saving={saving}
        onCancel={() => {
          setModalOpen(false);
          setForm(createEmptyPaymentModeForm());
          setFormError("");
        }}
        onSubmit={handleSubmit}
      >
        <AlertMessage message={formError} variant="danger" />
        <div className="row g-3">
          <TextField
            label="Payment Mode Name"
            value={form.payment_mode_name}
            required
            onChange={(value) => setForm((current) => ({ ...current, payment_mode_name: value }))}
          />
          <div className="col-12">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              rows="3"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </div>
        </div>
      </FormModal>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Payment Mode"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete Payment Mode"
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

export default ManagePaymentModesPage;

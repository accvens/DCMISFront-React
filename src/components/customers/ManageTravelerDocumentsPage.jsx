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

function createEmptyDocumentForm() {
  return {
    id: "",
    traveler_id: "",
    document_type: "",
    file_path: "",
  };
}

function validateDocumentForm(form) {
  if (!form.traveler_id) {
    return "Traveler is required.";
  }
  if (!String(form.document_type || "").trim()) {
    return "Document type is required.";
  }
  if (!String(form.file_path || "").trim()) {
    return "File path is required.";
  }
  return "";
}

function ManageTravelerDocumentsPage({ token, apiRequest, canCreate, canUpdate, canDelete }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [travelers, setTravelers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(createEmptyDocumentForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);

  useEffect(() => {
    document.title = "Traveler Documents | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([
      apiRequest(`/traveler-documents?page=${page}&page_size=${pageSize}`, { token }),
      // Backend pagination validates page_size <= 100
      apiRequest("/travelers?page=1&page_size=100", { token }),
      apiRequest("/customers?page=1&page_size=100", { token }),
    ])
      .then(([docsResponse, travelersResponse, customersResponse]) => {
        if (!active) return;
        setPageData(docsResponse);
        setTravelers(travelersResponse.items || []);
        setCustomers(customersResponse.items || []);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message || "Unable to load traveler documents.");
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
    const validationError = validateDocumentForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    const isEditing = Boolean(form.id);

    try {
      await apiRequest(form.id ? `/traveler-documents/${form.id}` : "/traveler-documents", {
        method: form.id ? "PATCH" : "POST",
        token,
        body: {
          traveler_id: Number(form.traveler_id),
          document_type: form.document_type.trim(),
          file_path: form.file_path.trim(),
        },
      });
      setForm(createEmptyDocumentForm());
      setModalOpen(false);
      setPage(1);
      setRefreshKey((current) => current + 1);
      setSuccessModal({
        title: isEditing ? "Document Updated" : "Document Created",
        message: isEditing ? "Document updated successfully." : "Document created successfully.",
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save document.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(documentId) {
    try {
      await apiRequest(`/traveler-documents/${documentId}`, { method: "DELETE", token });
      setDeleteTarget(null);
      if ((pageData?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete document.");
    }
  }

  return (
    <>
      <AlertMessage message={error} variant="danger" />
      <ManageCard
        title="Traveler Documents"
        subtitle="Store document records linked to travelers (file path is stored)."
        actionLabel={canCreate ? "Add Document" : undefined}
        onAction={
          canCreate
            ? () => {
                setForm({
                  ...createEmptyDocumentForm(),
                  traveler_id: travelerOptions[0]?.value || "",
                });
                setFormError("");
                setModalOpen(true);
              }
            : undefined
        }
      >
        {loading ? (
          <CardLoader message="Loading traveler documents..." />
        ) : (
          <>
            <SimpleTable
              columns={["ID", "Traveler", "Type", "File Path", "Uploaded", "Actions"]}
              rows={(pageData?.items || []).map((item) => [
                `#${item.id}`,
                resolveTravelerLabel(item.traveler_id),
                item.document_type || "-",
                item.file_path || "-",
                formatDateTime(item.upload_date),
                <div key={`doc-actions-${item.id}`} className="ta-table-actions">
                  {canUpdate ? (
                    <button
                      type="button"
                      className="btn btn-icon btn-soft-primary btn-sm"
                      aria-label="Edit document"
                      onClick={() => {
                        setForm({
                          id: String(item.id),
                          traveler_id: String(item.traveler_id || ""),
                          document_type: item.document_type || "",
                          file_path: item.file_path || "",
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
                      aria-label="Delete document"
                      onClick={() =>
                        setDeleteTarget({
                          id: item.id,
                          label: item.document_type || `Document #${item.id}`,
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
              emptyMessage="No traveler documents found."
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
        title={form.id ? "Update Document" : "Add Document"}
        saveLabel={form.id ? "Update Document" : "Create Document"}
        saving={saving}
        size="modal-lg"
        onCancel={() => {
          setModalOpen(false);
          setForm(createEmptyDocumentForm());
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
            label="Document Type"
            value={form.document_type}
            required
            onChange={(value) => setForm((current) => ({ ...current, document_type: value }))}
          />
          <TextField
            label="File Path"
            value={form.file_path}
            required
            onChange={(value) => setForm((current) => ({ ...current, file_path: value }))}
          />
        </div>
      </FormModal>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Document"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete Document"
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

export default ManageTravelerDocumentsPage;

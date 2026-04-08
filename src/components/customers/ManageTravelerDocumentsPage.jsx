import { useEffect, useMemo, useState } from "react";
import {
  AlertMessage,
  AutocompleteField,
  CardLoader,
  ConfirmDeleteModal,
  FileField,
  FormModal,
  ListSearchInput,
  ManageCard,
  PaginationBar,
  SimpleTable,
  SuccessModal,
  formatDateTime,
  useDebouncedValue,
} from "../access/AccessShared.jsx";
import {
  buildPagedSearchUrl,
  CustomerAutocomplete,
  TravelerAutocomplete,
} from "./CustomersShared.jsx";

const TRAVELER_DOC_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf";

function documentAssetHref(filePath) {
  if (!filePath) {
    return "";
  }
  if (/^https?:\/\//i.test(filePath)) {
    return filePath;
  }
  const path = filePath.startsWith("/") ? filePath : `/${filePath}`;
  if (import.meta.env.DEV) {
    return path;
  }
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (envBase && /^https?:\/\//i.test(envBase)) {
    try {
      const origin = new URL(String(envBase).replace(/\/+$/, "")).origin;
      return `${origin}${path}`;
    } catch {
      /* fall through */
    }
  }
  return `http://127.0.0.1:8000${path}`;
}

function documentFileBasename(filePath) {
  if (!filePath) {
    return "";
  }
  const clean = String(filePath).split("?")[0];
  const parts = clean.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] || "document";
}

/** Suggested filename for Content-Disposition-style download (type + id + original extension). */
function documentDownloadFilename(item) {
  const extMatch = documentFileBasename(item.file_path).match(/(\.[^./\\]+)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : "";
  const typePart =
    String(item.document_type || "document")
      .replace(/[^\w\s.-]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "document";
  return `${typePart}_${item.id}${ext}`;
}

function createEmptyDocumentForm() {
  return {
    id: "",
    customer_id: "",
    traveler_id: "",
    document_type_id: "",
    file: null,
    existingFilePath: "",
  };
}

function validateDocumentForm(form, isEditing) {
  if (!form.traveler_id) {
    return "Traveler is required.";
  }
  if (!form.document_type_id) {
    return "Document type is required.";
  }
  if (!isEditing && !form.file) {
    return "Please choose a file to upload.";
  }
  if (isEditing && !form.file && !String(form.existingFilePath || "").trim()) {
    return "Choose a new file or keep the existing document.";
  }
  return "";
}

function ManageTravelerDocumentsPage({ token, apiRequest, canCreate, canUpdate, canDelete }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [travelers, setTravelers] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [form, setForm] = useState(createEmptyDocumentForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadFieldKey, setUploadFieldKey] = useState(0);
  const [successModal, setSuccessModal] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 400);

  useEffect(() => {
    document.title = "Traveler Documents | Travel Agency";
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([
      apiRequest(buildPagedSearchUrl("/traveler-documents", page, pageSize, debouncedSearch), { token }),
      // Backend pagination validates page_size <= 100
      apiRequest("/travelers?page=1&page_size=100", { token }),
      apiRequest("/traveler-document-types", { token }),
    ])
      .then(([docsResponse, travelersResponse, typesResponse]) => {
        if (!active) return;
        setPageData(docsResponse);
        setTravelers(travelersResponse.items || []);
        setDocumentTypes(Array.isArray(typesResponse) ? typesResponse : []);
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
  }, [apiRequest, page, pageSize, debouncedSearch, refreshKey, token]);

  const documentTypeOptions = useMemo(
    () =>
      documentTypes.map((t) => ({
        value: String(t.id),
        label: t.name || `Type #${t.id}`,
      })),
    [documentTypes],
  );

  function resolveTravelerLabel(travelerId) {
    const t = travelers.find((item) => String(item.id) === String(travelerId));
    if (!t) return `Traveler #${travelerId}`;
    return [t.first_name, t.last_name].filter(Boolean).join(" ") || `Traveler #${travelerId}`;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const validationError = validateDocumentForm(form, Boolean(form.id));
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    const isEditing = Boolean(form.id);

    try {
      const formData = new FormData();
      formData.set("traveler_id", String(Number(form.traveler_id)));
      formData.set("document_type_id", String(Number(form.document_type_id)));
      if (form.file) {
        formData.set("file", form.file);
      }

      await apiRequest(form.id ? `/traveler-documents/${form.id}` : "/traveler-documents", {
        method: form.id ? "PATCH" : "POST",
        token,
        body: formData,
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
        subtitle="Upload documents linked to travelers (PDF, images, Word)."
        toolbarExtra={
          <ListSearchInput
            id="traveler-documents-list-search"
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search traveler, customer, document type, file..."
          />
        }
        actionLabel={canCreate ? "Add Document" : undefined}
        onAction={
          canCreate
            ? () => {
                setUploadFieldKey((k) => k + 1);
                setForm({
                  ...createEmptyDocumentForm(),
                  document_type_id: documentTypeOptions[0]?.value || "",
                  file: null,
                  existingFilePath: "",
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
              columns={["ID", "Traveler", "Type", "File", "Uploaded", "Actions"]}
              rows={(pageData?.items || []).map((item) => [
                `#${item.id}`,
                resolveTravelerLabel(item.traveler_id),
                item.document_type || "-",
                item.file_path ? (
                  <div
                    key={`doc-file-${item.id}`}
                    className="d-flex flex-wrap gap-2 align-items-center"
                  >
                    <a
                      href={documentAssetHref(item.file_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-break"
                    >
                      Open
                    </a>
                    <span className="text-muted" aria-hidden="true">
                      |
                    </span>
                    <a
                      href={documentAssetHref(item.file_path)}
                      download={documentDownloadFilename(item)}
                      className="text-break"
                    >
                      Download
                    </a>
                  </div>
                ) : (
                  "-"
                ),
                formatDateTime(item.upload_date),
                <div key={`doc-actions-${item.id}`} className="ta-table-actions">
                  {canUpdate ? (
                    <button
                      type="button"
                      className="btn btn-icon btn-soft-primary btn-sm"
                      aria-label="Edit document"
                      onClick={() => {
                        setUploadFieldKey((k) => k + 1);
                        const t = travelers.find((tr) => String(tr.id) === String(item.traveler_id));
                        const open = (customerId) => {
                          setForm({
                            id: String(item.id),
                            customer_id: customerId,
                            traveler_id: String(item.traveler_id || ""),
                            document_type_id: String(item.document_type_id ?? ""),
                            file: null,
                            existingFilePath: item.file_path || "",
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
              sortable
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
          <AutocompleteField
            label="Document Type"
            value={form.document_type_id}
            required
            placeholder="Type to search document types…"
            onChange={(value) => setForm((current) => ({ ...current, document_type_id: value }))}
            options={documentTypeOptions}
          />
          {form.id && form.existingFilePath ? (
            <div className="col-12 col-md-6">
              <label className="form-label">Current file</label>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <a
                  href={documentAssetHref(form.existingFilePath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-outline-primary"
                >
                  Open
                </a>
                <a
                  href={documentAssetHref(form.existingFilePath)}
                  download={documentDownloadFilename({
                    id: form.id,
                    document_type:
                      documentTypeOptions.find((o) => o.value === String(form.document_type_id))
                        ?.label || "",
                    file_path: form.existingFilePath,
                  })}
                  className="btn btn-sm btn-outline-secondary"
                >
                  Download
                </a>
                <span className="text-muted small">Upload a new file below to replace it.</span>
              </div>
            </div>
          ) : null}
          <FileField
            label={form.id ? "Replace file" : "Document file"}
            accept={TRAVELER_DOC_ACCEPT}
            required={!form.id}
            inputKey={`doc-upload-${uploadFieldKey}`}
            onChange={(file) => setForm((current) => ({ ...current, file }))}
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

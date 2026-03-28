import { useEffect, useState } from "react";
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

function createEmptyDestinationForm() {
  return {
    id: "",
    destination_name: "",
    city: "",
    country: "",
    status: "Active",
  };
}

function validateDestinationForm(form) {
  if (!String(form.destination_name || "").trim()) {
    return "Destination name is required.";
  }

  if (!form.status) {
    return "Status is required.";
  }

  return "";
}

function ManageDestinationsPage({ token, apiRequest, canCreate, canUpdate, canDelete }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [form, setForm] = useState(createEmptyDestinationForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);

  useEffect(() => {
    document.title = "Manage Destination | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    apiRequest(`/masters/destinations?page=${page}&page_size=${pageSize}`, { token })
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
        setError(requestError.message || "Unable to load destinations.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiRequest, page, pageSize, refreshKey, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const validationError = validateDestinationForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    const isEditing = Boolean(form.id);

    try {
      await apiRequest(
        form.id ? `/masters/destinations/${form.id}` : "/masters/destinations",
        {
          method: form.id ? "PATCH" : "POST",
          token,
          body: {
            destination_name: form.destination_name.trim(),
            city: form.city.trim() || null,
            country: form.country.trim() || null,
            status: form.status,
          },
        },
      );
      setForm(createEmptyDestinationForm());
      setModalOpen(false);
      setPage(1);
      setRefreshKey((current) => current + 1);
      setSuccessModal({
        title: isEditing ? "Destination Updated" : "Destination Created",
        message: isEditing
          ? "Destination updated successfully."
          : "Destination created successfully.",
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save destination.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(destinationId) {
    try {
      await apiRequest(`/masters/destinations/${destinationId}`, { method: "DELETE", token });
      setDeleteTarget(null);
      if ((pageData?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete destination.");
    }
  }

  return (
    <>
      <AlertMessage message={error} variant="danger" />
      <ManageCard
        title="Manage Destination"
        subtitle="Create and maintain destinations used in bookings."
        actionLabel={canCreate ? "Add Destination" : undefined}
        onAction={
          canCreate
            ? () => {
                setForm(createEmptyDestinationForm());
                setFormError("");
                setModalOpen(true);
              }
            : undefined
        }
      >
        {loading ? (
          <CardLoader message="Loading destinations..." />
        ) : (
          <>
            <SimpleTable
              columns={["ID", "Destination", "City", "Country", "Status", "Actions"]}
              rows={(pageData?.items || []).map((item) => [
                `#${item.id}`,
                item.destination_name,
                item.city || "-",
                item.country || "-",
                item.status || "-",
                <div key={`destination-actions-${item.id}`} className="ta-table-actions">
                  {canUpdate ? (
                    <button
                      type="button"
                      className="btn btn-icon btn-soft-primary btn-sm"
                      aria-label="Edit destination"
                      onClick={() => {
                        setForm({
                          id: String(item.id),
                          destination_name: item.destination_name || "",
                          city: item.city || "",
                          country: item.country || "",
                          status: item.status || "Active",
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
                      aria-label="Delete destination"
                      onClick={() =>
                        setDeleteTarget({
                          id: item.id,
                          label: item.destination_name,
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
              emptyMessage="No destinations found."
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
        title={form.id ? "Update Destination" : "Add Destination"}
        saveLabel={form.id ? "Update Destination" : "Create Destination"}
        saving={saving}
        onCancel={() => {
          setModalOpen(false);
          setForm(createEmptyDestinationForm());
          setFormError("");
        }}
        onSubmit={handleSubmit}
      >
        <AlertMessage message={formError} variant="danger" />
        <div className="row g-3">
          <TextField
            label="Destination Name"
            value={form.destination_name}
            required
            onChange={(value) => setForm((current) => ({ ...current, destination_name: value }))}
          />
          <TextField
            label="City"
            value={form.city}
            onChange={(value) => setForm((current) => ({ ...current, city: value }))}
          />
          <TextField
            label="Country"
            value={form.country}
            onChange={(value) => setForm((current) => ({ ...current, country: value }))}
          />
          <SelectField
            label="Status"
            value={form.status}
            required
            onChange={(value) => setForm((current) => ({ ...current, status: value }))}
            options={[
              { value: "Active", label: "Active" },
              { value: "Inactive", label: "Inactive" },
            ]}
          />
        </div>
      </FormModal>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Destination"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete Destination"
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

export default ManageDestinationsPage;

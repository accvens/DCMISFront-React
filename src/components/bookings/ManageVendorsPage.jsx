import { useEffect, useMemo, useState } from "react";
import {
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
import { vendorAssignedTypeIdsWithCatalog } from "../../assignedProductTypeIds.js";
import { BookingAlertMessage } from "./BookingAlertMessage.jsx";

function createEmptyVendorForm() {
  return {
    id: "",
    vendor_name: "",
    address: "",
    country_id: "",
    gst_number: "",
    bank_account_number: "",
    bank_ifsc: "",
    bank_branch: "",
    credit_limit_days: "",
  };
}

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

function ManageVendorsPage({ token, apiRequest, canCreate, canUpdate, canDelete }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [form, setForm] = useState(createEmptyVendorForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(null);
  const [countries, setCountries] = useState([]);
  const [typeRows, setTypeRows] = useState([]);
  const [typeRowsLoading, setTypeRowsLoading] = useState(false);
  const [typeRowsError, setTypeRowsError] = useState("");
  const [assignedProductTypeIds, setAssignedProductTypeIds] = useState([]);
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    document.title = "Manage Vendors | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    apiRequest("/masters/countries/options", { token })
      .then((co) => {
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

  const countryOptions = useMemo(
    () => [
      { value: "", label: "—" },
      ...countries.map((c) => ({ value: String(c.id), label: c.name || `Country #${c.id}` })),
    ],
    [countries],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    apiRequest(`/masters/vendors?page=${page}&page_size=${pageSize}`, { token })
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
        setError(requestError.message || "Unable to load vendors.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiRequest, page, pageSize, refreshKey, token]);

  useEffect(() => {
    if (!modalOpen) {
      return undefined;
    }
    let active = true;
    setTypeRowsLoading(true);
    setTypeRowsError("");
    setTypeFilter("");

    const vid = form.id ? Number(form.id) : 0;
    const qs = Number.isFinite(vid) && vid > 0 ? `?for_vendor_id=${vid}` : "";

    const pCatalog = apiRequest(`/masters/vendors/product-type-assignment-catalog${qs}`, { token });
    const pVendor =
      Number.isFinite(vid) && vid > 0
        ? apiRequest(`/masters/vendors/${vid}`, { token })
        : Promise.resolve(null);

    Promise.allSettled([pCatalog, pVendor])
      .then((results) => {
        if (!active) {
          return;
        }
        const [catRes, venRes] = results;
        let rows = [];
        if (catRes.status === "fulfilled") {
          rows = Array.isArray(catRes.value) ? catRes.value : [];
        }
        setTypeRows(rows);

        let ids = [];
        if (venRes.status === "fulfilled" && venRes.value && Number.isFinite(vid) && vid > 0) {
          const v = venRes.value;
          ids = vendorAssignedTypeIdsWithCatalog(v, rows);
          setForm((f) => ({
            ...f,
            vendor_name: v.vendor_name != null ? String(v.vendor_name) : f.vendor_name,
            address: v.address != null ? String(v.address) : "",
            country_id: v.country_id != null ? String(v.country_id) : "",
            gst_number: v.gst_number != null ? String(v.gst_number) : "",
            bank_account_number: v.bank_account_number != null ? String(v.bank_account_number) : "",
            bank_ifsc: v.bank_ifsc != null ? String(v.bank_ifsc) : "",
            bank_branch: v.bank_branch != null ? String(v.bank_branch) : "",
            credit_limit_days:
              v.credit_limit_days != null && v.credit_limit_days !== ""
                ? String(v.credit_limit_days)
                : "",
          }));
        }
        if (!ids.length) {
          ids = rows.filter((r) => Number(r.on_this_vendor) > 0).map((r) => Number(r.product_type_id));
        }
        setAssignedProductTypeIds(ids);

        if (catRes.status === "rejected") {
          const r = catRes.reason;
          const msg =
            r && typeof r === "object" && "message" in r && r.message != null
              ? String(r.message)
              : r != null
                ? String(r)
                : "Unable to load products.";
          setTypeRowsError(msg);
        } else {
          setTypeRowsError("");
        }
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setTypeRows([]);
        setAssignedProductTypeIds([]);
        setTypeRowsError(requestError.message || "Unable to load products.");
      })
      .finally(() => {
        if (active) {
          setTypeRowsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [modalOpen, form.id, token, apiRequest]);

  const filteredTypes = useMemo(() => {
    const q = norm(typeFilter);
    if (!q) {
      return typeRows;
    }
    return typeRows.filter((row) => {
      const hay = [row.type_name, row.description, String(row.product_type_id)].map(norm).join(" ");
      return hay.includes(q);
    });
  }, [typeRows, typeFilter]);

  function toggleProductType(id) {
    const tid = Number(id);
    if (!Number.isFinite(tid)) {
      return;
    }
    setAssignedProductTypeIds((prev) =>
      prev.includes(tid) ? prev.filter((x) => x !== tid) : [...prev, tid].sort((a, b) => a - b),
    );
  }

  function selectAllVisibleTypes() {
    setAssignedProductTypeIds((prev) => {
      const next = new Set(prev);
      for (const r of filteredTypes) {
        next.add(Number(r.product_type_id));
      }
      return Array.from(next).sort((a, b) => a - b);
    });
  }

  function clearTypeSelection() {
    setAssignedProductTypeIds([]);
  }

  function selectTypesLinkedToThisVendor() {
    setAssignedProductTypeIds(
      typeRows.filter((r) => Number(r.on_this_vendor) > 0).map((r) => Number(r.product_type_id)),
    );
  }

  function resetModalTypeState() {
    setAssignedProductTypeIds([]);
    setTypeRows([]);
    setTypeRowsError("");
    setTypeFilter("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    if (!form.vendor_name.trim()) {
      setFormError("Vendor name is required.");
      return;
    }
    const creditRaw = String(form.credit_limit_days ?? "").trim();
    let credit_limit_days = null;
    if (creditRaw !== "") {
      const n = Number(creditRaw);
      if (!Number.isFinite(n) || n < 0 || n > 3650) {
        setFormError("Credit limit in days must be a whole number between 0 and 3650.");
        return;
      }
      credit_limit_days = Math.trunc(n);
    }
    setSaving(true);
    const isEditing = Boolean(form.id);

    try {
      await apiRequest(form.id ? `/masters/vendors/${form.id}` : "/masters/vendors", {
        method: form.id ? "PATCH" : "POST",
        token,
        body: {
          vendor_name: form.vendor_name.trim(),
          address: form.address.trim() || null,
          country_id: form.country_id ? Number(form.country_id) : null,
          gst_number: form.gst_number.trim() || null,
          bank_account_number: form.bank_account_number.trim() || null,
          bank_ifsc: form.bank_ifsc.trim() || null,
          bank_branch: form.bank_branch.trim() || null,
          credit_limit_days,
          assigned_product_type_ids: assignedProductTypeIds,
        },
      });
      setForm(createEmptyVendorForm());
      setModalOpen(false);
      resetModalTypeState();
      setPage(1);
      setRefreshKey((current) => current + 1);
      setSuccessModal({
        title: isEditing ? "Vendor updated" : "Vendor created",
        message: isEditing ? "Vendor updated successfully." : "Vendor created successfully.",
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save vendor.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(vendorId) {
    try {
      await apiRequest(`/masters/vendors/${vendorId}`, { method: "DELETE", token });
      setDeleteTarget(null);
      if ((pageData?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete vendor.");
    }
  }

  const editingVendorId = form.id ? Number(form.id) : 0;
  const isEditingVendor = Number.isFinite(editingVendorId) && editingVendorId > 0;
  const selectedCount = assignedProductTypeIds.length;
  const visibleCount = filteredTypes.length;

  return (
    <>
      <BookingAlertMessage message={error} variant="danger" onDismiss={() => setError("")} />
      <ManageCard
        title="Manage Vendors"
        subtitle="Add, update, or delete vendors and link products."
        actionLabel={canCreate ? "Add vendor" : undefined}
        onAction={
          canCreate
            ? () => {
                setForm(createEmptyVendorForm());
                setFormError("");
                setModalOpen(true);
              }
            : undefined
        }
      >
        {loading ? (
          <CardLoader message="Loading vendors..." />
        ) : (
          <>
            <SimpleTable
              columns={["ID", "Vendor name", "Address", "Country", "Actions"]}
              rows={(pageData?.items || []).map((item) => [
                `#${item.id}`,
                item.vendor_name,
                item.address || "—",
                item.country || "—",
                <div key={`vendor-actions-${item.id}`} className="ta-table-actions">
                  {canUpdate ? (
                    <button
                      type="button"
                      className="btn btn-icon btn-soft-primary btn-sm"
                      aria-label="Edit vendor"
                      onClick={() => {
                        setForm({
                          id: String(item.id),
                          vendor_name: item.vendor_name || "",
                          address: item.address || "",
                          country_id:
                            item.country_id != null && item.country_id !== undefined
                              ? String(item.country_id)
                              : "",
                          gst_number: item.gst_number != null ? String(item.gst_number) : "",
                          bank_account_number:
                            item.bank_account_number != null ? String(item.bank_account_number) : "",
                          bank_ifsc: item.bank_ifsc != null ? String(item.bank_ifsc) : "",
                          bank_branch: item.bank_branch != null ? String(item.bank_branch) : "",
                          credit_limit_days:
                            item.credit_limit_days != null && item.credit_limit_days !== ""
                              ? String(item.credit_limit_days)
                              : "",
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
                      aria-label="Delete vendor"
                      onClick={() =>
                        setDeleteTarget({
                          id: item.id,
                          label: item.vendor_name,
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
                  {!canUpdate && !canDelete ? "—" : null}
                </div>,
              ])}
              sortable
              emptyMessage="No vendors found."
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
        title={form.id ? "Update vendor" : "Add vendor"}
        saveLabel={form.id ? "Update vendor" : "Create vendor"}
        saving={saving}
        size="modal-lg"
        scrollableBody
        onCancel={() => {
          setModalOpen(false);
          setForm(createEmptyVendorForm());
          setFormError("");
          resetModalTypeState();
        }}
        onSubmit={handleSubmit}
      >
        <BookingAlertMessage message={formError} variant="danger" onDismiss={() => setFormError("")} />
        <div className="row g-3">
          <TextField
            label="Vendor name"
            value={form.vendor_name}
            required
            onChange={(value) => setForm((current) => ({ ...current, vendor_name: value }))}
          />
          <div className="col-12">
            <label className="form-label" htmlFor="ta-vendor-address">
              Address
            </label>
            <textarea
              id="ta-vendor-address"
              className="form-control"
              rows={3}
              value={form.address}
              onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))}
              placeholder="Street, area, postal code…"
            />
          </div>
          <SelectField
            label="Country"
            value={form.country_id}
            onChange={(value) => setForm((current) => ({ ...current, country_id: value }))}
            options={countryOptions}
          />
          <TextField
            label="GST number"
            value={form.gst_number}
            maxLength={50}
            onChange={(value) => setForm((current) => ({ ...current, gst_number: value }))}
          />
          <TextField
            label="Credit limit (days)"
            type="number"
            min={0}
            max={3650}
            step={1}
            value={form.credit_limit_days}
            placeholder="e.g. 10 — due date = invoice date + days"
            onChange={(value) => setForm((current) => ({ ...current, credit_limit_days: value }))}
          />
        </div>

        <section className="border rounded-3 p-3 p-md-4 mb-4 bg-light" aria-labelledby="ta-vendor-bank-heading">
          <h2 id="ta-vendor-bank-heading" className="h6 fw-semibold mb-1">
            Bank details
          </h2>
          <p className="small text-muted mb-3 mb-md-4">
            Payout / settlement account for this vendor (optional unless you use it on invoices or payments).
          </p>
          <div className="row g-3">
            <TextField
              label="Account number"
              value={form.bank_account_number}
              maxLength={34}
              onChange={(value) => setForm((current) => ({ ...current, bank_account_number: value }))}
            />
            <TextField
              label="IFSC code"
              value={form.bank_ifsc}
              maxLength={20}
              onChange={(value) => setForm((current) => ({ ...current, bank_ifsc: value }))}
            />
            <TextField
              label="Branch"
              value={form.bank_branch}
              maxLength={200}
              onChange={(value) => setForm((current) => ({ ...current, bank_branch: value }))}
            />
          </div>
        </section>

        <hr className="my-4" />
        <fieldset className="border-0 p-0 m-0">
          <legend className="form-label fw-semibold mb-2">Product</legend>
          <BookingAlertMessage
            message={typeRowsError}
            variant="danger"
            onDismiss={() => setTypeRowsError("")}
          />
          <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
            <div className="flex-grow-1" style={{ minWidth: "12rem" }}>
              <label className="form-label small mb-0" htmlFor="ta-vendor-type-filter">
                Filter
              </label>
              <input
                id="ta-vendor-type-filter"
                type="search"
                className="form-control form-control-sm"
                placeholder="Name, description, ID"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                disabled={typeRowsLoading || !typeRows.length}
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm text-nowrap"
              disabled={typeRowsLoading || !visibleCount}
              onClick={selectAllVisibleTypes}
            >
              Select all shown
            </button>
            {isEditingVendor ? (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm text-nowrap"
                disabled={typeRowsLoading || !typeRows.length}
                onClick={selectTypesLinkedToThisVendor}
              >
                Select linked
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm text-nowrap"
              disabled={!selectedCount}
              onClick={clearTypeSelection}
            >
              Clear
            </button>
          </div>
          <p className="small text-muted mb-2" aria-live="polite">
            Selected: {selectedCount}
            {typeFilter.trim() ? ` · ${visibleCount} / ${typeRows.length}` : ""}
          </p>
          {typeRowsLoading ? (
            <CardLoader message="Loading products…" />
          ) : (
            <div
              className="border rounded bg-light p-2 ta-vendor-type-assign"
              style={{ maxHeight: "min(50vh, 22rem)", overflowY: "auto" }}
            >
              {typeRows.length ? (
                visibleCount ? (
                  <div className="row row-cols-1 row-cols-md-3 g-2 small">
                    {filteredTypes.map((row) => {
                      const tid = Number(row.product_type_id);
                      const checked = assignedProductTypeIds.includes(tid);
                      const total = Number(row.total_products) || 0;
                      const onHere = Number(row.on_this_vendor) || 0;
                      const cbId = `ta-vendor-pt-${tid}`;
                      const metaParts = [];
                      if (total > 0) {
                        metaParts.push(`${total} line${total === 1 ? "" : "s"}`);
                      }
                      if (isEditingVendor && onHere > 0) {
                        metaParts.push(`${onHere} here`);
                      }
                      const meta = metaParts.length > 0 ? metaParts.join(" · ") : null;
                      const titleTip = [row.description, meta].filter(Boolean).join(" — ") || undefined;
                      return (
                        <div key={cbId} className="col">
                          <div className="d-flex align-items-center gap-2 rounded border bg-white px-2 py-1 h-100">
                            <input
                              id={cbId}
                              type="checkbox"
                              className="form-check-input flex-shrink-0 m-0 mt-0"
                              checked={checked}
                              onChange={() => toggleProductType(row.product_type_id)}
                              aria-label={`${row.type_name}, product ${tid}`}
                            />
                            <label
                              className="mb-0 flex-grow-1 min-w-0"
                              htmlFor={cbId}
                              style={{ cursor: "pointer" }}
                              title={titleTip}
                            >
                              <span className="fw-medium text-body text-truncate d-block">{row.type_name}</span>
                              {meta ? (
                                <span className="text-muted text-truncate d-block" style={{ fontSize: "0.72rem" }}>
                                  {meta}
                                </span>
                              ) : null}
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted small mb-0 px-1">No products match the filter.</p>
                )
              ) : (
                <p className="text-muted small mb-0 px-1">
                  No products yet. Add them under <strong>Masters → Manage Product</strong>.
                </p>
              )}
            </div>
          )}
        </fieldset>
      </FormModal>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete vendor"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete vendor"
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

export default ManageVendorsPage;

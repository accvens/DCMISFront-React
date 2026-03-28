import { NavLink } from "react-router-dom";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_REGEX = /^[a-z0-9_]+$/;

export function AccessPageHeader({ title, subtitle }) {
  return (
    <div className="page-title-box d-flex align-items-center justify-content-between">
      <div>
        <h4 className="mb-1">{title}</h4>
        <p className="ta-card-muted mb-0">{subtitle}</p>
      </div>
    </div>
  );
}

export function AccessSubmenu() {
  const links = [
    { to: "/access/users", label: "Manage User" },
    { to: "/access/roles", label: "Manage Role" },
    { to: "/access/permissions", label: "Manage Permission" },
  ];

  return (
    <div className="card">
      <div className="card-body py-3">
        <div className="ta-submenu">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `btn btn-sm ${isActive ? "btn-primary" : "btn-light"}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ManageCard({ title, subtitle, actionLabel, onAction, children }) {
  return (
    <div className="row">
      <div className="col-12">
        <div className="card">
          <div className="card-body">
            <div className="ta-toolbar">
              <div>
                <h4 className="card-title mb-1">{title}</h4>
                <p className="ta-card-muted mb-0">{subtitle}</p>
              </div>
              {actionLabel && onAction ? (
                <button type="button" className="btn btn-primary" onClick={onAction}>
                  {actionLabel}
                </button>
              ) : null}
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SimpleTable({ columns, rows, emptyMessage }) {
  return (
    <div className="table-responsive">
      <table className="table table-centered table-nowrap mb-0 ta-summary-table">
        <thead className="table-light">
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="ta-empty">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function PaginationBar({
  pageData,
  onSelectPage,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
}) {
  if (!pageData) {
    return null;
  }

  const currentPage = Number(pageData.page || 1);
  const totalPages = Math.max(1, Number(pageData.total_pages || 1));
  const visiblePages = [];

  for (let page = 1; page <= totalPages; page += 1) {
    const isEdgePage = page === 1 || page === totalPages;
    const isNearCurrent = Math.abs(page - currentPage) <= 1;

    if (isEdgePage || isNearCurrent) {
      visiblePages.push(page);
    }
  }

  return (
    <div className="ta-toolbar mt-3">
      <div className="ta-card-muted">
        Page {currentPage} of {totalPages}
      </div>
      <div className="ta-toolbar-actions">
        {onPageSizeChange ? (
          <select
            className="form-select form-select-sm"
            style={{ width: "auto" }}
            value={String(pageSize || pageData.page_size || 10)}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option} / page
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          className="btn btn-sm btn-light"
          disabled={currentPage <= 1}
          onClick={() => onSelectPage(currentPage - 1)}
        >
          Prev
        </button>
        {visiblePages.map((page, index) => (
          <div key={`page-${page}`} className="d-inline-flex align-items-center gap-2">
            {index > 0 && visiblePages[index - 1] !== page - 1 ? (
              <span className="ta-card-muted px-1">...</span>
            ) : null}
            <button
              type="button"
              className={`btn btn-sm ${page === currentPage ? "btn-primary" : "btn-light"}`}
              onClick={() => onSelectPage(page)}
            >
              {page}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-sm btn-light"
          disabled={currentPage >= totalPages}
          onClick={() => onSelectPage(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function AlertMessage({ message, variant }) {
  if (!message) {
    return null;
  }

  return <div className={`alert alert-${variant}`}>{message}</div>;
}

export function CardLoader({ message }) {
  return (
    <div className="ta-loading">
      <div className="spinner-border text-primary" role="status"></div>
      <span>{message}</span>
    </div>
  );
}

export function ConfirmDeleteModal({
  open,
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}) {
  if (!open) {
    return null;
  }

  return (
    <>
      <div className="modal fade show ta-modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" onClick={onCancel} aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p className="mb-0">{message}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" onClick={onCancel}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={onConfirm}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show"></div>
    </>
  );
}

export function SuccessModal({ open, title, message, onClose }) {
  if (!open) {
    return null;
  }

  return (
    <>
      <div className="modal fade show ta-modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p className="mb-0">{message}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" onClick={onClose}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show"></div>
    </>
  );
}

export function FormModal({
  open,
  title,
  saveLabel,
  saving,
  onCancel,
  onSubmit,
  size = "",
  scrollableBody = false,
  children,
}) {
  if (!open) {
    return null;
  }

  const dialogClassName = `modal-dialog modal-dialog-centered${
    size ? ` ${size}` : ""
  }`;

  return (
    <>
      <div className="modal fade show ta-modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className={dialogClassName} role="document">
          <div className="modal-content">
            <form onSubmit={onSubmit}>
              <div className="modal-header">
                <h5 className="modal-title">{title}</h5>
                <button type="button" className="btn-close" onClick={onCancel} aria-label="Close"></button>
              </div>
              <div className={`modal-body${scrollableBody ? " ta-modal-body-scroll" : ""}`}>{children}</div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={onCancel}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : saveLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show"></div>
    </>
  );
}

export function SelectField({ label, value, onChange, options, required = false }) {
  return (
    <div className="col-12 col-md-6">
      <label className="form-label">{label}</label>
      <select
        className="form-select"
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.length ? (
          options.map((option) => (
            <option key={`${label}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))
        ) : (
          <option value="">No options</option>
        )}
      </select>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  step,
  min,
}) {
  return (
    <div className="col-12 col-md-6">
      <label className="form-label">{label}</label>
      <input
        className="form-control"
        type={type}
        value={value}
        required={required}
        step={step}
        min={min}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function FileField({ label, onChange }) {
  return (
    <div className="col-12 col-md-6">
      <label className="form-label">{label}</label>
      <input
        className="form-control"
        type="file"
        accept="image/*"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
    </div>
  );
}

export function CheckboxMultiField({ label, options, selectedValues, onToggle, compact = false }) {
  return (
    <div className="col-12">
      {label ? <label className="form-label">{label}</label> : null}
      <div className={`ta-checkbox-grid${compact ? " ta-checkbox-grid-compact" : ""}`}>
        {options.length ? (
          options.map((option) => (
            <label key={`${label}-${option.value}`} className="ta-checkbox-item">
              <input
                type="checkbox"
                className="ta-checkbox-input"
                checked={selectedValues.includes(option.value)}
                onChange={() => onToggle(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))
        ) : (
          <span className="ta-card-muted">No roles available.</span>
        )}
      </div>
    </div>
  );
}

/**
 * Groups permissions by entity derived from slug (e.g. create_user -> User, view_payment_mode -> Payment Mode).
 * Returns [{ groupLabel, permissions: [{ id, permission_name, slug }, ...] }, ...] sorted by groupLabel.
 */
export function getPermissionGroups(permissionOptions) {
  if (!Array.isArray(permissionOptions) || permissionOptions.length === 0) {
    return [];
  }

  const toTitleCase = (str) =>
    str
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

  const byGroup = new Map();

  for (const p of permissionOptions) {
    const slug = (p.slug || "").trim();
    const parts = slug.split("_").filter(Boolean);
    const entityKey = parts.length >= 2 ? parts.slice(1).join("_") : "other";
    const groupLabel = toTitleCase(entityKey);

    if (!byGroup.has(groupLabel)) {
      byGroup.set(groupLabel, []);
    }
    byGroup.get(groupLabel).push({
      id: p.id,
      permission_name: p.permission_name || p.slug,
      slug: p.slug,
    });
  }

  return Array.from(byGroup.entries())
    .map(([groupLabel, permissions]) => ({ groupLabel, permissions }))
    .sort((a, b) => a.groupLabel.localeCompare(b.groupLabel));
}

/** Format date or datetime for UI display as Y-m-d H:i:s (e.g. 2026-03-17 14:30:45). Date-only values show 00:00:00. */
export function formatDateTime(value) {
  if (value == null || value === "") return "-";
  const s = String(value).trim();
  if (!s) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s + " 00:00:00";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}:${sec}`;
}

/** Same as formatDateTime: display as Y-m-d H:i:s. */
export function formatDate(value) {
  return formatDateTime(value);
}

export function createEmptyUserForm() {
  return {
    id: "",
    name: "",
    email: "",
    contact: "",
    gender: "",
    password: "",
    role_ids: [],
    image_file: null,
  };
}

export function createEmptyRoleForm() {
  return {
    id: "",
    role_name: "",
    slug: "",
    permission_ids: [],
  };
}

export function createEmptyPermissionForm() {
  return {
    id: "",
    permission_name: "",
    slug: "",
  };
}

export function validateUserForm(form) {
  if (!form.name.trim()) {
    return "Name is required.";
  }

  if (!form.email.trim()) {
    return "Email is required.";
  }

  if (!EMAIL_REGEX.test(form.email.trim())) {
    return "Enter a valid email address.";
  }

  if (!form.id && !form.password) {
    return "Password is required.";
  }

  if (form.password && form.password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (!form.role_ids.length) {
    return "Select at least one role.";
  }

  return "";
}

export function validateNamedSlugForm(name, slug, entityLabel) {
  if (!String(name || "").trim()) {
    return `${entityLabel} name is required.`;
  }

  if (!String(slug || "").trim()) {
    return `${entityLabel} slug is required.`;
  }

  if (!SLUG_REGEX.test(String(slug).trim())) {
    return `${entityLabel} slug can contain only lowercase letters, numbers, and underscores.`;
  }

  return "";
}

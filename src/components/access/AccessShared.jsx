import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import { formatAmountInputGrouped, formatAmountPlain, stripAmountGrouping } from "../../formatAmount.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_REGEX = /^[a-z0-9_]+$/;

export function useDebouncedValue(value, delayMs = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

export function ListSearchInput({
  id,
  value,
  onChange,
  placeholder = "Search...",
  /** When set, shows a visible label above the field instead of a screen-reader-only label. */
  fieldLabel,
}) {
  const showVisibleLabel = Boolean(fieldLabel);
  return (
    <div
      className={`ta-list-search flex-grow-1 d-flex ${showVisibleLabel ? "flex-column align-items-stretch" : "align-items-center"}`}
      style={{ minWidth: "12rem", maxWidth: "26rem" }}
    >
      <label htmlFor={id} className={showVisibleLabel ? "form-label small text-muted mb-1" : "visually-hidden"}>
        {fieldLabel ?? "Search"}
      </label>
      <input
        id={id}
        type="search"
        className="form-control form-control-sm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

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

export function ManageCard({
  title,
  subtitle,
  actionLabel,
  onAction,
  toolbarExtra,
  /** Full-width block between the title row and card body (e.g. filters). */
  filterSlot,
  hideHeader = false,
  children,
}) {
  const showTitle = !hideHeader && Boolean(title);
  const showSubtitle = !hideHeader && Boolean(subtitle);
  const hasActions = Boolean(actionLabel && onAction);
  const showToolbarExtras = Boolean(toolbarExtra) || hasActions;
  const showBar = showTitle || showSubtitle || showToolbarExtras;

  return (
    <div className="row">
      <div className="col-12">
        <div className="card">
          <div className="card-body">
            {showBar ? (
              <div className="ta-toolbar flex-wrap gap-2 align-items-start mb-3">
                {showTitle || showSubtitle ? (
                  <div>
                    {showTitle ? <h4 className="card-title mb-1">{title}</h4> : null}
                    {showSubtitle ? <p className="ta-card-muted mb-0">{subtitle}</p> : null}
                  </div>
                ) : null}
                {showToolbarExtras ? (
                  <div className="d-flex flex-wrap gap-2 ms-auto align-items-center">
                    {toolbarExtra}
                    {hasActions ? (
                      <button type="button" className="btn btn-sm btn-primary" onClick={onAction}>
                        {actionLabel}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {filterSlot ? <div className="ta-card-filter-slot mb-3">{filterSlot}</div> : null}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function cellSortText(cell) {
  if (cell == null || cell === false) {
    return "";
  }
  if (typeof cell === "string" || typeof cell === "number") {
    return String(cell);
  }
  if (typeof cell === "boolean") {
    return cell ? "1" : "0";
  }
  if (Array.isArray(cell)) {
    return cell.map(cellSortText).join(" ");
  }
  if (typeof cell === "object" && cell.props != null) {
    const ds = cell.props["data-sort"];
    if (ds != null && ds !== "") {
      return String(ds);
    }
    const ch = cell.props.children;
    if (typeof ch === "string") {
      return ch;
    }
    if (Array.isArray(ch)) {
      return ch.map(cellSortText).join(" ");
    }
  }
  return "";
}

export function SimpleTable({ columns, rows, emptyMessage, sortable = false }) {
  const actionsColIndex = columns.findIndex((c) => String(c).toLowerCase() === "actions");
  const [sort, setSort] = useState({ col: null, dir: "asc" });

  const displayRows = useMemo(() => {
    if (!sortable || sort.col == null) {
      return rows;
    }
    const idx = sort.col;
    const next = [...rows];
    next.sort((a, b) => {
      const va = cellSortText(a[idx]);
      const vb = cellSortText(b[idx]);
      const cmp = va.localeCompare(vb, undefined, { numeric: true, sensitivity: "base" });
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return next;
  }, [rows, sort, sortable]);

  function toggleSort(colIndex) {
    if (!sortable) {
      return;
    }
    if (actionsColIndex !== -1 && colIndex === actionsColIndex) {
      return;
    }
    setSort((s) =>
      s.col === colIndex
        ? { col: colIndex, dir: s.dir === "asc" ? "desc" : "asc" }
        : { col: colIndex, dir: "asc" },
    );
  }

  return (
    <div className="table-responsive">
      <table className="table table-centered mb-0 ta-summary-table">
        <thead className="table-light">
          <tr>
            {columns.map((column, colIndex) => (
              <th
                key={column}
                className={
                  sortable && (actionsColIndex === -1 || colIndex !== actionsColIndex)
                    ? "user-select-none"
                    : undefined
                }
                style={
                  sortable && (actionsColIndex === -1 || colIndex !== actionsColIndex)
                    ? { cursor: "pointer" }
                    : undefined
                }
                onClick={() => toggleSort(colIndex)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleSort(colIndex);
                  }
                }}
                tabIndex={sortable && (actionsColIndex === -1 || colIndex !== actionsColIndex) ? 0 : undefined}
                role={sortable && (actionsColIndex === -1 || colIndex !== actionsColIndex) ? "button" : undefined}
              >
                {column}
                {sortable && sort.col === colIndex
                  ? sort.dir === "asc"
                    ? " ▲"
                    : " ▼"
                  : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.length ? (
            displayRows.map((row, rowIndex) => (
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
  pageSizeOptions = [10, 25, 50, 100],
}) {
  if (!pageData) {
    return null;
  }

  const currentPage = Number(pageData.page || 1);
  const totalPages = Math.max(1, Number(pageData.total_pages || 1));
  const total = Number(pageData.total || 0);
  const effectivePageSize = Number(pageSize || pageData.page_size || 10);
  const start = total === 0 ? 0 : (currentPage - 1) * effectivePageSize + 1;
  const end = total === 0 ? 0 : Math.min(currentPage * effectivePageSize, total);
  const visiblePages = [];

  for (let page = 1; page <= totalPages; page += 1) {
    const isEdgePage = page === 1 || page === totalPages;
    const isNearCurrent = Math.abs(page - currentPage) <= 1;

    if (isEdgePage || isNearCurrent) {
      visiblePages.push(page);
    }
  }

  return (
    <div className="ta-toolbar mt-3 flex-wrap gap-2">
      <div className="ta-card-muted">
        Page {currentPage} of {totalPages}
        {total > 0 ? (
          <span className="ms-2">
            Showing {start}–{end} of {total}
          </span>
        ) : null}
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

/** Default duration for inline alerts that auto-hide (ms). */
export const ALERT_AUTO_HIDE_MS = 5000;

let toastHostEl = null;

function getToastHost() {
  if (typeof document === "undefined") {
    return null;
  }
  if (toastHostEl && document.body.contains(toastHostEl)) {
    return toastHostEl;
  }
  let el = document.getElementById("ta-toast-host");
  if (!el) {
    el = document.createElement("div");
    el.id = "ta-toast-host";
    el.className = "ta-toast-host";
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-relevant", "additions text");
    document.body.appendChild(el);
  }
  toastHostEl = el;
  return el;
}

export function AlertMessage({ message, variant, id, autoHideAfterMs, onAutoHide, fadeOutDurationMs = 400 }) {
  const onAutoHideRef = useRef(onAutoHide);
  onAutoHideRef.current = onAutoHide;
  const [exiting, setExiting] = useState(false);
  const [removed, setRemoved] = useState(false);

  const text = String(message ?? "").trim();

  useEffect(() => {
    if (!text) {
      setExiting(false);
      setRemoved(false);
      return;
    }
    setExiting(false);
    setRemoved(false);
    const ms =
      autoHideAfterMs === 0
        ? 0
        : typeof autoHideAfterMs === "number" && autoHideAfterMs > 0
          ? autoHideAfterMs
          : autoHideAfterMs === undefined && variant === "success"
            ? ALERT_AUTO_HIDE_MS
            : 0;
    if (!ms) {
      return;
    }
    const fadeMs = typeof fadeOutDurationMs === "number" && fadeOutDurationMs >= 0 ? fadeOutDurationMs : 400;
    const startExit = window.setTimeout(() => {
      setExiting(true);
    }, ms);
    const finish = window.setTimeout(() => {
      setRemoved(true);
      onAutoHideRef.current?.();
    }, ms + fadeMs);
    return () => {
      window.clearTimeout(startExit);
      window.clearTimeout(finish);
    };
  }, [text, variant, autoHideAfterMs, fadeOutDurationMs]);

  if (!text || removed) {
    return null;
  }

  const inner = (
    <div className={`ta-toast${exiting ? " ta-toast--exiting" : ""}`}>
      <div
        id={id}
        className={`alert alert-${variant} ta-alert-scrollable ta-toast__alert mb-0`}
        role="alert"
        tabIndex={id ? -1 : undefined}
      >
        {message}
      </div>
    </div>
  );

  const host = getToastHost();
  if (host) {
    return createPortal(inner, host);
  }

  return inner;
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

/** Generic confirm dialog (primary action). Same shell as delete confirm, without destructive styling by default. */
export function ConfirmActionModal({
  open,
  title,
  message,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  confirmButtonClassName = "btn btn-primary",
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
                {cancelLabel}
              </button>
              <button type="button" className={confirmButtonClassName} onClick={onConfirm}>
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

/** Default auto-close for success modals (ms). Pass 0 to disable. */
export const SUCCESS_MODAL_AUTO_CLOSE_MS = 5000;

export function SuccessModal({
  open,
  title,
  message,
  onClose,
  autoCloseAfterMs = SUCCESS_MODAL_AUTO_CLOSE_MS,
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || !autoCloseAfterMs || autoCloseAfterMs <= 0) {
      return;
    }
    const t = window.setTimeout(() => onCloseRef.current(), autoCloseAfterMs);
    return () => window.clearTimeout(t);
  }, [open, autoCloseAfterMs, message, title]);

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
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit(event);
              }}
            >
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
  placeholder,
  maxLength,
  list,
  id,
  autoComplete,
  spellCheck,
  inputMode,
  readOnly = false,
  title,
  formatAmountOnBlur = false,
  onBlur,
  onFocus,
}) {
  const [amountFocused, setAmountFocused] = useState(false);
  const inputId = id || (label ? `ta-field-${String(label).replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const strippedBase = stripAmountGrouping(String(value ?? ""));
  const amountNum = Number(strippedBase);
  const editingAmount = formatAmountOnBlur && amountFocused && !readOnly;
  const showAmountFormatted =
    formatAmountOnBlur && !editingAmount && strippedBase !== "" && Number.isFinite(amountNum);
  const displayValue = showAmountFormatted ? formatAmountInputGrouped(amountNum) : (value ?? "");
  const effectiveType = formatAmountOnBlur ? "text" : type;
  const effectiveInputMode = formatAmountOnBlur ? "decimal" : inputMode;

  return (
    <div className="col-12 col-md-6">
      <label className="form-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={`form-control${readOnly ? " bg-light" : ""}`}
        type={effectiveType}
        value={displayValue}
        required={required}
        readOnly={readOnly}
        title={title}
        step={formatAmountOnBlur ? undefined : step}
        min={formatAmountOnBlur ? undefined : min}
        placeholder={placeholder}
        maxLength={maxLength}
        list={list}
        autoComplete={autoComplete}
        spellCheck={spellCheck}
        inputMode={effectiveInputMode}
        onChange={(event) => {
          if (formatAmountOnBlur) {
            onChange(stripAmountGrouping(event.target.value));
          } else {
            onChange(event.target.value);
          }
        }}
        onFocus={(event) => {
          if (formatAmountOnBlur && !readOnly) {
            setAmountFocused(true);
          }
          onFocus?.(event);
        }}
        onBlur={(event) => {
          if (formatAmountOnBlur && !readOnly) {
            setAmountFocused(false);
            const stripped = stripAmountGrouping(event.target.value);
            if (stripped === "") {
              if (value !== "" && value != null) {
                onChange("");
              }
            } else {
              const n = Number(stripped);
              const next = Number.isFinite(n) ? formatAmountPlain(n) : stripped;
              if (next !== String(value ?? "")) {
                onChange(next);
              }
            }
          }
          onBlur?.(event);
        }}
      />
    </div>
  );
}

/**
 * Compact amount field (tables): Indian grouping when unfocused; plain while editing; paise rounding on blur without forced ".00".
 */
export function AmountFormattedInput({
  id,
  className = "form-control form-control-sm",
  value,
  onChange,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
  disabled = false,
  readOnly = false,
  placeholder,
  autoComplete = "off",
  title,
  "aria-label": ariaLabel,
}) {
  const [focused, setFocused] = useState(false);
  const strippedBase = stripAmountGrouping(String(value ?? ""));
  const n = Number(strippedBase);
  const editing = focused && !readOnly && !disabled;
  const showFormatted = !editing && strippedBase !== "" && Number.isFinite(n);
  const displayValue = showFormatted ? formatAmountInputGrouped(n) : String(value ?? "");

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      className={className}
      disabled={disabled}
      readOnly={readOnly}
      placeholder={placeholder}
      autoComplete={autoComplete}
      title={title}
      aria-label={ariaLabel}
      value={displayValue}
      onFocus={(e) => {
        if (!readOnly && !disabled) {
          setFocused(true);
        }
        onFocusProp?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        if (readOnly || disabled) {
          onBlurProp?.(e);
          return;
        }
        const stripped = stripAmountGrouping(e.target.value);
        if (stripped === "") {
          if (value !== "" && value != null) {
            onChange("");
          }
          onBlurProp?.(e);
          return;
        }
        const num = Number(stripped);
        const next = Number.isFinite(num) ? formatAmountPlain(num) : stripped;
        if (next !== String(value ?? "")) {
          onChange(next);
        }
        onBlurProp?.(e);
      }}
      onChange={(e) => {
        if (readOnly || disabled) {
          return;
        }
        onChange(stripAmountGrouping(e.target.value));
      }}
    />
  );
}

export function FileField({ label, onChange, accept = "image/*", required = false, inputKey }) {
  return (
    <div className="col-12 col-md-6">
      <label className="form-label">{label}</label>
      <input
        key={inputKey}
        className="form-control"
        type="file"
        accept={accept}
        required={required}
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

/**
 * Combobox: type to filter options; optional final row to create a new record (onAddNew).
 */
export function AutocompleteField({
  label,
  value,
  onChange,
  options,
  required = false,
  placeholder = "Type to search…",
  onAddNew,
  addNewLabel,
  disabled = false,
  wrapperClassName = "col-12 col-md-6",
  hideLabel = false,
  inputClassName = "form-control",
  /** When set, called with debounced input text so parent can load `options` from the API (no local filtering). */
  onDebouncedInputChange,
  debounceMs = 400,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropRect, setDropRect] = useState(null);
  const rootRef = useRef(null);
  const anchorRef = useRef(null);
  const listId = useRef(`ac-${Math.random().toString(36).slice(2)}`).current;

  const serverDriven = Boolean(onDebouncedInputChange);
  const debouncedForServer = useDebouncedValue(query, debounceMs);
  useEffect(() => {
    onDebouncedInputChange?.(debouncedForServer.trim());
  }, [debouncedForServer, onDebouncedInputChange]);

  const selected = options.find((o) => String(o.value) === String(value));
  const displayLabel = selected?.label ?? "";

  useLayoutEffect(() => {
    if (!open) {
      setDropRect(null);
      return;
    }
    function measure() {
      const el = anchorRef.current;
      if (!el) {
        return;
      }
      const r = el.getBoundingClientRect();
      setDropRect({
        top: r.bottom + 2,
        left: r.left,
        width: Math.max(r.width, 12 * 16),
      });
    }
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (anchorRef.current && ro) {
      ro.observe(anchorRef.current);
    }
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDoc(e) {
      if (rootRef.current?.contains(e.target)) {
        return;
      }
      if (e.target.closest?.("[data-ta-ac-portal]")) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (selected) {
      setQuery(selected.label);
    } else if (!value) {
      setQuery("");
    }
  }, [value, selected]);

  const q = query.trim().toLowerCase();
  const filtered = serverDriven
    ? options
    : options.filter((o) => {
        if (!q) {
          return true;
        }
        const hay = `${o.label} ${o.searchText || ""}`.toLowerCase();
        return hay.includes(q);
      });

  const showCreate =
    Boolean(onAddNew) &&
    query.trim().length > 0 &&
    addNewLabel &&
    !options.some((o) => String(o.label).toLowerCase() === query.trim().toLowerCase());

  const rows = showCreate ? [...filtered, { __create: true, q: query.trim() }] : filtered;

  function pickOption(opt) {
    if (opt.__create) {
      onAddNew(opt.q);
      setOpen(false);
      return;
    }
    onChange(String(opt.value));
    setQuery(opt.label);
    setOpen(false);
  }

  const listPortal =
    open && rows.length > 0 && dropRect && typeof document !== "undefined"
      ? createPortal(
      <ul
        id={listId}
        data-ta-ac-portal="1"
        role="listbox"
        className="list-group shadow-sm ta-ac-list ta-ac-list--portal"
        style={{
          position: "fixed",
          top: dropRect.top,
          left: dropRect.left,
          width: dropRect.width,
          zIndex: 4000,
          maxHeight: "14rem",
          overflowY: "auto",
        }}
      >
        {rows.map((opt, i) => (
          <li
            key={opt.__create ? "__new__" : `${opt.value}-${i}`}
            role="option"
            className="list-group-item list-group-item-action py-2 small"
            style={{ cursor: "pointer" }}
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => pickOption(opt)}
          >
            {opt.__create
              ? typeof addNewLabel === "function"
                ? addNewLabel(opt.q)
                : `${addNewLabel} "${opt.q}"`
              : opt.label}
          </li>
        ))}
      </ul>,
      document.body,
        )
      : null;

  return (
    <div className={wrapperClassName} ref={rootRef}>
      {label && !hideLabel ? <label className="form-label">{label}</label> : null}
      <div className="position-relative" ref={anchorRef}>
        <input
          type="text"
          className={inputClassName}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          required={required && !value}
          disabled={disabled}
          placeholder={placeholder}
          value={open ? query : displayLabel || query}
          style={{ whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}
          onFocus={() => {
            setOpen(true);
            setQuery(displayLabel || query);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value) {
              onChange("");
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </div>
      {listPortal}
    </div>
  );
}

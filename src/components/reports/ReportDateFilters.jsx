import { useMemo } from "react";

function toInputDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function defaultDateRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { dateFrom: toInputDate(from), dateTo: toInputDate(to) };
}

export function ReportDateFilters({
  dateFrom,
  dateTo,
  onChangeFrom,
  onChangeTo,
  overdueOnly,
  onChangeOverdue,
  showOverdue,
  disabled,
  /** One horizontal row (From / To / overdue) for report toolbars. */
  variant = "stacked",
}) {
  const ids = useMemo(
    () => ({
      from: "rep-df",
      to: "rep-dt",
      od: "rep-od",
    }),
    [],
  );

  if (variant === "inline") {
    return (
      <div className="d-flex flex-nowrap align-items-center gap-2 gap-md-3 ta-report-date-filters ta-report-date-filters--inline">
        <div className="ta-report-date-filters__pair ta-bookings-filter-field">
          <label className="form-label mb-0 text-nowrap" htmlFor={ids.from}>
            From
          </label>
          <input
            id={ids.from}
            type="date"
            className="form-control"
            value={dateFrom}
            onChange={(e) => onChangeFrom(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="ta-report-date-filters__pair ta-bookings-filter-field">
          <label className="form-label mb-0 text-nowrap" htmlFor={ids.to}>
            To
          </label>
          <input
            id={ids.to}
            type="date"
            className="form-control"
            value={dateTo}
            onChange={(e) => onChangeTo(e.target.value)}
            disabled={disabled}
          />
        </div>
        {showOverdue ? (
          <div className="ta-report-date-filters__pair ta-bookings-filter-field">
            <div className="form-check mb-0">
              <input
                id={ids.od}
                type="checkbox"
                className="form-check-input"
                checked={Boolean(overdueOnly)}
                onChange={(e) => onChangeOverdue(e.target.checked)}
                disabled={disabled}
              />
              <label className="form-check-label" htmlFor={ids.od}>
                Overdue only
              </label>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="row g-3 align-items-end ta-report-date-filters">
      <div className="col-md-3 ta-bookings-filter-field">
        <label className="form-label" htmlFor={ids.from}>
          From
        </label>
        <input
          id={ids.from}
          type="date"
          className="form-control"
          value={dateFrom}
          onChange={(e) => onChangeFrom(e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="col-md-3 ta-bookings-filter-field">
        <label className="form-label" htmlFor={ids.to}>
          To
        </label>
        <input
          id={ids.to}
          type="date"
          className="form-control"
          value={dateTo}
          onChange={(e) => onChangeTo(e.target.value)}
          disabled={disabled}
        />
      </div>
      {showOverdue ? (
        <div className="col-md-3 ta-bookings-filter-field">
          <div className="form-check mt-md-4 pt-md-2">
            <input
              id={ids.od}
              type="checkbox"
              className="form-check-input"
              checked={Boolean(overdueOnly)}
              onChange={(e) => onChangeOverdue(e.target.checked)}
              disabled={disabled}
            />
            <label className="form-check-label" htmlFor={ids.od}>
              Overdue only
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}

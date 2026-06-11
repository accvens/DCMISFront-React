import { useCallback, useEffect, useState } from "react";
import { AlertMessage } from "../access/AccessShared.jsx";
import { defaultDateRange, ReportDateFilters } from "./ReportDateFilters.jsx";
import { isReportNumericColumn } from "./reportUi.js";
import { downloadReportXlsx, triggerBlobDownload } from "./ReportsShared.jsx";

/**
 * @param {{
 *   token: string,
 *   apiRequest: Function,
 *   title: string,
 *   description?: string,
 *   apiPath: string,
 *   filename: string,
 *   columns: { key: string, label: string }[],
 *   rowsKey?: string,
 *   showOverdue?: boolean,
 * }} props
 */
export default function TabularReportPage({
  token,
  apiRequest,
  title,
  description = "",
  apiPath,
  filename,
  columns,
  rowsKey = "rows",
  showOverdue = false,
}) {
  const init = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(init.dateFrom);
  const [dateTo, setDateTo] = useState(init.dateTo);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
        format: "json",
      });
      if (showOverdue) {
        q.set("overdue_only", overdueOnly ? "true" : "false");
      }
      const res = await apiRequest(`${apiPath}?${q}`, { token });
      setRows(Array.isArray(res?.[rowsKey]) ? res[rowsKey] : []);
    } catch (e) {
      setError(e?.message || "Failed to load report.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiRequest, token, dateFrom, dateTo, overdueOnly, apiPath, rowsKey, showOverdue]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      const params = { date_from: dateFrom, date_to: dateTo };
      if (showOverdue) {
        params.overdue_only = overdueOnly ? "true" : "false";
      }
      const blob = await downloadReportXlsx(token, apiPath, params);
      triggerBlobDownload(blob, filename);
    } catch (e) {
      setError(e?.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="ta-report-page">
      <div className="card border-0 shadow-sm ta-mis-page__card">
        <div className="card-body p-4 p-lg-5">
          <div className="mb-4">
            <h1 className="h4 mb-1 text-primary fw-semibold">{title}</h1>
            {description?.trim() ? <p className="text-muted small mb-0">{description.trim()}</p> : null}
          </div>

          <div className="ta-bookings-filters-bar ta-report-filters-toolbar mb-4">
            <ReportDateFilters
              variant="inline"
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChangeFrom={setDateFrom}
              onChangeTo={setDateTo}
              overdueOnly={overdueOnly}
              onChangeOverdue={setOverdueOnly}
              showOverdue={showOverdue}
              disabled={loading}
            />
            <div className="ta-report-filters-toolbar__actions">
              <button type="button" className="btn btn-primary" disabled={loading} onClick={load}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    Loading…
                  </>
                ) : (
                  "Apply"
                )}
              </button>
              <button
                type="button"
                className="btn btn-outline-primary"
                disabled={loading || exporting}
                onClick={handleExport}
              >
                {exporting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    Exporting…
                  </>
                ) : (
                  <>
                    <i className="uil uil-file-download-alt me-1" aria-hidden="true" />
                    Export Excel
                  </>
                )}
              </button>
            </div>
          </div>

          {error ? <AlertMessage className="mb-4" message={error} /> : null}

          <section className="ta-mis-section">
            {loading && rows.length === 0 ? (
              <div className="ta-mis-loading text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading</span>
                </div>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0 ta-mis-table ta-report-table">
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th
                          key={c.key}
                          scope="col"
                          className={isReportNumericColumn(c.key) ? "text-end" : ""}
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && !loading ? (
                      <tr>
                        <td colSpan={columns.length} className="text-muted text-center py-5">
                          —
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, idx) => (
                        <tr key={row.id ?? row.sr ?? idx}>
                          {columns.map((c) => {
                            const num = isReportNumericColumn(c.key);
                            return (
                              <td
                                key={c.key}
                                className={
                                  num ? "text-end ta-mis-table__value" : "ta-mis-table__label"
                                }
                              >
                                {row[c.key] ?? "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

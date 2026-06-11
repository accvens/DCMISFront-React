import { useCallback, useState } from "react";
import { formatCurrency } from "../../formatAmount.js";
import { AlertMessage } from "../access/AccessShared.jsx";
import { CustomerAutocomplete, mergeUniqueById } from "../customers/CustomersShared.jsx";
import { defaultDateRange, ReportDateFilters } from "./ReportDateFilters.jsx";
import { downloadReportXlsx, triggerBlobDownload } from "./ReportsShared.jsx";

function formatCellAmount(raw) {
  if (raw == null || raw === "") {
    return "—";
  }
  return formatCurrency(String(raw));
}

export default function CustomerLedgerReportPage({ token, apiRequest }) {
  const init = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(init.dateFrom);
  const [dateTo, setDateTo] = useState(init.dateTo);
  const [customerId, setCustomerId] = useState("");
  const [customersList, setCustomersList] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!String(customerId || "").trim()) {
      setError("Select a customer.");
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({
        customer_id: String(customerId).trim(),
        date_from: dateFrom,
        date_to: dateTo,
        format: "json",
      });
      const res = await apiRequest(`/reports/customer-ledger?${q}`, { token });
      setData(res);
    } catch (e) {
      setError(e?.message || "Failed to load ledger.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiRequest, token, customerId, dateFrom, dateTo]);

  async function handleExport() {
    if (!String(customerId || "").trim()) {
      setError("Select a customer.");
      return;
    }
    setExporting(true);
    setError("");
    try {
      const blob = await downloadReportXlsx(token, "/reports/customer-ledger", {
        customer_id: String(customerId).trim(),
        date_from: dateFrom,
        date_to: dateTo,
      });
      triggerBlobDownload(blob, "customer-ledger.xlsx");
    } catch (e) {
      setError(e?.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  const lines = Array.isArray(data?.lines) ? data.lines : [];

  return (
    <div className="ta-report-page ta-customer-ledger-page">
      <div className="card border-0 shadow-sm ta-mis-page__card">
        <div className="card-body p-4 p-lg-5">
          <div className="mb-4">
            <h1 className="h4 mb-1 text-primary fw-semibold">Customer ledger</h1>
          </div>

          <div className="ta-bookings-filters-bar ta-report-filters-toolbar mb-4">
            <div className="ta-bookings-filter-field ta-report-filters-toolbar__customer">
              <CustomerAutocomplete
                value={customerId}
                onChange={(v) => {
                  setCustomerId(v || "");
                  setData(null);
                }}
                apiRequest={apiRequest}
                token={token}
                customers={customersList}
                onResolvedRecord={(c) => setCustomersList((prev) => mergeUniqueById(prev, [c]))}
                required
                hideLabel
                wrapperClassName="w-100 min-w-0"
                placeholder="Type customer to search"
              />
            </div>
            <ReportDateFilters
              variant="inline"
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChangeFrom={setDateFrom}
              onChangeTo={setDateTo}
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
                disabled={loading || exporting || !String(customerId || "").trim()}
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

          {data ? (
            <>
              <div className="row g-3 mb-4">
                <div className="col-md-4">
                  <div className="ta-mis-kpi h-100">
                    <span className="ta-mis-kpi__label">Scoped sales</span>
                    <span className="ta-mis-kpi__value">{formatCellAmount(data.scoped_sales)}</span>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="ta-mis-kpi h-100">
                    <span className="ta-mis-kpi__label">Amount received</span>
                    <span className="ta-mis-kpi__value">{formatCellAmount(data.amount_received_customer)}</span>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="ta-mis-kpi h-100">
                    <span className="ta-mis-kpi__label">Balance due</span>
                    <span className="ta-mis-kpi__value">{formatCellAmount(data.balance_due)}</span>
                  </div>
                </div>
              </div>

              <section className="ta-mis-section">
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0 ta-mis-table">
                    <thead>
                      <tr>
                        <th scope="col">Sr</th>
                        <th scope="col">Date</th>
                        <th scope="col">Particulars</th>
                        <th scope="col">Reference</th>
                        <th scope="col" className="text-end">
                          Debit (₹)
                        </th>
                        <th scope="col" className="text-end">
                          Credit (₹)
                        </th>
                        <th scope="col" className="text-end">
                          Balance (₹)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-muted text-center py-4">
                            —
                          </td>
                        </tr>
                      ) : (
                        lines.map((row) => (
                          <tr key={`ledger-line-${row.sr}`}>
                            <td className="ta-mis-table__label">{row.sr}</td>
                            <td className="ta-mis-table__label">{row.txn_date || "—"}</td>
                            <td className="ta-mis-table__label">{row.particulars || "—"}</td>
                            <td className="small text-break">{row.reference || "—"}</td>
                            <td className="text-end ta-mis-table__value">
                              {row.debit ? formatCurrency(row.debit) : "—"}
                            </td>
                            <td className="text-end ta-mis-table__value">
                              {row.credit ? formatCurrency(row.credit) : "—"}
                            </td>
                            <td className="text-end ta-mis-table__value fw-semibold">
                              {formatCurrency(row.balance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { formatCurrency, stripAmountGrouping } from "../../formatAmount.js";
import { AlertMessage } from "../access/AccessShared.jsx";
import { defaultDateRange, ReportDateFilters } from "./ReportDateFilters.jsx";
import { downloadReportXlsx, triggerBlobDownload } from "./ReportsShared.jsx";

/** @typedef {"inr" | "int" | "pct" | "plain"} MisFormat */

function formatMisCell(raw, kind) {
  if (raw == null || raw === "") {
    return "—";
  }
  const s = String(raw);
  if (kind === "inr") {
    return formatCurrency(s);
  }
  if (kind === "int") {
    const n = Math.round(Number(stripAmountGrouping(s)));
    if (!Number.isFinite(n)) {
      return s;
    }
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
  }
  if (kind === "pct") {
    const n = Number(stripAmountGrouping(s));
    if (!Number.isFinite(n)) {
      return s;
    }
    return `${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}%`;
  }
  return s;
}

/** @type {{ title: string, rows: { key: string, label: string, format: MisFormat }[] }[]} */
const MIS_SECTIONS = [
  {
    title: "Trading",
    rows: [
      { key: "sales", label: "Sales", format: "inr" },
      { key: "sales_commission", label: "Sales commission", format: "inr" },
      { key: "sales_return", label: "Sales return", format: "inr" },
      { key: "purchase", label: "Purchase", format: "inr" },
      { key: "purchase_return", label: "Purchase return", format: "inr" },
    ],
  },
  {
    title: "Profitability",
    rows: [
      { key: "gross_profit", label: "Gross profit", format: "inr" },
      { key: "gross_profit_percent", label: "Gross profit %", format: "pct" },
      { key: "operating_expenses", label: "Operating expenses", format: "inr" },
      { key: "net_profit", label: "Net profit", format: "inr" },
      { key: "net_profit_percent", label: "Net profit %", format: "pct" },
    ],
  },
  {
    title: "Activity",
    rows: [
      { key: "num_sales_bills", label: "No. of bookings", format: "int" },
      { key: "new_customers", label: "No. of new customers (created in period)", format: "int" },
      { key: "repeat_customer_bookings", label: "No. of repeat customer bookings", format: "int" },
      { key: "amount_received", label: "Total PI amount received (in period)", format: "inr" },
      { key: "num_vendor_invoices", label: "No. of vendor invoices", format: "int" },
      { key: "amount_paid", label: "Total payment made to vendors", format: "inr" },
    ],
  },
  {
    title: "Cash position",
    rows: [
      { key: "cash_opening_balance", label: "Cash in hand on first day of range", format: "inr" },
      { key: "cash_closing_balance", label: "Cash in hand on last day of range", format: "inr" },
    ],
  },
];

const KPI_KEYS = [
  { key: "sales", label: "Sales" },
  { key: "gross_profit", label: "Gross profit" },
  { key: "amount_received", label: "Amount received" },
];

export default function MisReportPage({ token, apiRequest }) {
  const init = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(init.dateFrom);
  const [dateTo, setDateTo] = useState(init.dateTo);
  const [data, setData] = useState(null);
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
      const res = await apiRequest(`/reports/mis?${q}`, { token });
      setData(res);
    } catch (e) {
      setError(e?.message || "Failed to load MIS.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiRequest, token, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      const blob = await downloadReportXlsx(token, "/reports/mis", {
        date_from: dateFrom,
        date_to: dateTo,
      });
      triggerBlobDownload(blob, "mis-report.xlsx");
    } catch (e) {
      setError(e?.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="ta-report-page ta-mis-page">
      <div className="card border-0 shadow-sm ta-mis-page__card">
        <div className="card-body p-4 p-lg-5">
          <div className="ta-bookings-filters-bar ta-report-filters-toolbar mb-4">
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

          {loading && !data ? (
            <div className="ta-mis-loading text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading</span>
              </div>
            </div>
          ) : null}

          {data ? (
            <>
              <div className="row g-3 mb-4">
                {KPI_KEYS.map(({ key, label }) => (
                  <div key={key} className="col-md-4">
                    <div className="ta-mis-kpi h-100">
                      <span className="ta-mis-kpi__label">{label}</span>
                      <span className="ta-mis-kpi__value">{formatMisCell(data[key], "inr")}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="row g-4">
                {MIS_SECTIONS.map((section) => (
                  <div key={section.title} className="col-12 col-xl-6">
                    <section className="ta-mis-section h-100">
                      <div className="table-responsive">
                        <table className="table table-sm table-hover align-middle mb-0 ta-mis-table">
                          <thead>
                            <tr>
                              <th scope="col">Particulars</th>
                              <th scope="col" className="text-end">
                                Value
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.rows.map((row) => (
                              <tr key={row.key}>
                                <td className="ta-mis-table__label">{row.label}</td>
                                <td className="text-end ta-mis-table__value">
                                  {formatMisCell(data[row.key], row.format)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

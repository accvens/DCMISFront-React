import { resolveApiBase } from "../../apiOrigin.js";

export const REPORT_ROUTES = [
  { to: "/reports/mis", label: "MIS" },
  { to: "/reports/accounts-receivable", label: "Accounts Receivable" },
  { to: "/reports/accounts-payable", label: "Accounts Payable" },
  { to: "/reports/customer-ledger", label: "Customer Ledger" },
  { to: "/reports/tcs", label: "TCS" },
  { to: "/reports/sales", label: "Sales Report" },
  { to: "/reports/purchase", label: "Purchase Report" },
  { to: "/reports/customer-summary", label: "Customer Report" },
];

/**
 * Download report as .xlsx (format=xlsx). Params must match the JSON GET.
 */
export async function downloadReportXlsx(token, path, params) {
  const base = resolveApiBase();
  const qs = new URLSearchParams({ ...params, format: "xlsx" });
  const url = `${base}${path}?${qs.toString()}`;
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    let msg = text?.slice(0, 200) || res.statusText;
    try {
      const j = JSON.parse(text);
      msg = j.detail || j.message || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg || "Export failed.");
  }
  return res.blob();
}

export function triggerBlobDownload(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

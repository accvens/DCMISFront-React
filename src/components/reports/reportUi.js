/** Column keys that should be right-aligned (amounts, counts, rates). */
const NUMERIC_COLUMN_KEYS = new Set([
  "sr",
  "pax",
  "invoice_amount",
  "balance_due",
  "amount_received",
  "payment",
  "gst",
  "tcs",
  "net_amount",
  "taxable_amount",
  "amount_payable",
  "sales_commission",
  "tds",
  "order_value",
  "order_margin",
  "tcs_rate",
]);

export function isReportNumericColumn(key) {
  return NUMERIC_COLUMN_KEYS.has(String(key || ""));
}

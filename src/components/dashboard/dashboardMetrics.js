import { parseAmountNumeric } from "../../formatAmount.js";
import { formatDate } from "../../formatDate.js";

export const DASH_CHART_OPTIONS = [
  { value: "year", label: "This Year" },
  { value: "month", label: "This Month" },
  { value: "week", label: "This Week" },
];

export const DASH_OVERALL_OPTIONS = [
  { value: "6m", label: "Last 6 Months" },
  { value: "month", label: "This Month" },
  { value: "week", label: "This Week" },
];

/** Inner height (px) for Sales vs Purchase bar columns — must match CSS. */
export const DASH_CHART_BAR_HEIGHT = 180;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function getChartDateRange(period, now = new Date()) {
  const end = endOfDay(now);
  if (period === "week") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 6);
    return { start, end };
  }
  if (period === "month") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 29);
    return { start, end };
  }
  const start = startOfDay(new Date(now.getFullYear(), 0, 1));
  return { start, end };
}

export function getOverallDateRange(period, now = new Date()) {
  const end = endOfDay(now);
  if (period === "6m") {
    const start = startOfDay(new Date(now));
    start.setMonth(start.getMonth() - 6);
    return { start, end };
  }
  if (period === "month") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 29);
    return { start, end };
  }
  const start = startOfDay(new Date(now));
  start.setDate(start.getDate() - 6);
  return { start, end };
}

/** Overlap of Sales-chart and Customers-overview period selectors. */
export function intersectDateRanges(a, b) {
  const start = a.start > b.start ? a.start : b.start;
  const end = a.end < b.end ? a.end : b.end;
  if (start.getTime() > end.getTime()) {
    const empty = startOfDay(start);
    return { start: empty, end: endOfDay(empty) };
  }
  return { start: startOfDay(start), end: endOfDay(end) };
}

export function formatDashboardRangeLabel(range) {
  if (!range?.start || !range?.end) {
    return "";
  }
  const startKey = localDateKey(range.start);
  const endKey = localDateKey(range.end);
  return `${formatDate(startKey)} – ${formatDate(endKey)}`;
}

function parseTs(raw) {
  if (raw == null || raw === "") {
    return null;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDayOnly(isoDate) {
  if (!isoDate || String(isoDate).length < 8) {
    return null;
  }
  const s = String(isoDate).slice(0, 10);
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getBookingTimestamp(booking) {
  return parseTs(booking.created_at) || parseDayOnly(booking.travel_start_date);
}

export function getPaymentTimestamp(payment) {
  return parseDayOnly(payment.payment_date) || parseTs(payment.created_at);
}

export function getVendorPaymentTimestamp(payment) {
  return parseDayOnly(payment.payment_date) || parseTs(payment.created_at);
}

export function inRange(ts, start, end) {
  if (!ts) {
    return false;
  }
  return ts >= start && ts <= end;
}

export function filterBookings(bookings, start, end) {
  return bookings.filter((b) => inRange(getBookingTimestamp(b), start, end));
}

export function filterPayments(payments, start, end) {
  return payments.filter((p) => inRange(getPaymentTimestamp(p), start, end));
}

export function filterVendorPayments(list, start, end) {
  return list.filter((p) => inRange(getVendorPaymentTimestamp(p), start, end));
}

export function prevWindow(start, end) {
  const len = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 86400000);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd.getTime() - len);
  return { start: startOfDay(prevStart), end: prevEnd };
}

export function pctChangeMini(cur, prev) {
  if (prev === 0 && cur === 0) {
    return { text: "0% since last month", tone: "muted" };
  }
  if (prev === 0) {
    return { text: "+100% since last month", tone: "pos" };
  }
  const p = Math.round(((cur - prev) / Math.abs(prev)) * 100);
  const sign = p > 0 ? "+" : "";
  const tone = p >= 0 ? "pos" : "neg";
  return { text: `${sign}${p}% since last month`, tone };
}

export function pctChangeWide(cur, prev) {
  if (prev === 0 && cur === 0) {
    return { text: "0% vs Last Month", tone: "muted" };
  }
  if (prev === 0) {
    return { text: "+100% vs Last Month", tone: "pos" };
  }
  const p = Math.round(((cur - prev) / Math.abs(prev)) * 100);
  const sign = p > 0 ? "+" : "";
  const tone = p >= 0 ? "pos" : "neg";
  return { text: `${sign}${p}% vs Last Month`, tone };
}

export function formatDashDayLabel(isoDateStr) {
  const formatted = formatDate(isoDateStr);
  return formatted === "-" ? isoDateStr : formatted;
}

export function formatCompactCount(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`.replace(".0M", "M");
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`.replace(".0K", "K");
  }
  return String(num);
}

function localDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function recordDayKey(raw) {
  const s = String(raw ?? "").trim();
  if (s.length >= 10 && s.includes("-")) {
    return s.slice(0, 10);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : localDateKey(d);
}

function paymentDayKey(payment) {
  return recordDayKey(payment?.payment_date || payment?.created_at);
}

function bookingDayKey(booking) {
  const created = recordDayKey(booking?.created_at);
  if (created) {
    return created;
  }
  return recordDayKey(booking?.travel_start_date);
}

function sumDayBookings(bookings, dayKey) {
  let total = 0;
  for (const booking of bookings) {
    if (bookingDayKey(booking) === dayKey) {
      total += parseAmountNumeric(booking.total_amount);
    }
  }
  return total;
}

function sumDayVendor(vendorPayments, dayKey) {
  let s = 0;
  for (const p of vendorPayments) {
    if (paymentDayKey(p) === dayKey) {
      s += parseAmountNumeric(p.amount);
    }
  }
  return s;
}

function monthKeyFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return `${String(m).padStart(2, "0")}-${y}`;
}

/** Buckets for bar chart within `range` (bookings/payments already filtered to range). */
export function buildBarBuckets(chartPeriod, range, bookings, payments, vendorPayments) {
  const { start, end } = range;
  if (chartPeriod === "week") {
    const keys = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      keys.push(localDateKey(d));
    }
    return keys.map((key) => ({
      key,
      label: formatDashDayLabel(key),
      sales: sumDayBookings(bookings, key),
      purchase: sumDayVendor(vendorPayments, key),
    }));
  }

  if (chartPeriod === "month") {
    const buckets = [];
    for (let b = 0; b < 6; b += 1) {
      let sales = 0;
      let purchase = 0;
      let labelKey = "";
      for (let i = 0; i < 5; i += 1) {
        const d = new Date(start);
        d.setDate(start.getDate() + b * 5 + i);
        if (d > end) {
          break;
        }
        const k = localDateKey(d);
        if (!labelKey) {
          labelKey = k;
        }
        sales += sumDayBookings(bookings, k);
        purchase += sumDayVendor(vendorPayments, k);
      }
      buckets.push({
        key: `w${b}`,
        label: labelKey ? formatDashDayLabel(labelKey) : `W${b + 1}`,
        sales,
        purchase,
      });
    }
    return buckets;
  }

  const months = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endMonth) {
    months.push(monthKeyFromDate(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months.map((ym) => {
    let sales = 0;
    let purchase = 0;
    for (const booking of bookings) {
      const k = bookingDayKey(booking);
      if (k.startsWith(ym)) {
        sales += parseAmountNumeric(booking.total_amount);
      }
    }
    for (const p of vendorPayments) {
      const k = paymentDayKey(p);
      if (k.startsWith(ym)) {
        purchase += parseAmountNumeric(p.amount);
      }
    }
    return { key: ym, label: monthLabel(ym), sales, purchase };
  });
}

export function niceYAxisMax(barBuckets) {
  const maxVal = Math.max(0, ...barBuckets.flatMap((b) => [b.sales, b.purchase]));
  if (maxVal <= 0) {
    return 10;
  }
  const padded = maxVal * 1.12;
  const rough = Math.ceil(padded);
  const exp = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / exp;
  let niceNorm = 10;
  if (norm <= 1) {
    niceNorm = 1;
  } else if (norm <= 2) {
    niceNorm = 2;
  } else if (norm <= 5) {
    niceNorm = 5;
  }
  return niceNorm * exp;
}

/** Y-axis tick values from 0 through max (about 5 ticks). */
export function buildYAxisTicks(yMax) {
  if (yMax <= 0) {
    return [0, 5, 10];
  }
  const targetTicks = 5;
  const roughStep = yMax / targetTicks;
  const exp = 10 ** Math.floor(Math.log10(roughStep));
  const norm = roughStep / exp;
  let stepNorm = 1;
  if (norm <= 1) {
    stepNorm = 1;
  } else if (norm <= 2) {
    stepNorm = 2;
  } else if (norm <= 5) {
    stepNorm = 5;
  } else {
    stepNorm = 10;
  }
  const step = Math.max(stepNorm * exp, 1);
  const ticks = [];
  for (let v = 0; v <= yMax + step * 0.01; v += step) {
    ticks.push(Math.round(v));
  }
  const top = ticks[ticks.length - 1];
  if (top < yMax) {
    ticks.push(Math.ceil(yMax / step) * step);
  }
  return ticks;
}

export function chartBarHeightPx(value, yMax) {
  if (!yMax || yMax <= 0 || value <= 0) {
    return 0;
  }
  const h = Math.round((value / yMax) * DASH_CHART_BAR_HEIGHT);
  return Math.max(4, h);
}

function isCancelledBooking(booking) {
  return String(booking?.status || "").toLowerCase() === "cancelled";
}

/** Sum of product line costs on bookings (catalogue / vendor lines), not customer order total. */
export function sumBookingProductCosts(bookings) {
  let total = 0;
  for (const booking of bookings) {
    if (isCancelledBooking(booking)) {
      continue;
    }
    const lines = booking?.products;
    if (!Array.isArray(lines) || !lines.length) {
      continue;
    }
    for (const line of lines) {
      const raw =
        line.net_payable ?? line.taxable_amount ?? line.gross_amount ?? line.total_amount ?? line.price;
      total += parseAmountNumeric(raw);
    }
  }
  return total;
}

/** Estimated profit from booking margin % when set; otherwise sales minus product line cost. */
export function sumBookingGrossProfit(bookings) {
  let total = 0;
  for (const booking of bookings) {
    if (isCancelledBooking(booking)) {
      continue;
    }
    const sales = parseAmountNumeric(booking.total_amount);
    const marginPct = Number(booking.estimated_margin);
    if (Number.isFinite(marginPct) && marginPct > 0) {
      total += (sales * marginPct) / 100;
      continue;
    }
    const lineCost = sumBookingProductCosts([booking]);
    total += sales - lineCost;
  }
  return total;
}

/** Refund / return payment lines (customer or vendor) by status label. */
export function sumPaymentReturns(payments, vendorPayments) {
  const isReturnStatus = (status) => {
    const st = String(status || "").toLowerCase();
    return st.includes("return") || st.includes("refund") || st.includes("reversal");
  };
  let total = 0;
  for (const p of payments) {
    if (isReturnStatus(p.status)) {
      total += parseAmountNumeric(p.amount);
    }
  }
  for (const p of vendorPayments) {
    if (isReturnStatus(p.status)) {
      total += parseAmountNumeric(p.amount);
    }
  }
  return total;
}

function aggregateCore(bookings, payments, vendorPayments) {
  const activeBookings = bookings.filter((b) => !isCancelledBooking(b));
  const totalSales = activeBookings.reduce(
    (sum, b) => sum + parseAmountNumeric(b.total_amount),
    0,
  );
  const totalPurchase = vendorPayments.reduce((sum, p) => sum + parseAmountNumeric(p.amount), 0);
  const totalReceived = payments.reduce((sum, p) => sum + parseAmountNumeric(p.amount), 0);
  const outstanding = Math.max(0, totalSales - totalReceived);
  const totalExpenses = sumBookingProductCosts(activeBookings);
  const productCosts = totalExpenses;
  const paymentReturns = sumPaymentReturns(payments, vendorPayments);
  const pendingCustomerPayments = payments
    .filter((p) => String(p.status || "").toLowerCase() === "pending")
    .reduce((sum, p) => sum + parseAmountNumeric(p.amount), 0);
  // Gross profit: booking revenue minus vendor payouts (matches booking economics).
  const totalProfit = totalSales - totalPurchase;
  // Wide card: vendor payouts in period (primary outflow); fall back to product line costs.
  const totalExpensesWide = totalPurchase > 0 ? totalPurchase : productCosts;
  const vendorIds = new Set(
    vendorPayments.map((p) => p.vendor_id).filter((id) => id != null && id !== ""),
  );
  return {
    totalSales,
    totalPurchase,
    totalReceived,
    outstanding,
    totalExpenses,
    productCosts,
    paymentReturns,
    pendingCustomerPayments,
    totalProfit,
    totalExpensesWide,
    vendorCount: vendorIds.size,
  };
}

/** KPI row only — not tied to chart period dropdowns (uses calendar year). */
export function computeKpiBlock(bookings, payments, vendorPayments) {
  return computeMainBlock(bookings, payments, vendorPayments, "year");
}

/** Sales vs Purchase bar chart — bucket layout from chartPeriod, data from shared filter range. */
export function computeSalesChartBlock(bookings, payments, vendorPayments, chartPeriod, range) {
  const b = filterBookings(bookings, range.start, range.end);
  const p = filterPayments(payments, range.start, range.end);
  const v = filterVendorPayments(vendorPayments, range.start, range.end);
  const barBuckets = buildBarBuckets(chartPeriod, range, b, p, v);
  return {
    range,
    barBuckets,
    yAxisMax: niceYAxisMax(barBuckets),
  };
}

export function computeMainBlock(bookings, payments, vendorPayments, chartPeriod) {
  const range = getChartDateRange(chartPeriod);
  const prev = prevWindow(range.start, range.end);
  const b = filterBookings(bookings, range.start, range.end);
  const p = filterPayments(payments, range.start, range.end);
  const v = filterVendorPayments(vendorPayments, range.start, range.end);
  const bPrev = filterBookings(bookings, prev.start, prev.end);
  const pPrev = filterPayments(payments, prev.start, prev.end);
  const vPrev = filterVendorPayments(vendorPayments, prev.start, prev.end);

  const cur = aggregateCore(b, p, v);
  const prevAgg = aggregateCore(bPrev, pPrev, vPrev);

  const barBuckets = buildBarBuckets(chartPeriod, range, b, p, v);
  const yAxisMax = niceYAxisMax(barBuckets);

  return {
    range,
    ...cur,
    trends: {
      sales: pctChangeMini(cur.totalSales, prevAgg.totalSales),
      purchase: pctChangeMini(cur.totalPurchase, prevAgg.totalPurchase),
      expenses: pctChangeMini(cur.totalExpenses, prevAgg.totalExpenses),
      outstanding: pctChangeMini(cur.outstanding, prevAgg.outstanding),
      profit: pctChangeWide(cur.totalProfit, prevAgg.totalProfit),
      returns: pctChangeWide(cur.paymentReturns, prevAgg.paymentReturns),
      wideExp: pctChangeWide(cur.totalExpensesWide, prevAgg.totalExpensesWide),
    },
    barBuckets,
    yAxisMax,
  };
}

export function computeCustomerSplit(bookings) {
  const byCustomer = new Map();
  for (const booking of bookings) {
    const cid = booking.customer_id;
    if (cid == null) {
      continue;
    }
    byCustomer.set(cid, (byCustomer.get(cid) || 0) + 1);
  }
  let firstTime = 0;
  let returning = 0;
  for (const count of byCustomer.values()) {
    if (count <= 1) {
      firstTime += 1;
    } else {
      returning += 1;
    }
  }
  const total = firstTime + returning;
  const pctFirst = total ? Math.round((firstTime / total) * 100) : 0;
  const pctReturn = total ? Math.round((returning / total) * 100) : 0;
  return { firstTime, returning, pctFirst, pctReturn, total };
}

/** Customers Overview — uses the same date window as the Sales chart (both dropdowns). */
export function computeOverallForRange(bookings, _payments, vendorPayments, range) {
  const b = filterBookings(bookings, range.start, range.end);
  const v = filterVendorPayments(vendorPayments, range.start, range.end);
  const split = computeCustomerSplit(b);
  const donut =
    split.total === 0
      ? [{ key: "empty", label: "No customers in range", count: 1, color: "#e9ecef" }]
      : [
          { key: "ft", label: "First time", count: split.firstTime, color: "#2e8b57" },
          { key: "ret", label: "Return", count: split.returning, color: "#f5b041" },
        ];
  const donutTotal = Math.max(1, donut.reduce((sum, s) => sum + s.count, 0));

  const customerIds = new Set(b.map((x) => x.customer_id).filter((id) => id != null));
  const vendorIds = new Set(v.map((x) => x.vendor_id).filter((id) => id != null && id !== ""));

  return {
    range,
    donut,
    donutTotal,
    split,
    suppliers: vendorIds.size,
    customers: customerIds.size,
    orders: b.length,
  };
}

export function computeOverallBlock(bookings, payments, vendorPayments, overallPeriod) {
  const range = getOverallDateRange(overallPeriod);
  return computeOverallForRange(bookings, payments, vendorPayments, range);
}

export function recentItemsInRange(items, start, end, getTs, limit = 5) {
  return items
    .filter((item) => inRange(getTs(item), start, end))
    .sort((a, c) => (getTs(c)?.getTime() || 0) - (getTs(a)?.getTime() || 0))
    .slice(0, limit);
}

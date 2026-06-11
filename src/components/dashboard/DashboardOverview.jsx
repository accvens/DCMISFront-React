import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { formatCurrencyAmount } from "../../formatAmount.js";
import { buildCustomerRadialRings, CustomerRadialChart } from "./CustomerRadialChart.jsx";
import { DashHoverTip } from "./DashHoverTip.jsx";
import { DashboardSelect } from "./DashboardSelect.jsx";
import { SalesVsPurchaseChart } from "./SalesVsPurchaseChart.jsx";
import { TrendPill } from "./TrendPill.jsx";
import {
  buildYAxisTicks,
  computeKpiBlock,
  computeOverallForRange,
  computeSalesChartBlock,
  DASH_CHART_OPTIONS,
  DASH_OVERALL_OPTIONS,
  formatCompactCount,
  formatDashboardRangeLabel,
  getChartDateRange,
  getOverallDateRange,
} from "./dashboardMetrics.js";

function toneClass(tone) {
  if (tone === "pos") {
    return "pos";
  }
  if (tone === "neg") {
    return "neg";
  }
  return "muted";
}

function DashRupeeIcon({ variant = "mini" }) {
  const isWide = variant === "wide";
  return (
    <svg
      viewBox="0 0 24 24"
      width={isWide ? 24 : 30}
      height={isWide ? 24 : 30}
      aria-hidden="true"
      className={`ta-dash-kpi-rupee-icon ta-dash-kpi-rupee-icon--${variant}`}
    >
      <text
        x="12"
        y="12.5"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={isWide ? "19" : "22"}
        fontWeight="700"
        fill="currentColor"
        fontFamily="Poppins, system-ui, sans-serif"
      >
        ₹
      </text>
    </svg>
  );
}

function formatStatCount(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("en-IN");
}

function formatYAxisTick(value, yMax) {
  if (value === 0) {
    return "0";
  }
  if (yMax >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }
  return String(Math.round(value));
}

function YAxisTicks({ yMax }) {
  const ticks = buildYAxisTicks(yMax);
  return (
    <div className="ta-dash-y-axis">
      {[...ticks].reverse().map((v) => (
        <div key={v} className="ta-dash-y-axis__tick">
          {formatYAxisTick(v, yMax)}
        </div>
      ))}
      <div className="ta-dash-y-axis__unit">Amount (₹)</div>
    </div>
  );
}

export function DashboardOverview({
  bookings,
  payments,
  vendorPayments,
  chartPeriod,
  onChartPeriodChange,
}) {
  const [overallPeriod, setOverallPeriod] = useState("6m");

  const chartRange = useMemo(() => getChartDateRange(chartPeriod), [chartPeriod]);
  const overallRange = useMemo(() => getOverallDateRange(overallPeriod), [overallPeriod]);
  const chartRangeLabel = useMemo(() => formatDashboardRangeLabel(chartRange), [chartRange]);
  const overallRangeLabel = useMemo(() => formatDashboardRangeLabel(overallRange), [overallRange]);

  const kpi = useMemo(
    () => computeKpiBlock(bookings, payments, vendorPayments),
    [bookings, payments, vendorPayments],
  );

  const salesChart = useMemo(
    () => computeSalesChartBlock(bookings, payments, vendorPayments, chartPeriod, chartRange),
    [bookings, payments, vendorPayments, chartPeriod, chartRange],
  );

  const overall = useMemo(
    () => computeOverallForRange(bookings, payments, vendorPayments, overallRange),
    [bookings, payments, vendorPayments, overallRange],
  );

  const { split } = overall;

  const radialRings = useMemo(
    () => buildCustomerRadialRings(split, overall.orders, overall.customers),
    [split, overall.orders, overall.customers],
  );

  return (
    <>
      <div className="row g-3 g-lg-4 mb-3 mb-lg-4 align-items-stretch">
        <div className="col-6 col-xl-3">
          <div className="ta-dash-kpi-mini ta-dash-kpi-mini--rose" title={`Total Sales: ${formatCurrencyAmount(kpi.totalSales)} — ${kpi.trends.sales.text}`}>
            <div className="ta-dash-kpi-mini__head">
              <div className="ta-dash-kpi-mini__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path d="M7 3h8v4H7V3zm0 6h10v12H7V9zm2 2v8h6v-8H9z" fill="currentColor" />
                </svg>
              </div>
            </div>
            <div className="ta-dash-kpi-mini__label">Total Sales</div>
            <div className="ta-dash-kpi-mini__value ta-dash-kpi-mini__value--accent">
              {formatCurrencyAmount(kpi.totalSales)}
            </div>
            <div
              className={`ta-dash-kpi-mini__hint ta-dash-kpi-mini__hint--${toneClass(kpi.trends.sales.tone)}`}
            >
              {kpi.trends.sales.text}
            </div>
          </div>
        </div>
        <div className="col-6 col-xl-3">
          <div className="ta-dash-kpi-mini ta-dash-kpi-mini--mint" title={`Total Purchase: ${formatCurrencyAmount(kpi.totalPurchase)} — ${kpi.trends.purchase.text}`}>
            <div className="ta-dash-kpi-mini__head">
              <div className="ta-dash-kpi-mini__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path
                    d="M17.65 6.35A7.958 7.958 0 0012 4V1L7 6l5 5V7c2.76 0 5 2.24 5 5 0 1.13-.37 2.16-1 3l1.49 1.49A7.905 7.905 0 0020 12a8 8 0 00-2.35-5.65zM12 19v3l5-5-5-5v3c-2.76 0-5-2.24-5-5 0-1.13.37-2.16 1-3L5.51 6.51A7.905 7.905 0 004 12a8 8 0 002.35 5.65L7 19z"
                    fill="currentColor"
                  />
                </svg>
              </div>
            </div>
            <div className="ta-dash-kpi-mini__label">Total Purchase</div>
            <div className="ta-dash-kpi-mini__value">{formatCurrencyAmount(kpi.totalPurchase)}</div>
            <div
              className={`ta-dash-kpi-mini__hint ta-dash-kpi-mini__hint--${toneClass(kpi.trends.purchase.tone)}`}
            >
              {kpi.trends.purchase.text}
            </div>
          </div>
        </div>
        <div className="col-6 col-xl-3">
          <div className="ta-dash-kpi-mini ta-dash-kpi-mini--sky" title={`Total Expenses: ${formatCurrencyAmount(kpi.totalExpenses)} — ${kpi.trends.expenses.text}`}>
            <div className="ta-dash-kpi-mini__head">
              <div className="ta-dash-kpi-mini__icon ta-dash-kpi-mini__icon--rupee" aria-hidden="true">
                <DashRupeeIcon variant="mini" />
              </div>
            </div>
            <div className="ta-dash-kpi-mini__label">Total Expenses</div>
            <div className="ta-dash-kpi-mini__value">{formatCurrencyAmount(kpi.totalExpenses)}</div>
            <div
              className={`ta-dash-kpi-mini__hint ta-dash-kpi-mini__hint--${toneClass(kpi.trends.expenses.tone)}`}
            >
              {kpi.trends.expenses.text}
            </div>
          </div>
        </div>
        <div className="col-6 col-xl-3">
          <div className="ta-dash-kpi-mini ta-dash-kpi-mini--amber" title={`Invoice Due: ${formatCurrencyAmount(kpi.outstanding)} — ${kpi.trends.outstanding.text}`}>
            <div className="ta-dash-kpi-mini__head">
              <div className="ta-dash-kpi-mini__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path d="M4 4h16v4H4V4zm0 6h10v2H4v-2zm0 4h16v2H4v-2zm0 4h7v2H4v-2z" fill="currentColor" />
                </svg>
              </div>
            </div>
            <div className="ta-dash-kpi-mini__label">Invoice Due</div>
            <div className="ta-dash-kpi-mini__value">{formatCurrencyAmount(kpi.outstanding)}</div>
            <div
              className={`ta-dash-kpi-mini__hint ta-dash-kpi-mini__hint--${toneClass(kpi.trends.outstanding.tone)}`}
            >
              {kpi.trends.outstanding.text}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 g-lg-4 mb-3 mb-lg-4 align-items-stretch">
        <div className="col-md-4">
          <div className="ta-dash-kpi-wide" title={`Total Profit: ${formatCurrencyAmount(kpi.totalProfit)} — ${kpi.trends.profit.text}`}>
            <div className="ta-dash-kpi-wide__head">
              <span className="ta-dash-kpi-wide__icon ta-dash-kpi-wide__icon--orange" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="5" y="3" width="10" height="14" rx="1" />
                  <rect x="9" y="7" width="10" height="14" rx="1" opacity="0.55" />
                </svg>
              </span>
            </div>
            <div className="ta-dash-kpi-wide__value">{formatCurrencyAmount(kpi.totalProfit)}</div>
            <div className="ta-dash-kpi-wide__label">Total Profit</div>
            <div className="ta-dash-kpi-wide__footer">
              <span className={`ta-dash-kpi-wide__delta ta-dash-kpi-wide__delta--${toneClass(kpi.trends.profit.tone)}`}>
                {kpi.trends.profit.text}
              </span>
              <NavLink to="/bookings/list" className="ta-dash-kpi-wide__link">
                View
              </NavLink>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="ta-dash-kpi-wide" title={`Payment Returns: ${formatCurrencyAmount(kpi.paymentReturns)} — ${kpi.trends.returns.text}`}>
            <div className="ta-dash-kpi-wide__head">
              <span className="ta-dash-kpi-wide__icon ta-dash-kpi-wide__icon--red" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 10h18" />
                  <path d="M7 15h4" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <div className="ta-dash-kpi-wide__value">{formatCurrencyAmount(kpi.paymentReturns)}</div>
            <div className="ta-dash-kpi-wide__label">Total Payment Returns</div>
            <div className="ta-dash-kpi-wide__footer">
              <span
                className={`ta-dash-kpi-wide__delta ta-dash-kpi-wide__delta--${toneClass(kpi.trends.returns.tone)}`}
              >
                {kpi.trends.returns.text}
              </span>
              <NavLink to="/payments/customer" className="ta-dash-kpi-wide__link ta-dash-kpi-wide__link--red">
                View
              </NavLink>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="ta-dash-kpi-wide" title={`Total Expenses: ${formatCurrencyAmount(kpi.totalExpensesWide)} — ${kpi.trends.wideExp.text}`}>
            <div className="ta-dash-kpi-wide__head">
              <span className="ta-dash-kpi-wide__icon ta-dash-kpi-wide__icon--amber ta-dash-kpi-wide__icon--rupee" aria-hidden="true">
                <DashRupeeIcon variant="wide" />
              </span>
            </div>
            <div className="ta-dash-kpi-wide__value">{formatCurrencyAmount(kpi.totalExpensesWide)}</div>
            <div className="ta-dash-kpi-wide__label">Total Expenses</div>
            <div className="ta-dash-kpi-wide__footer">
              <span
                className={`ta-dash-kpi-wide__delta ta-dash-kpi-wide__delta--${toneClass(kpi.trends.wideExp.tone)}`}
              >
                {kpi.trends.wideExp.text}
              </span>
              <NavLink to="/payments/vendor" className="ta-dash-kpi-wide__link ta-dash-kpi-wide__link--amber">
                View
              </NavLink>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 g-lg-4 align-items-stretch">
        <div className="col-xl-7">
          <div className="ta-dash-panel h-100">
            <div className="ta-dash-panel__head">
              <h5 className="ta-dash-panel__title mb-0">Sales vs Purchase</h5>
              <DashboardSelect
                ariaLabel="Sales chart period"
                value={chartPeriod}
                onChange={onChartPeriodChange}
                options={DASH_CHART_OPTIONS}
              />
            </div>
            {chartRangeLabel ? (
              <p className="ta-dash-panel__range mb-2 mb-md-3">{chartRangeLabel}</p>
            ) : null}
            <div className="ta-dash-bar-chart">
              <YAxisTicks yMax={salesChart.yAxisMax} />
              <div className="ta-dash-bar-chart__main">
                <SalesVsPurchaseChart barBuckets={salesChart.barBuckets} yAxisMax={salesChart.yAxisMax} />
                <div className="ta-dash-chart-legend ta-dash-chart-legend--center">
                  <span>
                    <i className="ta-dash-legend-dot ta-dash-legend-dot--sales" /> Sales (₹)
                  </span>
                  <span>
                    <i className="ta-dash-legend-dot ta-dash-legend-dot--purchase" /> Purchase (₹)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-5">
          <div className="ta-dash-panel h-100">
            <div className="ta-dash-panel__head">
              <h5 className="ta-dash-panel__title mb-0">Customers Overview</h5>
              <DashboardSelect
                ariaLabel="Customers overview period"
                value={overallPeriod}
                onChange={setOverallPeriod}
                options={DASH_OVERALL_OPTIONS}
              />
            </div>
            {overallRangeLabel ? (
              <p className="ta-dash-panel__range mb-2 mb-md-3">{overallRangeLabel}</p>
            ) : null}
            <div className="ta-dash-donut-row">
              <CustomerRadialChart rings={radialRings} />
              <div className="ta-dash-customer-split">
                <DashHoverTip
                  tip={`First-time customers: ${split.firstTime} (${split.pctFirst}% of active customers)`}
                  className="ta-dash-customer-split__col"
                >
                  <div className="ta-dash-customer-split__num">{formatCompactCount(split.firstTime)}</div>
                  <div className="ta-dash-customer-split__lbl ta-dash-customer-split__lbl--first">First Time</div>
                  <TrendPill value={split.pctFirst} />
                </DashHoverTip>
                <div className="ta-dash-customer-split__sep" />
                <DashHoverTip
                  tip={`Returning customers: ${split.returning} (${split.pctReturn}% of active customers)`}
                  className="ta-dash-customer-split__col"
                >
                  <div className="ta-dash-customer-split__num">{formatCompactCount(split.returning)}</div>
                  <div className="ta-dash-customer-split__lbl ta-dash-customer-split__lbl--return">Return</div>
                  <TrendPill value={split.pctReturn} />
                </DashHoverTip>
              </div>
            </div>
            <div className="ta-dash-overall-stats">
              <DashHoverTip tip="Unique vendors with payments in this period" className="ta-dash-overall-stats__cell">
                <div className="ta-dash-overall-stats__num">{formatStatCount(overall.suppliers)}</div>
                <div className="ta-dash-overall-stats__lbl">Suppliers</div>
              </DashHoverTip>
              <div className="ta-dash-overall-stats__sep" />
              <DashHoverTip tip="Unique customers with bookings in this period" className="ta-dash-overall-stats__cell">
                <div className="ta-dash-overall-stats__num">{formatStatCount(overall.customers)}</div>
                <div className="ta-dash-overall-stats__lbl">Customers</div>
              </DashHoverTip>
              <div className="ta-dash-overall-stats__sep" />
              <DashHoverTip tip="Total bookings in this period" className="ta-dash-overall-stats__cell">
                <div className="ta-dash-overall-stats__num">{formatStatCount(overall.orders)}</div>
                <div className="ta-dash-overall-stats__lbl">Orders</div>
              </DashHoverTip>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

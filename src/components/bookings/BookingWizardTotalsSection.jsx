import { formatCurrency, normalizeBookingAmountInput } from "./BookingsShared.jsx";

/** Customer % collected vs booking total — higher is better. */
function customerReceivedProgressToneClass(percent) {
  const p = Number(percent);
  if (!Number.isFinite(p) || p < 0) {
    return "ta-booking-pay-progress__fill--red";
  }
  if (p < 50) {
    return "ta-booking-pay-progress__fill--red";
  }
  if (p < 90) {
    return "ta-booking-pay-progress__fill--yellow";
  }
  return "ta-booking-pay-progress__fill--green";
}

function vendorLineProgressToneClass(percent) {
  const p = Number(percent);
  if (!Number.isFinite(p) || p < 0) {
    return "ta-booking-pay-progress__fill--red";
  }
  if (p < 60) {
    return "ta-booking-pay-progress__fill--red";
  }
  if (p < 85) {
    return "ta-booking-pay-progress__fill--yellow";
  }
  return "ta-booking-pay-progress__fill--green";
}

/** @param {number} rawRatio vendor numerator / budget (uncapped; may exceed 1) */
function vendorBarFillClass(rawRatio) {
  const r = Number(rawRatio);
  if (!Number.isFinite(r) || r < 0) {
    return "ta-booking-pay-progress__fill--red";
  }
  if (r > 1) {
    return "ta-booking-pay-progress__fill--red";
  }
  return vendorLineProgressToneClass(r * 100);
}

/**
 * Wizard header left: one tab-style box per metric in a single horizontal row.
 */
export function BookingWizardTotalsSection({
  customerReceivedTotal,
  totalTourValue,
  vendorLineTotalSum,
  effectiveTourValue,
  vendorProgressVsLabel,
}) {
  const tv = Number(normalizeBookingAmountInput(String(totalTourValue ?? "")));
  const hasTotalTour = Number.isFinite(tv) && tv > 0;
  const customerPct = hasTotalTour
    ? Math.min(100, Math.max(0, (Number(customerReceivedTotal) / tv) * 100))
    : 0;

  const ev = effectiveTourValue;
  const hasEffective = ev != null && Number.isFinite(ev) && ev > 0;
  const vendorRaw = hasEffective && ev > 0 ? Number(vendorLineTotalSum) / ev : 0;
  const vendorBarWidthPct = hasEffective
    ? Math.min(100, Math.max(0, vendorRaw * 100))
    : 0;

  const outstanding =
    hasTotalTour ? Math.max(0, tv - Number(customerReceivedTotal) || 0) : null;
  const vendorBalance =
    hasEffective ? Math.max(0, ev - Number(vendorLineTotalSum) || 0) : null;

  return (
    <div
      className="ta-booking-wizard-totals-section ta-booking-wizard-totals-stack ta-booking-wizard-totals--summary-bar"
      aria-label="Booking totals summary"
    >
      <div className="ta-booking-wizard-totals-tile">
        <div className="ta-booking-wizard-totals-tile__label">Total order value</div>
        <div className="ta-booking-wizard-totals-tile__value">
          {hasTotalTour ? formatCurrency(tv) : "—"}
        </div>
        <div className="ta-booking-wizard-totals-tile__sub">( Status: Open )</div>
      </div>

      <div className="ta-booking-wizard-totals-tile ta-booking-wizard-totals-tile--received">
        <div className="ta-booking-wizard-totals-tile__label">Payment received</div>
        <div className="ta-booking-wizard-totals-tile__value">
          {hasTotalTour ? formatCurrency(customerReceivedTotal) : "—"}
        </div>
        <div className="ta-booking-wizard-totals-tile__sub">
          {hasTotalTour && outstanding != null ? `( O/s: ${formatCurrency(outstanding)} )` : "( O/s: — )"}
        </div>
        <div
          className="ta-booking-pay-progress__track ta-booking-wizard-totals-tile__track"
          role="progressbar"
          aria-hidden="true"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(customerPct)}
        >
          <div
            className={`ta-booking-pay-progress__fill ${customerReceivedProgressToneClass(customerPct)}`}
            style={{ width: `${customerPct}%` }}
          />
        </div>
      </div>

      <div className="ta-booking-wizard-totals-tile ta-booking-wizard-totals-tile--vendor">
        <div className="ta-booking-wizard-totals-tile__label">Vendor payments</div>
        <div className="ta-booking-wizard-totals-tile__value">
          {hasEffective ? formatCurrency(vendorLineTotalSum) : "—"}
        </div>
        <div className="ta-booking-wizard-totals-tile__sub">
          {hasEffective && vendorBalance != null
            ? `( Bal: ${formatCurrency(vendorBalance)} )`
            : "( Bal: — )"}
        </div>
        <div
          className="ta-booking-pay-progress__track ta-booking-wizard-totals-tile__track"
          role="progressbar"
          aria-hidden="true"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(vendorBarWidthPct)}
        >
          <div
            className={`ta-booking-pay-progress__fill ${vendorBarFillClass(vendorRaw)}`}
            style={{ width: `${vendorBarWidthPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

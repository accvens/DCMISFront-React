export function TrendPill({ value, tone = "pos" }) {
  const display = typeof value === "number" ? `${value}%` : String(value);
  return (
    <span className={`ta-dash-pill ta-dash-pill--${tone}`}>
      <svg className="ta-dash-pill__icon" viewBox="0 0 12 12" width="10" height="10" aria-hidden>
        <path d="M6 9V3M6 3l2.5 2.5M6 3 3.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {display}
    </span>
  );
}

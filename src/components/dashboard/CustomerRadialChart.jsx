import { useState } from "react";

/**
 * Concentric progress rings with hover center label (Customers Overview).
 */
export function CustomerRadialChart({ rings, size = 168 }) {
  const [activeKey, setActiveKey] = useState(null);
  const center = size / 2;
  const stroke = 11;
  const gap = 14;
  const hitStroke = 22;
  const radii = [
    center - stroke / 2 - 6,
    center - stroke / 2 - 6 - gap,
    center - stroke / 2 - 6 - gap * 2,
  ];

  const activeRing = rings.find((r) => r.key === activeKey) || null;
  const defaultRing = rings.find((r) => r.percent > 0) || rings[0];
  const displayRing = activeRing || defaultRing;

  return (
    <div
      className="ta-dash-radial-chart-wrap"
      style={{ width: size, height: size }}
      onMouseLeave={() => setActiveKey(null)}
    >
      <svg
        className="ta-dash-radial-chart"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Customer overview chart"
      >
        {rings.map((ring, index) => {
          const r = radii[index];
          if (r <= stroke) {
            return null;
          }
          const circumference = 2 * Math.PI * r;
          const pct = Math.min(100, Math.max(0, Number(ring.percent) || 0));
          const dash = (pct / 100) * circumference;
          const isActive = activeKey === ring.key;
          return (
            <g key={ring.key}>
              <title>{`${ring.label}: ${pct}%${ring.detail ? ` (${ring.detail})` : ""}`}</title>
              <circle
                cx={center}
                cy={center}
                r={r}
                fill="none"
                stroke="#eceef1"
                strokeWidth={stroke}
              />
              <circle
                cx={center}
                cy={center}
                r={r}
                fill="none"
                stroke={ring.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                transform={`rotate(-90 ${center} ${center})`}
                className={isActive ? "ta-dash-radial-chart__arc--active" : undefined}
                style={{ opacity: activeKey && !isActive ? 0.45 : 1 }}
              />
              <circle
                cx={center}
                cy={center}
                r={r}
                fill="none"
                stroke="transparent"
                strokeWidth={hitStroke}
                style={{ cursor: "pointer", pointerEvents: "stroke" }}
                onMouseEnter={() => setActiveKey(ring.key)}
                onFocus={() => setActiveKey(ring.key)}
                tabIndex={0}
                role="button"
                aria-label={`${ring.label} ${pct}%`}
              />
            </g>
          );
        })}
      </svg>
      <div className="ta-dash-radial-chart__center" aria-live="polite">
        <div
          className={`ta-dash-radial-chart__center-label${
            displayRing?.key === "outer" ? " ta-dash-radial-chart__center-label--first" : ""
          }${displayRing?.key === "middle" ? " ta-dash-radial-chart__center-label--return" : ""}`}
        >
          {displayRing?.label || "Overview"}
        </div>
        <div className="ta-dash-radial-chart__center-value">{displayRing?.percent ?? 0}%</div>
        {activeRing?.detail ? <div className="ta-dash-radial-chart__center-detail">{activeRing.detail}</div> : null}
      </div>
    </div>
  );
}

export function buildCustomerRadialRings(split, orders, customers) {
  const innerPct =
    customers > 0 ? Math.min(100, Math.round((orders / customers) * 100)) : Math.min(100, split.pctFirst);

  if (!split.total) {
    return [
      { key: "outer", label: "First Time", percent: 0, detail: "No customers in range", color: "#2bbbad" },
      { key: "middle", label: "Return", percent: 0, detail: "No customers in range", color: "#ff9f43" },
      { key: "inner", label: "Orders", percent: 0, detail: "No orders in range", color: "#f1c40f" },
    ];
  }

  return [
    {
      key: "outer",
      label: "First Time",
      percent: split.pctFirst,
      detail: `${split.firstTime} customer${split.firstTime === 1 ? "" : "s"}`,
      color: "#2bbbad",
    },
    {
      key: "middle",
      label: "Return",
      percent: split.pctReturn,
      detail: `${split.returning} customer${split.returning === 1 ? "" : "s"}`,
      color: "#ff9f43",
    },
    {
      key: "inner",
      label: "Orders",
      percent: innerPct,
      detail: `${orders} orders · ${customers} customers`,
      color: "#f1c40f",
    },
  ];
}

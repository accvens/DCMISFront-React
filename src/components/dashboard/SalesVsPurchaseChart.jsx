import { useState } from "react";
import { formatCurrencyAmount } from "../../formatAmount.js";
import { chartBarHeightPx } from "./dashboardMetrics.js";

export function SalesVsPurchaseChart({ barBuckets, yAxisMax }) {
  const [activeKey, setActiveKey] = useState(null);

  return (
    <div className="ta-dash-bar-chart__plot">
      {barBuckets.map((b) => {
        const isActive = activeKey === b.key;
        return (
          <div
            key={b.key}
            className={`ta-dash-bar-group${isActive ? " ta-dash-bar-group--active" : ""}`}
            onMouseEnter={() => setActiveKey(b.key)}
            onMouseLeave={() => setActiveKey(null)}
            onFocus={() => setActiveKey(b.key)}
            onBlur={() => setActiveKey(null)}
            tabIndex={0}
            role="group"
            aria-label={`${b.label}: Sales ${formatCurrencyAmount(b.sales)}, Purchase ${formatCurrencyAmount(b.purchase)}`}
          >
            {isActive ? (
              <div className="ta-dash-bar-group__tooltip" role="tooltip">
                <div className="ta-dash-bar-group__tooltip-title">{b.label}</div>
                <div>
                  <span className="ta-dash-legend-dot ta-dash-legend-dot--sales" /> Sales (₹){" "}
                  <strong>{formatCurrencyAmount(b.sales)}</strong>
                </div>
                <div>
                  <span className="ta-dash-legend-dot ta-dash-legend-dot--purchase" /> Purchase (₹){" "}
                  <strong>{formatCurrencyAmount(b.purchase)}</strong>
                </div>
              </div>
            ) : null}
            <div className="ta-dash-bar-group__bars">
              <div
                className="ta-dash-bar ta-dash-bar--sales"
                style={{ height: `${chartBarHeightPx(b.sales, yAxisMax)}px` }}
              />
              <div
                className="ta-dash-bar ta-dash-bar--purchase"
                style={{ height: `${chartBarHeightPx(b.purchase, yAxisMax)}px` }}
              />
            </div>
            <div className="ta-dash-bar-group__label">{b.label}</div>
          </div>
        );
      })}
    </div>
  );
}


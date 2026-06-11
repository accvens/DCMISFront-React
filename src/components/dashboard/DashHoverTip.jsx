import { useId, useState } from "react";

/**
 * Visible hover/focus tooltip for dashboard metrics and charts.
 */
export function DashHoverTip({ tip, children, className = "", placement = "top" }) {
  const [visible, setVisible] = useState(false);
  const tipId = useId();

  if (!tip) {
    return children;
  }

  const useBlock =
    className.includes("d-block") || className.includes("__col") || className.includes("__cell");
  const wrapClass = `ta-dash-tip-wrap ta-dash-tip-wrap--${placement} ${className}`.trim();
  const handlers = {
    onMouseEnter: () => setVisible(true),
    onMouseLeave: () => setVisible(false),
    onFocus: () => setVisible(true),
    onBlur: () => setVisible(false),
    tabIndex: 0,
    "aria-describedby": visible ? tipId : undefined,
  };

  const tipNode = visible ? (
    <span id={tipId} className="ta-dash-tip" role="tooltip">
      {tip}
    </span>
  ) : null;

  if (useBlock) {
    return (
      <div className={wrapClass} {...handlers}>
        {children}
        {tipNode}
      </div>
    );
  }

  return (
    <span className={wrapClass} {...handlers}>
      {children}
      {tipNode}
    </span>
  );
}

import { useEffect, useRef, useState } from "react";

/**
 * Custom dropdown matching dashboard reference: white trigger, chevron, blue selected row.
 */
export function DashboardSelect({ value, onChange, options, ariaLabel, className }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function onDocMouseDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onKey(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const selected = options.find((o) => o.value === value) ?? options[0];

  return (
    <div className={`ta-dash-dd ${className || ""}`} ref={rootRef}>
      <button
        type="button"
        className="ta-dash-dd__trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ta-dash-dd__trigger-text">{selected.label}</span>
        <span className={`ta-dash-dd__chev ${open ? "is-open" : ""}`} aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path
              d="M2.5 4.25L6 7.75l3.5-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {open ? (
        <div className="ta-dash-dd__menu" role="listbox" aria-label={ariaLabel}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              className={`ta-dash-dd__option ${opt.value === value ? "is-active" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

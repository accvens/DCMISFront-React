import { NavLink } from "react-router-dom";

function BreadcrumbChevron() {
  return (
    <svg className="ta-booking-editor__breadcrumb-chevron" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Compact page shell for full-screen create / edit booking.
 */
export function BookingEditorChrome({ mode, bookingId, children }) {
  const isEdit = mode === "edit";

  return (
    <div className="ta-booking-editor">
      <div className="ta-booking-editor__container">
        <header className="ta-booking-editor__header">
          <nav className="ta-booking-editor__breadcrumb" aria-label="Breadcrumb">
            <ol className="ta-booking-editor__breadcrumb-list">
              <li className="ta-booking-editor__breadcrumb-item">
                <NavLink end to="/bookings/list" className="ta-booking-editor__breadcrumb-link">
                  Bookings
                </NavLink>
              </li>
              <li className="ta-booking-editor__breadcrumb-item ta-booking-editor__breadcrumb-item--sep" aria-hidden="true">
                <BreadcrumbChevron />
              </li>
              <li className="ta-booking-editor__breadcrumb-item">
                <span className="ta-booking-editor__breadcrumb-current" aria-current="page">
                  {isEdit ? `Edit #${bookingId}` : "New booking"}
                </span>
              </li>
            </ol>
          </nav>
        </header>
        <div className="ta-booking-editor__body">{children}</div>
      </div>
    </div>
  );
}

/**
 * Row below the wizard step content: Previous | Next + Save (inside &lt;form&gt;).
 */
export function BookingWizardToolbar({
  submitting,
  submitLabel = "Save Booking",
  savingLabel,
  onPrevious,
  onNext,
  previousDisabled,
  nextDisabled,
  stepIndex,
  stepCount,
  stepLabel,
}) {
  return (
    <div className="ta-booking-wizard-toolbar">
      <div className="ta-booking-wizard-toolbar__row">
        <div className="ta-booking-wizard-toolbar__nav">
          <button
            type="button"
            className="btn btn-outline-secondary ta-booking-editor-actions__step-btn"
            disabled={previousDisabled}
            onClick={onPrevious}
          >
            Previous
          </button>
        </div>
        <div className="ta-booking-wizard-toolbar__primary">
          <button
            type="button"
            className="btn btn-outline-primary ta-booking-editor-actions__step-btn"
            disabled={nextDisabled}
            onClick={onNext}
          >
            Next
          </button>
          <button type="submit" className="btn ta-booking-editor-actions__submit" disabled={submitting}>
            {submitting ? savingLabel || "Saving…" : submitLabel}
          </button>
        </div>
      </div>
      {stepCount > 0 ? (
        <p className="ta-booking-wizard-toolbar__hint small text-muted mb-0">
          Step {stepIndex + 1} of {stepCount}
          {stepLabel ? (
            <>
              : <span className="text-body">{stepLabel}</span>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

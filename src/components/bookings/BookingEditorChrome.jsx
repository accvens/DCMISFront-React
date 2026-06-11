/**
 * Compact page shell for full-screen create / edit booking.
 */
export function BookingEditorChrome({ children }) {
  return (
    <div className="ta-booking-editor">
      <div className="ta-booking-editor__container">
        <div className="ta-booking-editor__body">{children}</div>
      </div>
    </div>
  );
}

/**
 * Row below the wizard step content: Previous | Next + Save.
 * Save uses `type="button"` + onClick so Enter in other fields does not submit the parent form.
 */
export function BookingWizardToolbar({
  /** When true, primary submit is in flight (shows `savingLabel` on the submit button). */
  submitting = false,
  submitLabel = "Save",
  savingLabel,
  onPrevious,
  onNext,
  onSave,
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
          <button
            type="button"
            className="btn ta-booking-editor-actions__submit"
            disabled={submitting}
            onClick={onSave}
          >
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

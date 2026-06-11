import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ConfirmActionModal } from "../access/AccessShared.jsx";

/**
 * After a successful save from Vendor Payment (last wizard step), ask whether to stay on this booking or return to the list.
 * — Continue editing: same screen (edit) or open edit on the last step (create → first save).
 * — Complete booking: navigate to the bookings list.
 */
export function BookingPostSaveNextModal({ open, onContinueEditing, onCompleteBooking }) {
  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <ConfirmActionModal
      open
      title="Booking saved"
      message="Your booking has been saved. You can keep working on this booking, or return to the bookings list."
      cancelLabel="Continue editing"
      confirmLabel="Complete booking"
      onCancel={onContinueEditing}
      onConfirm={onCompleteBooking}
    />,
    document.body,
  );
}

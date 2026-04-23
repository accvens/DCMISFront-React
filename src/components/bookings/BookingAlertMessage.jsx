import { AlertMessage } from "../access/AccessShared.jsx";

/** Visible time before fade-out for booking-related toasts (ms). */
export const BOOKING_ALERT_AUTO_HIDE_MS = 3000;
/** Fade duration after the visible period (ms). */
export const BOOKING_ALERT_FADE_OUT_MS = 400;

/**
 * Booking alerts: show for {@link BOOKING_ALERT_AUTO_HIDE_MS}, then fade out and call `onDismiss`.
 */
export function BookingAlertMessage({ message, variant, id, onDismiss }) {
  const text = String(message ?? "").trim();
  return (
    <AlertMessage
      message={message}
      variant={variant}
      id={id}
      autoHideAfterMs={text ? BOOKING_ALERT_AUTO_HIDE_MS : 0}
      fadeOutDurationMs={BOOKING_ALERT_FADE_OUT_MS}
      onAutoHide={onDismiss}
    />
  );
}

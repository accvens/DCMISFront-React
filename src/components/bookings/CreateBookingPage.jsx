import { useEffect, useState } from "react";
import {
  AlertMessage,
  CardLoader,
  ManageCard,
  SuccessModal,
} from "../access/AccessShared.jsx";
import {
  BookingFormModal,
  buildBookingPayload,
  createDefaultBookingForm,
  createEmptyBookingForm,
  validateBookingForm,
} from "./BookingsShared.jsx";

function CreateBookingPage({ token, apiRequest, bookingStatusOptions }) {
  const [state, setState] = useState({
    loading: true,
    error: "",
    customers: [],
    destinations: [],
    travelers: [],
    products: [],
    vendors: [],
  });
  const [form, setForm] = useState(createEmptyBookingForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  useEffect(() => {
    document.title = "Create Booking | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));

    Promise.all([
      apiRequest("/customers?page=1&page_size=100", { token }),
      apiRequest("/masters/destinations?page=1&page_size=100", { token }),
      apiRequest("/travelers?page=1&page_size=100", { token }),
      apiRequest("/masters/products?page=1&page_size=100", { token }),
      apiRequest("/masters/vendors?page=1&page_size=100", { token }),
    ])
      .then(([customers, destinations, travelers, products, vendors]) => {
        if (!active) {
          return;
        }
        const nextState = {
          loading: false,
          error: "",
          customers: customers.items,
          destinations: destinations.items,
          travelers: travelers.items,
          products: products.items,
          vendors: vendors.items,
        };
        setState(nextState);
        setForm((current) =>
          current.customer_id ? current : createDefaultBookingForm(nextState),
        );
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setState((current) => ({
          ...current,
          loading: false,
          error: requestError.message || "Unable to load booking form data.",
        }));
      });

    return () => {
      active = false;
    };
  }, [apiRequest, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const validationError = validateBookingForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSubmitting(true);

    try {
      await apiRequest("/bookings", {
        method: "POST",
        token,
        body: buildBookingPayload(form),
      });
      setModalOpen(false);
      setForm(createDefaultBookingForm(state));
      setSuccessModal(true);
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save booking.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AlertMessage message={state.error} variant="danger" />
      <ManageCard
        title="Create Booking"
        subtitle="Open the popup to create a booking with traveler and product details."
        actionLabel="Add Booking"
        onAction={() => {
          setForm(createDefaultBookingForm(state));
          setFormError("");
          setModalOpen(true);
        }}
      >
        {state.loading ? (
          <CardLoader message="Loading booking form..." />
        ) : (
          <p className="ta-card-muted mb-0">
            Phase 1 supports one traveler line and one product line per booking.
          </p>
        )}
      </ManageCard>
      <BookingFormModal
        open={modalOpen}
        title="Add Booking"
        saveLabel="Create Booking"
        saving={submitting}
        onCancel={() => {
          setModalOpen(false);
          setForm(createDefaultBookingForm(state));
          setFormError("");
        }}
        onSubmit={handleSubmit}
        formError={formError}
        form={form}
        setForm={setForm}
        state={state}
        bookingStatusOptions={bookingStatusOptions}
      />
      <SuccessModal
        open={successModal}
        title="Booking Created"
        message="Booking created successfully."
        onClose={() => setSuccessModal(false)}
      />
    </>
  );
}

export default CreateBookingPage;

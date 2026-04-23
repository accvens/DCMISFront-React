import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchAllListItems } from "../../fetchAllPages.js";
import { CardLoader } from "../access/AccessShared.jsx";
import { BookingAlertMessage } from "./BookingAlertMessage.jsx";
import {
  buildBookingPayload,
  createBookingFormFromBooking,
  isVendorTaxableCapValidationMessage,
  validateBookingDraft,
  validateBookingForm,
} from "./BookingsShared.jsx";
import { BookingEditorChrome } from "./BookingEditorChrome.jsx";
import OrderEntryBookingForm, { BOOKING_WIZARD_LAST_STEP_INDEX } from "./OrderEntryBookingForm.jsx";

function EditBookingPage({
  token,
  apiRequest,
  canCreateCustomer,
  canCreateTraveler,
  canCreateProductType = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { bookingId } = useParams();
  /** Captured once when entering from Create (first save) so we can restore tab and show a one-time message. */
  const [createFlow] = useState(() => ({
    fromCreate: location.state?.fromCreate === true,
    savedIncomplete: location.state?.savedIncomplete === true,
    wizardStep:
      typeof location.state?.wizardStep === "number" && Number.isFinite(location.state.wizardStep)
        ? location.state.wizardStep
        : undefined,
  }));
  const [state, setState] = useState({
    loading: true,
    error: "",
    booking: null,
    customers: [],
    travelers: [],
    products: [],
    vendors: [],
    productTypes: [],
    paymentModes: [],
    systemUsers: [],
  });
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState(() => {
    if (createFlow.savedIncomplete) {
      return "Booking saved. Add the remaining details when you are ready.";
    }
    return createFlow.fromCreate ? "Booking created. Further saves update this booking." : "";
  });
  const [wizardStep, setWizardStep] = useState(0);

  useEffect(() => {
    document.title = "Edit Booking | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    const id = Number(bookingId);
    if (!id) {
      setState((s) => ({ ...s, loading: false, error: "Invalid booking id." }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: "" }));

    Promise.all([
      apiRequest(`/bookings/${id}`, { token }),
      apiRequest("/customers?page=1&page_size=100", { token }),
      apiRequest("/travelers?page=1&page_size=100", { token }),
      fetchAllListItems(apiRequest, "/masters/products", { token }),
      fetchAllListItems(apiRequest, "/masters/vendors", { token }),
      apiRequest("/masters/product-types?page=1&page_size=100", { token }),
      apiRequest("/masters/payment-modes?page=1&page_size=100", { token }).catch(() => ({ items: [] })),
      apiRequest("/users?page=1&page_size=100", { token }).catch(() => ({ items: [] })),
    ])
      .then(([booking, customers, travelers, productItems, vendorItems, productTypes, paymentModes, usersRes]) => {
        if (!active) {
          return;
        }
        const nextState = {
          loading: false,
          error: "",
          booking,
          customers: customers.items,
          travelers: travelers.items,
          products: productItems,
          vendors: vendorItems,
          productTypes: productTypes.items,
          paymentModes: paymentModes.items || [],
          systemUsers: usersRes.items || [],
        };
        setState(nextState);
        setForm(createBookingFormFromBooking(booking, { catalogueProducts: productItems }));
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setState((s) => ({
          ...s,
          loading: false,
          error: requestError.message || "Unable to load booking.",
        }));
      });

    return () => {
      active = false;
    };
  }, [apiRequest, bookingId, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");
    const fullError = validateBookingForm(form);
    let saveIncomplete = false;
    if (fullError) {
      const partialError = validateBookingDraft(form);
      if (partialError) {
        setFormError(partialError);
        return;
      }
      saveIncomplete = true;
    }
    setSubmitting(true);
    const id = Number(bookingId);

    try {
      const updated = await apiRequest(`/bookings/${id}`, {
        method: "PATCH",
        token,
        body: buildBookingPayload(form, saveIncomplete ? { draft: true } : {}),
      });
      setState((s) => ({ ...s, booking: updated }));
      setForm(createBookingFormFromBooking(updated, { catalogueProducts: state.products || [] }));
      if (wizardStep === BOOKING_WIZARD_LAST_STEP_INDEX) {
        navigate("/bookings/list");
        return;
      }
      setSuccessMessage(
        saveIncomplete
          ? "Booking saved. Add the remaining details when you are ready."
          : "Booking updated successfully.",
      );
    } catch (requestError) {
      setFormError(requestError.message || "Unable to update booking.");
    } finally {
      setSubmitting(false);
    }
  }

  if (state.error && !state.booking) {
    return (
      <div className="ta-booking-editor ta-booking-editor--error">
        <div className="ta-booking-editor__container py-5">
          <div className="card border-0 shadow-sm ta-booking-editor-error-card mx-auto">
            <div className="card-body p-4 p-md-5 text-center">
              <h1 className="h5 mb-3">Unable to load booking</h1>
              <BookingAlertMessage
                message={state.error}
                variant="danger"
                onDismiss={() => setState((s) => ({ ...s, error: "" }))}
              />
              <NavLink to="/bookings/list" className="btn ta-booking-editor-actions__submit mt-3">
                Back to bookings list
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {state.loading || !form ? (
        <div className="ta-booking-editor ta-booking-editor--loading">
          <CardLoader message="Loading booking…" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="ta-booking-editor-form">
          <BookingEditorChrome mode="edit" bookingId={bookingId}>
            <BookingAlertMessage
              message={state.error}
              variant="danger"
              onDismiss={() => setState((s) => ({ ...s, error: "" }))}
            />
            <BookingAlertMessage
              id="ta-booking-form-validation-error"
              message={isVendorTaxableCapValidationMessage(formError) ? "" : formError}
              variant="danger"
              onDismiss={() => setFormError("")}
            />
            <BookingAlertMessage message={successMessage} variant="success" onDismiss={() => setSuccessMessage("")} />
            <OrderEntryBookingForm
              mode="edit"
              bookingId={bookingId}
              initialWizardStep={createFlow.wizardStep}
              form={form}
              setForm={setForm}
              state={state}
              token={token}
              apiRequest={apiRequest}
              canCreateCustomer={canCreateCustomer}
              canCreateTraveler={canCreateTraveler}
              canCreateProductType={canCreateProductType}
              setCustomersList={(fn) => setState((s) => ({ ...s, customers: fn(s.customers) }))}
              setTravelersList={(fn) => setState((s) => ({ ...s, travelers: fn(s.travelers) }))}
              setProductsList={(fn) => setState((s) => ({ ...s, products: fn(s.products) }))}
              setVendorsList={(fn) => setState((s) => ({ ...s, vendors: fn(s.vendors) }))}
              setProductTypesList={(fn) => setState((s) => ({ ...s, productTypes: fn(s.productTypes) }))}
              paymentModes={state.paymentModes || []}
              submitting={submitting}
              submitLabel="Save booking"
              savingLabel="Saving…"
              onWizardStepChange={setWizardStep}
              validationError={formError}
            />
          </BookingEditorChrome>
        </form>
      )}
    </>
  );
}

export default EditBookingPage;

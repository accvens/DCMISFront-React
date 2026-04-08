import { useEffect, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { AlertMessage, CardLoader } from "../access/AccessShared.jsx";
import {
  buildBookingPayload,
  createBookingFormFromBooking,
  validateBookingForm,
} from "./BookingsShared.jsx";
import { BookingEditorChrome } from "./BookingEditorChrome.jsx";
import OrderEntryBookingForm, { BOOKING_WIZARD_LAST_STEP_INDEX } from "./OrderEntryBookingForm.jsx";

function EditBookingPage({
  token,
  apiRequest,
  bookingStatusOptions,
  canCreateCustomer,
  canCreateDestination,
  canCreateTraveler,
  canCreateProductType = false,
  canCreateCatalogProduct = false,
  canCreateVendor = false,
}) {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const [state, setState] = useState({
    loading: true,
    error: "",
    booking: null,
    customers: [],
    destinations: [],
    travelers: [],
    products: [],
    vendors: [],
    productTypes: [],
    paymentModes: [],
  });
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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
      apiRequest("/masters/destinations?page=1&page_size=100", { token }),
      apiRequest("/travelers?page=1&page_size=100", { token }),
      apiRequest("/masters/products?page=1&page_size=100", { token }),
      apiRequest("/masters/vendors?page=1&page_size=100", { token }),
      apiRequest("/masters/product-types?page=1&page_size=100", { token }),
      apiRequest("/masters/payment-modes?page=1&page_size=100", { token }).catch(() => ({ items: [] })),
    ])
      .then(([booking, customers, destinations, travelers, products, vendors, productTypes, paymentModes]) => {
        if (!active) {
          return;
        }
        const nextState = {
          loading: false,
          error: "",
          booking,
          customers: customers.items,
          destinations: destinations.items,
          travelers: travelers.items,
          products: products.items,
          vendors: vendors.items,
          productTypes: productTypes.items,
          paymentModes: paymentModes.items || [],
        };
        setState(nextState);
        setForm(createBookingFormFromBooking(booking, { catalogueProducts: products.items }));
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
    const validationError = validateBookingForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSubmitting(true);
    const id = Number(bookingId);

    try {
      const updated = await apiRequest(`/bookings/${id}`, {
        method: "PATCH",
        token,
        body: buildBookingPayload(form),
      });
      setState((s) => ({ ...s, booking: updated }));
      if (wizardStep === BOOKING_WIZARD_LAST_STEP_INDEX) {
        navigate("/bookings/list");
        return;
      }
      setSuccessMessage("Booking updated successfully.");
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
              <AlertMessage message={state.error} variant="danger" />
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
            <AlertMessage message={state.error} variant="danger" />
            <AlertMessage id="ta-booking-form-validation-error" message={formError} variant="danger" />
            <AlertMessage message={successMessage} variant="success" />
            <OrderEntryBookingForm
              mode="edit"
              bookingId={bookingId}
              form={form}
              setForm={setForm}
              state={state}
              bookingStatusOptions={bookingStatusOptions}
              token={token}
              apiRequest={apiRequest}
              canCreateCustomer={canCreateCustomer}
              canCreateDestination={canCreateDestination}
              canCreateTraveler={canCreateTraveler}
              canCreateProductType={canCreateProductType}
              canCreateCatalogProduct={canCreateCatalogProduct}
              canCreateVendor={canCreateVendor}
              setCustomersList={(fn) => setState((s) => ({ ...s, customers: fn(s.customers) }))}
              setDestinationsList={(fn) => setState((s) => ({ ...s, destinations: fn(s.destinations) }))}
              setTravelersList={(fn) => setState((s) => ({ ...s, travelers: fn(s.travelers) }))}
              setProductsList={(fn) => setState((s) => ({ ...s, products: fn(s.products) }))}
              setVendorsList={(fn) => setState((s) => ({ ...s, vendors: fn(s.vendors) }))}
              setProductTypesList={(fn) => setState((s) => ({ ...s, productTypes: fn(s.productTypes) }))}
              paymentModes={state.paymentModes || []}
              submitting={submitting}
              submitLabel="Update booking"
              savingLabel="Updating…"
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

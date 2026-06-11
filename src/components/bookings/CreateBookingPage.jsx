import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAllListItems } from "../../fetchAllPages.js";
import { CardLoader } from "../access/AccessShared.jsx";
import { BookingAlertMessage } from "./BookingAlertMessage.jsx";
import {
  buildBookingPayload,
  createDefaultBookingForm,
  createEmptyBookingForm,
  isVendorTaxableCapValidationMessage,
  validateBookingDraft,
  validateBookingForm,
} from "./BookingsShared.jsx";
import { BookingEditorChrome } from "./BookingEditorChrome.jsx";
import { BookingPostSaveNextModal } from "./BookingPostSaveNextModal.jsx";
import OrderEntryBookingForm, { BOOKING_WIZARD_LAST_STEP_INDEX } from "./OrderEntryBookingForm.jsx";

function CreateBookingPage({
  token,
  apiRequest,
  canCreateCustomer,
  canCreateTraveler,
  canCreateProductType = false,
}) {
  const navigate = useNavigate();
  const [state, setState] = useState({
    loading: true,
    error: "",
    customers: [],
    travelers: [],
    products: [],
    vendors: [],
    productTypes: [],
    paymentModes: [],
    systemUsers: [],
  });
  const [form, setForm] = useState(createEmptyBookingForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [wizardStep, setWizardStep] = useState(0);
  const [showPostVendorSaveModal, setShowPostVendorSaveModal] = useState(false);
  const [postSaveBookingId, setPostSaveBookingId] = useState(null);
  const [postSaveSavedAsDraft, setPostSaveSavedAsDraft] = useState(false);

  useEffect(() => {
    document.title = "Create Booking | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));

    Promise.all([
      apiRequest("/customers?page=1&page_size=100", { token }),
      apiRequest("/travelers?page=1&page_size=100", { token }),
      fetchAllListItems(apiRequest, "/masters/products", { token }),
      fetchAllListItems(apiRequest, "/masters/vendors", { token }),
      apiRequest("/masters/product-types?page=1&page_size=100", { token }),
      apiRequest("/masters/payment-modes?page=1&page_size=100", { token }).catch(() => ({ items: [] })),
      apiRequest("/users?page=1&page_size=100", { token }).catch(() => ({ items: [] })),
    ])
      .then(([customers, travelers, productItems, vendorItems, productTypes, paymentModes, usersRes]) => {
        if (!active) {
          return;
        }
        const nextState = {
          loading: false,
          error: "",
          customers: customers.items,
          travelers: travelers.items,
          products: productItems,
          vendors: vendorItems,
          productTypes: productTypes.items,
          paymentModes: paymentModes.items || [],
          systemUsers: usersRes.items || [],
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

  async function performSave(wizardStepFromForm) {
    setFormError("");
    const fullError = validateBookingForm(form, { travelers: state.travelers });
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
    const effectiveStep =
      typeof wizardStepFromForm === "number" && Number.isFinite(wizardStepFromForm)
        ? Math.floor(wizardStepFromForm)
        : wizardStep;

    try {
      const created = await apiRequest("/bookings", {
        method: "POST",
        token,
        body: buildBookingPayload(form, saveIncomplete ? { draft: true } : {}),
      });
      const newId = created?.id;
      if (newId == null || Number.isNaN(Number(newId))) {
        setFormError("Booking was created but the server did not return an id. Open it from the bookings list to edit.");
        return;
      }
      if (effectiveStep === BOOKING_WIZARD_LAST_STEP_INDEX) {
        setPostSaveBookingId(Number(newId));
        setPostSaveSavedAsDraft(saveIncomplete);
        setShowPostVendorSaveModal(true);
        return;
      }
      navigate(`/bookings/${newId}/edit`, {
        replace: true,
        state: { fromCreate: true, wizardStep: effectiveStep, savedIncomplete: saveIncomplete },
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save booking.");
    } finally {
      setSubmitting(false);
    }
  }

  function handlePostVendorSaveContinueEditing() {
    const id = postSaveBookingId;
    const wasDraft = postSaveSavedAsDraft;
    setShowPostVendorSaveModal(false);
    setPostSaveBookingId(null);
    setPostSaveSavedAsDraft(false);
    if (id != null && Number.isFinite(id)) {
      navigate(`/bookings/${id}/edit`, {
        replace: true,
        state: {
          fromCreate: true,
          wizardStep: BOOKING_WIZARD_LAST_STEP_INDEX,
          savedIncomplete: wasDraft,
        },
      });
    }
  }

  function handlePostVendorSaveCompleteBooking() {
    setShowPostVendorSaveModal(false);
    setPostSaveBookingId(null);
    setPostSaveSavedAsDraft(false);
    navigate("/bookings/list");
  }

  return (
    <>
      {state.loading ? (
        <div className="ta-booking-editor ta-booking-editor--loading">
          <CardLoader message="Preparing booking workspace…" />
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
          className="ta-booking-editor-form"
        >
          <BookingEditorChrome>
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
            <OrderEntryBookingForm
              mode="create"
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
              submitLabel="Save"
              savingLabel="Saving…"
              onWizardStepChange={setWizardStep}
              onSaveBooking={performSave}
              validationError={formError}
            />
          </BookingEditorChrome>
        </form>
      )}
      <BookingPostSaveNextModal
        open={showPostVendorSaveModal}
        onContinueEditing={handlePostVendorSaveContinueEditing}
        onCompleteBooking={handlePostVendorSaveCompleteBooking}
      />
    </>
  );
}

export default CreateBookingPage;

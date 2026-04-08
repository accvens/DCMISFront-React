import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertMessage,
  CardLoader,
  ConfirmDeleteModal,
  ManageCard,
  PaginationBar,
  SimpleTable,
  SuccessModal,
} from "../access/AccessShared.jsx";
import {
  BookingFormModal,
  StatusBadge,
  buildBookingPayload,
  createDefaultBookingForm,
  createEmptyBookingForm,
  createMap,
  emptyTravelerLine,
  formatCurrency,
  formatDate,
  patchLine,
  validateBookingForm,
} from "./BookingsShared.jsx";
import { useBookingCatalogCreateModals } from "./useBookingCatalogCreateModals.jsx";
import { useBookingReferenceCreateModals } from "./useBookingReferenceCreateModals.jsx";
import { mergeUniqueById } from "../customers/CustomersShared.jsx";

function BookingsListPage({
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(createEmptyBookingForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [successModal, setSuccessModal] = useState(null);
  const [state, setState] = useState({
    loading: true,
    error: "",
    bookingsPage: null,
    customers: [],
    destinations: [],
    travelers: [],
    products: [],
    vendors: [],
    productTypes: [],
    paymentModes: [],
  });

  useEffect(() => {
    document.title = "Bookings List | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));

    Promise.all([
      apiRequest(`/bookings?page=${page}&page_size=${pageSize}`, { token }),
      apiRequest("/customers?page=1&page_size=100", { token }),
      apiRequest("/masters/destinations?page=1&page_size=100", { token }),
      apiRequest("/travelers?page=1&page_size=100", { token }),
      apiRequest("/masters/products?page=1&page_size=100", { token }),
      apiRequest("/masters/vendors?page=1&page_size=100", { token }),
      apiRequest("/masters/product-types?page=1&page_size=100", { token }),
      apiRequest("/masters/payment-modes?page=1&page_size=100", { token }).catch(() => ({
        items: [],
      })),
    ])
      .then(
        ([
          bookingsPage,
          customers,
          destinations,
          travelers,
          products,
          vendors,
          productTypes,
          paymentModes,
        ]) => {
          if (!active) {
            return;
          }
          const nextState = {
            loading: false,
            error: "",
            bookingsPage,
            customers: customers.items,
            destinations: destinations.items,
            travelers: travelers.items,
            products: products.items,
            vendors: vendors.items,
            productTypes: productTypes.items,
            paymentModes: paymentModes.items || [],
          };
          setState(nextState);
          setForm((current) =>
            current.customer_id ? current : createDefaultBookingForm(nextState),
          );
        },
      )
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setState((current) => ({
          ...current,
          loading: false,
          error: requestError.message || "Unable to load bookings data.",
        }));
      });

    return () => {
      active = false;
    };
  }, [apiRequest, page, pageSize, refreshKey, token]);

  const {
    renderModals,
    customerAutocompleteExtras,
    destinationAutocompleteExtras,
    travelerAutocompleteExtrasForRow,
  } = useBookingReferenceCreateModals({
    token,
    apiRequest,
    canCreateCustomer,
    canCreateDestination,
    canCreateTraveler,
    customers: state.customers,
    setCustomers: (fn) => setState((s) => ({ ...s, customers: fn(s.customers) })),
    destinations: state.destinations,
    setDestinations: (fn) => setState((s) => ({ ...s, destinations: fn(s.destinations) })),
    travelers: state.travelers,
    setTravelers: (fn) => setState((s) => ({ ...s, travelers: fn(s.travelers) })),
    selectedCustomerId: form.customer_id,
    onCustomerCreated: (c) => {
      setForm((current) => ({
        ...current,
        customer_id: String(c.id),
        travelerLines: patchLine(
          current.travelerLines?.length ? current.travelerLines : [emptyTravelerLine()],
          0,
          { traveler_id: "" },
        ),
      }));
    },
    onDestinationCreated: (d) => {
      setForm((current) => ({ ...current, destination_id: String(d.id) }));
    },
    onTravelerCreated: (t, rowIndex) => {
      const idx = rowIndex ?? 0;
      setForm((current) => ({
        ...current,
        travelerLines: patchLine(
          current.travelerLines?.length ? current.travelerLines : [emptyTravelerLine()],
          idx,
          { traveler_id: String(t.id) },
        ),
      }));
    },
  });

  const { renderCatalogModals, catalogMasterToolbar } = useBookingCatalogCreateModals({
    token,
    apiRequest,
    destinationId: form.destination_id,
    productTypes: state.productTypes,
    setProductTypes: (fn) => setState((s) => ({ ...s, productTypes: fn(s.productTypes) })),
    vendors: state.vendors,
    setVendors: (fn) => setState((s) => ({ ...s, vendors: fn(s.vendors) })),
    setProducts: (fn) => setState((s) => ({ ...s, products: fn(s.products) })),
    canCreateProductType,
    canCreateCatalogProduct,
    canCreateVendor,
  });

  const customerMap = useMemo(() => createMap(state.customers, "id"), [state.customers]);
  const destinationMap = useMemo(
    () => createMap(state.destinations, "id"),
    [state.destinations],
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const validationError = validateBookingForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);

    try {
      await apiRequest("/bookings", {
        method: "POST",
        token,
        body: buildBookingPayload(form),
      });
      setModalOpen(false);
      setForm(createDefaultBookingForm(state));
      setPage(1);
      setRefreshKey((current) => current + 1);
      setSuccessModal({
        title: "Booking Created",
        message: "Booking created successfully.",
      });
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save booking.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(bookingId) {
    try {
      await apiRequest(`/bookings/${bookingId}`, {
        method: "DELETE",
        token,
      });
      if ((state.bookingsPage?.items || []).length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      setRefreshKey((current) => current + 1);
      setDeleteTarget(null);
    } catch (requestError) {
      setState((current) => ({
        ...current,
        error: requestError.message || "Unable to delete booking.",
      }));
    }
  }

  return (
    <>
      <AlertMessage message={state.error} variant="danger" />
      <ManageCard
        title="Bookings List"
        subtitle="Create, update, and delete bookings from one popup workflow."
        actionLabel="Add Booking"
        onAction={() => {
          setForm(createDefaultBookingForm(state));
          setFormError("");
          setModalOpen(true);
        }}
      >
        {state.loading ? (
          <CardLoader message="Loading bookings..." />
        ) : (
          <>
            <SimpleTable
              columns={[
                "ID",
                "DRC No",
                "Customer",
                "Destination",
                "Travel Start Date",
                "Status",
                "Total",
                "Actions",
              ]}
              rows={(state.bookingsPage?.items || []).map((booking) => [
                `#${booking.id}`,
                booking.drc_no || "-",
                (customerMap[booking.customer_id]
                  ? [customerMap[booking.customer_id].first_name, customerMap[booking.customer_id].last_name].filter(Boolean).join(" ") || customerMap[booking.customer_id].customer_id
                  : null) || `Customer #${booking.customer_id}`,
                destinationMap[booking.destination_id]?.destination_name ||
                  `Destination #${booking.destination_id}`,
                formatDate(booking.travel_start_date),
                <StatusBadge
                  key={`booking-status-${booking.id}`}
                  status={booking.status}
                  data-sort={booking.status || ""}
                />,
                <span key={`booking-total-${booking.id}`} data-sort={String(booking.total_amount ?? "")}>
                  {formatCurrency(booking.total_amount)}
                </span>,
                <div key={`booking-actions-${booking.id}`} className="ta-table-actions">
                  <button
                    type="button"
                    className="btn btn-icon btn-soft-primary btn-sm"
                    aria-label="Edit booking"
                    onClick={() => navigate(`/bookings/edit/${booking.id}`)}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true" className="ta-action-icon">
                      <path d="M3 11.5 3.5 9l6-6 2.5 2.5-6 6L3 11.5z" />
                      <path d="M2 13.5h12" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-soft-danger btn-sm"
                    aria-label="Delete booking"
                    onClick={() =>
                      setDeleteTarget({
                        id: booking.id,
                        label: booking.drc_no || `Booking #${booking.id}`,
                      })
                    }
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true" className="ta-action-icon">
                      <path d="M3 4h10" />
                      <path d="M6 4V3h4v1" />
                      <path d="M5 4v8M11 4v8" />
                      <rect x="4" y="4" width="8" height="9" rx="1" />
                    </svg>
                  </button>
                </div>,
              ])}
              sortable
              emptyMessage="No bookings found."
            />
            <PaginationBar
              pageData={state.bookingsPage}
              onSelectPage={setPage}
              pageSize={pageSize}
              onPageSizeChange={(value) => {
                setPage(1);
                setPageSize(value);
              }}
            />
          </>
        )}
      </ManageCard>
      <BookingFormModal
        open={modalOpen}
        title="Add Booking"
        saveLabel="Create Booking"
        saving={saving}
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
        customerAutocompleteExtras={customerAutocompleteExtras}
        destinationAutocompleteExtras={destinationAutocompleteExtras}
        travelerAutocompleteExtras={travelerAutocompleteExtrasForRow(0)}
        catalogToolbar={catalogMasterToolbar}
        apiRequest={apiRequest}
        token={token}
        mergeCustomersIntoState={(items) =>
          setState((s) => ({ ...s, customers: mergeUniqueById(s.customers, items) }))
        }
        mergeTravelersIntoState={(items) =>
          setState((s) => ({ ...s, travelers: mergeUniqueById(s.travelers, items) }))
        }
      />
      {renderModals()}
      {renderCatalogModals()}
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Booking"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete Booking"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget.id)}
      />
      <SuccessModal
        open={Boolean(successModal)}
        title={successModal?.title || ""}
        message={successModal?.message || ""}
        onClose={() => setSuccessModal(null)}
      />
    </>
  );
}

export default BookingsListPage;

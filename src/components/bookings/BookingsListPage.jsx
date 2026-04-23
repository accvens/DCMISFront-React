import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CardLoader,
  ConfirmDeleteModal,
  ListSearchInput,
  ManageCard,
  PaginationBar,
  SimpleTable,
  useDebouncedValue,
} from "../access/AccessShared.jsx";
import { BookingAlertMessage } from "./BookingAlertMessage.jsx";
import { StatusBadge, bookingListDisplayStatus, formatCurrency, formatDate } from "./BookingsShared.jsx";

/** Open / Closed display; API still uses Pending / Completed (or Open/Closed accepted by server). */
function BookingListStatusCell({ bookingId, status, saving, onSetStatus, canCloseBooking, canReopenBooking }) {
  const quick = bookingListDisplayStatus(status);
  const disabled = saving;
  const showOpenBtn = quick === "Open" || canReopenBooking;
  const showClosedBtn = quick === "Closed" || canCloseBooking;

  return (
    <div className="ta-bookings-status-cell d-flex flex-column gap-1 align-items-start">
      <StatusBadge status={quick} />
      <div
        className="btn-group btn-group-sm"
        role="group"
        aria-label={`Booking ${bookingId}: booking status`}
      >
        {showOpenBtn ? (
          <button
            type="button"
            className={`btn ${quick === "Open" ? "btn-primary" : "btn-outline-secondary"}`}
            disabled={disabled || (quick === "Closed" && !canReopenBooking)}
            aria-pressed={quick === "Open"}
            title={
              quick === "Closed" && !canReopenBooking
                ? "You do not have permission to reopen this booking"
                : "Set booking to Open (in progress)"
            }
            onClick={() => onSetStatus(bookingId, "Pending")}
          >
            Open
          </button>
        ) : null}
        {showClosedBtn ? (
          <button
            type="button"
            className={`btn ${quick === "Closed" ? "btn-success" : "btn-outline-secondary"}`}
            disabled={disabled || (quick === "Open" && !canCloseBooking)}
            aria-pressed={quick === "Closed"}
            title={
              quick === "Open" && !canCloseBooking
                ? "You do not have permission to close this booking"
                : "Set booking to Closed (completed)"
            }
            onClick={() => onSetStatus(bookingId, "Completed")}
          >
            Closed
          </button>
        ) : null}
      </div>
    </div>
  );
}

function BookingsListPage({
  token,
  apiRequest,
  canCloseBooking = false,
  canReopenBooking = false,
}) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 400);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusSavingId, setStatusSavingId] = useState(null);
  const [state, setState] = useState({
    loading: true,
    error: "",
    bookingsPage: null,
    customers: [],
  });

  const prevDebouncedSearchRef = useRef(debouncedSearch);
  const prevDateFromRef = useRef(dateFrom);
  const prevDateToRef = useRef(dateTo);

  const dateRangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  useEffect(() => {
    document.title = "Bookings List | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    const searchChanged = prevDebouncedSearchRef.current !== debouncedSearch;
    prevDebouncedSearchRef.current = debouncedSearch;
    const dateFromChanged = prevDateFromRef.current !== dateFrom;
    prevDateFromRef.current = dateFrom;
    const dateToChanged = prevDateToRef.current !== dateTo;
    prevDateToRef.current = dateTo;
    const filtersChanged = searchChanged || dateFromChanged || dateToChanged;

    const pageToFetch = filtersChanged ? 1 : page;
    if (filtersChanged && page !== 1) {
      setPage(1);
    }

    if (dateRangeInvalid) {
      setState((current) => ({ ...current, loading: false, error: "" }));
      return () => {
        active = false;
      };
    }

    setState((current) => ({ ...current, loading: true, error: "" }));

    const params = new URLSearchParams({
      page: String(pageToFetch),
      page_size: String(pageSize),
    });
    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }
    if (dateFrom) {
      params.set("created_from", dateFrom);
    }
    if (dateTo) {
      params.set("created_to", dateTo);
    }

    Promise.all([
      apiRequest(`/bookings?${params.toString()}`, { token }),
      apiRequest("/customers?page=1&page_size=100", { token }),
    ])
      .then(([bookingsPage, customers]) => {
        if (!active) {
          return;
        }
        setState({
          loading: false,
          error: "",
          bookingsPage,
          customers: customers.items,
        });
      })
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
  }, [apiRequest, dateFrom, dateRangeInvalid, dateTo, debouncedSearch, page, pageSize, refreshKey, token]);

  const customerById = (state.customers || []).reduce((acc, c) => {
    acc[c.id] = c;
    acc[String(c.id)] = c;
    return acc;
  }, {});

  async function handleBookingStatusChange(bookingId, nextStatus) {
    const booking = (state.bookingsPage?.items || []).find((b) => b.id === bookingId);
    if (!booking || String(booking.status || "").trim() === String(nextStatus).trim()) {
      return;
    }
    const quick = bookingListDisplayStatus(booking.status);
    if (String(nextStatus).trim() === "Completed" && quick === "Open" && !canCloseBooking) {
      return;
    }
    if (String(nextStatus).trim() === "Pending" && quick === "Closed" && !canReopenBooking) {
      return;
    }
    setStatusSavingId(bookingId);
    setState((current) => ({ ...current, error: "" }));
    try {
      const updated = await apiRequest(`/bookings/${bookingId}/status`, {
        method: "PATCH",
        token,
        body: { status: nextStatus },
      });
      setState((current) => {
        const items = (current.bookingsPage?.items || []).map((b) =>
          b.id === bookingId ? { ...b, status: updated?.status ?? nextStatus } : b,
        );
        return {
          ...current,
          bookingsPage: current.bookingsPage ? { ...current.bookingsPage, items } : current.bookingsPage,
        };
      });
    } catch (requestError) {
      setState((current) => ({
        ...current,
        error: requestError.message || "Unable to update booking status.",
      }));
    } finally {
      setStatusSavingId(null);
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

  const hasDateFilters = Boolean(dateFrom || dateTo);

  return (
    <>
      {dateRangeInvalid ? (
        <div className="alert alert-warning mb-3" role="alert">
          <strong>Date range</strong> — &quot;Created from&quot; must be on or before &quot;Created to&quot;.
        </div>
      ) : null}
      <BookingAlertMessage
        message={state.error}
        variant="danger"
        onDismiss={() => setState((s) => ({ ...s, error: "" }))}
      />
      <ManageCard
        hideHeader
        filterSlot={
          <div className="ta-bookings-filters-bar">
            <div className="row g-3 g-lg-4 align-items-end">
              <div className="col-12 col-lg-7 col-xl-6">
                <p className="ta-bookings-filters-bar__title mb-2">Filters</p>
                <div className="d-flex flex-wrap align-items-end gap-2 gap-md-3">
                  <div className="ta-bookings-filter-field">
                    <label className="form-label small text-muted" htmlFor="ta-bookings-filter-from">
                      Created from
                    </label>
                    <input
                      id="ta-bookings-filter-from"
                      type="date"
                      className="form-control form-control-sm"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      aria-label="Filter bookings created on or after this date"
                    />
                  </div>
                  <span className="ta-bookings-filters-sep text-muted pb-1 d-none d-sm-block" aria-hidden="true">
                    —
                  </span>
                  <div className="ta-bookings-filter-field">
                    <label className="form-label small text-muted" htmlFor="ta-bookings-filter-to">
                      Created to
                    </label>
                    <input
                      id="ta-bookings-filter-to"
                      type="date"
                      className="form-control form-control-sm"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      aria-label="Filter bookings created on or before this date"
                    />
                  </div>
                  <div className="d-flex align-items-end pt-1 pt-sm-0">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      disabled={!hasDateFilters}
                      onClick={() => {
                        setDateFrom("");
                        setDateTo("");
                      }}
                    >
                      Reset dates
                    </button>
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-5 col-xl-6">
                <div className="ta-bookings-filters-search-wrap">
                  <ListSearchInput
                    id="ta-bookings-list-search"
                    fieldLabel="Search"
                    value={searchInput}
                    onChange={setSearchInput}
                    placeholder="Id, DRC, destination, status…"
                  />
                </div>
              </div>
            </div>
          </div>
        }
      >
        {state.loading ? (
          <CardLoader message="Loading bookings..." />
        ) : (
          <>
            <SimpleTable
              columns={[
                "ID",
                "Created",
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
                <span
                  key={`booking-created-${booking.id}`}
                  className="text-nowrap small"
                  data-sort={booking.created_at ? String(booking.created_at) : ""}
                >
                  {booking.created_at ? formatDate(booking.created_at) : "—"}
                </span>,
                booking.drc_no || "-",
                (() => {
                  const c = customerById[booking.customer_id];
                  return c
                    ? [c.first_name, c.last_name].filter(Boolean).join(" ") || c.customer_id
                    : `Customer #${booking.customer_id}`;
                })(),
                booking.destination || "—",
                formatDate(booking.travel_start_date),
                <div
                  key={`booking-status-${booking.id}`}
                  data-sort={bookingListDisplayStatus(booking.status)}
                >
                  <BookingListStatusCell
                    bookingId={booking.id}
                    status={booking.status}
                    saving={statusSavingId === booking.id}
                    onSetStatus={handleBookingStatusChange}
                    canCloseBooking={canCloseBooking}
                    canReopenBooking={canReopenBooking}
                  />
                </div>,
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
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Booking"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete Booking"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget.id)}
      />
    </>
  );
}

export default BookingsListPage;

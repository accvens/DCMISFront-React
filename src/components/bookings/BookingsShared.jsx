import { NavLink } from "react-router-dom";
import {
  AlertMessage,
  FormModal,
  formatDate,
  SelectField,
  TextField,
} from "../access/AccessShared.jsx";

export { formatDate };

export function BookingsSubmenu({ links }) {

  return (
    <div className="card">
      <div className="card-body py-3">
        <div className="ta-submenu">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `btn btn-sm ${isActive ? "btn-primary" : "btn-light"}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  let className = "bg-info-subtle text-info";
  const normalized = (status || "Unknown").toLowerCase();

  if (normalized === "confirmed" || normalized === "paid") {
    className = "bg-success-subtle text-success";
  } else if (
    normalized === "pending" ||
    normalized === "partial" ||
    normalized === "in progress"
  ) {
    className = "bg-warning-subtle text-warning";
  } else if (normalized === "cancelled") {
    className = "bg-danger-subtle text-danger";
  }

  return <span className={`badge rounded-pill ${className} ta-status-badge`}>{status || "Unknown"}</span>;
}

export function createMap(items, key) {
  return items.reduce((map, item) => {
    map[item[key]] = item;
    return map;
  }, {});
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function createEmptyBookingForm() {
  return {
    customer_id: "",
    destination_id: "",
    atpl_member: false,
    drc_no: "",
    travel_start_date: "",
    travel_end_date: "",
    estimated_margin: "",
    total_amount: "",
    status: "Pending",
    traveler_id: "",
    seat_preference: "",
    meal_preference: "",
    special_request: "",
    product_id: "",
    vendor_id: "",
    quantity: "1",
    price: "",
    line_total: "0.00",
  };
}

export function createDefaultBookingForm(data) {
  const firstCustomer = data.customers[0];
  const firstDestination = data.destinations[0];
  const firstProduct = data.products[0];
  const matchingTravelers = data.travelers.filter(
    (traveler) => traveler.customer_id === firstCustomer?.id,
  );

  return {
    customer_id: firstCustomer ? String(firstCustomer.id) : "",
    destination_id: firstDestination ? String(firstDestination.id) : "",
    atpl_member: false,
    drc_no: "",
    travel_start_date: "",
    travel_end_date: "",
    estimated_margin: "",
    total_amount: firstProduct ? String(firstProduct.price) : "",
    status: "Pending",
    traveler_id: matchingTravelers[0] ? String(matchingTravelers[0].id) : "",
    seat_preference: "",
    meal_preference: "",
    special_request: "",
    product_id: firstProduct ? String(firstProduct.product_id) : "",
    vendor_id: firstProduct ? String(firstProduct.vendor_id) : "",
    quantity: "1",
    price: firstProduct ? String(firstProduct.price) : "",
    line_total: firstProduct ? String(firstProduct.price) : "0.00",
  };
}

export function createBookingFormFromBooking(booking) {
  const travelerLine = booking.travelers?.[0];
  const productLine = booking.products?.[0];

  return {
    id: String(booking.id),
    customer_id: String(booking.customer_id || ""),
    destination_id: String(booking.destination_id || ""),
    atpl_member: Boolean(booking.atpl_member),
    drc_no: booking.drc_no || "",
    travel_start_date: booking.travel_start_date || "",
    travel_end_date: booking.travel_end_date || "",
    estimated_margin:
      booking.estimated_margin === null || booking.estimated_margin === undefined
        ? ""
        : String(booking.estimated_margin),
    total_amount: String(booking.total_amount || ""),
    status: booking.status || "Pending",
    traveler_id: travelerLine ? String(travelerLine.traveler_id) : "",
    seat_preference: travelerLine?.seat_preference || "",
    meal_preference: travelerLine?.meal_preference || "",
    special_request: travelerLine?.special_request || "",
    product_id: productLine ? String(productLine.product_id) : "",
    vendor_id: productLine ? String(productLine.vendor_id) : "",
    quantity: productLine ? String(productLine.quantity) : "1",
    price: productLine ? String(productLine.price) : "",
    line_total: productLine ? String(productLine.total_amount) : "0.00",
  };
}

export function buildBookingPayload(form) {
  return {
    customer_id: Number(form.customer_id),
    destination_id: Number(form.destination_id),
    atpl_member: form.atpl_member,
    drc_no: form.drc_no || null,
    travel_start_date: form.travel_start_date || null,
    travel_end_date: form.travel_end_date || null,
    estimated_margin: form.estimated_margin ? Number(form.estimated_margin) : null,
    total_amount: Number(form.total_amount),
    status: form.status,
    travelers: form.traveler_id
      ? [
          {
            traveler_id: Number(form.traveler_id),
            seat_preference: form.seat_preference || null,
            meal_preference: form.meal_preference || null,
            special_request: form.special_request || null,
          },
        ]
      : [],
    products: form.product_id
      ? [
          {
            product_id: Number(form.product_id),
            vendor_id: Number(form.vendor_id),
            quantity: Number(form.quantity),
            price: Number(form.price),
            total_amount: Number(form.line_total),
          },
        ]
      : [],
  };
}

export function validateBookingForm(form) {
  if (!form.customer_id) {
    return "Customer is required.";
  }

  if (!form.destination_id) {
    return "Destination is required.";
  }

  if (!form.status) {
    return "Status is required.";
  }

  if (!form.traveler_id) {
    return "Traveler is required.";
  }

  if (!form.product_id) {
    return "Product is required.";
  }

  if (!form.vendor_id) {
    return "Vendor is required.";
  }

  if (!form.total_amount || Number(form.total_amount) <= 0) {
    return "Total amount must be greater than 0.";
  }

  if (!form.quantity || Number(form.quantity) <= 0) {
    return "Quantity must be greater than 0.";
  }

  if (!form.price || Number(form.price) <= 0) {
    return "Price must be greater than 0.";
  }

  if (form.travel_start_date && form.travel_end_date && form.travel_end_date < form.travel_start_date) {
    return "Travel end date cannot be earlier than travel start date.";
  }

  if (form.estimated_margin && Number(form.estimated_margin) < 0) {
    return "Estimated margin cannot be negative.";
  }

  return "";
}

export function BookingFormModal({
  open,
  title,
  saveLabel,
  saving,
  onCancel,
  onSubmit,
  formError,
  form,
  setForm,
  state,
  bookingStatusOptions,
}) {
  const availableTravelers = state.travelers.filter(
    (traveler) => String(traveler.customer_id) === String(form.customer_id),
  );

  function updateBookingAmounts(nextValues) {
    const quantity = Number(nextValues.quantity || 0);
    const price = Number(nextValues.price || 0);
    return {
      ...nextValues,
      line_total: quantity && price ? (quantity * price).toFixed(2) : "0.00",
    };
  }

  function handleCustomerChange(value) {
    const nextTravelers = state.travelers.filter(
      (traveler) => String(traveler.customer_id) === String(value),
    );
    setForm((current) => ({
      ...current,
      customer_id: value,
      traveler_id: nextTravelers[0] ? String(nextTravelers[0].id) : "",
    }));
  }

  function handleProductChange(value) {
    const product = state.products.find((item) => String(item.id) === String(value));
    setForm((current) => {
      const nextForm = {
        ...current,
        product_id: value,
        vendor_id: product ? String(product.vendor_id) : current.vendor_id,
        price: product ? String(product.price) : current.price,
      };
      return updateBookingAmounts(nextForm);
    });
  }

  return (
    <FormModal
      open={open}
      title={title}
      saveLabel={saveLabel}
      saving={saving}
      size="modal-xl"
      onCancel={onCancel}
      onSubmit={onSubmit}
    >
      <AlertMessage message={formError} variant="danger" />
      <div className="row g-3">
        <SelectField
          label="Customer"
          value={form.customer_id}
          required
          onChange={handleCustomerChange}
          options={state.customers.map((item) => ({
            value: String(item.id),
            label: [item.first_name, item.last_name].filter(Boolean).join(" ") || item.customer_id || item.email || "Customer",
          }))}
        />
        <SelectField
          label="Destination"
          value={form.destination_id}
          required
          onChange={(value) =>
            setForm((current) => ({ ...current, destination_id: value }))
          }
          options={state.destinations.map((item) => ({
            value: String(item.id),
            label: item.destination_name,
          }))}
        />
        <TextField
          label="DRC No"
          value={form.drc_no}
          onChange={(value) => setForm((current) => ({ ...current, drc_no: value }))}
        />
        <TextField
          label="Total Amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          value={form.total_amount}
          onChange={(value) =>
            setForm((current) => ({ ...current, total_amount: value }))
          }
        />
        <TextField
          label="Travel Start Date"
          type="date"
          value={form.travel_start_date}
          onChange={(value) =>
            setForm((current) => ({ ...current, travel_start_date: value }))
          }
        />
        <TextField
          label="Travel End Date"
          type="date"
          value={form.travel_end_date}
          onChange={(value) =>
            setForm((current) => ({ ...current, travel_end_date: value }))
          }
        />
        <TextField
          label="Estimated Margin"
          type="number"
          step="0.01"
          value={form.estimated_margin}
          onChange={(value) =>
            setForm((current) => ({ ...current, estimated_margin: value }))
          }
        />
        <SelectField
          label="Status"
          value={form.status}
          required
          onChange={(value) => setForm((current) => ({ ...current, status: value }))}
          options={bookingStatusOptions.map((status) => ({
            value: status,
            label: status,
          }))}
        />
        <SelectField
          label="Traveler"
          value={form.traveler_id}
          required
          onChange={(value) =>
            setForm((current) => ({ ...current, traveler_id: value }))
          }
          options={availableTravelers.map((item) => ({
            value: String(item.id),
            label: `${item.first_name} ${item.last_name || ""}`.trim(),
          }))}
        />
        <TextField
          label="Seat Preference"
          value={form.seat_preference}
          onChange={(value) =>
            setForm((current) => ({ ...current, seat_preference: value }))
          }
        />
        <TextField
          label="Meal Preference"
          value={form.meal_preference}
          onChange={(value) =>
            setForm((current) => ({ ...current, meal_preference: value }))
          }
        />
        <TextField
          label="Special Request"
          value={form.special_request}
          onChange={(value) =>
            setForm((current) => ({ ...current, special_request: value }))
          }
        />
        <SelectField
          label="Product"
          value={form.product_id}
          required
          onChange={handleProductChange}
          options={state.products.map((item) => ({
            value: String(item.product_id),
            label: item.product_name,
          }))}
        />
        <SelectField
          label="Vendor"
          value={form.vendor_id}
          required
          onChange={(value) =>
            setForm((current) => ({ ...current, vendor_id: value }))
          }
          options={state.vendors.map((item) => ({
            value: String(item.id),
            label: item.vendor_name,
          }))}
        />
        <TextField
          label="Quantity"
          type="number"
          min="1"
          required
          value={form.quantity}
          onChange={(value) =>
            setForm((current) => updateBookingAmounts({ ...current, quantity: value }))
          }
        />
        <TextField
          label="Price"
          type="number"
          step="0.01"
          min="0.01"
          required
          value={form.price}
          onChange={(value) =>
            setForm((current) => updateBookingAmounts({ ...current, price: value }))
          }
        />
        <TextField
          label="Line Total"
          type="number"
          step="0.01"
          value={form.line_total}
          onChange={(value) =>
            setForm((current) => ({ ...current, line_total: value }))
          }
        />
        <div className="col-12">
          <div className="form-check">
            <input
              id="booking_atpl_member"
              type="checkbox"
              className="form-check-input"
              checked={form.atpl_member}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  atpl_member: event.target.checked,
                }))
              }
            />
            <label className="form-check-label" htmlFor="booking_atpl_member">
              ATPL member
            </label>
          </div>
        </div>
      </div>
    </FormModal>
  );
}

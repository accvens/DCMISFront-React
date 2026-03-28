import { NavLink } from "react-router-dom";

export function PaymentsSubmenu() {
  const links = [
    { to: "/payments/customer", label: "Customer Payment" },
    { to: "/payments/vendor", label: "Vendor Payment" },
  ];

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

export function createEmptyPaymentForm() {
  return {
    id: "",
    booking_id: "",
    amount: "",
    payment_method: "",
    transaction_reference: "",
    payment_date: "",
    status: "Pending",
  };
}

export function createDefaultPaymentForm(bookings) {
  return {
    ...createEmptyPaymentForm(),
    booking_id: bookings[0] ? String(bookings[0].id) : "",
  };
}

export function createEmptyVendorPaymentForm() {
  return {
    id: "",
    booking_id: "",
    vendor_id: "",
    amount: "",
    payment_method: "",
    payment_date: "",
    status: "Pending",
  };
}

export function createDefaultVendorPaymentForm(bookings, vendors) {
  return {
    ...createEmptyVendorPaymentForm(),
    booking_id: bookings[0] ? String(bookings[0].id) : "",
    vendor_id: vendors[0] ? String(vendors[0].id) : "",
  };
}

export function validatePaymentForm(form) {
  if (!form.booking_id) {
    return "Booking is required.";
  }

  if (!form.amount || Number(form.amount) <= 0) {
    return "Amount must be greater than 0.";
  }

  if (!String(form.payment_method || "").trim()) {
    return "Payment method is required.";
  }

  if (!form.status) {
    return "Status is required.";
  }

  return "";
}

export function validateVendorPaymentForm(form) {
  if (!form.vendor_id) {
    return "Vendor is required.";
  }

  return validatePaymentForm(form);
}

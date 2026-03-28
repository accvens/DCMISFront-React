import { NavLink } from "react-router-dom";

export function CustomersSubmenu({ links }) {
  const submenuLinks = links?.length
    ? links
    : [{ to: "/customers/list", label: "Manage Customer" }];

  return (
    <div className="card">
      <div className="card-body py-3">
        <div className="ta-submenu">
          {submenuLinks.map((link) => (
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

export function createEmptyCustomerForm() {
  return {
    id: "",
    customer_id: "",
    first_name: "",
    last_name: "",
    email: "",
    contact_number: "",
    gender: "",
    address: "",
    city: "",
    country: "",
  };
}

export function validateCustomerForm(form) {
  if (!String(form.first_name || "").trim()) {
    return "First name is required.";
  }
  if (!String(form.last_name || "").trim()) {
    return "Last name is required.";
  }

  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "Enter a valid email address.";
  }

  if (!form.gender) {
    return "Gender is required.";
  }

  return "";
}

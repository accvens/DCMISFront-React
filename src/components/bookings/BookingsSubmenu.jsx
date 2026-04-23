import { NavLink } from "react-router-dom";

/** Horizontal tab-style links for bookings / masters section layouts. */
export function BookingsSubmenu({ links }) {
  return (
    <div className="card">
      <div className="card-body py-3">
        <div className="ta-submenu">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `btn btn-sm ${isActive ? "btn-primary" : "btn-light"}`}
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

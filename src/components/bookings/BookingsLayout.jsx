import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AccessPageHeader } from "../access/AccessShared.jsx";
import { BookingsSubmenu } from "./BookingsShared.jsx";

function BookingsLayout({ items }) {
  const location = useLocation();

  if (location.pathname === "/bookings") {
    return <Navigate to="/bookings/list" replace />;
  }

  return (
    <>
      <AccessPageHeader
        title="Bookings"
        subtitle="Manage booking records in separate sections"
      />
      <BookingsSubmenu links={items} />
      <Outlet />
    </>
  );
}

export default BookingsLayout;

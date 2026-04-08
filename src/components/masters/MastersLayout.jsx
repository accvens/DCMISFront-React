import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AccessPageHeader } from "../access/AccessShared.jsx";
import { BookingsSubmenu } from "../bookings/BookingsShared.jsx";

function MastersLayout({ items }) {
  const location = useLocation();

  if (location.pathname === "/masters") {
    const first = items?.[0]?.to;
    return <Navigate to={first || "/dashboard"} replace />;
  }

  return (
    <>
      <AccessPageHeader
        title="Master section"
        subtitle="Manage master data used in bookings."
      />
      <BookingsSubmenu links={items} />
      <Outlet />
    </>
  );
}

export default MastersLayout;


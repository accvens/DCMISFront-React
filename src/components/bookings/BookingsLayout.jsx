import { Navigate, Outlet, useLocation } from "react-router-dom";

function BookingsLayout() {
  const location = useLocation();

  if (location.pathname === "/bookings") {
    return <Navigate to="/bookings/list" replace />;
  }

  return <Outlet />;
}

export default BookingsLayout;

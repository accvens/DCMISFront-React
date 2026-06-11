import { Navigate, Outlet, useLocation } from "react-router-dom";

function PaymentsLayout() {
  const location = useLocation();

  if (location.pathname === "/payments") {
    return <Navigate to="/payments/customer" replace />;
  }

  return <Outlet />;
}

export default PaymentsLayout;

import { Navigate, Outlet, useLocation } from "react-router-dom";

function ReportsLayout() {
  const location = useLocation();

  if (location.pathname === "/reports") {
    return <Navigate to="/reports/mis" replace />;
  }

  return <Outlet />;
}

export default ReportsLayout;

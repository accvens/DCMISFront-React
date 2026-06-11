import { Navigate, Outlet, useLocation } from "react-router-dom";

function CustomersLayout() {
  const location = useLocation();

  if (location.pathname === "/customers") {
    return <Navigate to="/customers/list" replace />;
  }

  return <Outlet />;
}

export default CustomersLayout;

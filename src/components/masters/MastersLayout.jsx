import { Navigate, Outlet, useLocation } from "react-router-dom";

function MastersLayout({ items }) {
  const location = useLocation();

  if (location.pathname === "/masters") {
    const first = items?.[0]?.to;
    return <Navigate to={first || "/dashboard"} replace />;
  }

  return <Outlet />;
}

export default MastersLayout;

import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function AdditionalSettingsLayout() {
  const location = useLocation();

  if (location.pathname === "/additional-settings") {
    return <Navigate to="/additional-settings/smtp-profiles" replace />;
  }

  return <Outlet />;
}

import { Navigate, Outlet, useLocation } from "react-router-dom";

function UsersAccessLayout() {
  const location = useLocation();

  if (location.pathname === "/access") {
    return <Navigate to="/access/users" replace />;
  }

  return <Outlet />;
}

export default UsersAccessLayout;

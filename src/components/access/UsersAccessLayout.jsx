import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AccessPageHeader, AccessSubmenu } from "./AccessShared.jsx";

function UsersAccessLayout() {
  const location = useLocation();

  if (location.pathname === "/access") {
    return <Navigate to="/access/users" replace />;
  }

  return (
    <>
      <AccessPageHeader
        title="Users & Access"
        subtitle="Manage users, roles, and permissions in separate sections"
      />
      <AccessSubmenu />
      <Outlet />
    </>
  );
}

export default UsersAccessLayout;

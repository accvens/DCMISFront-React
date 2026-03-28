import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AccessPageHeader } from "../access/AccessShared.jsx";
import { CustomersSubmenu } from "./CustomersShared.jsx";

function CustomersLayout({ items }) {
  const location = useLocation();

  if (location.pathname === "/customers") {
    return <Navigate to="/customers/list" replace />;
  }

  return (
    <>
      <AccessPageHeader
        title="Customers"
        subtitle="Manage customer records in a separate section"
      />
      <CustomersSubmenu links={items} />
      <Outlet />
    </>
  );
}

export default CustomersLayout;

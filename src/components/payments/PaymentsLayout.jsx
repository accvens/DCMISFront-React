import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AccessPageHeader } from "../access/AccessShared.jsx";
import { PaymentsSubmenu } from "./PaymentsShared.jsx";

function PaymentsLayout() {
  const location = useLocation();

  if (location.pathname === "/payments") {
    return <Navigate to="/payments/customer" replace />;
  }

  return (
    <>
      <AccessPageHeader
        title="Payments"
        subtitle="Track customer and vendor payments in separate sections"
      />
      <PaymentsSubmenu />
      <Outlet />
    </>
  );
}

export default PaymentsLayout;

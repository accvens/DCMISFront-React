import { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AlertMessage, FileField, formatDate, TextField } from "./components/access/AccessShared.jsx";
import { formatCurrency, parseAmountNumeric } from "./formatAmount.js";
import ManagePermissionsPage from "./components/access/ManagePermissionsPage.jsx";
import ManageRolesPage from "./components/access/ManageRolesPage.jsx";
import ManageUsersPage from "./components/access/ManageUsersPage.jsx";
import UsersAccessLayout from "./components/access/UsersAccessLayout.jsx";
import BookingsLayout from "./components/bookings/BookingsLayout.jsx";
import BookingsListPage from "./components/bookings/BookingsListPage.jsx";
import CreateBookingPage from "./components/bookings/CreateBookingPage.jsx";
import EditBookingPage from "./components/bookings/EditBookingPage.jsx";
import ManagePaymentModesPage from "./components/bookings/ManagePaymentModesPage.jsx";
import ManageProductTypesPage from "./components/bookings/ManageProductTypesPage.jsx";
import ManageVendorsPage from "./components/bookings/ManageVendorsPage.jsx";
import ManageTravelersPage from "./components/bookings/ManageTravelersPage.jsx";
import CustomersLayout from "./components/customers/CustomersLayout.jsx";
import ManageCustomersPage from "./components/customers/ManageCustomersPage.jsx";
import ManagePassportDetailsPage from "./components/customers/ManagePassportDetailsPage.jsx";
import ManageVisaDetailsPage from "./components/customers/ManageVisaDetailsPage.jsx";
import ManageTravelerDocumentsPage from "./components/customers/ManageTravelerDocumentsPage.jsx";
import ManageTravelerPreferencesPage from "./components/customers/ManageTravelerPreferencesPage.jsx";
import MastersLayout from "./components/masters/MastersLayout.jsx";
import ManageLookupMasterPage from "./components/masters/ManageLookupMasterPage.jsx";
import NotFoundPage from "./components/NotFoundPage.jsx";
import { normalizePaymentLineStatusForForm } from "./components/bookings/BookingsShared.jsx";
import CustomerPaymentsPage from "./components/payments/CustomerPaymentsPage.jsx";
import PaymentsLayout from "./components/payments/PaymentsLayout.jsx";
import VendorPaymentsPage from "./components/payments/VendorPaymentsPage.jsx";

function resolveApiBase() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (fromEnv) {
    return normalizeApiBase(fromEnv);
  }
  // Dev + no env: same-origin /api/v1 via Vite proxy → FastAPI (see vite.config.js).
  if (import.meta.env.DEV) {
    return "/api/v1";
  }
  // Production build served without proxy: browser must call API host directly.
  return "http://127.0.0.1:8000/api/v1";
}

const API_BASE = resolveApiBase();
const API_ORIGIN = getApiOrigin(API_BASE);
const TOKEN_KEY = "travel_agency_token";
const USER_KEY = "travel_agency_user";

const paymentStatusOptions = ["Pending", "Paid"];
const SUPER_ADMIN_ROLE = "super admin";
const BOOKING_AGENT_ROLE = "booking agent";
const ACCOUNTANT_ROLE = "accountant";

function normalizeNames(values) {
  return new Set((values || []).map((value) => String(value || "").trim().toLowerCase()));
}

function hasRole(user, roleName) {
  return normalizeNames(user?.roles).has(String(roleName).trim().toLowerCase());
}

function hasPermission(user, permissionSlug) {
  return normalizeNames(user?.permissions).has(String(permissionSlug).trim().toLowerCase());
}

function getCrudCapability(user, resourceName) {
  const isSuperAdmin = hasRole(user, SUPER_ADMIN_ROLE);
  if (isSuperAdmin) {
    return {
      view: true,
      create: true,
      update: true,
      delete: true,
      canAccess: true,
    };
  }

  const capability = {
    view: hasPermission(user, `view_${resourceName}`),
    create: hasPermission(user, `create_${resourceName}`),
    update: hasPermission(user, `update_${resourceName}`),
    delete: hasPermission(user, `delete_${resourceName}`),
  };

  return {
    ...capability,
    canAccess: capability.view || capability.create || capability.update || capability.delete,
  };
}

function getUserCapabilities(user) {
  const isSuperAdmin = hasRole(user, SUPER_ADMIN_ROLE);
  const customer = getCrudCapability(user, "customer");
  const traveler = getCrudCapability(user, "traveler");
  const paymentMode = getCrudCapability(user, "payment_mode");
  const productType = getCrudCapability(user, "product_type");
  const canAccessBookingsList =
    isSuperAdmin ||
    hasRole(user, BOOKING_AGENT_ROLE) ||
    hasPermission(user, "create_booking") ||
    hasPermission(user, "cancel_booking");
  const canAccessBookings =
    canAccessBookingsList ||
    traveler.canAccess ||
    paymentMode.canAccess ||
    productType.canAccess;
  const canCreateBooking =
    isSuperAdmin ||
    hasRole(user, BOOKING_AGENT_ROLE) ||
    hasPermission(user, "create_booking");
  /** Bookings list: set status to Closed (Completed). Granted via `close_booking` on roles (see migrations). */
  const canCloseBooking = isSuperAdmin || hasPermission(user, "close_booking");
  /** Bookings list: set status back to Open (Pending) after Closed. Granted via `reopen_booking` on roles. */
  const canReopenBooking = isSuperAdmin || hasPermission(user, "reopen_booking");
  const canAccessPayments =
    isSuperAdmin || hasRole(user, ACCOUNTANT_ROLE) || hasPermission(user, "view_reports");
  const canAccessAccess =
    isSuperAdmin || hasPermission(user, "create_user") || hasPermission(user, "delete_user");
  const canAccessMasters =
    paymentMode.canAccess ||
    productType.canAccess ||
    traveler.canAccess ||
    customer.canAccess;

  return {
    isSuperAdmin,
    customer,
    traveler,
    paymentMode,
    productType,
    canAccessBookingsList,
    canAccessBookings,
    canCreateBooking,
    canCloseBooking,
    canReopenBooking,
    canAccessPayments,
    canAccessAccess,
    canAccessMasters,
  };
}

function App() {
  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState(getStoredUser());
  const [authLoading, setAuthLoading] = useState(Boolean(getStoredToken()));
  const capabilities = getUserCapabilities(user);

  useEffect(() => {
    document.body.setAttribute("data-layout", "horizontal");
    document.body.setAttribute("data-topbar", "colored");
    document.body.setAttribute("data-layout-size", "fluid");
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setAuthLoading(false);
      return;
    }

    let active = true;
    setAuthLoading(true);

    apiRequest("/auth/me", { token })
      .then((me) => {
        if (!active) {
          return;
        }
        setUser(me);
        storeUser(me);
        setAuthLoading(false);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        clearStoredSession();
        setToken("");
        setUser(null);
        setAuthLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function handleLogin(credentials) {
    const formData = new URLSearchParams();
    formData.set("username", credentials.email);
    formData.set("password", credentials.password);

    const loginResult = await apiRequest("/auth/login", {
      method: "POST",
      auth: false,
      body: formData,
    });
    storeToken(loginResult.access_token, credentials.remember);
    const me = await apiRequest("/auth/me", { token: loginResult.access_token });
    storeUser(me, credentials.remember);
    setToken(loginResult.access_token);
    setUser(me);
  }

  function handleLogout() {
    clearStoredSession();
    setToken("");
    setUser(null);
  }

  function handleUserUpdated(updatedUser) {
    setUser(updatedUser);
    storeUser(updatedUser);
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            token && user && !authLoading ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginPage onLogin={handleLogin} authLoading={authLoading} />
            )
          }
        />
        <Route
          path="/"
          element={
            <ProtectedLayout
              token={token}
              user={user}
              capabilities={capabilities}
              authLoading={authLoading}
              onLogout={handleLogout}
            />
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={<DashboardPage token={token} user={user} capabilities={capabilities} />}
          />
          <Route
            path="/customers"
            element={
              <RequireSectionAccess allowed={capabilities.customer.canAccess}>
                <CustomersLayout
                  items={[
                    { to: "/customers/list", label: "Manage Customer" },
                    ...(capabilities.traveler.canAccess
                      ? [{ to: "/customers/travelers", label: "Traveler" }]
                      : []),
                    ...(capabilities.traveler.canAccess
                      ? [{ to: "/customers/passports", label: "Passport Details" }]
                      : []),
                    ...(capabilities.traveler.canAccess
                      ? [{ to: "/customers/visas", label: "Visa Details" }]
                      : []),
                    ...(capabilities.customer.canAccess && capabilities.traveler.canAccess
                      ? [{ to: "/customers/preferences", label: "Traveler Preferences" }]
                      : []),
                    ...(capabilities.traveler.canAccess
                      ? [{ to: "/customers/documents", label: "Traveler Documents" }]
                      : []),
                  ]}
                />
              </RequireSectionAccess>
            }
          >
            <Route
              path="list"
              element={
                <ManageCustomersPage
                  token={token}
                  apiRequest={apiRequest}
                  canCreate={capabilities.customer.create}
                  canUpdate={capabilities.customer.update}
                  canDelete={capabilities.customer.delete}
                />
              }
            />
            <Route
              path="travelers"
              element={
                <RequireSectionAccess allowed={capabilities.traveler.canAccess}>
                  <ManageTravelersPage
                    token={token}
                    apiRequest={apiRequest}
                    canCreate={capabilities.traveler.create}
                    canUpdate={capabilities.traveler.update}
                    canDelete={capabilities.traveler.delete}
                  />
                </RequireSectionAccess>
              }
            />
            <Route
              path="passports"
              element={
                <RequireSectionAccess allowed={capabilities.traveler.canAccess}>
                  <ManagePassportDetailsPage
                    token={token}
                    apiRequest={apiRequest}
                    canCreate={capabilities.traveler.create}
                    canUpdate={capabilities.traveler.update}
                    canDelete={capabilities.traveler.delete}
                  />
                </RequireSectionAccess>
              }
            />
            <Route
              path="visas"
              element={
                <RequireSectionAccess allowed={capabilities.traveler.canAccess}>
                  <ManageVisaDetailsPage
                    token={token}
                    apiRequest={apiRequest}
                    canCreate={capabilities.traveler.create}
                    canUpdate={capabilities.traveler.update}
                    canDelete={capabilities.traveler.delete}
                  />
                </RequireSectionAccess>
              }
            />
            <Route
              path="documents"
              element={
                <RequireSectionAccess allowed={capabilities.traveler.canAccess}>
                  <ManageTravelerDocumentsPage
                    token={token}
                    apiRequest={apiRequest}
                    canCreate={capabilities.traveler.create}
                    canUpdate={capabilities.traveler.update}
                    canDelete={capabilities.traveler.delete}
                  />
                </RequireSectionAccess>
              }
            />
            <Route
              path="preferences"
              element={
                <RequireSectionAccess
                  allowed={capabilities.customer.canAccess && capabilities.traveler.canAccess}
                >
                  <ManageTravelerPreferencesPage
                    token={token}
                    apiRequest={apiRequest}
                    canCreate={capabilities.customer.create || capabilities.traveler.create}
                    canUpdate={capabilities.customer.update || capabilities.traveler.update}
                    canDelete={capabilities.customer.delete || capabilities.traveler.delete}
                  />
                </RequireSectionAccess>
              }
            />
          </Route>
          <Route
            path="/bookings"
            element={
              <RequireSectionAccess allowed={capabilities.canAccessBookings}>
                <BookingsLayout
                  items={[
                    ...(capabilities.canAccessBookings
                      ? [
                          { to: "/bookings/list", label: "Bookings List" },
                          ...(capabilities.canCreateBooking
                            ? [{ to: "/bookings/create", label: "Create Booking" }]
                            : []),
                        ]
                      : []),
                  ]}
                />
              </RequireSectionAccess>
            }
          >
            <Route
              path="list"
              element={
                <RequireSectionAccess allowed={capabilities.canAccessBookings}>
                  <BookingsListPage
                    token={token}
                    apiRequest={apiRequest}
                    canCloseBooking={capabilities.canCloseBooking}
                    canReopenBooking={capabilities.canReopenBooking}
                  />
                </RequireSectionAccess>
              }
            />
            <Route
              path="create"
              element={
                <RequireSectionAccess allowed={capabilities.canCreateBooking}>
                  <CreateBookingPage
                    token={token}
                    apiRequest={apiRequest}
                    canCreateCustomer={capabilities.customer.create}
                    canCreateTraveler={capabilities.traveler.create}
                    canCreateProductType={capabilities.productType.create}
                  />
                </RequireSectionAccess>
              }
            />
            <Route
              path="edit/:bookingId"
              element={
                <EditBookingPage
                  token={token}
                  apiRequest={apiRequest}
                  canCreateCustomer={capabilities.customer.create}
                  canCreateTraveler={capabilities.traveler.create}
                  canCreateProductType={capabilities.productType.create}
                />
              }
            />
            <Route
              path=":bookingId/edit"
              element={
                <EditBookingPage
                  token={token}
                  apiRequest={apiRequest}
                  canCreateCustomer={capabilities.customer.create}
                  canCreateTraveler={capabilities.traveler.create}
                  canCreateProductType={capabilities.productType.create}
                />
              }
            />
          </Route>
          <Route
            path="/masters"
            element={
              <RequireSectionAccess allowed={capabilities.canAccessMasters}>
                <MastersLayout
                  items={[
                    ...(capabilities.customer.canAccess ||
                    capabilities.traveler.canAccess ||
                    capabilities.productType.canAccess
                      ? [{ to: "/masters/countries", label: "Countries" }]
                      : []),
                    ...(capabilities.productType.canAccess
                      ? [{ to: "/masters/vendors", label: "Vendors" }]
                      : []),
                    ...(capabilities.traveler.canAccess
                      ? [{ to: "/masters/traveler-types", label: "Traveler Types" }]
                      : []),
                    ...(capabilities.paymentMode.canAccess
                      ? [{ to: "/masters/payment-modes", label: "Payment Modes" }]
                      : []),
                    ...(capabilities.productType.canAccess
                      ? [{ to: "/masters/product-types", label: "Manage Product" }]
                      : []),
                  ]}
                />
              </RequireSectionAccess>
            }
          >
            <Route
              path="payment-modes"
              element={
                <RequireSectionAccess allowed={capabilities.paymentMode.canAccess}>
                  <ManagePaymentModesPage
                    token={token}
                    apiRequest={apiRequest}
                    canCreate={capabilities.paymentMode.create}
                    canUpdate={capabilities.paymentMode.update}
                    canDelete={capabilities.paymentMode.delete}
                  />
                </RequireSectionAccess>
              }
            />
            <Route
              path="product-types"
              element={
                <RequireSectionAccess allowed={capabilities.productType.canAccess}>
                  <ManageProductTypesPage
                    token={token}
                    apiRequest={apiRequest}
                    canCreate={capabilities.productType.create}
                    canUpdate={capabilities.productType.update}
                    canDelete={capabilities.productType.delete}
                  />
                </RequireSectionAccess>
              }
            />
            <Route
              path="countries"
              element={
                <RequireSectionAccess
                  allowed={
                    capabilities.customer.canAccess ||
                    capabilities.traveler.canAccess ||
                    capabilities.productType.canAccess
                  }
                >
                  <ManageLookupMasterPage
                    token={token}
                    apiRequest={apiRequest}
                    slug="countries"
                    title="Countries"
                    documentTitle="Countries | Master | Travel Agency"
                    canCreate={capabilities.productType.create}
                    canUpdate={capabilities.productType.update}
                    canDelete={capabilities.productType.delete}
                  />
                </RequireSectionAccess>
              }
            />
            <Route
              path="vendors"
              element={
                <RequireSectionAccess allowed={capabilities.productType.canAccess}>
                  <ManageVendorsPage
                    token={token}
                    apiRequest={apiRequest}
                    canCreate={capabilities.productType.create}
                    canUpdate={capabilities.productType.update}
                    canDelete={capabilities.productType.delete}
                  />
                </RequireSectionAccess>
              }
            />
            <Route
              path="traveler-types"
              element={
                <RequireSectionAccess allowed={capabilities.traveler.canAccess}>
                  <ManageLookupMasterPage
                    token={token}
                    apiRequest={apiRequest}
                    slug="traveler-types"
                    title="Traveler Types"
                    documentTitle="Traveler Types | Master | Travel Agency"
                    canCreate={capabilities.traveler.create}
                    canUpdate={capabilities.traveler.update}
                    canDelete={capabilities.traveler.delete}
                  />
                </RequireSectionAccess>
              }
            />
          </Route>
          <Route
            path="/payments"
            element={
              <RequireSectionAccess allowed={capabilities.canAccessPayments}>
                <PaymentsLayout />
              </RequireSectionAccess>
            }
          >
            <Route
              path="customer"
              element={
                <CustomerPaymentsPage
                  token={token}
                  apiRequest={apiRequest}
                  paymentStatusOptions={paymentStatusOptions}
                />
              }
            />
            <Route
              path="vendor"
              element={
                <VendorPaymentsPage
                  token={token}
                  apiRequest={apiRequest}
                  paymentStatusOptions={paymentStatusOptions}
                />
              }
            />
          </Route>
          <Route
            path="/access"
            element={
              <RequireSectionAccess allowed={capabilities.canAccessAccess}>
                <UsersAccessLayout />
              </RequireSectionAccess>
            }
          >
            <Route path="users" element={<ManageUsersPage token={token} apiRequest={apiRequest} />} />
            <Route path="roles" element={<ManageRolesPage token={token} apiRequest={apiRequest} />} />
            <Route
              path="permissions"
              element={<ManagePermissionsPage token={token} apiRequest={apiRequest} />}
            />
          </Route>
          <Route
            path="/profile"
            element={
              <ProfilePage token={token} user={user} onUserUpdated={handleUserUpdated} />
            }
          />
          <Route
            path="/change-password"
            element={
              <ChangePasswordPage
                token={token}
                user={user}
                onUserUpdated={handleUserUpdated}
              />
            }
          />
        </Route>
        <Route path="*" element={<NotFoundPage token={token} />} />
      </Routes>
    </BrowserRouter>
  );
}

function RequireSectionAccess({ allowed, children }) {
  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function ProtectedLayout({ token, user, capabilities, authLoading, onLogout }) {
  const location = useLocation();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [location.pathname]);

  if (authLoading) {
    return <FullPageLoader message="Loading your workspace..." />;
  }

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const accessItems = capabilities.canAccessAccess
    ? [
        { to: "/access/users", label: "Manage User" },
        { to: "/access/roles", label: "Manage Role" },
        { to: "/access/permissions", label: "Manage Permission" },
      ]
    : [];

  return (
    <div id="layout-wrapper">
      <header id="page-topbar">
        <div className="navbar-header">
          <div className="d-flex align-items-center gap-3 ta-topbar-logo">
            <div className="navbar-brand-box">
              <NavLink to="/dashboard" className="logo logo-light">
                <span className="logo-sm">
                  <img src="/travel-logo-lg.jpeg" alt="Dreamcatcherz Travel & Events" className="ta-brand-logo ta-brand-logo-sm" height="40" />
                </span>
                <span className="logo-lg">
                  <img src="/travel-logo-lg.jpeg" alt="Dreamcatcherz Travel & Events" className="ta-brand-logo ta-brand-logo-lg" height="48" />
                </span>
              </NavLink>
            </div>
          </div>
          <div className="d-flex align-items-center gap-3 ta-topbar-actions">
            <div className={`dropdown d-inline-block ta-profile-dropdown${profileMenuOpen ? " show" : ""}`}>
              <button
                type="button"
                className="btn header-item waves-effect ta-profile-button"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((current) => !current)}
              >
                <img src={resolveUserAvatar(user)} alt="Profile avatar" className="ta-profile-image" />
                <span className="d-none d-xl-inline-block ms-2 fw-medium font-size-15 ta-profile-name">
                  {user.name || user.email}
                </span>
                <span
                  className={`d-none d-xl-inline-block ms-1 ta-profile-arrow${
                    profileMenuOpen ? " open" : ""
                  }`}
                ></span>
              </button>
              <div className={`dropdown-menu dropdown-menu-end ta-profile-menu${profileMenuOpen ? " show" : ""}`}>
                <NavLink className="dropdown-item" to="/profile">
                  <i className="uil uil-user-circle font-size-18 align-middle text-muted me-1"></i>
                  <span className="align-middle">My Profile</span>
                </NavLink>
                <NavLink className="dropdown-item" to="/change-password">
                  <i className="uil uil-lock-alt font-size-18 align-middle me-1 text-muted"></i>
                  <span className="align-middle">Change Password</span>
                </NavLink>
                {capabilities.canAccessAccess ? (
                  <NavLink className="dropdown-item d-block" to="/access/users">
                    <i className="uil uil-cog font-size-18 align-middle me-1 text-muted"></i>
                    <span className="align-middle">Settings</span>
                    <span className="badge bg-success-subtle text-success rounded-pill mt-1 ms-2">
                      {user.roles?.length || 0}
                    </span>
                  </NavLink>
                ) : null}
                <button type="button" className="dropdown-item" onClick={onLogout}>
                  <i className="uil uil-sign-out-alt font-size-18 align-middle me-1 text-muted"></i>
                  <span className="align-middle">Sign out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="container-fluid">
          <div className="topnav">
            <nav className="navbar navbar-light navbar-expand-lg topnav-menu">
              <div className="collapse navbar-collapse show" id="topnav-menu-content">
                <ul className="navbar-nav">
                  <HorizontalNavLink to="/dashboard" icon="dashboard" label="Dashboard" />
                  <HorizontalNavDropdown
                    icon="customers"
                    label="Customer"
                    activePrefix="/customers"
                    items={[
                      { to: "/customers/list", label: "Manage Customer" },
                      ...(capabilities.traveler.canAccess
                        ? [{ to: "/customers/travelers", label: "Traveler" }]
                        : []),
                      ...(capabilities.traveler.canAccess
                        ? [{ to: "/customers/passports", label: "Passport Details" }]
                        : []),
                      ...(capabilities.traveler.canAccess
                        ? [{ to: "/customers/visas", label: "Visa Details" }]
                        : []),
                      ...(capabilities.customer.canAccess && capabilities.traveler.canAccess
                        ? [{ to: "/customers/preferences", label: "Traveler Preferences" }]
                        : []),
                      ...(capabilities.traveler.canAccess
                        ? [{ to: "/customers/documents", label: "Traveler Documents" }]
                        : []),
                    ]}
                  />
                  {capabilities.canAccessBookings ? (
                    <HorizontalNavDropdown
                      icon="bookings"
                      label="Bookings"
                      activePrefix="/bookings"
                      items={[
                        { to: "/bookings/list", label: "Bookings List" },
                        ...(capabilities.canCreateBooking
                          ? [{ to: "/bookings/create", label: "Create Booking" }]
                          : []),
                      ]}
                    />
                  ) : null}
                  {capabilities.canAccessMasters ? (
                    <HorizontalNavDropdown
                      icon="bookings"
                      label="Master section"
                      activePrefix="/masters"
                      items={[
                        ...(capabilities.customer.canAccess ||
                        capabilities.traveler.canAccess ||
                        capabilities.productType.canAccess
                          ? [{ to: "/masters/countries", label: "Countries" }]
                          : []),
                        ...(capabilities.productType.canAccess
                          ? [{ to: "/masters/vendors", label: "Vendors" }]
                          : []),
                        ...(capabilities.traveler.canAccess
                          ? [{ to: "/masters/traveler-types", label: "Traveler Types" }]
                          : []),
                        ...(capabilities.paymentMode.canAccess
                          ? [{ to: "/masters/payment-modes", label: "Payment Modes" }]
                          : []),
                        ...(capabilities.productType.canAccess
                          ? [{ to: "/masters/product-types", label: "Manage Product" }]
                          : []),
                      ]}
                    />
                  ) : null}
                  <HorizontalNavDropdown
                    icon="payments"
                    label="Payments"
                    activePrefix="/payments"
                    items={[
                      { to: "/payments/customer", label: "Customer Payment" },
                      { to: "/payments/vendor", label: "Vendor Payment" },
                    ]}
                  />
                  <HorizontalNavDropdown
                    icon="access"
                    label="Users & Access"
                    activePrefix="/access"
                    items={[
                      { to: "/access/users", label: "Manage User" },
                      { to: "/access/roles", label: "Manage Role" },
                      { to: "/access/permissions", label: "Manage Permission" },
                    ]}
                  />
                </ul>
              </div>
            </nav>
          </div>
        </div>
      </header>

      <div className="main-content">
        <div className="page-content">
          <div className="container-fluid">
            <Outlet />
          </div>
        </div>
        <footer className="footer">
          <div className="container-fluid text-center">
            {new Date().getFullYear()} Dreamcatcherz Travel & Events by accven
          </div>
        </footer>
      </div>
    </div>
  );
}

function HorizontalNavLink({ to, icon, label }) {
  return (
    <li className="nav-item">
      <NavLink
        to={to}
        className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
      >
        <MenuIcon name={icon} />
        {label}
        <span className="ta-menu-arrow"></span>
      </NavLink>
    </li>
  );
}

function HorizontalNavDropdown({ icon, label, items, activePrefix }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  return (
    <li className={`nav-item dropdown ta-nav-dropdown${open ? " show" : ""}`}>
      <button
        type="button"
        className={`nav-link ta-nav-dropdown-toggle${
          location.pathname.startsWith(activePrefix) ? " active" : ""
        }`}
        onClick={() => setOpen((current) => !current)}
      >
        <MenuIcon name={icon} />
        {label}
        <span className={`ta-menu-arrow${open ? " open" : ""}`}></span>
      </button>
      <div className={`dropdown-menu ta-nav-dropdown-menu${open ? " show" : ""}`}>
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className="dropdown-item">
            {item.label}
          </NavLink>
        ))}
      </div>
    </li>
  );
}

function MenuIcon({ name }) {
  const icons = {
    dashboard: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" rx="1.5"></rect>
        <rect x="13" y="3" width="8" height="5" rx="1.5"></rect>
        <rect x="13" y="10" width="8" height="11" rx="1.5"></rect>
        <rect x="3" y="13" width="8" height="8" rx="1.5"></rect>
      </svg>
    ),
    customers: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="8" cy="8" r="3"></circle>
        <circle cx="16.5" cy="9.5" r="2.5"></circle>
        <path d="M3.5 19c0-2.8 2.2-5 5-5s5 2.2 5 5"></path>
        <path d="M13.5 19c.3-1.9 1.8-3.4 3.8-3.8"></path>
      </svg>
    ),
    bookings: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="6" width="16" height="13" rx="2"></rect>
        <path d="M9 6V4m6 2V4"></path>
        <path d="M4 10h16"></path>
      </svg>
    ),
    payments: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="6" width="18" height="12" rx="2"></rect>
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M7 12h.01M17 12h.01"></path>
      </svg>
    ),
    access: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3"></circle>
        <path d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5"></path>
        <path d="M17 8h4M19 6v4"></path>
      </svg>
    ),
  };

  return <span className="ta-menu-icon">{icons[name] || icons.dashboard}</span>;
}

function LoginPage({ onLogin, authLoading }) {
  const [form, setForm] = useState({
    email: "",
    password: "",
    remember: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Login | Travel Agency";
    document.body.classList.add("ta-login-page-active");
    return () => document.body.classList.remove("ta-login-page-active");
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await onLogin(form);
    } catch (requestError) {
      setError(requestError.message || "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ta-login-page">
      <div className="container">
        <div className="row justify-content-center align-items-center min-vh-100">
          <div className="col-xl-10">
            <div className="card ta-login-card border-0 shadow-lg overflow-hidden">
              <div className="row g-0">
                <div className="col-lg-6 ta-login-hero">
                  <div className="ta-login-hero-content">
                    <div className="ta-login-brand">
                      <img src="/travel-logo-lg.jpeg" alt="Dreamcatcherz Travel & Events by accven" className="ta-login-logo" />
                    </div>
                    <h2 className="ta-login-title">
                      Manage bookings, payments, and access from one workspace.
                    </h2>
                    <p className="ta-login-copy">
                      Sign in to continue to your travel operations portal with role-based access.
                    </p>
                    <div className="ta-login-feature-list">
                      <div className="ta-login-feature">Booking and payment workflows</div>
                      <div className="ta-login-feature">Role and permission based access</div>
                      <div className="ta-login-feature">Minible inspired responsive interface</div>
                    </div>
                  </div>
                </div>
                <div className="col-lg-6 bg-white">
                  <div className="ta-login-form-panel">
                    <div className="mb-4">
                      <span className="badge bg-primary-subtle text-primary mb-3">
                        Secure Sign In
                      </span>
                      <h3 className="mb-2">Welcome Back</h3>
                      <p className="ta-card-muted mb-0">
                        Enter your email and password to access your dashboard.
                      </p>
                    </div>
                    <AlertMessage message={error} variant="danger" />
                    <form onSubmit={handleSubmit}>
                      <div className="mb-3">
                        <label className="form-label" htmlFor="email">
                          Email Address
                        </label>
                        <input
                          id="email"
                          type="email"
                          className="form-control ta-login-input"
                          placeholder="name@example.com"
                          value={form.email}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, email: event.target.value }))
                          }
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label" htmlFor="password">
                          Password
                        </label>
                        <input
                          id="password"
                          type="password"
                          className="form-control ta-login-input"
                          placeholder="Enter your password"
                          value={form.password}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, password: event.target.value }))
                          }
                          required
                        />
                      </div>
                      <div className="d-flex align-items-center justify-content-between mb-4">
                        <div className="form-check">
                          <input
                            id="remember"
                            type="checkbox"
                            className="form-check-input"
                            checked={form.remember}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, remember: event.target.checked }))
                            }
                          />
                          <label className="form-check-label" htmlFor="remember">
                            Remember me
                          </label>
                        </div>
                        <span className="ta-card-muted">Travel Agency Portal</span>
                      </div>
                      <div className="d-grid">
                        <button
                          className="btn btn-primary btn-lg"
                          type="submit"
                          disabled={submitting || authLoading}
                        >
                          {submitting || authLoading ? "Signing in..." : "Log In"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardPage({ token, user, capabilities }) {
  const [state, setState] = useState({
    loading: true,
    error: "",
    bookings: [],
    payments: [],
    vendorPayments: [],
    customerTotal: 0,
  });

  useEffect(() => {
    document.title = "Dashboard | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));

    Promise.all([
      capabilities.canAccessBookings
        ? apiRequest("/bookings?page=1&page_size=100", { token })
        : Promise.resolve({ items: [] }),
      capabilities.canAccessPayments
        ? apiRequest("/payments?page=1&page_size=100", { token })
        : Promise.resolve({ items: [] }),
      capabilities.canAccessPayments
        ? apiRequest("/vendor-payments?page=1&page_size=100", { token })
        : Promise.resolve({ items: [] }),
      capabilities.customer.canAccess
        ? apiRequest("/customers?page=1&page_size=1", { token })
        : Promise.resolve({ total: 0 }),
    ])
      .then(([bookings, payments, vendorPayments, customersPage]) => {
        if (!active) {
          return;
        }
        setState({
          loading: false,
          error: "",
          bookings: bookings.items,
          payments: payments.items,
          vendorPayments: vendorPayments.items,
          customerTotal: Number(customersPage.total ?? 0),
        });
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setState((current) => ({
          ...current,
          loading: false,
          error: requestError.message || "Unable to load dashboard data.",
        }));
      });

    return () => {
      active = false;
    };
  }, [
    capabilities.canAccessBookings,
    capabilities.canAccessPayments,
    capabilities.customer.canAccess,
    token,
  ]);

  const totalReceived = state.payments.reduce(
    (sum, payment) => sum + parseAmountNumeric(payment.amount),
    0,
  );
  const totalVendorPaid = state.vendorPayments.reduce(
    (sum, payment) => sum + parseAmountNumeric(payment.amount),
    0,
  );
  const pendingBookings = state.bookings.filter((booking) =>
    !["confirmed", "paid"].includes((booking.status || "").toLowerCase()),
  ).length;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of bookings and payment activity"
      />
      <AlertMessage message={state.error} variant="danger" />
      {state.loading ? (
        <CardLoader message="Loading dashboard metrics..." />
      ) : (
        <>
          <div className="row g-4 mb-4 ta-dashboard">
            <StatCard
              label="Signed in user"
              value={user?.name || user?.email || "-"}
              actionTo="/profile"
              actionLabel="View profile"
            />
            {capabilities.customer.canAccess ? (
              <StatCard
                label="Customers"
                value={String(state.customerTotal)}
                actionTo="/customers/list"
                actionLabel="Manage customers"
              />
            ) : null}
            {capabilities.canAccessBookings ? (
              <StatCard
                label="Total bookings"
                value={String(state.bookings.length)}
                actionTo="/bookings/list"
                actionLabel="View bookings"
              />
            ) : null}
            {capabilities.canAccessPayments ? (
              <StatCard
                label="Customer payments"
                value={formatCurrency(totalReceived)}
                actionTo="/payments/customer"
                actionLabel="Customer payments"
              />
            ) : null}
            {capabilities.canAccessPayments ? (
              <StatCard
                label="Vendor payments"
                value={formatCurrency(totalVendorPaid)}
                actionTo="/payments/vendor"
                actionLabel="Vendor payments"
              />
            ) : null}
          </div>
          <div className="row g-4 align-items-stretch">
            {capabilities.canAccessBookings ? (
              <div
                className={`d-flex flex-column ${capabilities.canAccessPayments ? "col-xl-7" : "col-12"}`}
              >
                <div className="card flex-grow-1 w-100 h-100">
                  <div className="card-body d-flex flex-column">
                    <div className="ta-toolbar flex-wrap gap-2">
                      <div>
                        <h4 className="card-title mb-1">Recent Bookings</h4>
                        <p className="ta-card-muted mb-0">
                          Latest booking records from the backend.
                        </p>
                      </div>
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <div className="badge bg-warning-subtle text-warning ta-status-badge">
                          Pending: {pendingBookings}
                        </div>
                        {capabilities.customer.canAccess ? (
                          <NavLink to="/customers/list" className="btn btn-primary btn-sm">
                            Customers
                          </NavLink>
                        ) : null}
                        <NavLink to="/bookings/create" className="btn btn-primary btn-sm">
                          Create booking
                        </NavLink>
                        <NavLink to="/bookings/list" className="btn btn-primary btn-sm">
                          Bookings list
                        </NavLink>
                      </div>
                    </div>
                    <div className="mt-3">
                    <SimpleTable
                      columns={["ID", "DRC No", "Travel Start Date", "Status", "Total"]}
                      rows={state.bookings
                        .slice(-5)
                        .reverse()
                        .map((booking) => [
                          `#${booking.id}`,
                          booking.drc_no || "-",
                          formatDate(booking.travel_start_date),
                          <StatusBadge key={`status-${booking.id}`} status={booking.status} />,
                          formatCurrency(booking.total_amount),
                        ])}
                      emptyMessage="No bookings found."
                    />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {capabilities.canAccessPayments ? (
              <div
                className={`d-flex flex-column ${capabilities.canAccessBookings ? "col-xl-5" : "col-12"}`}
              >
                <div className="card flex-grow-1 w-100 h-100">
                  <div className="card-body d-flex flex-column">
                    <div className="ta-toolbar flex-wrap gap-2">
                      <div>
                        <h4 className="card-title mb-1">Recent Payments</h4>
                        <p className="ta-card-muted mb-0">
                          Latest customer payments received.
                        </p>
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        <NavLink to="/payments/vendor" className="btn btn-primary btn-sm">
                          Vendor payments
                        </NavLink>
                        <NavLink to="/payments/customer" className="btn btn-primary btn-sm">
                          Customer payments
                        </NavLink>
                      </div>
                    </div>
                    <div className="mt-3">
                    <SimpleTable
                      columns={["ID", "Booking", "Method", "Amount", "Status"]}
                      rows={state.payments
                        .slice(-5)
                        .reverse()
                        .map((payment) => [
                          `#${payment.id}`,
                          `Booking #${payment.booking_id}`,
                          payment.payment_method,
                          formatCurrency(payment.amount),
                          <StatusBadge key={`payment-${payment.id}`} status={payment.status} />,
                        ])}
                      emptyMessage="No payments found."
                    />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {!capabilities.canAccessBookings && !capabilities.canAccessPayments ? (
              <div className="col-12">
                <div className="card h-100">
                  <div className="card-body">
                    <h4 className="card-title mb-2">Welcome</h4>
                    <p className="ta-card-muted mb-3">
                      Your account is active, but no booking or payment modules are assigned yet.
                    </p>
                    <div className="d-flex flex-wrap gap-2">
                      {capabilities.customer.canAccess ? (
                        <NavLink to="/customers/list" className="btn btn-primary btn-sm">
                          Manage customers
                        </NavLink>
                      ) : null}
                      {capabilities.traveler.canAccess ? (
                        <NavLink to="/customers/travelers" className="btn btn-primary btn-sm">
                          Travelers
                        </NavLink>
                      ) : null}
                      {capabilities.canAccessAccess ? (
                        <NavLink to="/access/users" className="btn btn-primary btn-sm">
                          Users &amp; access
                        </NavLink>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}
    </>
  );
}

function PaymentsPage({ token }) {
  const [paymentPage, setPaymentPage] = useState(1);
  const [vendorPaymentPage, setVendorPaymentPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [state, setState] = useState({
    loading: true,
    error: "",
    paymentsPage: null,
    vendorPaymentsPage: null,
    bookings: [],
    vendors: [],
  });
  const [paymentForm, setPaymentForm] = useState(createEmptyPaymentForm());
  const [vendorPaymentForm, setVendorPaymentForm] = useState(
    createEmptyVendorPaymentForm(),
  );
  const [paymentFormError, setPaymentFormError] = useState("");
  const [vendorPaymentFormError, setVendorPaymentFormError] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingVendorPayment, setSavingVendorPayment] = useState(false);

  useEffect(() => {
    document.title = "Payments | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));

    Promise.all([
      apiRequest(`/payments?page=${paymentPage}&page_size=10`, { token }),
      apiRequest(`/vendor-payments?page=${vendorPaymentPage}&page_size=10`, { token }),
      apiRequest("/bookings?page=1&page_size=100", { token }),
      apiRequest("/masters/vendors?page=1&page_size=100", { token }),
    ])
      .then(([paymentsPage, vendorPaymentsPage, bookings, vendors]) => {
        if (!active) {
          return;
        }
        setState({
          loading: false,
          error: "",
          paymentsPage,
          vendorPaymentsPage,
          bookings: bookings.items,
          vendors: vendors.items,
        });
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setState((current) => ({
          ...current,
          loading: false,
          error: requestError.message || "Unable to load payment data.",
        }));
      });

    return () => {
      active = false;
    };
  }, [paymentPage, refreshKey, token, vendorPaymentPage]);

  useEffect(() => {
    if (!state.bookings.length || paymentForm.booking_id) {
      return;
    }
    setPaymentForm(createDefaultPaymentForm(state.bookings));
  }, [paymentForm.booking_id, state.bookings]);

  useEffect(() => {
    if (!state.bookings.length || !state.vendors.length || vendorPaymentForm.booking_id) {
      return;
    }
    setVendorPaymentForm(createDefaultVendorPaymentForm(state.bookings, state.vendors));
  }, [state.bookings, state.vendors, vendorPaymentForm.booking_id]);

  const bookingMap = useMemo(() => createMap(state.bookings, "id"), [state.bookings]);
  const vendorMap = useMemo(() => createMap(state.vendors, "id"), [state.vendors]);

  async function submitPayment(event) {
    event.preventDefault();
    setSavingPayment(true);
    setPaymentFormError("");

    try {
      await apiRequest(
        paymentForm.id ? `/payments/${paymentForm.id}` : "/payments",
        {
          method: paymentForm.id ? "PATCH" : "POST",
          token,
          body: {
            booking_id: Number(paymentForm.booking_id),
            amount: parseAmountNumeric(paymentForm.amount),
            payment_method: paymentForm.payment_method,
            transaction_reference: paymentForm.transaction_reference || null,
            payment_date: paymentForm.payment_date || null,
            status: paymentForm.status,
          },
        },
      );
      setPaymentForm(createDefaultPaymentForm(state.bookings));
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setPaymentFormError(requestError.message || "Unable to save payment.");
    } finally {
      setSavingPayment(false);
    }
  }

  async function submitVendorPayment(event) {
    event.preventDefault();
    setSavingVendorPayment(true);
    setVendorPaymentFormError("");

    try {
      await apiRequest(
        vendorPaymentForm.id
          ? `/vendor-payments/${vendorPaymentForm.id}`
          : "/vendor-payments",
        {
          method: vendorPaymentForm.id ? "PATCH" : "POST",
          token,
          body: {
            booking_id: Number(vendorPaymentForm.booking_id),
            vendor_id: Number(vendorPaymentForm.vendor_id),
            amount: parseAmountNumeric(vendorPaymentForm.amount),
            payment_method: vendorPaymentForm.payment_method,
            payment_date: vendorPaymentForm.payment_date || null,
            status: vendorPaymentForm.status,
          },
        },
      );
      setVendorPaymentForm(createDefaultVendorPaymentForm(state.bookings, state.vendors));
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setVendorPaymentFormError(requestError.message || "Unable to save vendor payment.");
    } finally {
      setSavingVendorPayment(false);
    }
  }

  async function deletePayment(id) {
    try {
      await apiRequest(`/payments/${id}`, { method: "DELETE", token });
      setRefreshKey((current) => current + 1);
      setDeleteTarget(null);
    } catch (requestError) {
      setState((current) => ({
        ...current,
        error: requestError.message || "Unable to delete payment.",
      }));
    }
  }

  async function deleteVendorPayment(id) {
    try {
      await apiRequest(`/vendor-payments/${id}`, { method: "DELETE", token });
      setRefreshKey((current) => current + 1);
      setDeleteTarget(null);
    } catch (requestError) {
      setState((current) => ({
        ...current,
        error: requestError.message || "Unable to delete vendor payment.",
      }));
    }
  }

  return (
    <>
      <PageHeader title="Payments" subtitle="Track customer and vendor payments" />
      <AlertMessage message={state.error} variant="danger" />
      <div className="row">
        <div className="col-xl-6">
          <div className="card">
            <div className="card-body">
              <div className="ta-toolbar">
                <div>
                  <h4 className="card-title mb-1">Customer Payments</h4>
                  <p className="ta-card-muted mb-0">
                    Create, patch, and delete customer payment records.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => {
                    setPaymentForm(createDefaultPaymentForm(state.bookings));
                    setPaymentFormError("");
                  }}
                >
                  Reset Form
                </button>
              </div>
              <AlertMessage message={paymentFormError} variant="danger" />
              <form onSubmit={submitPayment}>
                <div className="row g-3">
                  <SelectField
                    label="Booking"
                    value={paymentForm.booking_id}
                    onChange={(value) =>
                      setPaymentForm((current) => ({ ...current, booking_id: value }))
                    }
                    options={state.bookings.map((item) => ({
                      value: String(item.id),
                      label: item.drc_no || `Booking #${item.id}`,
                    }))}
                  />
                  <TextField
                    label="Amount"
                    formatAmountOnBlur
                    value={paymentForm.amount}
                    onChange={(value) =>
                      setPaymentForm((current) => ({ ...current, amount: value }))
                    }
                  />
                  <TextField
                    label="Payment Method"
                    value={paymentForm.payment_method}
                    onChange={(value) =>
                      setPaymentForm((current) => ({
                        ...current,
                        payment_method: value,
                      }))
                    }
                  />
                  <TextField
                    label="Transaction Reference"
                    value={paymentForm.transaction_reference}
                    onChange={(value) =>
                      setPaymentForm((current) => ({
                        ...current,
                        transaction_reference: value,
                      }))
                    }
                  />
                  <TextField
                    label="Payment Date"
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(value) =>
                      setPaymentForm((current) => ({
                        ...current,
                        payment_date: value,
                      }))
                    }
                  />
                  <SelectField
                    label="Status"
                    value={paymentForm.status}
                    onChange={(value) =>
                      setPaymentForm((current) => ({ ...current, status: value }))
                    }
                    options={paymentStatusOptions.map((status) => ({
                      value: status,
                      label: status,
                    }))}
                  />
                  <div className="col-12 d-grid">
                    <button type="submit" className="btn btn-primary" disabled={savingPayment}>
                      {savingPayment
                        ? "Saving..."
                        : paymentForm.id
                          ? "Patch Payment"
                          : "Add Payment"}
                    </button>
                  </div>
                </div>
              </form>
              {state.loading ? (
                <CardLoader message="Loading payments..." />
              ) : (
                <>
                  <SimpleTable
                    columns={[
                      "ID",
                      "Booking",
                      "Method",
                      "Amount",
                      "Status",
                      "Actions",
                    ]}
                    rows={(state.paymentsPage?.items || []).map((payment) => [
                      `#${payment.id}`,
                      bookingMap[payment.booking_id]?.drc_no || `Booking #${payment.booking_id}`,
                      payment.payment_method,
                      formatCurrency(payment.amount),
                      <StatusBadge key={`customer-${payment.id}`} status={payment.status} />,
                      <div key={`payment-actions-${payment.id}`} className="ta-table-actions">
                        <button
                          type="button"
                          className="btn btn-icon btn-soft-primary btn-sm"
                          aria-label="Edit payment"
                          onClick={() =>
                            setPaymentForm({
                              id: String(payment.id),
                              booking_id: String(payment.booking_id),
                              amount: String(payment.amount),
                              payment_method: payment.payment_method,
                              transaction_reference: payment.transaction_reference || "",
                              payment_date: payment.payment_date || "",
                              status: normalizePaymentLineStatusForForm(payment.status),
                            })
                          }
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true" className="ta-action-icon">
                            <path d="M3 11.5 3.5 9l6-6 2.5 2.5-6 6L3 11.5z" />
                            <path d="M2 13.5h12" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon btn-soft-danger btn-sm"
                          aria-label="Delete payment"
                          onClick={() =>
                            setDeleteTarget({
                              kind: "payment",
                              id: payment.id,
                              label: `payment #${payment.id}`,
                            })
                          }
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true" className="ta-action-icon">
                            <path d="M3 4h10" />
                            <path d="M6 4V3h4v1" />
                            <path d="M5 4v8M11 4v8" />
                            <rect x="4" y="4" width="8" height="9" rx="1" />
                          </svg>
                        </button>
                      </div>,
                    ])}
                    emptyMessage="No payments found."
                  />
                  <PaginationBar
                    pageData={state.paymentsPage}
                    onSelectPage={setPaymentPage}
                  />
                </>
              )}
            </div>
          </div>
        </div>
        <div className="col-xl-6">
          <div className="card">
            <div className="card-body">
              <div className="ta-toolbar">
                <div>
                  <h4 className="card-title mb-1">Vendor Payments</h4>
                  <p className="ta-card-muted mb-0">
                    Manage vendor payout transactions from the same portal.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => {
                    setVendorPaymentForm(
                      createDefaultVendorPaymentForm(state.bookings, state.vendors),
                    );
                    setVendorPaymentFormError("");
                  }}
                >
                  Reset Form
                </button>
              </div>
              <AlertMessage message={vendorPaymentFormError} variant="danger" />
              <form onSubmit={submitVendorPayment}>
                <div className="row g-3">
                  <SelectField
                    label="Booking"
                    value={vendorPaymentForm.booking_id}
                    onChange={(value) =>
                      setVendorPaymentForm((current) => ({ ...current, booking_id: value }))
                    }
                    options={state.bookings.map((item) => ({
                      value: String(item.id),
                      label: item.drc_no || `Booking #${item.id}`,
                    }))}
                  />
                  <SelectField
                    label="Vendor"
                    value={vendorPaymentForm.vendor_id}
                    onChange={(value) =>
                      setVendorPaymentForm((current) => ({ ...current, vendor_id: value }))
                    }
                    options={state.vendors.map((item) => ({
                      value: String(item.id),
                      label: item.vendor_name,
                    }))}
                  />
                  <TextField
                    label="Amount"
                    formatAmountOnBlur
                    value={vendorPaymentForm.amount}
                    onChange={(value) =>
                      setVendorPaymentForm((current) => ({ ...current, amount: value }))
                    }
                  />
                  <TextField
                    label="Payment Method"
                    value={vendorPaymentForm.payment_method}
                    onChange={(value) =>
                      setVendorPaymentForm((current) => ({
                        ...current,
                        payment_method: value,
                      }))
                    }
                  />
                  <TextField
                    label="Payment Date"
                    type="date"
                    value={vendorPaymentForm.payment_date}
                    onChange={(value) =>
                      setVendorPaymentForm((current) => ({
                        ...current,
                        payment_date: value,
                      }))
                    }
                  />
                  <SelectField
                    label="Status"
                    value={vendorPaymentForm.status}
                    onChange={(value) =>
                      setVendorPaymentForm((current) => ({ ...current, status: value }))
                    }
                    options={paymentStatusOptions.map((status) => ({
                      value: status,
                      label: status,
                    }))}
                  />
                  <div className="col-12 d-grid">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={savingVendorPayment}
                    >
                      {savingVendorPayment
                        ? "Saving..."
                        : vendorPaymentForm.id
                          ? "Patch Vendor Payment"
                          : "Add Vendor Payment"}
                    </button>
                  </div>
                </div>
              </form>
              {state.loading ? (
                <CardLoader message="Loading vendor payments..." />
              ) : (
                <>
                  <SimpleTable
                    columns={[
                      "ID",
                      "Booking",
                      "Vendor",
                      "Method",
                      "Amount",
                      "Status",
                      "Actions",
                    ]}
                    rows={(state.vendorPaymentsPage?.items || []).map((payment) => [
                      `#${payment.id}`,
                      bookingMap[payment.booking_id]?.drc_no || `Booking #${payment.booking_id}`,
                      vendorMap[payment.vendor_id]?.vendor_name ||
                        `Vendor #${payment.vendor_id}`,
                      payment.payment_method,
                      formatCurrency(payment.amount),
                      <StatusBadge key={`vendor-${payment.id}`} status={payment.status} />,
                      <div
                        key={`vendor-payment-actions-${payment.id}`}
                        className="ta-table-actions"
                      >
                        <button
                          type="button"
                          className="btn btn-soft-primary btn-sm"
                          onClick={() =>
                            setVendorPaymentForm({
                              id: String(payment.id),
                              booking_id: String(payment.booking_id),
                              vendor_id: String(payment.vendor_id),
                              amount: String(payment.amount),
                              payment_method: payment.payment_method,
                              payment_date: payment.payment_date || "",
                              status: normalizePaymentLineStatusForForm(payment.status),
                            })
                          }
                        >
                          Patch
                        </button>
                        <button
                          type="button"
                          className="btn btn-soft-danger btn-sm"
                          onClick={() =>
                            setDeleteTarget({
                              kind: "vendor-payment",
                              id: payment.id,
                              label: `vendor payment #${payment.id}`,
                            })
                          }
                        >
                          Delete
                        </button>
                      </div>,
                    ])}
                    emptyMessage="No vendor payments found."
                  />
                  <PaginationBar
                    pageData={state.vendorPaymentsPage}
                    onSelectPage={setVendorPaymentPage}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title={
          deleteTarget?.kind === "vendor-payment"
            ? "Delete Vendor Payment"
            : "Delete Payment"
        }
        message={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.label}?`
            : ""
        }
        confirmLabel={
          deleteTarget?.kind === "vendor-payment"
            ? "Delete Vendor Payment"
            : "Delete Payment"
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteTarget.kind === "vendor-payment"
            ? deleteVendorPayment(deleteTarget.id)
            : deletePayment(deleteTarget.id)
        }
      />
    </>
  );
}

function ProfilePage({ token, user, onUserUpdated }) {
  const [roleOptions, setRoleOptions] = useState([]);
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    contact: user?.contact || "",
    gender: user?.gender || "",
    password: "",
    image_file: null,
  });
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "My Profile | Travel Agency";
  }, []);

  useEffect(() => {
    setForm({
      name: user?.name || "",
      email: user?.email || "",
      contact: user?.contact || "",
      gender: user?.gender || "",
      password: "",
      image_file: null,
    });
    setAvatarPreviewUrl("");
  }, [user]);

  useEffect(() => {
    if (!form.image_file) {
      setAvatarPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(form.image_file);
    setAvatarPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [form.image_file]);

  useEffect(() => {
    let active = true;

    apiRequest("/roles?page=1&page_size=100", { token })
      .then((response) => {
        if (!active) {
          return;
        }
        setRoleOptions(response.items || []);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setError(requestError.message || "Unable to load profile settings.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    if (!form.email.trim()) {
      setError("Email is required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    if (!form.gender) {
      setError("Gender is required.");
      return;
    }

    if (form.password && form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    const roleIds = mapRoleNamesToIds(user.roles || [], roleOptions);
    if ((user.roles?.length ?? 0) > 0 && roleIds.length === 0) {
      setError("Could not resolve your roles. Please refresh the page and try again.");
      return;
    }

    setSaving(true);

    try {
      const formData = new FormData();
      formData.append("name", form.name.trim());
      formData.append("email", form.email.trim());
      formData.append("contact", form.contact.trim() || "");
      formData.append("gender", form.gender || "");
      if (form.password) {
        formData.append("password", form.password);
      }
      roleIds.forEach((roleId) => {
        formData.append("role_ids", String(roleId));
      });
      if (form.image_file) {
        formData.append("image", form.image_file, form.image_file.name || "avatar.png");
      }

      const updatedUser = await apiRequest(`/users/${user.id}`, {
        method: "PATCH",
        token,
        body: formData,
      });
      onUserUpdated(updatedUser);
      setForm((current) => ({ ...current, password: "", image_file: null }));
      setSuccessMessage("Profile updated successfully.");
    } catch (requestError) {
      setError(requestError.message || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="My Profile"
        subtitle="Update your name, contact details, avatar, and password on this page"
      />
      <div className="row justify-content-center">
        <div className="col-xl-8">
          <div className="card">
            <div className="card-body">
              {loading ? <CardLoader message="Loading profile..." /> : null}
              <AlertMessage message={error} variant="danger" />
              <AlertMessage message={successMessage} variant="success" />
              {!loading ? (
                <form onSubmit={handleSubmit}>
                  <div className="row g-3">
                    <div className="col-12 ta-profile-header">
                      <img
                        src={avatarPreviewUrl || resolveUserAvatar(user)}
                        alt="Profile avatar"
                        className="ta-profile-avatar-lg ta-profile-avatar-photo"
                      />
                      <div>
                        <h4 className="mb-1">{user?.name || user?.email}</h4>
                        <p className="ta-card-muted mb-0">
                          {user?.roles?.length ? user.roles.join(", ") : "Authenticated user"}
                        </p>
                      </div>
                    </div>
                    <TextField
                      label="Name"
                      value={form.name}
                      required
                      onChange={(value) => setForm((current) => ({ ...current, name: value }))}
                    />
                    <TextField
                      label="Email"
                      type="email"
                      value={form.email}
                      required
                      onChange={(value) => setForm((current) => ({ ...current, email: value }))}
                    />
                    <TextField
                      label="Contact"
                      value={form.contact}
                      onChange={(value) => setForm((current) => ({ ...current, contact: value }))}
                    />
                    <SelectField
                      label="Gender"
                      value={form.gender}
                      required
                      onChange={(value) => setForm((current) => ({ ...current, gender: value }))}
                      options={[
                        { value: "", label: "Select gender" },
                        { value: "Male", label: "Male" },
                        { value: "Female", label: "Female" },
                        { value: "Other", label: "Other" },
                      ]}
                    />
                    <TextField
                      label="Current Password"
                      type="password"
                      value={form.password}
                      onChange={(value) => setForm((current) => ({ ...current, password: value }))}
                    />
                    <FileField
                      label="Avatar Image"
                      onChange={(file) =>
                        setForm((current) => ({ ...current, image_file: file }))
                      }
                    />
                    <div className="col-12">
                      <p className="ta-card-muted mb-0">
                        Leave password blank if you do not want to change it.
                      </p>
                    </div>
                    <div className="col-12 d-grid d-md-flex justify-content-md-end">
                      <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? "Saving..." : "Save Profile"}
                      </button>
                    </div>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ChangePasswordPage({ token, user, onUserUpdated }) {
  const navigate = useNavigate();
  const [roleOptions, setRoleOptions] = useState([]);
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Change Password | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;

    apiRequest("/roles?page=1&page_size=100", { token })
      .then((response) => {
        if (!active) {
          return;
        }
        setRoleOptions(response.items || []);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setError(requestError.message || "Unable to load change password settings.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccessModalOpen(false);

    if (form.newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirm password must match.");
      return;
    }

    setSaving(true);

    try {
      const updatedUser = await apiRequest(`/users/${user.id}`, {
        method: "PATCH",
        token,
        body: {
          name: user.name,
          email: user.email,
          contact: user.contact,
          gender: user.gender,
          password: form.newPassword,
          role_ids: mapRoleNamesToIds(user.roles || [], roleOptions),
        },
      });
      onUserUpdated(updatedUser);
      setForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setSuccessModalOpen(true);
    } catch (requestError) {
      setError(requestError.message || "Unable to change password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Change Password"
        subtitle="Update your password from the profile dropdown"
      />
      <div className="row justify-content-center">
        <div className="col-xl-7">
          <div className="card">
            <div className="card-body">
              {loading ? <CardLoader message="Loading password settings..." /> : null}
              <AlertMessage message={error} variant="danger" />
              {!loading ? (
                <form onSubmit={handleSubmit}>
                  <div className="row g-3">
                    <TextField
                      label="Current Password"
                      type="password"
                      value={form.currentPassword}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, currentPassword: value }))
                      }
                    />
                    <TextField
                      label="New Password"
                      type="password"
                      value={form.newPassword}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, newPassword: value }))
                      }
                    />
                    <TextField
                      label="Confirm Password"
                      type="password"
                      value={form.confirmPassword}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, confirmPassword: value }))
                      }
                    />
                    <div className="col-12">
                      <p className="ta-card-muted mb-0">
                        Current password is collected for UX, but the backend currently updates password from the new value only.
                      </p>
                    </div>
                    <div className="col-12 d-grid d-md-flex justify-content-md-end">
                      <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? "Saving..." : "Change Password"}
                      </button>
                    </div>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <SuccessModal
        open={successModalOpen}
        title="Password Updated"
        message="Password changed successfully."
        onClose={() => {
          setSuccessModalOpen(false);
          navigate("/profile");
        }}
      />
    </>
  );
}

function PageHeader({ title, subtitle }) {
  return (
    <div className="page-title-box d-flex align-items-center justify-content-between">
      <div>
        <h4 className="mb-1">{title}</h4>
        <p className="ta-card-muted mb-0">{subtitle}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, actionTo, actionLabel }) {
  return (
    <div className="col-md-6 col-xl-3 d-flex">
      <div className="card ta-dashboard-stat-card flex-grow-1 w-100 h-100">
        <div className="card-body d-flex flex-column">
          <p className="ta-stat-label">{label}</p>
          <h4 className="mb-1 mt-1">{value}</h4>
          {actionTo && actionLabel ? (
            <NavLink to={actionTo} className="btn btn-primary btn-sm w-100 mt-auto">
              {actionLabel}
            </NavLink>
          ) : (
            <p className="ta-card-muted mb-0 mt-auto small">Live backend data</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SimpleTable({ columns, rows, emptyMessage }) {
  return (
    <div className="table-responsive">
      <table className="table table-centered table-nowrap mb-0 ta-summary-table">
        <thead className="table-light">
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="ta-empty">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PaginationBar({ pageData, onSelectPage }) {
  if (!pageData || !pageData.total_pages || pageData.total_pages <= 1) {
    return null;
  }

  return (
    <div className="ta-toolbar mt-3">
      <div className="ta-card-muted">
        Page {pageData.page} of {pageData.total_pages}
      </div>
      <div className="ta-toolbar-actions">
        {Array.from({ length: pageData.total_pages }, (_, index) => index + 1).map((page) => (
          <button
            key={page}
            type="button"
            className={`btn btn-sm ${page === pageData.page ? "btn-primary" : "btn-light"}`}
            onClick={() => onSelectPage(page)}
          >
            {page}
          </button>
        ))}
      </div>
    </div>
  );
}

function SuccessModal({ open, title, message, onClose }) {
  if (!open) {
    return null;
  }

  return (
    <>
      <div className="modal fade show ta-modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p className="mb-0">{message}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" onClick={onClose}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show"></div>
    </>
  );
}

function CardLoader({ message }) {
  return (
    <div className="ta-loading">
      <div className="spinner-border text-primary" role="status"></div>
      <span>{message}</span>
    </div>
  );
}

function FullPageLoader({ message }) {
  return (
    <div className="ta-auth-shell">
      <CardLoader message={message} />
    </div>
  );
}

function ConfirmDeleteModal({
  open,
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}) {
  if (!open) {
    return null;
  }

  return (
    <>
      <div className="modal fade show ta-modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" onClick={onCancel} aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p className="mb-0">{message}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" onClick={onCancel}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={onConfirm}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show"></div>
    </>
  );
}

function CheckboxMultiField({ label, options, selectedValues, onToggle }) {
  return (
    <div className="col-12">
      <label className="form-label">{label}</label>
      <div className="ta-checkbox-grid">
        {options.length ? (
          options.map((option) => (
            <label key={`${label}-${option.value}`} className="ta-checkbox-item">
              <input
                type="checkbox"
                className="form-check-input"
                checked={selectedValues.includes(option.value)}
                onChange={() => onToggle(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))
        ) : (
          <span className="ta-card-muted">No roles available.</span>
        )}
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="col-md-6">
      <label className="form-label">{label}</label>
      <select
        className="form-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.length ? (
          options.map((option) => (
            <option key={`${label}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))
        ) : (
          <option value="">No options</option>
        )}
      </select>
    </div>
  );
}

function StatusBadge({ status }) {
  let className = "bg-info-subtle text-info";
  const normalized = (status || "Unknown").toLowerCase();

  if (normalized === "confirmed" || normalized === "paid") {
    className = "bg-success-subtle text-success";
  } else if (
    normalized === "pending" ||
    normalized === "partial" ||
    normalized === "in progress"
  ) {
    className = "bg-warning-subtle text-warning";
  } else if (normalized === "cancelled") {
    className = "bg-danger-subtle text-danger";
  }

  return (
    <span className={`badge rounded-pill ${className} ta-status-badge`}>
      {status || "Unknown"}
    </span>
  );
}

/** Build a readable message from failed API responses (FastAPI and generic JSON). */
function formatHttpErrorMessage(response, data, rawText) {
  const code = response.status;
  const badge = Number.isFinite(code) && code > 0 ? `[HTTP ${code}] ` : "";

  if (code === 502 || code === 503) {
    return (
      badge +
      "The API closed the connection or is not running. If you use Vite’s proxy, start FastAPI on port 8000 " +
      "(e.g. uvicorn in the backend folder). If the API was just saved, wait for it to finish reloading, then retry."
    );
  }

  if (data?.detail != null) {
    const d = data.detail;
    if (typeof d === "string" && d.trim()) {
      return badge + d.trim();
    }
    if (Array.isArray(d)) {
      const joined = d
        .map((item) => {
          if (item == null) {
            return "";
          }
          if (typeof item === "string") {
            return item;
          }
          if (typeof item === "object") {
            const loc = Array.isArray(item.loc) ? item.loc.filter(Boolean).join(".") : "";
            const msg = item.msg || item.message || "";
            return loc && msg ? `${loc}: ${msg}` : msg || loc || JSON.stringify(item);
          }
          return String(item);
        })
        .filter(Boolean)
        .join(", ");
      if (joined) {
        return badge + joined;
      }
    } else if (typeof d === "object") {
      try {
        const s = JSON.stringify(d);
        if (s && s !== "{}") {
          return badge + s;
        }
      } catch {
        /* ignore */
      }
    } else if (String(d).trim()) {
      return badge + String(d);
    }
  }

  if (typeof data?.message === "string" && data.message.trim()) {
    return badge + data.message.trim();
  }
  if (typeof data?.error === "string" && data.error.trim()) {
    return badge + data.error.trim();
  }

  const snippet = String(rawText || "")
    .trim()
    .slice(0, 280);
  if (snippet) {
    return badge + snippet;
  }

  return badge ? `${badge.trimEnd()} Request failed.` : "Request failed.";
}

function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const requestOptions = {
    method: options.method || "GET",
    headers,
  };

  if (options.auth !== false) {
    const token = options.token || getStoredToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (options.body instanceof URLSearchParams) {
    requestOptions.body = options.body.toString();
    headers.set("Content-Type", "application/x-www-form-urlencoded");
  } else if (options.body instanceof FormData) {
    requestOptions.body = options.body;
  } else if (options.body !== undefined) {
    requestOptions.body = JSON.stringify(options.body);
    headers.set("Content-Type", "application/json");
  }

  const url = buildApiUrl(path);
  return fetch(url, requestOptions)
    .catch((err) => {
      const msg = err?.message || String(err);
      if (msg === "Failed to fetch" || msg.includes("NetworkError") || msg.includes("Load failed")) {
        throw new Error(
          `Cannot reach API (${url}). Start FastAPI on port 8000 (e.g. uvicorn app.main:app --reload --port 8000). ` +
            `Dev uses Vite proxy: set VITE_API_PROXY_TARGET if the API is not at http://127.0.0.1:8000. ` +
            `Or set VITE_API_BASE_URL to the full API root. (API base: ${API_BASE})`,
        );
      }
      throw err instanceof Error ? err : new Error(msg);
    })
    .then(async (response) => {
      if (response.status === 204) {
        return null;
      }

      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(text?.slice(0, 200) || "Invalid response from server.");
      }

      if (!response.ok) {
        throw new Error(formatHttpErrorMessage(response, data, text));
      }

      return data;
    });
}

function normalizeApiBase(value) {
  return String(value || "").replace(/\/+$/, "");
}

function buildApiUrl(path) {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path)
    : `/${String(path || "")}`;
  return `${API_BASE}${normalizedPath}`;
}

function getApiOrigin(value) {
  const s = String(value || "");
  if (!s || s.startsWith("/")) {
    return typeof window !== "undefined" ? window.location.origin : "";
  }
  try {
    return new URL(s).origin;
  } catch {
    return typeof window !== "undefined" ? window.location.origin : "";
  }
}

function buildAssetUrl(path) {
  if (!path) {
    return "/minible/profile-avatar.png";
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return path.startsWith("/") ? `${API_ORIGIN}${path}` : `${API_ORIGIN}/${path}`;
}

function resolveUserAvatar(user) {
  return buildAssetUrl(user?.image_path);
}

function createMap(items, key) {
  return items.reduce((map, item) => {
    map[item[key]] = item;
    return map;
  }, {});
}

function getInitials(value) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) {
    return "U";
  }
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function mapRoleNamesToIds(roleNames, roles) {
  const wanted = new Set(
    (roleNames || []).map((n) => String(n ?? "").trim().toLowerCase())
  );
  return (roles || [])
    .filter((role) =>
      wanted.has(String(role.role_name ?? "").trim().toLowerCase())
    )
    .map((role) => role.id);
}

function createEmptyPaymentForm() {
  return {
    id: "",
    booking_id: "",
    amount: "",
    payment_method: "",
    transaction_reference: "",
    payment_date: "",
    status: "Pending",
  };
}

function createDefaultPaymentForm(bookings) {
  return {
    ...createEmptyPaymentForm(),
    booking_id: bookings[0] ? String(bookings[0].id) : "",
  };
}

function createEmptyVendorPaymentForm() {
  return {
    id: "",
    booking_id: "",
    vendor_id: "",
    amount: "",
    payment_method: "",
    payment_date: "",
    status: "Pending",
  };
}

function createDefaultVendorPaymentForm(bookings, vendors) {
  return {
    ...createEmptyVendorPaymentForm(),
    booking_id: bookings[0] ? String(bookings[0].id) : "",
    vendor_id: vendors[0] ? String(vendors[0].id) : "",
  };
}

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || "";
}

function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    return null;
  }
}

function storeToken(token, remember) {
  const activeStorage = remember ? localStorage : sessionStorage;
  const inactiveStorage = remember ? sessionStorage : localStorage;
  activeStorage.setItem(TOKEN_KEY, token);
  inactiveStorage.removeItem(TOKEN_KEY);
}

function storeUser(user, remember) {
  const useLocalStorage =
    typeof remember === "boolean"
      ? remember
      : Boolean(localStorage.getItem(TOKEN_KEY));
  const activeStorage = useLocalStorage ? localStorage : sessionStorage;
  const inactiveStorage = useLocalStorage ? sessionStorage : localStorage;
  activeStorage.setItem(USER_KEY, JSON.stringify(user));
  inactiveStorage.removeItem(USER_KEY);
}

function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export default App;

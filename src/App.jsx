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
import { formatDate } from "./components/access/AccessShared.jsx";
import ManagePermissionsPage from "./components/access/ManagePermissionsPage.jsx";
import ManageRolesPage from "./components/access/ManageRolesPage.jsx";
import ManageUsersPage from "./components/access/ManageUsersPage.jsx";
import UsersAccessLayout from "./components/access/UsersAccessLayout.jsx";
import BookingsLayout from "./components/bookings/BookingsLayout.jsx";
import BookingsListPage from "./components/bookings/BookingsListPage.jsx";
import CreateBookingPage from "./components/bookings/CreateBookingPage.jsx";
import ManageDestinationsPage from "./components/bookings/ManageDestinationsPage.jsx";
import ManagePaymentModesPage from "./components/bookings/ManagePaymentModesPage.jsx";
import ManageProductTypesPage from "./components/bookings/ManageProductTypesPage.jsx";
import ManageTravelersPage from "./components/bookings/ManageTravelersPage.jsx";
import CustomersLayout from "./components/customers/CustomersLayout.jsx";
import ManageCustomersPage from "./components/customers/ManageCustomersPage.jsx";
import ManagePassportDetailsPage from "./components/customers/ManagePassportDetailsPage.jsx";
import ManageVisaDetailsPage from "./components/customers/ManageVisaDetailsPage.jsx";
import ManageTravelerDocumentsPage from "./components/customers/ManageTravelerDocumentsPage.jsx";
import ManageTravelerPreferencesPage from "./components/customers/ManageTravelerPreferencesPage.jsx";
import MastersLayout from "./components/masters/MastersLayout.jsx";
import NotFoundPage from "./components/NotFoundPage.jsx";
import CustomerPaymentsPage from "./components/payments/CustomerPaymentsPage.jsx";
import PaymentsLayout from "./components/payments/PaymentsLayout.jsx";
import VendorPaymentsPage from "./components/payments/VendorPaymentsPage.jsx";

const API_BASE = normalizeApiBase(
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8006/api/v1",
);
const API_ORIGIN = getApiOrigin(API_BASE);
const TOKEN_KEY = "travel_agency_token";
const USER_KEY = "travel_agency_user";

const bookingStatusOptions = [
  "Pending",
  "Confirmed",
  "In Progress",
  "Cancelled",
];
const paymentStatusOptions = ["Pending", "Partial", "Paid"];
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
  const destination = getCrudCapability(user, "destination");
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
    destination.canAccess ||
    paymentMode.canAccess ||
    productType.canAccess;
  const canAccessPayments =
    isSuperAdmin || hasRole(user, ACCOUNTANT_ROLE) || hasPermission(user, "view_reports");
  const canAccessAccess =
    isSuperAdmin || hasPermission(user, "create_user") || hasPermission(user, "delete_user");

  return {
    isSuperAdmin,
    customer,
    traveler,
    destination,
    paymentMode,
    productType,
    canAccessBookingsList,
    canAccessBookings,
    canAccessPayments,
    canAccessAccess,
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
                    ...(capabilities.traveler.canAccess
                      ? [{ to: "/customers/documents", label: "Traveler Documents" }]
                      : []),
                    ...(capabilities.customer.canAccess
                      ? [{ to: "/customers/preferences", label: "Traveler Preferences" }]
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
                <RequireSectionAccess allowed={capabilities.customer.canAccess}>
                  <ManageTravelerPreferencesPage
                    token={token}
                    apiRequest={apiRequest}
                    canCreate={capabilities.customer.create}
                    canUpdate={capabilities.customer.update}
                    canDelete={capabilities.customer.delete}
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
                          { to: "/bookings/create", label: "Create Booking" },
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
                  bookingStatusOptions={bookingStatusOptions}
                />
                </RequireSectionAccess>
              }
            />
            <Route
              path="create"
              element={
                <CreateBookingPage
                  token={token}
                  apiRequest={apiRequest}
                  bookingStatusOptions={bookingStatusOptions}
                />
              }
            />
          </Route>
          <Route
            path="/masters"
            element={
              <RequireSectionAccess
                allowed={
                  capabilities.destination.canAccess ||
                  capabilities.paymentMode.canAccess ||
                  capabilities.productType.canAccess
                }
              >
                <MastersLayout
                  items={[
                    ...(capabilities.destination.canAccess
                      ? [{ to: "/masters/destinations", label: "Destinations" }]
                      : []),
                    ...(capabilities.paymentMode.canAccess
                      ? [{ to: "/masters/payment-modes", label: "Payment Modes" }]
                      : []),
                    ...(capabilities.productType.canAccess
                      ? [{ to: "/masters/product-types", label: "Product Types" }]
                      : []),
                  ]}
                />
              </RequireSectionAccess>
            }
          >
            <Route
              path="destinations"
              element={
                <RequireSectionAccess allowed={capabilities.destination.canAccess}>
                  <ManageDestinationsPage
                    token={token}
                    apiRequest={apiRequest}
                    canCreate={capabilities.destination.create}
                    canUpdate={capabilities.destination.update}
                    canDelete={capabilities.destination.delete}
                  />
                </RequireSectionAccess>
              }
            />
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
                      ...(capabilities.traveler.canAccess
                        ? [{ to: "/customers/documents", label: "Traveler Documents" }]
                        : []),
                      ...(capabilities.customer.canAccess
                        ? [{ to: "/customers/preferences", label: "Traveler Preferences" }]
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
                        { to: "/bookings/create", label: "Create Booking" },
                      ]}
                    />
                  ) : null}
                  {capabilities.destination.canAccess ||
                  capabilities.paymentMode.canAccess ||
                  capabilities.productType.canAccess ? (
                    <HorizontalNavDropdown
                      icon="bookings"
                      label="Master section"
                      activePrefix="/masters"
                      items={[
                        ...(capabilities.destination.canAccess
                          ? [{ to: "/masters/destinations", label: "Destinations" }]
                          : []),
                        ...(capabilities.paymentMode.canAccess
                          ? [{ to: "/masters/payment-modes", label: "Payment Modes" }]
                          : []),
                        ...(capabilities.productType.canAccess
                          ? [{ to: "/masters/product-types", label: "Product Types" }]
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
    ])
      .then(([bookings, payments, vendorPayments]) => {
        if (!active) {
          return;
        }
        setState({
          loading: false,
          error: "",
          bookings: bookings.items,
          payments: payments.items,
          vendorPayments: vendorPayments.items,
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
  }, [capabilities.canAccessBookings, capabilities.canAccessPayments, token]);

  const totalReceived = state.payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const totalVendorPaid = state.vendorPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
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
          <div className="row">
            <StatCard label="Signed in user" value={user?.name || user?.email || "-"} />
            {capabilities.canAccessBookings ? (
              <StatCard label="Total bookings" value={String(state.bookings.length)} />
            ) : null}
            {capabilities.canAccessPayments ? (
              <StatCard label="Customer payments" value={formatCurrency(totalReceived)} />
            ) : null}
            {capabilities.canAccessPayments ? (
              <StatCard label="Vendor payments" value={formatCurrency(totalVendorPaid)} />
            ) : null}
          </div>
          <div className="row">
            {capabilities.canAccessBookings ? (
              <div className={capabilities.canAccessPayments ? "col-xl-7" : "col-12"}>
                <div className="card">
                  <div className="card-body">
                    <div className="ta-toolbar">
                      <div>
                        <h4 className="card-title mb-1">Recent Bookings</h4>
                        <p className="ta-card-muted mb-0">
                          Latest booking records from the backend.
                        </p>
                      </div>
                      <div className="badge bg-warning-subtle text-warning ta-status-badge">
                        Pending: {pendingBookings}
                      </div>
                    </div>
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
            ) : null}
            {capabilities.canAccessPayments ? (
              <div className={capabilities.canAccessBookings ? "col-xl-5" : "col-12"}>
                <div className="card">
                  <div className="card-body">
                    <div className="ta-toolbar">
                      <div>
                        <h4 className="card-title mb-1">Recent Payments</h4>
                        <p className="ta-card-muted mb-0">
                          Latest customer payments received.
                        </p>
                      </div>
                      <NavLink to="/payments/customer" className="btn btn-primary btn-sm">
                        Open Payments
                      </NavLink>
                    </div>
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
            ) : null}
            {!capabilities.canAccessBookings && !capabilities.canAccessPayments ? (
              <div className="col-12">
                <div className="card">
                  <div className="card-body">
                    <h4 className="card-title mb-2">Welcome</h4>
                    <p className="ta-card-muted mb-0">
                      Your account is active, but no booking or payment modules are assigned yet.
                    </p>
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

function BookingsPage({ token }) {
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pageState, setPageState] = useState({
    loading: true,
    error: "",
    bookingsPage: null,
    customers: [],
    destinations: [],
    travelers: [],
    products: [],
    vendors: [],
  });
  const [form, setForm] = useState(createEmptyBookingForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    document.title = "Bookings | Travel Agency";
  }, []);

  useEffect(() => {
    let active = true;
    setPageState((current) => ({ ...current, loading: true, error: "" }));

    Promise.all([
      apiRequest(`/bookings?page=${page}&page_size=10`, { token }),
      apiRequest("/customers?page=1&page_size=100", { token }),
      apiRequest("/masters/destinations?page=1&page_size=100", { token }),
      apiRequest("/travelers?page=1&page_size=100", { token }),
      apiRequest("/masters/products?page=1&page_size=100", { token }),
      apiRequest("/masters/vendors?page=1&page_size=100", { token }),
    ])
      .then(([bookingsPage, customers, destinations, travelers, products, vendors]) => {
        if (!active) {
          return;
        }
        setPageState({
          loading: false,
          error: "",
          bookingsPage,
          customers: customers.items,
          destinations: destinations.items,
          travelers: travelers.items,
          products: products.items,
          vendors: vendors.items,
        });
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setPageState((current) => ({
          ...current,
          loading: false,
          error: requestError.message || "Unable to load bookings data.",
        }));
      });

    return () => {
      active = false;
    };
  }, [page, refreshKey, token]);

  useEffect(() => {
    if (
      !pageState.customers.length ||
      !pageState.destinations.length ||
      !pageState.products.length ||
      !pageState.vendors.length
    ) {
      return;
    }

    setForm((current) => {
      if (current.customer_id) {
        return current;
      }
      const baseForm = createDefaultBookingForm(pageState);
      return baseForm;
    });
  }, [pageState]);

  const customerMap = useMemo(
    () => createMap(pageState.customers, "id"),
    [pageState.customers],
  );
  const destinationMap = useMemo(
    () => createMap(pageState.destinations, "id"),
    [pageState.destinations],
  );
  const availableTravelers = useMemo(
    () =>
      pageState.travelers.filter(
        (traveler) => String(traveler.customer_id) === String(form.customer_id),
      ),
    [form.customer_id, pageState.travelers],
  );

  function updateBookingAmounts(nextValues) {
    const quantity = Number(nextValues.quantity || 0);
    const price = Number(nextValues.price || 0);
    return {
      ...nextValues,
      line_total: quantity && price ? (quantity * price).toFixed(2) : "0.00",
    };
  }

  function handleCustomerChange(value) {
    const nextTravelers = pageState.travelers.filter(
      (traveler) => String(traveler.customer_id) === String(value),
    );
    setForm((current) => ({
      ...current,
      customer_id: value,
      traveler_id: nextTravelers[0] ? String(nextTravelers[0].id) : "",
    }));
  }

  function handleProductChange(value) {
    const product = pageState.products.find((item) => String(item.id) === String(value));
    setForm((current) => {
      const nextForm = {
        ...current,
        product_id: value,
        vendor_id: product ? String(product.vendor_id) : current.vendor_id,
        price: product ? String(product.price) : current.price,
      };
      return updateBookingAmounts(nextForm);
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");

    try {
      const payload = {
        customer_id: Number(form.customer_id),
        destination_id: Number(form.destination_id),
        atpl_member: form.atpl_member,
        drc_no: form.drc_no || null,
        travel_start_date: form.travel_start_date || null,
        travel_end_date: form.travel_end_date || null,
        estimated_margin: form.estimated_margin ? Number(form.estimated_margin) : null,
        total_amount: Number(form.total_amount),
        status: form.status,
        travelers: form.traveler_id
          ? [
              {
                traveler_id: Number(form.traveler_id),
                seat_preference: form.seat_preference || null,
                meal_preference: form.meal_preference || null,
                special_request: form.special_request || null,
              },
            ]
          : [],
        products: form.product_id
          ? [
              {
                product_id: Number(form.product_id),
                vendor_id: Number(form.vendor_id),
                quantity: Number(form.quantity),
                price: Number(form.price),
                total_amount: Number(form.line_total),
              },
            ]
          : [],
      };

      await apiRequest("/bookings", {
        method: "POST",
        token,
        body: payload,
      });
      setForm(createDefaultBookingForm(pageState));
      setPage(1);
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save booking.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(bookingId) {
    try {
      await apiRequest(`/bookings/${bookingId}`, {
        method: "DELETE",
        token,
      });
      setRefreshKey((current) => current + 1);
      setDeleteTarget(null);
    } catch (requestError) {
      setPageState((current) => ({
        ...current,
        error: requestError.message || "Unable to delete booking.",
      }));
    }
  }

  return (
    <>
      <PageHeader title="Bookings" subtitle="Create and manage travel bookings" />
      <AlertMessage message={pageState.error} variant="danger" />
      <div className="row">
        <div className="col-xl-8">
          <div className="card">
            <div className="card-body">
              <div className="ta-toolbar">
                <div>
                  <h4 className="card-title mb-1">Bookings List</h4>
                  <p className="ta-card-muted mb-0">
                    Current booking records with backend pagination.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setRefreshKey((current) => current + 1)}
                >
                  Refresh
                </button>
              </div>
              {pageState.loading ? (
                <CardLoader message="Loading bookings..." />
              ) : (
                <>
                  <SimpleTable
                    columns={[
                      "ID",
                      "DRC No",
                      "Customer",
                      "Destination",
                      "Travel Start Date",
                      "Status",
                      "Total",
                      "Actions",
                    ]}
                    rows={(pageState.bookingsPage?.items || []).map((booking) => [
                      `#${booking.id}`,
                      booking.drc_no || "-",
                      (customerMap[booking.customer_id] ? [customerMap[booking.customer_id].first_name, customerMap[booking.customer_id].last_name].filter(Boolean).join(" ") || customerMap[booking.customer_id].customer_id : null) ||
                        `Customer #${booking.customer_id}`,
                      destinationMap[booking.destination_id]?.destination_name ||
                        `Destination #${booking.destination_id}`,
                      formatDate(booking.travel_start_date),
                      <StatusBadge key={`booking-status-${booking.id}`} status={booking.status} />,
                      formatCurrency(booking.total_amount),
                      <button
                        key={`booking-delete-${booking.id}`}
                        type="button"
                        className="btn btn-soft-danger btn-sm"
                        onClick={() =>
                          setDeleteTarget({
                            id: booking.id,
                            label: booking.drc_no || `Booking #${booking.id}`,
                          })
                        }
                      >
                        Delete
                      </button>,
                    ])}
                    emptyMessage="No bookings found."
                  />
                  <PaginationBar
                    pageData={pageState.bookingsPage}
                    onSelectPage={setPage}
                  />
                </>
              )}
            </div>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="card">
            <div className="card-body">
              <h4 className="card-title mb-1">Create Booking</h4>
              <p className="ta-card-muted mb-3">
                Phase 1 supports one traveler line and one product line per booking.
              </p>
              <AlertMessage message={formError} variant="danger" />
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <SelectField
                    label="Customer"
                    value={form.customer_id}
                    onChange={handleCustomerChange}
                    options={pageState.customers.map((item) => ({
                      value: String(item.id),
                      label: [item.first_name, item.last_name].filter(Boolean).join(" ") || item.customer_id || item.email || "Customer",
                    }))}
                  />
                  <SelectField
                    label="Destination"
                    value={form.destination_id}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, destination_id: value }))
                    }
                    options={pageState.destinations.map((item) => ({
                      value: String(item.id),
                      label: item.destination_name,
                    }))}
                  />
                  <TextField
                    label="DRC No"
                    value={form.drc_no}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, drc_no: value }))
                    }
                  />
                  <TextField
                    label="Total Amount"
                    type="number"
                    step="0.01"
                    value={form.total_amount}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, total_amount: value }))
                    }
                  />
                  <TextField
                    label="Travel Start Date"
                    type="date"
                    value={form.travel_start_date}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, travel_start_date: value }))
                    }
                  />
                  <TextField
                    label="Travel End Date"
                    type="date"
                    value={form.travel_end_date}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, travel_end_date: value }))
                    }
                  />
                  <TextField
                    label="Estimated Margin"
                    type="number"
                    step="0.01"
                    value={form.estimated_margin}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, estimated_margin: value }))
                    }
                  />
                  <SelectField
                    label="Status"
                    value={form.status}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, status: value }))
                    }
                    options={bookingStatusOptions.map((status) => ({
                      value: status,
                      label: status,
                    }))}
                  />
                  <SelectField
                    label="Traveler"
                    value={form.traveler_id}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, traveler_id: value }))
                    }
                    options={availableTravelers.map((item) => ({
                      value: String(item.id),
                      label: `${item.first_name} ${item.last_name || ""}`.trim(),
                    }))}
                  />
                  <TextField
                    label="Seat Preference"
                    value={form.seat_preference}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, seat_preference: value }))
                    }
                  />
                  <TextField
                    label="Meal Preference"
                    value={form.meal_preference}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, meal_preference: value }))
                    }
                  />
                  <TextField
                    label="Special Request"
                    value={form.special_request}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, special_request: value }))
                    }
                  />
                  <SelectField
                    label="Product"
                    value={form.product_id}
                    onChange={handleProductChange}
                    options={pageState.products.map((item) => ({
                      value: String(item.product_id),
                      label: item.product_name,
                    }))}
                  />
                  <SelectField
                    label="Vendor"
                    value={form.vendor_id}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, vendor_id: value }))
                    }
                    options={pageState.vendors.map((item) => ({
                      value: String(item.id),
                      label: item.vendor_name,
                    }))}
                  />
                  <TextField
                    label="Quantity"
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(value) =>
                      setForm((current) =>
                        updateBookingAmounts({ ...current, quantity: value }),
                      )
                    }
                  />
                  <TextField
                    label="Price"
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(value) =>
                      setForm((current) =>
                        updateBookingAmounts({ ...current, price: value }),
                      )
                    }
                  />
                  <TextField
                    label="Line Total"
                    type="number"
                    step="0.01"
                    value={form.line_total}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, line_total: value }))
                    }
                  />
                  <div className="col-12">
                    <div className="form-check">
                      <input
                        id="atpl_member"
                        type="checkbox"
                        className="form-check-input"
                        checked={form.atpl_member}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            atpl_member: event.target.checked,
                          }))
                        }
                      />
                      <label className="form-check-label" htmlFor="atpl_member">
                        ATPL member
                      </label>
                    </div>
                  </div>
                  <div className="col-12 d-grid">
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? "Saving..." : "Save Booking"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Booking"
        message={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.label}?`
            : ""
        }
        confirmLabel="Delete Booking"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget.id)}
      />
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
            amount: Number(paymentForm.amount),
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
            amount: Number(vendorPaymentForm.amount),
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
                    type="number"
                    step="0.01"
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
                              status: payment.status,
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
                    type="number"
                    step="0.01"
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
                              status: payment.status,
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
  const [successModalOpen, setSuccessModalOpen] = useState(false);
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
    setSuccessModalOpen(false);

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
      setSuccessModalOpen(true);
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
        subtitle="Update your account details from the horizontal topbar menu"
      />
      <div className="row justify-content-center">
        <div className="col-xl-8">
          <div className="card">
            <div className="card-body">
              {loading ? <CardLoader message="Loading profile..." /> : null}
              <AlertMessage message={error} variant="danger" />
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
      <SuccessModal
        open={successModalOpen}
        title="Profile Updated"
        message="Profile updated successfully."
        onClose={() => setSuccessModalOpen(false)}
      />
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

function StatCard({ label, value }) {
  return (
    <div className="col-md-6 col-xl-3">
      <div className="card">
        <div className="card-body">
          <p className="ta-stat-label">{label}</p>
          <h4 className="mb-1 mt-1">{value}</h4>
          <p className="ta-card-muted mb-0">Live backend data</p>
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

function AlertMessage({ message, variant }) {
  if (!message) {
    return null;
  }

  return <div className={`alert alert-${variant}`}>{message}</div>;
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

function FileField({ label, onChange }) {
  return (
    <div className="col-md-6">
      <label className="form-label">{label}</label>
      <input
        className="form-control"
        type="file"
        accept="image/*"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
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

function TextField({
  label,
  value,
  onChange,
  type = "text",
  step,
  min,
}) {
  return (
    <div className="col-md-6">
      <label className="form-label">{label}</label>
      <input
        className="form-control"
        type={type}
        value={value}
        step={step}
        min={min}
        onChange={(event) => onChange(event.target.value)}
      />
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

  return fetch(buildApiUrl(path), requestOptions).then(async (response) => {
    if (response.status === 204) {
      return null;
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const detail = Array.isArray(data?.detail)
        ? data.detail
            .map((item) => item?.msg || item?.message || "")
            .filter(Boolean)
            .join(", ")
        : data?.detail;
      throw new Error(detail || "Request failed.");
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
  try {
    return new URL(value).origin;
  } catch {
    return window.location.origin;
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

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
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

function createEmptyBookingForm() {
  return {
    customer_id: "",
    destination_id: "",
    atpl_member: false,
    drc_no: "",
    travel_start_date: "",
    travel_end_date: "",
    estimated_margin: "",
    total_amount: "",
    status: "Pending",
    traveler_id: "",
    seat_preference: "",
    meal_preference: "",
    special_request: "",
    product_id: "",
    vendor_id: "",
    quantity: "1",
    price: "",
    line_total: "0.00",
  };
}

function createDefaultBookingForm(data) {
  const firstCustomer = data.customers[0];
  const firstDestination = data.destinations[0];
  const firstProduct = data.products[0];
  const matchingTravelers = data.travelers.filter(
    (traveler) => traveler.customer_id === firstCustomer?.id,
  );

  return {
    customer_id: firstCustomer ? String(firstCustomer.id) : "",
    destination_id: firstDestination ? String(firstDestination.id) : "",
    atpl_member: false,
    drc_no: "",
    travel_start_date: "",
    travel_end_date: "",
    estimated_margin: "",
    total_amount: firstProduct ? String(firstProduct.price) : "",
    status: "Pending",
    traveler_id: matchingTravelers[0] ? String(matchingTravelers[0].id) : "",
    seat_preference: "",
    meal_preference: "",
    special_request: "",
    product_id: firstProduct ? String(firstProduct.product_id) : "",
    vendor_id: firstProduct ? String(firstProduct.vendor_id) : "",
    quantity: "1",
    price: firstProduct ? String(firstProduct.price) : "",
    line_total: firstProduct ? String(firstProduct.price) : "0.00",
  };
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
  return raw ? JSON.parse(raw) : null;
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

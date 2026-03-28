import { Link, useLocation } from "react-router-dom";

function NotFoundPage({ token }) {
  const location = useLocation();
  const targetPath = token ? "/dashboard" : "/login";
  const targetLabel = token ? "Dashboard" : "Login";

  return (
    <div className="container-fluid py-5">
      <div className="text-center">
        <h3 className="mb-2">Page not found</h3>
        <p className="text-muted mb-4">
          The route <code>{location.pathname}</code> does not exist.
        </p>
        <Link to={targetPath} className="btn btn-primary">
          Go to {targetLabel}
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;


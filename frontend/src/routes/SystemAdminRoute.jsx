import {
  Navigate,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext";


function SystemAdminRoute({ children }) {
  const {
    user,
    loading,
    isAuthenticated,
  } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  const roles = Array.isArray(
    user?.roles
  )
    ? user.roles
    : [];

  if (!roles.includes("SYSTEM_ADMIN")) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return children;
}


export default SystemAdminRoute;

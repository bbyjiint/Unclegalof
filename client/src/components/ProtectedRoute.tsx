import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import type { UserRole } from "../types";
import { getDefaultRouteForRole } from "../lib/roleRoutes";

type ProtectedRouteProps = {
  allowedRoles?: UserRole[];
};

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <main className="wrap"><div className="empty"><p>กำลังตรวจสอบสิทธิ์...</p></div></main>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  return <Outlet />;
}

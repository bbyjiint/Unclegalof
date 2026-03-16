import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function PublicOnlyRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <main className="wrap"><div className="empty"><p>กำลังโหลด...</p></div></main>;
  }

  if (user) {
    return <Navigate to="/staff" replace />;
  }

  return <Outlet />;
}

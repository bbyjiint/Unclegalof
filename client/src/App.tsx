import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicOnlyRoute from "./components/PublicOnlyRoute";
import InventoryPage from "./pages/InventoryPage";
import OwnerPage from "./pages/OwnerPage";
import RepairPage from "./pages/RepairPage";
import StaffPage from "./pages/StaffPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["OWNER", "ADMIN", "STAFF"]} />}>
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/repair" element={<RepairPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["OWNER", "ADMIN", "INVENTORY"]} />}>
          <Route path="/inventory" element={<InventoryPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["OWNER", "ADMIN"]} />}>
          <Route path="/owner" element={<OwnerPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

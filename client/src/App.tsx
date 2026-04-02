import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicOnlyRoute from "./components/PublicOnlyRoute";
import InventoryPage from "./pages/InventoryPage";
import OwnerDashboardLayout from "./pages/owner/OwnerDashboardLayout";
import RepairPage from "./pages/RepairPage";
import DeliveryOrdersPage from "./pages/DeliveryOrdersPage";
import StaffPage from "./pages/StaffPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";

const OwnerOverviewTab = lazy(() => import("./pages/owner/tabs/OwnerOverviewTab"));
const OwnerEmployeesTab = lazy(() => import("./pages/owner/tabs/OwnerEmployeesTab"));
const OwnerPromotionsTab = lazy(() => import("./pages/owner/tabs/OwnerPromotionsTab"));
const OwnerPurchasingTab = lazy(() => import("./pages/owner/tabs/OwnerPurchasingTab"));
const OwnerReportsTab = lazy(() => import("./pages/owner/tabs/OwnerReportsTab"));
const OwnerDeliveryTab = lazy(() => import("./pages/owner/tabs/OwnerDeliveryTab"));

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["OWNER", "SALES"]} />}>
          <Route path="/staff" element={<StaffPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["OWNER", "SALES"]} />}>
          <Route path="/inventory" element={<InventoryPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["OWNER", "REPAIRS"]} />}>
          <Route path="/repair" element={<RepairPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["OWNER", "REPAIRS"]} />}>
          <Route path="/deliveries" element={<DeliveryOrdersPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["OWNER"]} />}>
          <Route path="/owner" element={<OwnerDashboardLayout />}>
            <Route index element={<OwnerOverviewTab />} />
            <Route path="employees" element={<OwnerEmployeesTab />} />
            <Route path="promotions" element={<OwnerPromotionsTab />} />
            <Route path="purchasing" element={<OwnerPurchasingTab />} />
            <Route path="reports" element={<OwnerReportsTab />} />
            <Route path="delivery" element={<OwnerDeliveryTab />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import HomePage from "./pages/HomePage";
import InventoryPage from "./pages/InventoryPage";
import OwnerPage from "./pages/OwnerPage";
import RepairPage from "./pages/RepairPage";
import StaffPage from "./pages/StaffPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/repair" element={<RepairPage />} />
        <Route path="/owner" element={<OwnerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

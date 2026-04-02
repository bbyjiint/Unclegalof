import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  MapPin,
  Tag,
  Truck,
  Users
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { PaymentSlipLightbox } from "../../components/PaymentSlipLightbox";
import { api } from "../../lib/api";
import type {
  OwnerDashboard,
  PipelineItem,
  PipelinePriority,
  PipelineStatus,
  StaffMember
} from "../../types";
import {
  OwnerDashboardContext,
  type OwnerDashboardContextValue,
  type PipelineFormState,
  type PromotionFormState,
  type StaffFormState
} from "./ownerDashboardContext";
import "./owner-dashboard.css";

const NAV_ITEMS = [
  { to: "/owner", end: true as const, label: "ภาพรวม", Icon: LayoutDashboard },
  { to: "/owner/employees", end: false as const, label: "พนักงาน", Icon: Users },
  { to: "/owner/promotions", end: false as const, label: "โปรโมชั่น", Icon: Tag },
  { to: "/owner/purchasing", end: false as const, label: "สั่งซื้อ", Icon: Truck },
  { to: "/owner/delivery", end: false as const, label: "ค่าจัดส่ง", Icon: MapPin },
  { to: "/owner/reports", end: false as const, label: "รายงาน", Icon: ClipboardList }
];

function pageTitleFromPath(pathname: string): string {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/owner") {
    return "ภาพรวม";
  }
  const routes: Array<{ prefix: string; title: string }> = [
    { prefix: "/owner/employees", title: "พนักงาน" },
    { prefix: "/owner/promotions", title: "โปรโมชั่น" },
    { prefix: "/owner/purchasing", title: "สั่งซื้อ" },
    { prefix: "/owner/delivery", title: "ค่าจัดส่ง" },
    { prefix: "/owner/reports", title: "รายงาน" }
  ];
  for (const { prefix, title } of routes) {
    if (p === prefix || p.startsWith(`${prefix}/`)) {
      return title;
    }
  }
  return "แดชบอร์ด";
}

export default function OwnerDashboardLayout() {
  const now = new Date();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [weekFilter, setWeekFilter] = useState<"all" | "1" | "2" | "3" | "4" | "5">("all");
  const [payStatusFilter, setPayStatusFilter] = useState<"all" | "paid" | "pending" | "deposit">("all");
  const [sortBy, setSortBy] = useState<"time" | "total">("time");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [promoForm, setPromoForm] = useState<PromotionFormState>({ name: "", amountType: "fixed", amount: "" });
  const [pipelineItems, setPipelineItems] = useState<PipelineItem[]>([]);
  const [catalogOptions, setCatalogOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [pipeForm, setPipeForm] = useState<PipelineFormState>({
    deskItemId: "",
    qty: "1",
    costEst: "0",
    expectedDate: "",
    note: "",
    status: "planned",
    priority: "normal"
  });
  const [updatingSaleId, setUpdatingSaleId] = useState<string | null>(null);
  const [slipPreviewSrc, setSlipPreviewSrc] = useState<string | null>(null);
  const closeSlipPreview = useCallback(() => setSlipPreviewSrc(null), []);
  const [staffForm, setStaffForm] = useState<StaffFormState>({
    fullName: "",
    username: "",
    password: "",
    phone: "",
    role: "SALES"
  });
  const [staffMessage, setStaffMessage] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [staffDeletingId, setStaffDeletingId] = useState<string | null>(null);
  const [staffModalOpen, setStaffModalOpen] = useState(false);

  const loadPage = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const data = await api.ownerDashboard(month, year);
      setDashboard(data);
      try {
        const [pipe, products, staff] = await Promise.all([api.pipeline(), api.getProducts(), api.staff()]);
        setPipelineItems(pipe.items || []);
        setCatalogOptions(products.items.map((p) => ({ id: p.id, name: p.name })));
        setStaffMembers(staff.items || []);
        setPipeForm((current) => ({
          ...current,
          deskItemId: current.deskItemId || products.items[0]?.id || ""
        }));
      } catch (pipeErr) {
        setPipelineItems([]);
        setCatalogOptions([]);
        setStaffMembers([]);
        setError(pipeErr instanceof Error ? pipeErr.message : "โหลดแผนสั่งซื้อไม่สำเร็จ");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    }
  }, [month, year]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  async function addPromo(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    const amt = Number(promoForm.amount);
    if (promoForm.amountType === "percent" && (amt < 0 || amt > 100)) {
      setError("ส่วนลดเปอร์เซ็นต์ต้องอยู่ระหว่าง 0–100");
      return;
    }
    try {
      await api.createPromotion({
        name: promoForm.name,
        amount: amt,
        amountType: promoForm.amountType,
        active: true
      });
      setPromoForm({ name: "", amountType: "fixed", amount: "" });
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เพิ่มโปรโมชั่นไม่สำเร็จ");
    }
  }

  async function togglePromo(id: string, active: boolean): Promise<void> {
    await api.togglePromotion(id, active);
    await loadPage();
  }

  async function deletePromo(id: string): Promise<void> {
    await api.deletePromotion(id);
    await loadPage();
  }

  async function confirmSalePaid(id: string): Promise<void> {
    try {
      setUpdatingSaleId(id);
      await api.updateSaleStatus(id, { status: "paid" });
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update payment status");
    } finally {
      setUpdatingSaleId(null);
    }
  }

  async function viewPaymentSlipAndMark(saleId: string, imageSrc: string): Promise<void> {
    setSlipPreviewSrc(imageSrc);
    try {
      await api.markSaleSlipViewed(saleId);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกสถานะการดูสลิปไม่สำเร็จ");
    }
  }

  async function removePaymentSlipByOwner(saleId: string): Promise<void> {
    const confirmed = window.confirm("ลบสลิปที่แนบไว้รายการนี้?");
    if (!confirmed) {
      return;
    }
    try {
      setUpdatingSaleId(saleId);
      await api.removeSalePaymentSlip(saleId);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบสลิปไม่สำเร็จ");
    } finally {
      setUpdatingSaleId(null);
    }
  }

  async function addPipeline(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    const qty = Number(pipeForm.qty);
    const costEst = Number(pipeForm.costEst);
    if (!pipeForm.deskItemId || Number.isNaN(qty) || qty < 1) {
      setError("เลือกสินค้าและจำนวนให้ครบ");
      return;
    }
    try {
      await api.createPipeline({
        deskItemId: pipeForm.deskItemId,
        qty,
        costEst: Number.isNaN(costEst) ? 0 : Math.max(0, costEst),
        date: pipeForm.expectedDate.trim()
          ? new Date(pipeForm.expectedDate).toISOString()
          : null,
        note: pipeForm.note.trim(),
        status: pipeForm.status,
        priority: pipeForm.priority
      });
      setPipeForm((current) => ({
        ...current,
        qty: "1",
        costEst: "0",
        expectedDate: "",
        note: ""
      }));
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เพิ่มแผนสั่งซื้อไม่สำเร็จ");
    }
  }

  async function updatePipelineRow(
    id: string,
    patch: Partial<{ status: PipelineStatus; priority: PipelinePriority }>
  ): Promise<void> {
    try {
      setError(null);
      await api.updatePipeline(id, patch);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปเดตไม่สำเร็จ");
    }
  }

  async function removePipelineRow(id: string): Promise<void> {
    if (!window.confirm("ลบรายการนี้จากแผนสั่งซื้อ?")) {
      return;
    }
    try {
      setError(null);
      await api.deletePipeline(id);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    }
  }

  async function createStaffAccount(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setStaffMessage(null);
    if (!staffForm.fullName.trim() || !staffForm.username.trim() || staffForm.password.length < 8) {
      setError("กรอกชื่อ ชื่อผู้ใช้ และรหัสผ่านอย่างน้อย 8 ตัวอักษร");
      return;
    }
    try {
      setStaffSubmitting(true);
      await api.createStaff({
        fullName: staffForm.fullName.trim(),
        username: staffForm.username.trim(),
        password: staffForm.password,
        phone: staffForm.phone.trim() || undefined,
        role: staffForm.role
      });
      setStaffForm({ fullName: "", username: "", password: "", phone: "", role: "SALES" });
      setStaffMessage("สร้างบัญชีพนักงานเรียบร้อยแล้ว");
      setStaffModalOpen(false);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างบัญชีพนักงานไม่สำเร็จ");
    } finally {
      setStaffSubmitting(false);
    }
  }

  async function removeStaffAccount(staff: StaffMember): Promise<void> {
    const confirmed = window.confirm(`ลบพนักงาน ${staff.fullName} (@${staff.username}) ?`);
    if (!confirmed) {
      return;
    }
    try {
      setStaffDeletingId(staff.id);
      setError(null);
      setStaffMessage(null);
      await api.deleteStaff(staff.id);
      setStaffMessage("ลบพนักงานเรียบร้อยแล้ว");
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบพนักงานไม่สำเร็จ");
    } finally {
      setStaffDeletingId(null);
    }
  }

  const sales = dashboard?.sales || [];
  const filteredAndSortedSales = useMemo(() => {
    const inFilteredWeek = (dateValue?: string | null) => {
      if (weekFilter === "all") {
        return true;
      }
      if (!dateValue) {
        return false;
      }
      const dayOfMonth = new Date(dateValue).getDate();
      const weekOfMonth = Math.min(5, Math.floor((dayOfMonth - 1) / 7) + 1);
      return String(weekOfMonth) === weekFilter;
    };

    const statusFiltered = sales.filter((sale) => {
      if (payStatusFilter !== "all" && sale.payStatus !== payStatusFilter) {
        return false;
      }
      return inFilteredWeek(sale.date);
    });

    return [...statusFiltered].sort((a, b) => {
      let diff = 0;
      if (sortBy === "total") {
        diff = (a.grandTotal || 0) - (b.grandTotal || 0);
      } else {
        const timeA = new Date(a.date || 0).getTime();
        const timeB = new Date(b.date || 0).getTime();
        diff = timeA - timeB;
      }
      return sortDir === "asc" ? diff : -diff;
    });
  }, [sales, payStatusFilter, weekFilter, sortBy, sortDir]);

  const statusCount = useMemo(
    () => ({
      paid: sales.filter((s) => s.payStatus === "paid").length,
      pending: sales.filter((s) => s.payStatus === "pending").length,
      deposit: sales.filter((s) => s.payStatus === "deposit").length
    }),
    [sales]
  );

  const selectableYears = useMemo(() => {
    const currentYear = now.getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1];
  }, [now]);

  const promotions = dashboard?.promotions || [];
  const pageTitle = pageTitleFromPath(location.pathname);

  const contextValue: OwnerDashboardContextValue = {
    error,
    setError,
    loadPage,
    dashboard,
    month,
    year,
    setMonth,
    setYear,
    weekFilter,
    setWeekFilter,
    payStatusFilter,
    setPayStatusFilter,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    filteredAndSortedSales,
    statusCount,
    selectableYears,
    promotions,
    promoForm,
    setPromoForm,
    addPromo,
    togglePromo,
    deletePromo,
    pipelineItems,
    catalogOptions,
    pipeForm,
    setPipeForm,
    addPipeline,
    updatePipelineRow,
    removePipelineRow,
    staffMembers,
    staffMessage,
    staffModalOpen,
    setStaffModalOpen,
    staffForm,
    setStaffForm,
    staffSubmitting,
    staffDeletingId,
    createStaffAccount,
    removeStaffAccount,
    confirmSalePaid,
    viewPaymentSlipAndMark,
    removePaymentSlipByOwner,
    updatingSaleId,
    slipPreviewSrc,
    closeSlipPreview
  };

  if (!dashboard) {
    return (
      <main className="owrap owner-dash">
        <div className="owner-dash__loading">{error || "กำลังโหลด..."}</div>
      </main>
    );
  }

  return (
    <OwnerDashboardContext.Provider value={contextValue}>
      <main className={`owrap owner-dash${sidebarCollapsed ? " owner-dash--sidebar-collapsed" : ""}`}>
        <header className="owner-dash__topbar">
          <h1 className="owner-dash__topbar-title">{pageTitle}</h1>
        </header>

        <aside className="owner-dash__sidebar" aria-label="เมนูแดชบอร์ดเจ้าของ">
          <div className="owner-dash__sidebar-head">
            <button
              type="button"
              className="owner-dash__sidebar-collapse"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-expanded={!sidebarCollapsed}
              aria-label={sidebarCollapsed ? "ขยายเมนู" : "ย่อเมนู"}
            >
              {sidebarCollapsed ? (
                <ChevronRight size={20} strokeWidth={2} aria-hidden />
              ) : (
                <ChevronLeft size={20} strokeWidth={2} aria-hidden />
              )}
            </button>
          </div>
          <nav className="owner-dash__nav-desktop">
            {NAV_ITEMS.map(({ to, end, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `owner-dash__nav-link${isActive ? " owner-dash__nav-link--active" : ""}`
                }
              >
                <Icon size={22} strokeWidth={2} aria-hidden />
                <span className="owner-dash__nav-label">{label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="owner-dash__main">
          {error ? <div className="owner-dash__error">{error}</div> : null}
          <Suspense fallback={<div className="owner-dash__loading">กำลังโหลดหน้า…</div>}>
            <Outlet />
          </Suspense>
        </div>

        <nav className="owner-dash__bottom" aria-label="แท็บหลัก">
          {NAV_ITEMS.map(({ to, end, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `owner-dash__bottom-link${isActive ? " owner-dash__bottom-link--active" : ""}`
              }
            >
              <Icon size={20} strokeWidth={2} aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <PaymentSlipLightbox imageSrc={slipPreviewSrc} onClose={closeSlipPreview} />
      </main>
    </OwnerDashboardContext.Provider>
  );
}

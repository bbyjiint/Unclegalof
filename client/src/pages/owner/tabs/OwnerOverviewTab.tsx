import {
  AlertTriangle,
  Banknote,
  ClipboardList,
  Coins,
  CreditCard,
  PackageCheck,
  Percent,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatMoney } from "../../../data/constants";
import { api } from "../../../lib/api";
import type { Sale } from "../../../types";
import { useOwnerDashboard } from "../ownerDashboardContext";

function toNum(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function deliveryFulfillmentLabel(sale: Sale): { label: string; cls: "gray" | "shipped" | "shipping" } {
  if (sale.delivery === "selfpickup") {
    return { label: "รับเอง", cls: "gray" };
  }
  if (sale.deliveryCompletedAt) {
    return { label: "ส่งแล้ว", cls: "shipped" };
  }
  return { label: "กำลังส่ง", cls: "shipping" };
}

function profitCellContent(sale: Sale): { text: string; pending: boolean } {
  if (sale.costStatus === "pending_owner_review") {
    return { text: "รอกรอกทุน", pending: true };
  }
  if (sale.grossProfit != null) {
    return { text: formatMoney(sale.grossProfit), pending: false };
  }
  if (sale.cogsTotal != null) {
    return { text: formatMoney(sale.grandTotal - sale.cogsTotal), pending: false };
  }
  return { text: "—", pending: false };
}

type OwnerNetBlockProps = {
  profit: number;
  ownerNetIncome: number;
  staffTotal: number;
  variant: "mobile" | "desktop";
};

function OwnerNetIncomeCard({ profit, ownerNetIncome, staffTotal, variant }: OwnerNetBlockProps) {
  return (
    <div
      className={`owner-dash__card ov-fin-card ov-fin-card--owner ov-fin-owner-dock ov-fin-owner-dock--${variant}`}
      role="region"
      aria-label={variant === "mobile" ? "รายได้สุทธิเจ้าของ (ภาพรวมเร็ว)" : "รายได้สุทธิเจ้าของ"}
    >
      <h3 className="ov-fin-card__title">
        <Banknote size={18} strokeWidth={2} aria-hidden />
        รายได้สุทธิเจ้าของ
      </h3>
      <p className="ov-fin-owner__hero">{formatMoney(ownerNetIncome)}</p>
      <ul className="ov-fin-owner__breakdown">
        <li>
          <span>กำไรจากการขาย</span>
          <span className="ov-fin-owner__pos">+{formatMoney(profit)}</span>
        </li>
        <li>
          <span>ค่าแรงพนักงาน</span>
          <span className="ov-fin-owner__neg">−{formatMoney(staffTotal)}</span>
        </li>
        <li className="ov-fin-owner__netline">
          <span>รายได้สุทธิ</span>
          <span className="ov-fin-owner__pos">{formatMoney(ownerNetIncome)}</span>
        </li>
      </ul>
    </div>
  );
}

const MONTH_NAMES = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export default function OwnerOverviewTab() {
  const { dashboard, month, year, setMonth, setYear, selectableYears, loadPage, statusCount } =
    useOwnerDashboard();

  const [chartYear, setChartYear] = useState(year);
  const [monthlyIncome, setMonthlyIncome] = useState<number[]>(() => Array(12).fill(0));
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    setChartYear(year);
  }, [year]);

  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    void api
      .ownerMonthlyIncome(chartYear)
      .then((res) => {
        if (cancelled) return;
        const arr = res.incomeByMonth;
        if (Array.isArray(arr) && arr.length === 12) {
          setMonthlyIncome(arr.map((n) => (Number.isFinite(Number(n)) ? Number(n) : 0)));
        } else {
          setMonthlyIncome(Array(12).fill(0));
        }
      })
      .catch(() => {
        if (!cancelled) setMonthlyIncome(Array(12).fill(0));
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chartYear, dashboard]);

  const sales = dashboard?.sales ?? [];
  const raw = dashboard?.summary;
  const summary = {
    income: toNum(raw?.income),
    cogsFromSales: toNum(raw?.cogsFromSales),
    profit: toNum(raw?.profit),
    margin: toNum(raw?.margin),
    pendingCostLineCount: toNum(raw?.pendingCostLineCount),
    ownerNetIncome: toNum(raw?.ownerNetIncome),
    staff: raw?.staffExpenses ?? {
      salesCommission: 0,
      liftingFees: 0,
      deliveryWorkerFees: 0,
      total: 0,
    },
  };

  const orderCount = sales.length;
  const kpis = [
    { label: "รายได้รวมเดือนนี้", value: formatMoney(summary.income), Icon: Wallet, tone: "green" },
    { label: "ต้นทุนรวม (COGS)", value: formatMoney(summary.cogsFromSales), Icon: PackageCheck, tone: "gold" },
    { label: "กำไรรวม", value: formatMoney(summary.profit), Icon: TrendingUp, tone: "green" },
    { label: "Gross Margin", value: `${Number(summary.margin || 0).toFixed(1)}%`, Icon: Percent, tone: "blue" },
    { label: "ออเดอร์เดือนนี้", value: String(orderCount), Icon: ClipboardList, tone: "green" },
    {
      label: "รอกรอกต้นทุน",
      value: String(summary.pendingCostLineCount),
      Icon: AlertTriangle,
      tone: summary.pendingCostLineCount > 0 ? "warn" : "green",
      sub: summary.pendingCostLineCount > 0 ? "ต้องดำเนินการ" : undefined,
    },
  ];

  const totalStatusCount = statusCount.paid + statusCount.pending + statusCount.deposit;

  const statusRows = [
    { label: "ชำระแล้ว", value: statusCount.paid, cls: "paid" },
    { label: "รอชำระ", value: statusCount.pending, cls: "pending" },
    { label: "ค้างชำระ", value: statusCount.deposit, cls: "deposit" },
  ];

  const chartMax = Math.max(1, ...monthlyIncome);
  const highlightMonth = chartYear === year ? month : null;

  return (
    <div className="owner-dash__panel ov-panel">
      <div className="ov-toolbar">
        <h2 className="owner-dash__h2" style={{ margin: 0 }}>
          Dashboard
        </h2>
        <div className="ov-toolbar__right">
          <label className="ov-pill" htmlFor="ov-month">
            <span>เดือน</span>
            <select id="ov-month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {MONTH_NAMES[m - 1]}
                </option>
              ))}
            </select>
          </label>
          <label className="ov-pill" htmlFor="ov-year">
            <span>ปี</span>
            <select id="ov-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {selectableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="ov-refresh-btn" onClick={() => void loadPage()}>
            <RefreshCw size={15} strokeWidth={2.5} aria-hidden />
            รีเฟรช
          </button>
        </div>
      </div>

      <OwnerNetIncomeCard
        variant="mobile"
        profit={summary.profit}
        ownerNetIncome={summary.ownerNetIncome}
        staffTotal={summary.staff.total}
      />

      {/* KPI row — reference top strip */}
      <div className="ov-kpi-row">
        {kpis.map(({ label, value, Icon, tone, sub }) => (
          <div className={`ov-kpi ov-kpi--${tone}`} key={label}>
            <div className="ov-kpi__icon">
              <Icon size={20} strokeWidth={2} aria-hidden />
            </div>
            <div className="ov-kpi__body">
              <div className="ov-kpi__value">{value}</div>
              <div className="ov-kpi__label">{label}</div>
              {sub ? <div className="ov-kpi__sub">{sub}</div> : null}
            </div>
          </div>
        ))}
      </div>

      {/* Chart + payment + pending lots — reference middle */}
      <div className="ov-chart-layout">
        <div className="owner-dash__card ov-chart-card">
          <div className="ov-chart-head">
            <h3 className="ov-card-title" style={{ marginBottom: 0 }}>
              <TrendingUp size={16} strokeWidth={2.2} aria-hidden />
              รายได้รายเดือน
            </h3>
            <label className="ov-pill" htmlFor="ov-chart-year">
              <span>ปี</span>
              <select id="ov-chart-year" value={chartYear} onChange={(e) => setChartYear(Number(e.target.value))}>
                {selectableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="ov-chart-sub">รวมยอดขาย (รายรับ) ตามเดือน — ข้อมูลจากฐานข้อมูลจริง</p>
          {chartLoading ? (
            <p className="ov-empty" style={{ margin: "24px 0" }}>
              กำลังโหลดกราฟ…
            </p>
          ) : (
            <div className="ov-chart-graph" role="img" aria-label="รายได้รายเดือน">
              {monthlyIncome.map((amount, i) => {
                const m = i + 1;
                const pct = Math.round((amount / chartMax) * 100);
                const isHighlight = highlightMonth === m;
                return (
                  <div className="ov-chart-col" key={m}>
                    <div className="ov-chart-bar-shell" title={`${MONTH_NAMES[i]} ${chartYear}: ${formatMoney(amount)}`}>
                      <div
                        className={`ov-chart-bar ${isHighlight ? "ov-chart-bar--highlight" : ""}`}
                        style={{ height: `${amount > 0 ? Math.max(pct, 6) : 0}%` }}
                      />
                    </div>
                    <span className="ov-chart-mo">{MONTH_NAMES[i]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="ov-chart-stack">
          <div className="owner-dash__card ov-status-card">
            <h3 className="ov-card-title">
              <CreditCard size={16} strokeWidth={2.2} aria-hidden />
              สถานะการชำระเงิน
            </h3>
            <div className="ov-status-list ov-status-list--rail">
              {statusRows.map((row) => {
                const fillWidthPct =
                  totalStatusCount > 0 && row.value > 0 ? (100 * row.value) / totalStatusCount : 0;
                return (
                  <div className="ov-status-row ov-status-row--rail" key={row.label}>
                    <span className="ov-status-row__rail-label">{row.label}</span>
                    <div className="ov-status-track ov-status-track--rail">
                      <span
                        className={`ov-status-fill ov-status-fill--${row.cls}`}
                        style={{ width: `${fillWidthPct}%` }}
                      />
                    </div>
                    <strong className={`ov-status-row__rail-count ov-status-countStrong--${row.cls}`}>
                      {row.value} รายการ
                    </strong>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Orders — full width under chart block */}
      <div className="owner-dash__card ov-orders-card ov-orders-card--primary">
        <div className="ov-orders-card__head">
          <h3 className="ov-card-title ov-orders-card__title">
            <ClipboardList size={16} strokeWidth={2.2} aria-hidden />
            ออเดอร์ล่าสุด
          </h3>
          <Link to="/owner/reports" className="ov-see-all-btn ov-see-all-btn--blue">
            ดูทั้งหมด
          </Link>
        </div>
        {sales.length === 0 ? (
          <p className="ov-empty">ยังไม่มีออเดอร์ในเดือนนี้</p>
        ) : (
          <div className="ov-orders-scroll">
            <table className="ov-orders-tbl">
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>ลูกค้า</th>
                  <th>ยอด</th>
                  <th>กำไร</th>
                  <th>ประเภท</th>
                  <th>สถานะชำระ</th>
                  <th>สถานะจัดส่ง</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => {
                  const payLabel =
                    sale.payStatus === "paid" ? "ชำระแล้ว" : sale.payStatus === "deposit" ? "ค้างชำระ" : "รอชำระ";
                  const payCls =
                    sale.payStatus === "paid" ? "paid" : sale.payStatus === "deposit" ? "deposit" : "pending";
                  const typeLabel = sale.delivery === "selfpickup" ? "รับเอง" : "จัดส่ง";
                  const ship = deliveryFulfillmentLabel(sale);
                  const pc = profitCellContent(sale);
                  return (
                    <tr key={sale.id}>
                      <td className="ov-orders-tbl__num">{sale.orderNumber}</td>
                      <td>{sale.customerName || "—"}</td>
                      <td className="ov-orders-tbl__money">{formatMoney(sale.grandTotal)}</td>
                      <td className={`ov-orders-tbl__profit ${pc.pending ? "ov-orders-tbl__profit--pending" : ""}`}>
                        {pc.text}
                      </td>
                      <td>
                        <span className={`ov-badge ov-badge--${sale.delivery === "selfpickup" ? "gray" : "blue"}`}>
                          {typeLabel}
                        </span>
                      </td>
                      <td>
                        <span className={`ov-badge ov-badge--${payCls}`}>{payLabel}</span>
                      </td>
                      <td>
                        <span className={`ov-badge ov-badge--${ship.cls}`}>{ship.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ov-fin-bottom">
        <div className="owner-dash__card ov-fin-card ov-fin-card--expenses">
          <h3 className="ov-fin-card__title">
            <Coins size={18} strokeWidth={2} aria-hidden />
            ค่าใช้จ่ายพนักงาน (เดือนนี้)
          </h3>
          <ul className="ov-fin-lines">
            <li>
              <span>ค่าคอมมิชชันพนักงานขาย</span>
              <span>{formatMoney(summary.staff.salesCommission)}</span>
            </li>
            <li>
              <span>ค่ายกสินค้า</span>
              <span>{formatMoney(summary.staff.liftingFees)}</span>
            </li>
            <li>
              <span>ค่าส่งตามระยะทาง</span>
              <span>{formatMoney(summary.staff.deliveryWorkerFees)}</span>
            </li>
            <li className="ov-fin-lines__total">
              <span>รวม</span>
              <span className="ov-fin-lines__total-amt">{formatMoney(summary.staff.total)}</span>
            </li>
          </ul>
        </div>

        <OwnerNetIncomeCard
          variant="desktop"
          profit={summary.profit}
          ownerNetIncome={summary.ownerNetIncome}
          staffTotal={summary.staff.total}
        />
      </div>
    </div>
  );
}

import { RefreshCw } from "lucide-react";
import { formatMoney } from "../../../data/constants";
import { useOwnerDashboard } from "../ownerDashboardContext";

export default function OwnerOverviewTab() {
  const {
    dashboard,
    month,
    year,
    setMonth,
    setYear,
    selectableYears,
    loadPage,
    statusCount
  } = useOwnerDashboard();
  const summary = dashboard?.summary || { income: 0, cost: 0, profit: 0, margin: 0 };

  return (
    <div className="owner-dash__panel">
      <h2 className="owner-dash__h2">ภาพรวมธุรกิจ</h2>

      <div className="owner-dash__card owner-dash__card--muted">
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#636366" }}>ช่วงเวลาที่แสดงในรายงาน</p>
        <div className="owner-dash__filters">
          <div className="owner-dash__filter-group">
            <label htmlFor="owner-ov-month">เดือน</label>
            <select
              id="owner-ov-month"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="owner-dash__filter-group">
            <label htmlFor="owner-ov-year">ปี</label>
            <select id="owner-ov-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {selectableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button type="button" className="owner-dash__btn-primary" onClick={() => void loadPage()}>
        <RefreshCw size={18} strokeWidth={2} aria-hidden />
        รีเฟรชข้อมูล
      </button>

      <div className="owner-dash__grid4" style={{ marginTop: 14 }}>
        <div className="owner-dash__stat">
          <label>รายรับรวม</label>
          <div className="val">{formatMoney(summary.income)}</div>
        </div>
        <div className="owner-dash__stat">
          <label>ต้นทุนรวม</label>
          <div className="val">{formatMoney(summary.cost)}</div>
        </div>
        <div className="owner-dash__stat">
          <label>กำไรสุทธิ</label>
          <div className="val">{formatMoney(summary.profit)}</div>
        </div>
        <div className="owner-dash__stat">
          <label>Margin</label>
          <div className="val">{Number(summary.margin || 0).toFixed(1)}%</div>
        </div>
      </div>

      <div className="owner-dash__card" style={{ marginTop: 12 }}>
        <h3 className="owner-dash__h2" style={{ fontSize: 14 }}>
          สรุปสถานะการชำระ (เดือนที่เลือก)
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 14, color: "#3a3a3c" }}>
          <span>ชำระแล้ว {statusCount.paid}</span>
          <span>ค้างชำระ {statusCount.pending}</span>
          <span>มัดจำ {statusCount.deposit}</span>
        </div>
      </div>
    </div>
  );
}

import { RefreshCw } from "lucide-react";
import { formatMoney } from "../../../data/constants";
import { useOwnerDashboard } from "../ownerDashboardContext";

const defaultSummary = {
  income: 0,
  cost: 0,
  cogsFromSales: 0,
  profit: 0,
  margin: 0
};

export default function OwnerOverviewTab() {
  const { dashboard, month, year, setMonth, setYear, selectableYears, loadPage, statusCount } = useOwnerDashboard();
  const summary = { ...defaultSummary, ...dashboard?.summary };
  const costPositions = dashboard?.costPositions ?? [];

  return (
    <div className="owner-dash__panel">
      <h2 className="owner-dash__h2">ภาพรวมธุรกิจ</h2>

      <div className="owner-dash__card owner-dash__card--muted">
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#636366" }}>
          ยอดขายด้านล่างใช้<strong> เดือน/ปีที่เลือก</strong> — ตัวเลขกล่องสรุปด้านล่างเป็น<strong> สะสมทั้งหมด</strong> (รายรับ − ต้นทุนสินค้า)
        </p>
        <div className="owner-dash__filters">
          <div className="owner-dash__filter-group">
            <label htmlFor="owner-ov-month">เดือน (กรองรายการขาย)</label>
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

      <p style={{ margin: "12px 0 0", fontSize: 13, color: "#636366" }}>
        สรุปสะสม: ต้นทุนคิดจาก<strong> ค่าเฉลี่ยของราคาต้นทุนที่บันทึกตอนรับของเข้า</strong> (แต่ละครั้งรับของที่ใส่ราคา = 1 จุดใช้หาค่าเฉลี่ย) ไม่รวมค่าแรงหรือเงินเดือน
      </p>

      <div className="owner-dash__grid4" style={{ marginTop: 14 }}>
        <div className="owner-dash__stat">
          <label>รายรับสะสม</label>
          <div className="val">{formatMoney(summary.income)}</div>
        </div>
        <div className="owner-dash__stat">
          <label>ต้นทุนสินค้าสะสม (COGS)</label>
          <div className="val">{formatMoney(summary.cogsFromSales)}</div>
        </div>
        <div className="owner-dash__stat">
          <label>กำไรขายสะสม</label>
          <div className="val">{formatMoney(summary.profit)}</div>
        </div>
        <div className="owner-dash__stat">
          <label>Margin</label>
          <div className="val">{Number(summary.margin || 0).toFixed(1)}%</div>
        </div>
      </div>

      {costPositions.length > 0 ? (
        <div className="owner-dash__card" style={{ marginTop: 12, overflowX: "auto" }}>
          <h3 className="owner-dash__h2" style={{ fontSize: 14 }}>
            ต้นทุนเฉลี่ยต่อชิ้น (จากการบันทึกรับของ)
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e5ea" }}>
                <th style={{ padding: "8px 6px" }}>สินค้า</th>
                <th style={{ padding: "8px 6px" }}>คงคลัง</th>
                <th style={{ padding: "8px 6px" }}>เฉลี่ย / ชิ้น</th>
                <th style={{ padding: "8px 6px" }}>จำนวนครั้งที่มีต้นทุน</th>
              </tr>
            </thead>
            <tbody>
              {costPositions.map((row) => (
                <tr key={row.deskItemId} style={{ borderBottom: "1px solid #f2f2f7" }}>
                  <td style={{ padding: "8px 6px" }}>{row.name}</td>
                  <td style={{ padding: "8px 6px" }}>{row.onHandQty}</td>
                  <td style={{ padding: "8px 6px" }}>
                    {row.avgUnitCost == null ? "—" : formatMoney(row.avgUnitCost)}
                  </td>
                  <td style={{ padding: "8px 6px" }}>{row.costSampleCount ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="owner-dash__card" style={{ marginTop: 12 }}>
        <h3 className="owner-dash__h2" style={{ fontSize: 14 }}>
          สถานะการชำระ — เดือนที่เลือก ({month}/{year})
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

import { RefreshCw } from "lucide-react";
import { formatMoney } from "../../../data/constants";
import { useOwnerDashboard } from "../ownerDashboardContext";

export default function OwnerReportsTab() {
  const {
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
    loadPage,
    confirmSalePaid,
    viewPaymentSlipAndMark,
    removePaymentSlipByOwner,
    updatingSaleId
  } = useOwnerDashboard();

  return (
    <div className="owner-dash__panel">
      <h2 className="owner-dash__h2">รายการขาย</h2>

      <button
        type="button"
        className="owner-dash__btn-primary owner-dash__btn-primary--fit"
        style={{ marginBottom: 12 }}
        onClick={() => void loadPage()}
      >
        <RefreshCw size={18} strokeWidth={2} aria-hidden />
        โหลดรายการใหม่
      </button>

      <div className="owner-dash__card owner-dash__card--muted">
        <h3 className="owner-dash__h2" style={{ fontSize: 14 }}>
          ช่วงเวลา
        </h3>
        <div className="owner-dash__filters owner-dash__filters--reports">
          <div className="owner-dash__filter-group">
            <label htmlFor="rep-month">เดือน</label>
            <select id="rep-month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="owner-dash__filter-group">
            <label htmlFor="rep-year">ปี</label>
            <select id="rep-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {selectableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="owner-dash__filter-group">
            <label htmlFor="rep-week">สัปดาห์ของเดือน</label>
            <select
              id="rep-week"
              value={weekFilter}
              onChange={(e) => setWeekFilter(e.target.value as "all" | "1" | "2" | "3" | "4" | "5")}
            >
              <option value="all">ทั้งเดือน</option>
              <option value="1">สัปดาห์ที่ 1</option>
              <option value="2">สัปดาห์ที่ 2</option>
              <option value="3">สัปดาห์ที่ 3</option>
              <option value="4">สัปดาห์ที่ 4</option>
              <option value="5">สัปดาห์ที่ 5</option>
            </select>
          </div>
        </div>
      </div>

      <div className="owner-dash__card owner-dash__card--muted" style={{ marginTop: 10 }}>
        <h3 className="owner-dash__h2" style={{ fontSize: 14 }}>
          ตัวกรองรายการ
        </h3>
        <div className="owner-dash__filters owner-dash__filters--reports">
          <div className="owner-dash__filter-group">
            <label htmlFor="rep-pay">สถานะการชำระ</label>
            <select
              id="rep-pay"
              value={payStatusFilter}
              onChange={(e) =>
                setPayStatusFilter(e.target.value as "all" | "paid" | "pending" | "deposit")
              }
            >
              <option value="all">ทั้งหมด</option>
              <option value="paid">ชำระแล้ว</option>
              <option value="pending">ค้างชำระ</option>
              <option value="deposit">มัดจำ</option>
            </select>
          </div>
          <div className="owner-dash__filter-group">
            <label htmlFor="rep-sort">เรียงตาม</label>
            <select id="rep-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as "time" | "total")}>
              <option value="time">เวลา</option>
              <option value="total">ยอดรวม</option>
            </select>
          </div>
          <div className="owner-dash__filter-group">
            <label htmlFor="rep-dir">ทิศทาง</label>
            <select id="rep-dir" value={sortDir} onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}>
              <option value="desc">ใหม่ → เก่า / มาก → น้อย</option>
              <option value="asc">เก่า → ใหม่ / น้อย → มาก</option>
            </select>
          </div>
        </div>
      </div>

      <div className="owner-dash__card" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13, color: "#3a3a3c" }}>
          <span>ชำระแล้ว {statusCount.paid}</span>
          <span>ค้างชำระ {statusCount.pending}</span>
          <span>มัดจำ {statusCount.deposit}</span>
        </div>
      </div>

      {filteredAndSortedSales.length === 0 ? (
        <div className="owner-dash__card owner-dash__card--muted" style={{ marginTop: 12 }}>
          <p style={{ margin: 0, textAlign: "center", color: "#636366" }}>ไม่มีรายการตามตัวกรอง</p>
        </div>
      ) : (
        <div className="tbl-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>ออเดอร์</th>
                <th>สินค้า</th>
                <th>ชุด</th>
                <th>ยอดรวม</th>
                <th>ต้นทุนเฉลี่ย/ชิ้น</th>
                <th>กำไรขาย</th>
                <th>สถานะ</th>
                <th>ผู้บันทึก</th>
                <th>สลิป/ยืนยัน</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedSales.map((sale) => (
                <tr key={sale.id}>
                  <td>{sale.orderNumber}</td>
                  <td>{sale.type}</td>
                  <td>{sale.qty}</td>
                  <td>{formatMoney(sale.grandTotal)}</td>
                  <td className="csub" style={{ fontSize: 12 }}>
                    {sale.avgUnitCost != null ? formatMoney(sale.avgUnitCost) : "—"}
                  </td>
                  <td className="csub" style={{ fontSize: 12 }}>
                    {sale.grossProfit != null ? formatMoney(sale.grossProfit) : "—"}
                  </td>
                  <td>{sale.payStatus}</td>
                  <td>
                    <div>{sale.createdByName || sale.createdByUsername || "—"}</div>
                    {sale.recordedAt ? (
                      <div className="csub" style={{ fontSize: 11 }}>
                        {new Date(sale.recordedAt).toLocaleString("th-TH", {
                          dateStyle: "short",
                          timeStyle: "short"
                        })}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                      {sale.paymentSlipImage ? (
                        <>
                          <button
                            type="button"
                            className="btnok"
                            style={{ padding: "8px 12px", fontSize: 13, minHeight: 44 }}
                            onClick={() => {
                              void viewPaymentSlipAndMark(sale.id, sale.paymentSlipImage!);
                            }}
                          >
                            ดูสลิป
                          </button>
                          <button
                            type="button"
                            className="owner-dash__btn-danger"
                            onClick={() => void removePaymentSlipByOwner(sale.id)}
                            disabled={updatingSaleId === sale.id}
                          >
                            ลบสลิป
                          </button>
                        </>
                      ) : (
                        <span style={{ opacity: 0.7, fontSize: 13 }}>ไม่มีสลิป</span>
                      )}
                      <button
                        type="button"
                        className="btnok"
                        style={{ padding: "8px 12px", fontSize: 13, minHeight: 44 }}
                        disabled={
                          sale.payStatus === "paid" ||
                          !sale.paymentSlipImage ||
                          !sale.slipViewedAt ||
                          updatingSaleId === sale.id
                        }
                        onClick={() => void confirmSalePaid(sale.id)}
                      >
                        {sale.payStatus === "paid"
                          ? "ชำระแล้ว"
                          : updatingSaleId === sale.id
                            ? "กำลังอัปเดต..."
                            : "ยืนยันชำระ"}
                      </button>
                    </div>
                    <div style={{ marginTop: 6, textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: 8,
                          background: !sale.paymentSlipImage
                            ? "rgba(128,128,128,0.12)"
                            : sale.slipViewedAt
                              ? "rgba(46,125,50,0.14)"
                              : "rgba(245,124,0,0.16)",
                          color: !sale.paymentSlipImage ? "#666" : sale.slipViewedAt ? "#1b5e20" : "#b45309"
                        }}
                      >
                        {!sale.paymentSlipImage
                          ? "ยังไม่มีสลิป"
                          : sale.slipViewedAt
                            ? "ดูสลิปแล้ว"
                            : "ยังไม่ดูสลิป"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

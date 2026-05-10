import { RefreshCw } from "lucide-react";
import { formatMoney } from "../../../data/constants";
import { useOwnerDashboard } from "../ownerDashboardContext";

function toNum(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

export default function OwnerOverviewTab() {
  const { dashboard, month, year, setMonth, setYear, selectableYears, loadPage, statusCount } =
    useOwnerDashboard();
  const raw = dashboard?.summary;
  const summary = {
    income: toNum(raw?.income),
    cost: toNum(raw?.cost),
    cogsFromSales: toNum(raw?.cogsFromSales),
    profit: toNum(raw?.profit),
    margin: toNum(raw?.margin),
    pendingCostLineCount: toNum(raw?.pendingCostLineCount),
    pendingCostRevenue: toNum(raw?.pendingCostRevenue),
  };
  const costPositions = dashboard?.costPositions ?? [];
  const pendingCostOrders = dashboard?.pendingCostOrders ?? [];
  const totalStockValue = costPositions.reduce(
    (s, p) => s + p.lots.reduce((ls, l) => ls + l.totalValue, 0),
    0
  );
  const totalPendingQty = costPositions.reduce((s, p) => s + p.pendingQty, 0);

  return (
    <div className="owner-dash__panel">
      <h2 className="owner-dash__h2">ภาพรวมธุรกิจ</h2>

      {/* ── Period filter card — dark pill style ── */}
      <div
        style={{
          background: "#1c1c1e",
          borderRadius: 14,
          padding: "12px 14px",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {/* Month pill */}
          <label
            htmlFor="owner-ov-month"
            style={{
              display: "flex",
              alignItems: "center",
              background: "#2c2c2e",
              border: "1px solid #3a3a3c",
              borderRadius: 10,
              padding: "0 10px 0 12px",
              height: 40,
              gap: 4,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 13, color: "#8e8e93", userSelect: "none" }}>เดือน:</span>
            <select
              id="owner-ov-month"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              style={{
                background: "transparent",
                color: "#fff",
                border: "none",
                fontSize: 14,
                fontFamily: "inherit",
                outline: "none",
                cursor: "pointer",
                paddingRight: 2,
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m} style={{ background: "#2c2c2e", color: "#fff" }}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          {/* Year pill */}
          <label
            htmlFor="owner-ov-year"
            style={{
              display: "flex",
              alignItems: "center",
              background: "#2c2c2e",
              border: "1px solid #3a3a3c",
              borderRadius: 10,
              padding: "0 10px 0 12px",
              height: 40,
              gap: 4,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 13, color: "#8e8e93", userSelect: "none" }}>ปี:</span>
            <select
              id="owner-ov-year"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={{
                background: "transparent",
                color: "#fff",
                border: "none",
                fontSize: 14,
                fontFamily: "inherit",
                outline: "none",
                cursor: "pointer",
                paddingRight: 2,
              }}
            >
              {selectableYears.map((y) => (
                <option key={y} value={y} style={{ background: "#2c2c2e", color: "#fff" }}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, color: "#636366" }}>
          การตั้งค่าการแสดงผล
        </div>
      </div>

      <button type="button" className="owner-dash__btn-primary" onClick={() => void loadPage()}>
        <RefreshCw size={18} strokeWidth={2} aria-hidden />
        รีเฟรชข้อมูล
      </button>

      <p style={{ margin: "12px 0 0", fontSize: 13, color: "#636366" }}>
        กำไรคิดจาก<strong> FIFO ต้นทุนจริงต่อล็อต</strong> — ออเดอร์ที่รอกรอกต้นทุนไม่รวมในกำไร
      </p>

      {pendingCostOrders.length > 0 && (
        <div
          style={{
            background: "#fff8e1",
            border: "1px solid #f59e0b",
            borderRadius: 8,
            padding: "10px 14px",
            marginTop: 10,
            fontSize: 13,
            color: "#92400e",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <strong>รอกรอกต้นทุน {pendingCostOrders.length} บรรทัด</strong>
            <span style={{ fontSize: 12, color: "#a16207" }}>
              — รายรับ {formatMoney(summary.pendingCostRevenue)} ยังไม่รวมในกำไร
            </span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <tbody>
              {pendingCostOrders.map((order) => (
                <tr
                  key={order.id}
                  style={{ borderBottom: "1px solid #fde68a" }}
                >
                  <td
                    style={{
                      padding: "4px 8px 4px 0",
                      fontFamily: "monospace",
                      color: "#78350f",
                      whiteSpace: "nowrap",
                      verticalAlign: "top",
                    }}
                  >
                    {order.orderNumber}
                  </td>
                  <td style={{ padding: "4px 8px 4px 0", verticalAlign: "top" }}>
                    <div>
                      {order.productName}
                      <span style={{ color: "#a16207", marginLeft: 4 }}>×{order.qty}</span>
                    </div>
                    {order.pendingLots.map((lot, i) => (
                      <div
                        key={i}
                        style={{ marginTop: 2, paddingLeft: 8, fontSize: 11, color: "#a16207" }}
                      >
                        ↳{" "}
                        {lot.receivedAt == null ? (
                          <span style={{ color: "#dc2626" }}>สต็อกไม่พอ — ไม่สามารถแก้ได้</span>
                        ) : (
                          <>
                            ล็อต {formatDate(lot.receivedAt)}
                            <span style={{ color: "#78350f", marginLeft: 4 }}>
                              ({lot.consumedQty} ชิ้น)
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </td>
                  <td
                    style={{
                      padding: "4px 0",
                      textAlign: "right",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      verticalAlign: "top",
                    }}
                  >
                    {formatMoney(order.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 8, fontSize: 11, color: "#a16207", borderTop: "1px solid #fde68a", paddingTop: 6 }}>
            ไปที่ คลังสินค้า → ล็อตสินค้า → แก้ไขต้นทุน เพื่อให้กำไรคำนวณอัตโนมัติ
          </div>
        </div>
      )}

      <div className="owner-dash__grid4" style={{ marginTop: 14 }}>
        <div className="owner-dash__stat">
          <label>รายรับ ({month}/{year})</label>
          <div className="val">{formatMoney(summary.income)}</div>
        </div>
        <div className="owner-dash__stat">
          <label>ต้นทุนสินค้า ({month}/{year})</label>
          <div className="val">{formatMoney(summary.cogsFromSales)}</div>
        </div>
        <div className="owner-dash__stat">
          <label>กำไรขาย ({month}/{year})</label>
          <div className="val">{formatMoney(summary.profit)}</div>
        </div>
        <div className="owner-dash__stat">
          <label>Margin</label>
          <div className="val">{Number(summary.margin || 0).toFixed(1)}%</div>
        </div>
      </div>

      {costPositions.length > 0 && (
        <div className="owner-dash__card" style={{ marginTop: 12, overflowX: "auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <h3 className="owner-dash__h2" style={{ fontSize: 14, margin: 0 }}>
              ต้นทุนคงคลัง (FIFO ต่อล็อต)
            </h3>
            {totalStockValue > 0 && (
              <span style={{ fontSize: 13, color: "#3a3a3c" }}>
                มูลค่ารวม <strong>{formatMoney(totalStockValue)}</strong>
                {totalPendingQty > 0 && (
                  <span style={{ marginLeft: 8, color: "#d97706", fontSize: 12 }}>
                    + {totalPendingQty} ชิ้นรอต้นทุน
                  </span>
                )}
              </span>
            )}
          </div>

          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 10 }}
          >
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #e5e5ea",
                  color: "#636366",
                }}
              >
                <th style={{ padding: "6px 8px" }}>สินค้า</th>
                <th style={{ padding: "6px 8px" }}>วันที่รับ</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>คงคลัง</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>ต้นทุน/ชิ้น</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>มูลค่าล็อต</th>
              </tr>
            </thead>
            <tbody>
              {costPositions.map((product) => {
                if (product.lots.length === 0) {
                  return (
                    <tr
                      key={product.deskItemId}
                      style={{ borderBottom: "1px solid #f2f2f7", color: "#aeaeb2" }}
                    >
                      <td style={{ padding: "7px 8px" }}>{product.name}</td>
                      <td style={{ padding: "7px 8px" }}>—</td>
                      <td style={{ padding: "7px 8px", textAlign: "right" }}>0</td>
                      <td style={{ padding: "7px 8px", textAlign: "right" }}>—</td>
                      <td style={{ padding: "7px 8px", textAlign: "right" }}>—</td>
                    </tr>
                  );
                }

                return product.lots.map((lot, lotIndex) => {
                  const isFirst = lotIndex === 0;
                  const isLastLot = lotIndex === product.lots.length - 1;
                  return (
                    <tr
                      key={lot.id}
                      style={{
                        borderBottom: isLastLot ? "1px solid #d1d1d6" : "1px solid #f2f2f7",
                      }}
                    >
                      <td style={{ padding: "7px 8px" }}>
                        {isFirst ? (
                          <span>
                            {product.name}
                            {product.lots.length > 1 && (
                              <span style={{ marginLeft: 5, fontSize: 11, color: "#8e8e93" }}>
                                ({product.lots.length} ล็อต)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: "#c7c7cc", paddingLeft: 10 }}>↳</span>
                        )}
                      </td>
                      <td style={{ padding: "7px 8px", color: "#636366", fontSize: 12 }}>
                        {isFirst && (
                          <span
                            style={{
                              marginRight: 5,
                              fontSize: 10,
                              background: "#d1fae5",
                              color: "#065f46",
                              borderRadius: 3,
                              padding: "1px 4px",
                              fontWeight: 600,
                            }}
                          >
                            ถัดไป
                          </span>
                        )}
                        {formatDate(lot.receivedAt)}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right" }}>
                        {lot.remainingQty}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right" }}>
                        {lot.costPerUnit === 0 ? (
                          <span
                            style={{
                              fontSize: 11,
                              background: "#fef3c7",
                              color: "#d97706",
                              borderRadius: 4,
                              padding: "1px 5px",
                            }}
                          >
                            รอกรอก
                          </span>
                        ) : (
                          formatMoney(lot.costPerUnit)
                        )}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right" }}>
                        {lot.totalValue > 0 ? (
                          formatMoney(lot.totalValue)
                        ) : (
                          <span style={{ color: "#aeaeb2" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}

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

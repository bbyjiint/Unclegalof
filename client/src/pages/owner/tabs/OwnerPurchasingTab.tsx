import { PlusCircle, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import type { PipelinePriority, PipelineStatus } from "../../../types";
import { formatMoney } from "../../../data/constants";
import { useOwnerDashboard } from "../ownerDashboardContext";

export default function OwnerPurchasingTab() {
  const {
    pipelineItems,
    catalogOptions,
    pipeForm,
    setPipeForm,
    addPipeline,
    updatePipelineRow,
    removePipelineRow
  } = useOwnerDashboard();

  return (
    <div className="owner-dash__panel">
      <h2 className="owner-dash__h2">แผนสั่งซื้อ</h2>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#636366" }}>
        ติดตามคำสั่งซื้อที่ยังไม่เข้าคลัง (แยกจากสต็อกจริง)
      </p>

      <div className="owner-dash__card">
        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            void addPipeline(e);
          }}
        >
          <div className="owner-dash__filters">
            <div className="owner-dash__filter-group">
              <label htmlFor="pipe-product">สินค้า</label>
              <select
                id="pipe-product"
                value={pipeForm.deskItemId}
                onChange={(e) => setPipeForm({ ...pipeForm, deskItemId: e.target.value })}
                required
              >
                <option value="">-- เลือก --</option>
                {catalogOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="owner-dash__filter-group">
              <label htmlFor="pipe-qty">จำนวน</label>
              <input
                id="pipe-qty"
                type="number"
                min={1}
                value={pipeForm.qty}
                onChange={(e) => setPipeForm({ ...pipeForm, qty: e.target.value })}
                required
              />
            </div>
            <div className="owner-dash__filter-group">
              <label htmlFor="pipe-cost">ต้นทุนประมาณ (บาท)</label>
              <input
                id="pipe-cost"
                type="number"
                min={0}
                value={pipeForm.costEst}
                onChange={(e) => setPipeForm({ ...pipeForm, costEst: e.target.value })}
              />
            </div>
            <div className="owner-dash__filter-group">
              <label htmlFor="pipe-date">คาดว่าถึง</label>
              <input
                id="pipe-date"
                type="date"
                value={pipeForm.expectedDate}
                onChange={(e) => setPipeForm({ ...pipeForm, expectedDate: e.target.value })}
              />
            </div>
            <div className="owner-dash__filter-group">
              <label htmlFor="pipe-status">สถานะ</label>
              <select
                id="pipe-status"
                value={pipeForm.status}
                onChange={(e) => setPipeForm({ ...pipeForm, status: e.target.value as PipelineStatus })}
              >
                <option value="planned">วางแผน</option>
                <option value="ordered">สั่งแล้ว</option>
                <option value="transit">ระหว่างจัดส่ง</option>
                <option value="arrived">ถึงแล้ว</option>
              </select>
            </div>
            <div className="owner-dash__filter-group">
              <label htmlFor="pipe-prio">ความเร่งด่วน</label>
              <select
                id="pipe-prio"
                value={pipeForm.priority}
                onChange={(e) => setPipeForm({ ...pipeForm, priority: e.target.value as PipelinePriority })}
              >
                <option value="low">ต่ำ</option>
                <option value="normal">ปกติ</option>
                <option value="urgent">ด่วน</option>
              </select>
            </div>
          </div>
          <div className="owner-dash__filter-group" style={{ marginTop: 10 }}>
            <label htmlFor="pipe-note">หมายเหตุ</label>
            <input
              id="pipe-note"
              value={pipeForm.note}
              onChange={(e) => setPipeForm({ ...pipeForm, note: e.target.value })}
            />
          </div>
          <button type="submit" className="owner-dash__btn-primary owner-dash__btn-primary--fit" style={{ marginTop: 14 }}>
            <PlusCircle size={18} strokeWidth={2} aria-hidden />
            เพิ่มรายการ
          </button>
        </form>
      </div>

      <div style={{ marginTop: 16 }}>
        {pipelineItems.length === 0 ? (
          <div className="owner-dash__card owner-dash__card--muted">
            <p style={{ margin: 0, textAlign: "center", color: "#636366" }}>ยังไม่มีรายการแผนสั่งซื้อ</p>
          </div>
        ) : (
          pipelineItems.map((row) => (
            <div key={row.id} className="owner-dash__pipeline-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <strong style={{ fontSize: 15 }}>{row.productName}</strong>
                  <div style={{ fontSize: 12, color: "#636366", marginTop: 4 }}>
                    จำนวน {row.qty} · {formatMoney(row.costEst)}
                    <br />
                    คาดถึง{" "}
                    {row.expectedDate ? new Date(row.expectedDate).toLocaleDateString("th-TH") : "—"}
                  </div>
                </div>
                <button
                  type="button"
                  className="crow-icon-btn"
                  aria-label="ลบรายการ"
                  title="ลบ"
                  onClick={() => void removePipelineRow(row.id)}
                >
                  <Trash2 size={18} strokeWidth={2} aria-hidden />
                </button>
              </div>
              <div className="owner-dash__pipeline-row" style={{ marginTop: 10 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#636366" }}>สถานะ</span>
                  <select
                    value={row.status}
                    onChange={(e) => {
                      void updatePipelineRow(row.id, { status: e.target.value as PipelineStatus });
                    }}
                  >
                    <option value="planned">วางแผน</option>
                    <option value="ordered">สั่งแล้ว</option>
                    <option value="transit">ระหว่างจัดส่ง</option>
                    <option value="arrived">ถึงแล้ว</option>
                  </select>
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#636366" }}>ความสำคัญ</span>
                  <select
                    value={row.priority}
                    onChange={(e) => {
                      void updatePipelineRow(row.id, { priority: e.target.value as PipelinePriority });
                    }}
                  >
                    <option value="low">ต่ำ</option>
                    <option value="normal">ปกติ</option>
                    <option value="urgent">ด่วน</option>
                  </select>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

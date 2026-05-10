import { useCallback, useEffect, useState } from "react";
import { Package, RefreshCw } from "lucide-react";
import { formatMoney } from "../../../data/constants";
import { api } from "../../../lib/api";
import type { InventoryLotRow } from "../../../types";

export default function OwnerPurchasingTab() {
  const [lots, setLots] = useState<InventoryLotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingLotId, setSavingLotId] = useState<string | null>(null);
  const [costDrafts, setCostDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const lotsRes = await api.inventoryLots();
      setLots(lotsRes.items || []);
      const drafts: Record<string, string> = {};
      for (const lot of lotsRes.items || []) {
        if ((lot.costPerUnit ?? 0) === 0) {
          drafts[lot.id] = "";
        }
      }
      setCostDrafts(drafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveLotCost(lotId: string): Promise<void> {
    const raw = costDrafts[lotId] ?? "";
    const costPerUnit = Math.max(0, Math.round(Number(raw)));
    if (raw.trim() !== "" && Number.isNaN(Number(raw))) {
      setError("กรอกตัวเลขต้นทุนต่อชิ้น");
      return;
    }
    try {
      setSavingLotId(lotId);
      setError(null);
      await api.updateInventoryLotCost(lotId, { costPerUnit });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSavingLotId(null);
    }
  }

  return (
    <div className="owner-dash__panel">
      <h2 className="owner-dash__h2">
        <Package size={22} strokeWidth={2} aria-hidden style={{ verticalAlign: "middle", marginRight: 8 }} />
        รับของเข้าคลัง & ต้นทุน
      </h2>
      <p style={{ fontSize: 14, color: "#636366", marginBottom: 16, maxWidth: 560 }}>
        ดูประวัติรับของแต่ละรอบ ใส่ต้นทุนต่อชิ้นได้เมื่อรอบนั้นยังไม่มีต้นทุน
      </p>

      {error ? (
        <div className="owner-dash__card" style={{ borderLeft: "4px solid #c62828", marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <h3 className="owner-dash__h2" style={{ fontSize: 15, margin: 0 }}>
          ประวัติรับของ (ล่าสุดก่อน)
        </h3>
        <button type="button" className="owner-dash__btn-primary owner-dash__btn-primary--fit" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} strokeWidth={2} aria-hidden />
          รีเฟรช
        </button>
      </div>

      {loading ? (
        <div className="owner-dash__card owner-dash__card--muted">
          <p style={{ margin: 0 }}>กำลังโหลด…</p>
        </div>
      ) : lots.length === 0 ? (
        <div className="owner-dash__card owner-dash__card--muted">
          <p style={{ margin: 0, textAlign: "center", color: "#636366" }}>ยังไม่มีรอบรับของ</p>
        </div>
      ) : (
        <div className="purch-lot-list">
          {lots.map((lot) => {
            const hasCost = (lot.costPerUnit ?? 0) > 0;
            const dateStr = lot.createdAt
              ? new Date(lot.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })
              : "—";
            const costContent = hasCost ? (
              <span className="purch-lot-card__cost-val">{formatMoney(lot.costPerUnit ?? 0)}</span>
            ) : (
              <>
                <input
                  type="number"
                  min={0}
                  className="purch-lot-card__cost-input"
                  placeholder="บาท/ชิ้น"
                  value={costDrafts[lot.id] ?? ""}
                  onChange={(e) => setCostDrafts((d) => ({ ...d, [lot.id]: e.target.value }))}
                  aria-label={`ต้นทุน ${lot.productName}`}
                />
                <button
                  type="button"
                  className="purch-lot-card__save-btn"
                  disabled={savingLotId === lot.id}
                  onClick={() => void saveLotCost(lot.id)}
                >
                  {savingLotId === lot.id ? "…" : "บันทึก"}
                </button>
              </>
            );

            const pendingCount = lot.pendingOrderCount ?? 0;

            return (
              <div key={lot.id} className="purch-lot-card">
                {/* Top: 3-col mobile / 4-col desktop */}
                <div className="purch-lot-card__top">
                  <div>
                    <div className="purch-lot-card__date">{dateStr}</div>
                    <div className="purch-lot-card__product">{lot.productName}</div>
                    {lot.note ? <div className="purch-lot-card__note">{lot.note}</div> : null}
                  </div>
                  <div className="purch-lot-card__num-col">
                    <div className="purch-lot-card__col-label">จำนวนรับ</div>
                    <div className="purch-lot-card__num">{lot.qty}</div>
                  </div>
                  <div className="purch-lot-card__num-col">
                    <div className="purch-lot-card__col-label">คงเหลือ</div>
                    <div className="purch-lot-card__num">{lot.remainingQty}</div>
                  </div>
                  {/* 4th column — desktop only (CSS hides on mobile) */}
                  <div className="purch-lot-card__cost-col">
                    <div className="purch-lot-card__col-label" style={{ textAlign: "right" }}>ต้นทุน/ชิ้น</div>
                    <div className="purch-lot-card__cost-right">{costContent}</div>
                  </div>
                </div>

                {/* Cost row — mobile only (CSS hides on desktop) */}
                <div className="purch-lot-card__cost-row">
                  <div className="purch-lot-card__cost-label">ต้นทุน / ชิ้น</div>
                  <div className="purch-lot-card__cost-right">{costContent}</div>
                </div>

                {/* Pending-cost alert — shown when this lot is causing unfinalised profit lines */}
                {pendingCount > 0 && (
                  <div
                    style={{
                      borderTop: "1px solid #fde68a",
                      background: "#fffbeb",
                      padding: "6px 12px",
                      fontSize: 12,
                      color: "#92400e",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span aria-hidden>⚠️</span>
                    <span>
                      <strong>{pendingCount} ออเดอร์</strong>
                      {" "}รอต้นทุนจากล็อตนี้ — กรอกต้นทุนเพื่อให้กำไรคำนวณอัตโนมัติ
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

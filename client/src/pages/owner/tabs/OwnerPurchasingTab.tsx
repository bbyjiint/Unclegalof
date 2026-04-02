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
        <div className="tbl-wrap" style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>วันที่รับ</th>
                <th>สินค้า</th>
                <th>จำนวนรับ</th>
                <th>คงเหลือ</th>
                <th>ต้นทุน / ชิ้น</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => {
                const hasCost = (lot.costPerUnit ?? 0) > 0;
                return (
                  <tr key={lot.id}>
                    <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                      {lot.createdAt
                        ? new Date(lot.createdAt).toLocaleString("th-TH", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td>
                      {lot.productName}
                      {lot.note ? (
                        <div className="csub" style={{ fontSize: 11, color: "#636366" }}>
                          {lot.note}
                        </div>
                      ) : null}
                    </td>
                    <td>{lot.qty}</td>
                    <td>{lot.remainingQty}</td>
                    <td>
                      {hasCost ? (
                        <span style={{ fontWeight: 600 }}>{formatMoney(lot.costPerUnit ?? 0)}</span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                          <input
                            type="number"
                            min={0}
                            style={{ width: 100, padding: "6px 8px", borderRadius: 8, border: "1px solid #c7c7cc" }}
                            placeholder="บาท/ชิ้น"
                            value={costDrafts[lot.id] ?? ""}
                            onChange={(e) =>
                              setCostDrafts((d) => ({
                                ...d,
                                [lot.id]: e.target.value,
                              }))
                            }
                            aria-label={`ต้นทุน ${lot.productName}`}
                          />
                          <button
                            type="button"
                            className="btnok"
                            style={{ padding: "6px 12px", fontSize: 13 }}
                            disabled={savingLotId === lot.id}
                            onClick={() => void saveLotCost(lot.id)}
                          >
                            {savingLotId === lot.id ? "…" : "บันทึก"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

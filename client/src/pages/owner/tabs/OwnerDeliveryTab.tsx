import { useCallback, useEffect, useState } from "react";
import { MapPin, Save } from "lucide-react";
import { formatMoney } from "../../../data/constants";
import { api } from "../../../lib/api";
import type { DeliveryZoneRow } from "../../../types";

export default function OwnerDeliveryTab() {
  const [zones, setZones] = useState<DeliveryZoneRow[]>([]);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { zones: rows } = await api.deliveryFees();
      setZones(rows);
      const next: Record<number, string> = {};
      for (const z of rows) {
        next[z.range] = String(z.cost);
      }
      setDraft(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(): Promise<void> {
    setMessage(null);
    setError(null);
    const items: Array<{ range: number; cost: number }> = [];
    for (const z of zones) {
      const raw = draft[z.range];
      const cost = Math.max(0, Math.round(Number(raw)));
      if (Number.isNaN(cost)) {
        setError(`ค่าจัดส่งโซน ${z.range} ไม่ถูกต้อง`);
        return;
      }
      items.push({ range: z.range, cost });
    }
    try {
      setSaving(true);
      const { zones: updated } = await api.updateDeliveryFees(items);
      setZones(updated);
      const next: Record<number, string> = {};
      for (const z of updated) {
        next[z.range] = String(z.cost);
      }
      setDraft(next);
      setMessage("บันทึกค่าจัดส่งแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="owner-dash__panel">
      <h2 className="owner-dash__h2">
        <MapPin size={22} strokeWidth={2} aria-hidden style={{ verticalAlign: "middle", marginRight: 8 }} />
        ค่าจัดส่งตามโซน (กม.)
      </h2>
      <p style={{ fontSize: 14, color: "#636366", marginBottom: 16, maxWidth: 560 }}>
        กำหนดราคาค่าขนส่งตามระยะทาง (โซนตามกม.) ตรงกับการคำนวณในระบบขาย การเปลี่ยนราคามีผลกับการขายใหม่และการแสดงผลบนหน้าพนักงาน
      </p>

      {error ? (
        <div className="owner-dash__card" style={{ borderLeft: "4px solid #c62828", marginBottom: 12 }}>
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="owner-dash__card" style={{ borderLeft: "4px solid #2e7d32", marginBottom: 12 }} role="status">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="owner-dash__card owner-dash__card--muted">
          <p style={{ margin: 0 }}>กำลังโหลด…</p>
        </div>
      ) : (
        <>
          <div className="owner-dash__card" style={{ overflowX: "auto" }}>
            <table className="owner-delivery-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e5ea" }}>
                  <th style={{ padding: "10px 8px" }}>โซน</th>
                  <th style={{ padding: "10px 8px" }}>ระยะทาง (กม.)</th>
                  <th style={{ padding: "10px 8px" }}>ค่าจัดส่ง (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.range} style={{ borderBottom: "1px solid #f2f2f7" }}>
                    <td style={{ padding: "10px 8px", fontWeight: 600 }}>{z.range}</td>
                    <td style={{ padding: "10px 8px", color: "#636366" }}>
                      {z.minKm} – {z.maxKm >= 9999 ? "300+" : z.maxKm}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="owner-dash__filter-group input"
                        style={{ width: 120, padding: "8px 10px" }}
                        value={draft[z.range] ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, [z.range]: e.target.value }))}
                        aria-label={`ค่าจัดส่งโซน ${z.range}`}
                      />
                      <span style={{ marginLeft: 8, fontSize: 12, color: "#8e8e93" }}>
                        ({formatMoney(Math.max(0, Math.round(Number(draft[z.range]) || 0)))})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="owner-dash__btn-primary owner-dash__btn-primary--fit"
            style={{ marginTop: 16 }}
            disabled={saving}
            onClick={() => void handleSave()}
          >
            <Save size={18} strokeWidth={2} aria-hidden />
            {saving ? "กำลังบันทึก…" : "บันทึกค่าจัดส่ง"}
          </button>
        </>
      )}
    </div>
  );
}

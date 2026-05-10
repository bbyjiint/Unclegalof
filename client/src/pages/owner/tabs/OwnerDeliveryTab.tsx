import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Eye, MapPin, Package, Phone, Save, User } from "lucide-react";
import { formatMoney } from "../../../data/constants";
import { api } from "../../../lib/api";
import { PaymentSlipLightbox } from "../../../components/PaymentSlipLightbox";
import type { DeliveryOrderRow, DeliveryZoneRow } from "../../../types";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

function formatDateTh(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

function itemSummary(row: DeliveryOrderRow): string {
  if (row.items && row.items.length > 0) {
    return row.items.map((item) => `${item.type} x ${item.qty}`).join(", ");
  }
  return row.productName || "—";
}

export default function OwnerDeliveryTab() {
  const now = new Date();
  const [zones, setZones] = useState<DeliveryZoneRow[]>([]);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<DeliveryOrderRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyMonth, setHistoryMonth] = useState(now.getMonth() + 1);
  const [historyYear, setHistoryYear] = useState(now.getFullYear());
  const [proofPreviewSrc, setProofPreviewSrc] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  async function viewProofAndAcknowledge(row: DeliveryOrderRow): Promise<void> {
    if (!row.deliveryProofImage) return;
    setProofPreviewSrc(row.deliveryProofImage);
    if (row.deliveryAcknowledgedAt) return;
    try {
      setAcknowledgingId(row.id);
      await api.markDeliveryAcknowledged(row.id);
      const ackedAt = new Date().toISOString();
      setHistoryRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, deliveryAcknowledgedAt: ackedAt } : r))
      );
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "บันทึกการรับทราบไม่สำเร็จ");
    } finally {
      setAcknowledgingId(null);
    }
  }

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

  const loadHistory = useCallback(async () => {
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const { orders } = await api.deliveryHistory(historyMonth, historyYear);
      setHistoryRows(orders || []);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "โหลดประวัติการจัดส่งไม่สำเร็จ");
    } finally {
      setHistoryLoading(false);
    }
  }, [historyMonth, historyYear]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

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
        จัดส่ง
      </h2>
      <p style={{ fontSize: 14, color: "#636366", marginBottom: 16, maxWidth: 560 }}>
        ดูประวัติการจัดส่งและหลักฐานการส่งถึงลูกค้า พร้อมตั้งค่าขนส่งตามระยะทาง
      </p>

      <section className="owner-delivery-history">
        <div className="owner-delivery-history__head">
          <div>
            <h3 className="owner-dash__h3">ประวัติการจัดส่ง</h3>
            <p className="owner-delivery-history__intro">
              ดูรายการที่จัดส่งสำเร็จแล้ว พร้อมรูปหลักฐานการส่งถึงลูกค้า
            </p>
          </div>
          <button
            type="button"
            className="owner-dash__btn-primary owner-dash__btn-primary--fit"
            onClick={() => void loadHistory()}
            disabled={historyLoading}
          >
            {historyLoading ? "กำลังโหลด…" : "รีเฟรช"}
          </button>
        </div>

        <div className="owner-delivery-history__filters">
          <label className="owner-delivery-history__filter">
            <span>เดือนที่ส่ง</span>
            <select value={historyMonth} onChange={(e) => setHistoryMonth(Number(e.target.value))}>
              {MONTH_OPTIONS.map((month) => (
                <option key={month} value={month}>
                  {new Date(Date.UTC(2026, month - 1, 1)).toLocaleDateString("th-TH", { month: "long" })}
                </option>
              ))}
            </select>
          </label>
          <label className="owner-delivery-history__filter">
            <span>ปี</span>
            <input
              type="number"
              min={2000}
              max={2100}
              value={historyYear}
              onChange={(e) => setHistoryYear(Math.max(2000, Math.min(2100, Number(e.target.value) || now.getFullYear())))}
            />
          </label>
        </div>

        {historyError ? (
          <div className="owner-dash__card" style={{ borderLeft: "4px solid #c62828", marginBottom: 12 }}>
            {historyError}
          </div>
        ) : null}

        {historyLoading ? (
          <div className="owner-dash__card owner-dash__card--muted">
            <p style={{ margin: 0 }}>กำลังโหลดประวัติการจัดส่ง…</p>
          </div>
        ) : historyRows.length === 0 ? (
          <div className="owner-dash__card owner-dash__card--muted">
            <p style={{ margin: 0 }}>ยังไม่มีรายการจัดส่งสำเร็จในเดือนนี้</p>
          </div>
        ) : (
          <div className="owner-delivery-history__list">
            {historyRows.map((row) => {
              const acknowledged = !!row.deliveryAcknowledgedAt;
              const needsAck = !!row.deliveryProofImage && !acknowledged;
              return (
              <article
                key={row.id}
                className={`owner-delivery-history__card${acknowledged ? " owner-delivery-history__card--acknowledged" : ""}`}
              >
                <div className="owner-delivery-history__card-head">
                  <div>
                    <div className="owner-delivery-history__order">
                      {row.orderNumber}
                      {needsAck ? (
                        <span
                          className="owner-delivery-history__ack-dot"
                          aria-label="ยังไม่ได้ดูหลักฐาน"
                          title="ยังไม่ได้ดูหลักฐาน"
                        />
                      ) : null}
                    </div>
                    <div className="owner-delivery-history__date">
                      <CalendarDays size={14} strokeWidth={2} aria-hidden />
                      ส่งเมื่อ {formatDateTh(row.deliveryCompletedAt)}
                    </div>
                  </div>
                  <div className="owner-delivery-history__total">{formatMoney(row.totalPrice)}</div>
                </div>

                <div className="owner-delivery-history__meta">
                  <div>
                    <User size={14} strokeWidth={2} aria-hidden />
                    {row.customerName?.trim() || "—"}
                  </div>
                  <div>
                    <Phone size={14} strokeWidth={2} aria-hidden />
                    {row.customerPhone?.trim() ? (
                      <a href={`tel:${row.customerPhone.replace(/\s/g, "")}`}>{row.customerPhone.trim()}</a>
                    ) : "—"}
                  </div>
                  <div>
                    <MapPin size={14} strokeWidth={2} aria-hidden />
                    <span>{row.deliveryAddress?.trim() || "—"}</span>
                  </div>
                  <div>
                    <Package size={14} strokeWidth={2} aria-hidden />
                    <span>{itemSummary(row)}</span>
                  </div>
                </div>

                <div className="owner-delivery-history__actions">
                  {row.deliveryProofImage ? (
                    <button
                      type="button"
                      className="owner-delivery-history__proof-btn"
                      onClick={() => void viewProofAndAcknowledge(row)}
                      disabled={acknowledgingId === row.id}
                    >
                      <Eye size={16} strokeWidth={2} aria-hidden />
                      ดูหลักฐานการส่ง
                    </button>
                  ) : (
                    <span className="owner-delivery-history__missing-proof">ไม่มีรูปหลักฐาน</span>
                  )}
                  {row.deliveryProofImage ? (
                    <span
                      className={`owner-delivery-history__ack-badge${acknowledged ? " owner-delivery-history__ack-badge--done" : ""}`}
                    >
                      {acknowledged ? "รับทราบแล้ว" : "ยังไม่ได้รับทราบ"}
                    </span>
                  ) : null}
                  <span className="owner-delivery-history__sale-date">
                    วันที่ขาย {formatDateTh(row.saleDate)}
                  </span>
                </div>
              </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="owner-delivery-fees-section">
        <h3 className="owner-dash__h3">ค่าจัดส่งตามโซน (กม.)</h3>
        <p className="owner-delivery-history__intro">
          กำหนดราคาค่าขนส่งตามระยะทาง ตรงกับการคำนวณในระบบขายและมีผลกับรายการขายใหม่
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
            <div className="owner-dash__card owner-delivery-fees-card">
              <table className="owner-delivery-table">
                <thead>
                  <tr>
                    <th>โซน</th>
                    <th>ระยะทาง (กม.)</th>
                    <th>ค่าจัดส่ง (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((z) => (
                    <tr key={z.range}>
                      <td data-label="โซน" className="owner-delivery-table__zone">{z.range}</td>
                      <td data-label="ระยะทาง">
                        {z.minKm} – {z.maxKm >= 9999 ? "300+" : z.maxKm}
                      </td>
                      <td data-label="ค่าจัดส่ง">
                        <div className="owner-delivery-table__price">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            className="owner-delivery-table__input"
                            value={draft[z.range] ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, [z.range]: e.target.value }))}
                            aria-label={`ค่าจัดส่งโซน ${z.range}`}
                          />
                          <span className="owner-delivery-table__money">
                            ({formatMoney(Math.max(0, Math.round(Number(draft[z.range]) || 0)))})
                          </span>
                        </div>
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
      </section>

      <PaymentSlipLightbox imageSrc={proofPreviewSrc} onClose={() => setProofPreviewSrc(null)} />
    </div>
  );
}

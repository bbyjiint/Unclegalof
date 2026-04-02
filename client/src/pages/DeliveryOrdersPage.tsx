import { useEffect, useState } from "react";
import { CheckCircle2, MapPin, Phone, Truck, User } from "lucide-react";
import { api } from "../lib/api";
import { formatMoney } from "../data/constants";
import type { DeliveryOrderRow } from "../types";

function formatSaleDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

/** Renders plain text with http(s) URLs as clickable links (e.g. Google Maps). */
function DeliveryAddressText({ text }: { text: string | null | undefined }) {
  const t = text?.trim();
  if (!t) {
    return <>—</>;
  }
  const parts = t.split(/(https?:\/\/\S+)/g);
  return (
    <div style={{ fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </div>
  );
}

export default function DeliveryOrdersPage() {
  const [orders, setOrders] = useState<DeliveryOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const data = await api.deliveryOrders();
      setOrders(data.orders || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCompleteDelivery(id: string): Promise<void> {
    const ok = window.confirm("ยืนยันว่าจัดส่งถึงลูกค้าแล้ว? รายการนี้จะออกจากคิวจัดส่ง");
    if (!ok) {
      return;
    }
    setCompletingId(id);
    try {
      await api.completeDeliveryOrder(id);
      setOrders((prev) => prev.filter((row) => row.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <main className="wrap">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div className="h-with-icon" style={{ fontFamily: "Prompt", fontSize: 17, fontWeight: 700, color: "var(--dark)" }}>
          <Truck size={22} strokeWidth={2} aria-hidden />
          รายการจัดส่ง (ส่งถึงบ้าน)
        </div>
      </div>

      <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 14 }}>
        แสดงเฉพาะคิวที่ยังไม่ส่ง — กด &quot;จัดส่งสำเร็จ&quot; เมื่อส่งถึงลูกค้าแล้ว
      </p>

      {loading ? (
        <div className="card empty">
          <p>กำลังโหลด...</p>
        </div>
      ) : error ? (
        <div className="card empty">
          <p>{error}</p>
          <button type="button" className="btnok" onClick={() => void load()}>
            ลองอีกครั้ง
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="card empty">
          <p>ยังไม่มีรายการจัดส่ง</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {orders.map((o) => (
            <article key={o.id} className="card" style={{ margin: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--dark)" }}>{o.orderNumber}</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{formatSaleDate(o.saleDate)}</div>
                  {o.productName ? (
                    <div style={{ fontSize: 13, marginTop: 6, color: "var(--dark)" }}>{o.productName}</div>
                  ) : null}
                </div>
                <div style={{ fontWeight: 800, fontSize: 18, color: "var(--green)" }}>{formatMoney(o.totalPrice)}</div>
              </div>
              <hr style={{ border: "none", borderTop: "1px solid rgba(0,0,0,0.08)", margin: "12px 0" }} />
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <User size={16} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0, opacity: 0.7 }} aria-hidden />
                  <div>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)" }}>ชื่อ</div>
                    <div style={{ fontSize: 15 }}>{o.customerName?.trim() || "—"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Phone size={16} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0, opacity: 0.7 }} aria-hidden />
                  <div>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)" }}>โทรศัพท์</div>
                    <div style={{ fontSize: 15 }}>
                      {o.customerPhone?.trim() ? (
                        <a href={`tel:${o.customerPhone.replace(/\s/g, "")}`}>{o.customerPhone.trim()}</a>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <MapPin size={16} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0, opacity: 0.7 }} aria-hidden />
                  <div>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)" }}>ที่อยู่ / แผนที่</div>
                    <DeliveryAddressText text={o.deliveryAddress} />
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btnok"
                  disabled={completingId === o.id}
                  onClick={() => void handleCompleteDelivery(o.id)}
                >
                  <CheckCircle2 size={18} strokeWidth={2} aria-hidden />
                  {completingId === o.id ? "กำลังบันทึก..." : "จัดส่งสำเร็จ"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

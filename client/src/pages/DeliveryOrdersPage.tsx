import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, MapPin, MessageCircle, Phone, Table2, Truck, User, X } from "lucide-react";
import { api } from "../lib/api";
import { formatMoney } from "../data/constants";
import type { DeliveryOrderRow } from "../types";
import { PaymentSlipLightbox } from "../components/PaymentSlipLightbox";
import { uploadFileToR2 } from "../lib/upload";

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
    <div className="deliveries-page__addr">
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

type ProofState = {
  orderId: string;
  file: File | null;
  preview: string | null;
  uploading: boolean;
  warnNoPhoto: boolean;
};

export default function DeliveryOrdersPage() {
  const [orders, setOrders] = useState<DeliveryOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [proofState, setProofState] = useState<ProofState | null>(null);
  const [lineGroupNotice, setLineGroupNotice] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const lineReminderOkRef = useRef<HTMLButtonElement>(null);
  const proofFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (lineGroupNotice) {
      lineReminderOkRef.current?.focus();
    }
  }, [lineGroupNotice]);

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

  function openProofDialog(id: string): void {
    setProofState({ orderId: id, file: null, preview: null, uploading: false, warnNoPhoto: false });
  }

  function handleProofFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setProofState((prev) => prev ? { ...prev, file, preview, warnNoPhoto: false } : prev);
  }

  function clearProofFile(): void {
    if (proofState?.preview) URL.revokeObjectURL(proofState.preview);
    setProofState((prev) => prev ? { ...prev, file: null, preview: null, warnNoPhoto: false } : prev);
    if (proofFileInputRef.current) proofFileInputRef.current.value = "";
  }

  async function handleConfirmDelivery(): Promise<void> {
    if (!proofState?.file) {
      setProofState((prev) => prev ? { ...prev, warnNoPhoto: true } : prev);
      return;
    }
    const { orderId, file } = proofState;
    setProofState((prev) => prev ? { ...prev, uploading: true } : prev);
    setCompletingId(orderId);
    try {
      const proofImageUrl = await uploadFileToR2(file, "DELIVERY_PROOF");
      await api.completeDeliveryOrder(orderId, proofImageUrl);
      if (proofState?.preview) URL.revokeObjectURL(proofState.preview);
      setProofState(null);
      setOrders((prev) => prev.filter((row) => row.id !== orderId));
      setLineGroupNotice(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      setProofState((prev) => prev ? { ...prev, uploading: false } : prev);
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <main className="wrap deliveries-page">
      <div className="deliveries-page__head">
        <div className="h-with-icon deliveries-page__title">
          <Truck size={22} strokeWidth={2} aria-hidden />
          รายการจัดส่ง (ส่งถึงบ้าน)
        </div>
      </div>

      <p className="deliveries-page__intro">
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
        <div className="deliveries-page__list">
          {orders.map((o) => (
            <article key={o.id} className="del-card">
              {/* Header: order number + price */}
              <div className="del-card__header">
                <div>
                  <div className="del-card__order-num">{o.orderNumber}</div>
                  <div className="del-card__date">{formatSaleDate(o.saleDate)}</div>
                </div>
                <div className="del-card__price">{formatMoney(o.totalPrice)}</div>
              </div>

              <div className="del-card__divider" />

              {/* Customer info */}
              <div className="del-card__section">
                <div className="del-card__section-label">ข้อมูลลูกค้า</div>
                <div className="del-card__fields">
                  <div className="del-card__field-row">
                    <User size={15} strokeWidth={2} className="del-card__field-icon" aria-hidden />
                    <div className="del-card__field-value">{o.customerName?.trim() || "—"}</div>
                  </div>
                  <div className="del-card__field-row">
                    <Phone size={15} strokeWidth={2} className="del-card__field-icon" aria-hidden />
                    <div className="del-card__field-value">
                      {o.customerPhone?.trim() ? (
                        <a href={`tel:${o.customerPhone.replace(/\s/g, "")}`}>{o.customerPhone.trim()}</a>
                      ) : "—"}
                    </div>
                  </div>
                  <div className="del-card__field-row">
                    <MapPin size={15} strokeWidth={2} className="del-card__field-icon" aria-hidden />
                    <div className="del-card__field-value">
                      <DeliveryAddressText text={o.deliveryAddress} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="del-card__divider" />

              {/* Product info */}
              <div className="del-card__section">
                <div className="del-card__section-label">ข้อมูลสินค้า</div>
                <div className="deliveries-page__items-inner">
                  {(o.items?.length ?? 0) > 0 ? (
                    o.items!.map((item) => {
                      const photos = item.deskPhotos || [];
                      return (
                        <div key={item.id} className="del-card__item-row">
                          <div className="del-card__item-name">
                            <Table2 size={15} strokeWidth={2} style={{ color: "#64748b", flexShrink: 0 }} aria-hidden />
                            {item.type} x {item.qty}
                          </div>
                          {photos.length > 0 ? (
                            <button type="button" className="del-card__photo-btn" onClick={() => setLightbox({ images: photos, index: 0 })}>
                              ดูรูปโต๊ะ ({photos.length})
                            </button>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="del-card__item-row">
                      <div className="del-card__item-name">
                        <Table2 size={15} strokeWidth={2} style={{ color: "#64748b", flexShrink: 0 }} aria-hidden />
                        {o.productName || "—"}
                      </div>
                      {(o.deskPhotos?.length ?? 0) > 0 ? (
                        <button type="button" className="del-card__photo-btn" onClick={() => setLightbox({ images: o.deskPhotos!, index: 0 })}>
                          ดูรูปโต๊ะ ({o.deskPhotos!.length})
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {/* Complete button — full width, flush to card bottom */}
              <button
                type="button"
                className="del-card__complete-btn"
                disabled={completingId === o.id}
                onClick={() => openProofDialog(o.id)}
              >
                <Camera size={18} strokeWidth={2} aria-hidden />
                {completingId === o.id ? "กำลังบันทึก..." : "จัดส่งสำเร็จ"}
              </button>
            </article>
          ))}
        </div>
      )}

      {lineGroupNotice ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="line-reminder-title"
            className="card"
            style={{ maxWidth: 400, width: "100%", margin: 0 }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
              <MessageCircle size={24} strokeWidth={2} aria-hidden style={{ flexShrink: 0, color: "var(--green)", marginTop: 2 }} />
              <p id="line-reminder-title" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--dark)", lineHeight: 1.4 }}>
                ส่งลงไลน์กลุ่มด้วย
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                ref={lineReminderOkRef}
                type="button"
                className="btnok"
                onClick={() => setLineGroupNotice(false)}
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <PaymentSlipLightbox
        imageSources={lightbox?.images}
        initialIndex={lightbox?.index ?? 0}
        onClose={() => setLightbox(null)}
      />

      {proofState ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="proof-dialog-title"
            className="card"
            style={{ maxWidth: 420, width: "100%", margin: 0 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p id="proof-dialog-title" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--dark)" }}>
                ถ่ายรูปหลักฐานการส่ง
              </p>
              <button
                type="button"
                onClick={() => { if (proofState.preview) URL.revokeObjectURL(proofState.preview); setProofState(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--muted)" }}
                aria-label="ปิด"
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 14px" }}>
              กรุณาถ่ายรูปหน้าประตูหรือจุดวางสินค้าเพื่อเป็นหลักฐาน ก่อนกด &quot;ยืนยันจัดส่ง&quot;
            </p>

            {/* Hidden file input — shared between upload zone and "เปลี่ยนรูป" button */}
            <input
              ref={proofFileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={handleProofFileChange}
            />

            {proofState.preview ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ position: "relative" }}>
                  <img
                    src={proofState.preview}
                    alt="ตัวอย่างรูปหลักฐาน"
                    style={{ width: "100%", borderRadius: 10, maxHeight: 280, objectFit: "cover", display: "block" }}
                  />
                  <button
                    type="button"
                    onClick={clearProofFile}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      background: "rgba(0,0,0,0.6)",
                      border: "none",
                      borderRadius: "50%",
                      width: 32,
                      height: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "#fff",
                    }}
                    aria-label="ลบรูปที่เลือก"
                    disabled={proofState.uploading}
                  >
                    <X size={16} />
                  </button>
                </div>
                {/* Prominent replace button below preview */}
                <button
                  type="button"
                  onClick={() => proofFileInputRef.current?.click()}
                  disabled={proofState.uploading}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    padding: "8px 0",
                    border: "1px solid #c7c7cc",
                    borderRadius: 8,
                    background: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "var(--muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Camera size={15} strokeWidth={2} aria-hidden />
                  เปลี่ยนรูป / ถ่ายใหม่
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => proofFileInputRef.current?.click()}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  width: "100%",
                  border: `2px dashed ${proofState.warnNoPhoto ? "#ff3b30" : "#c7c7cc"}`,
                  borderRadius: 10,
                  padding: "28px 16px",
                  marginBottom: 14,
                  cursor: "pointer",
                  background: "none",
                  color: proofState.warnNoPhoto ? "#ff3b30" : "var(--muted)",
                  fontSize: 14,
                  transition: "border-color 0.2s, color 0.2s",
                }}
              >
                <Camera size={32} strokeWidth={1.5} aria-hidden />
                แตะเพื่อถ่ายรูป / เลือกรูปจากคลัง
              </button>
            )}

            {proofState.warnNoPhoto && !proofState.file ? (
              <p
                role="alert"
                style={{
                  margin: "0 0 12px",
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "#fff1f0",
                  border: "1px solid #ffccc7",
                  color: "#cf1322",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                ⚠ กรุณาถ่ายรูปหลักฐานก่อนยืนยัน
              </p>
            ) : null}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #c7c7cc", background: "none", cursor: "pointer", fontSize: 14 }}
                onClick={() => { if (proofState.preview) URL.revokeObjectURL(proofState.preview); setProofState(null); }}
                disabled={proofState.uploading}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btnok"
                disabled={proofState.uploading}
                onClick={() => void handleConfirmDelivery()}
              >
                <CheckCircle2 size={18} strokeWidth={2} aria-hidden />
                {proofState.uploading ? "กำลังอัปโหลด..." : "ยืนยันจัดส่ง"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

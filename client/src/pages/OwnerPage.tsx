import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ClipboardList, PlusCircle, Tag, X } from "lucide-react";
import { PaymentSlipLightbox } from "../components/PaymentSlipLightbox";
import { formatMoney } from "../data/constants";
import { api } from "../lib/api";
import type { OwnerDashboard, PromotionAmountType } from "../types";

type PromotionFormState = {
  name: string;
  amountType: PromotionAmountType;
  amount: string;
};

export default function OwnerPage() {
  const now = new Date();
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month] = useState<number>(now.getMonth() + 1);
  const [year] = useState<number>(now.getFullYear());
  const [promoForm, setPromoForm] = useState<PromotionFormState>({ name: "", amountType: "fixed", amount: "" });
  const [updatingSaleId, setUpdatingSaleId] = useState<string | null>(null);
  const [slipPreviewSrc, setSlipPreviewSrc] = useState<string | null>(null);
  const closeSlipPreview = useCallback(() => setSlipPreviewSrc(null), []);

  async function loadPage(): Promise<void> {
    try {
      setError(null);
      const data = await api.ownerDashboard(month, year);
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    }
  }

  useEffect(() => {
    void loadPage();
  }, [month, year]);

  async function addPromo(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    const amt = Number(promoForm.amount);
    if (promoForm.amountType === "percent" && (amt < 0 || amt > 100)) {
      setError("ส่วนลดเปอร์เซ็นต์ต้องอยู่ระหว่าง 0–100");
      return;
    }
    try {
      await api.createPromotion({
        name: promoForm.name,
        amount: amt,
        amountType: promoForm.amountType,
        active: true
      });
      setPromoForm({ name: "", amountType: "fixed", amount: "" });
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เพิ่มโปรโมชั่นไม่สำเร็จ");
    }
  }

  async function togglePromo(id: string, active: boolean): Promise<void> {
    await api.togglePromotion(id, active);
    await loadPage();
  }

  async function deletePromo(id: string): Promise<void> {
    await api.deletePromotion(id);
    await loadPage();
  }

  async function confirmSalePaid(id: string): Promise<void> {
    try {
      setUpdatingSaleId(id);
      await api.updateSaleStatus(id, { status: "paid" });
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update payment status");
    } finally {
      setUpdatingSaleId(null);
    }
  }

  if (!dashboard) {
    return (
      <main className="owrap">
        <div className="empty"><p>{error || "กำลังโหลด..."}</p></div>
      </main>
    );
  }

  const summary = dashboard.summary || { income: 0, cost: 0, profit: 0, margin: 0 };
  const promotions = dashboard.promotions || [];
  const sales = dashboard.sales || [];

  return (
    <main className="owrap">
      {error && (
        <div className="card" style={{ marginBottom: 12, borderLeft: "4px solid var(--red)" }}>
          <strong>เกิดข้อผิดพลาด:</strong> {error}
        </div>
      )}
      <div className="sgrid">
        <div className="scard c1"><label>รายรับรวม</label><div className="val">{formatMoney(summary.income)}</div></div>
        <div className="scard c2"><label>ต้นทุนรวม</label><div className="val">{formatMoney(summary.cost)}</div></div>
        <div className="scard c3"><label>กำไรสุทธิ</label><div className="val">{formatMoney(summary.profit)}</div></div>
        <div className="scard c4"><label>Margin</label><div className="val">{Number(summary.margin || 0).toFixed(1)}%</div></div>
      </div>

      <section className="card">
        <h3 className="h-with-icon">
          <Tag size={20} strokeWidth={2} aria-hidden />
          จัดการโปรโมชั่น
        </h3>
        <form onSubmit={addPromo}>
          <div className="frow">
            <div className="fg">
              <label>ชื่อโปรโมชั่น</label>
              <input value={promoForm.name} onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })} required />
            </div>
            <div className="fg">
              <label>ประเภทส่วนลด</label>
              <select
                value={promoForm.amountType}
                onChange={(e) => setPromoForm({ ...promoForm, amountType: e.target.value as PromotionAmountType })}
              >
                <option value="fixed">จำนวนเงิน (บาท)</option>
                <option value="percent">เปอร์เซ็นต์ (%)</option>
              </select>
            </div>
            <div className="fg">
              <label>{promoForm.amountType === "percent" ? "เปอร์เซ็นต์ (0–100)" : "จำนวนเงิน (บาท)"}</label>
              <input
                type="number"
                min={0}
                max={promoForm.amountType === "percent" ? 100 : undefined}
                value={promoForm.amount}
                onChange={(e) => setPromoForm({ ...promoForm, amount: e.target.value })}
                required
              />
            </div>
          </div>
          <button className="btnok with-icon" type="submit">
            <PlusCircle size={18} strokeWidth={2} aria-hidden />
            เพิ่มโปรโมชั่น
          </button>
        </form>
        <div style={{ marginTop: 16 }}>
          {promotions.map((promo) => (
            <div key={promo.id} className="crow">
              <div className="crow-l">
                <div>
                  <div className="ctxt">{promo.name}</div>
                  <div className="csub">
                    {promo.amountType === "percent" ? `ลด ${promo.amount}%` : `ลด ${formatMoney(promo.amount)}`}
                  </div>
                </div>
              </div>
              <div className="promo-row-actions">
                <button
                  type="button"
                  role="switch"
                  aria-checked={promo.active}
                  className={`promo-toggle${promo.active ? " promo-toggle--on" : " promo-toggle--off"}`}
                  onClick={() => togglePromo(promo.id, !promo.active)}
                >
                  <span className="promo-toggle-text">{promo.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span>
                  <span className="promo-toggle-track" aria-hidden>
                    <span className="promo-toggle-knob" />
                  </span>
                </button>
                <button
                  type="button"
                  className="promo-del-x"
                  aria-label={`ลบโปรโมชั่น ${promo.name}`}
                  onClick={() => deletePromo(promo.id)}
                >
                  <X size={18} strokeWidth={2.5} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3 className="h-with-icon">
          <ClipboardList size={20} strokeWidth={2} aria-hidden />
          รายการขาย
        </h3>
        {sales.length === 0 ? (
          <div className="empty"><p>ไม่มีรายการ</p></div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>ออเดอร์</th>
                  <th>สินค้า</th>
                  <th>ชุด</th>
                  <th>ยอดรวม</th>
                  <th>สถานะ</th>
                  <th>สลิป/ยืนยัน</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td>{sale.orderNumber}</td>
                    <td>{sale.type}</td>
                    <td>{sale.qty}</td>
                    <td>{formatMoney(sale.grandTotal)}</td>
                    <td>{sale.payStatus}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                        {sale.paymentSlipImage ? (
                          <button
                            type="button"
                            className="btnok"
                            style={{ padding: "6px 12px", fontSize: 13 }}
                            onClick={() => {
                              setSlipPreviewSrc(sale.paymentSlipImage!);
                            }}
                          >
                            ดูสลิป
                          </button>
                        ) : (
                          <span style={{ opacity: 0.7 }}>ไม่มีสลิป</span>
                        )}
                        <button
                          type="button"
                          className="btnok"
                          disabled={sale.payStatus === "paid" || !sale.paymentSlipImage || updatingSaleId === sale.id}
                          onClick={() => {
                            void confirmSalePaid(sale.id);
                          }}
                        >
                          {sale.payStatus === "paid" ? "ชำระแล้ว" : updatingSaleId === sale.id ? "กำลังอัปเดต..." : "ยืนยันชำระ"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PaymentSlipLightbox imageSrc={slipPreviewSrc} onClose={closeSlipPreview} />
    </main>
  );
}

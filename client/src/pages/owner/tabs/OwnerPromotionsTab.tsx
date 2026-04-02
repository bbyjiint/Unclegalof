import { PlusCircle, X } from "lucide-react";
import type { FormEvent } from "react";
import type { PromotionAmountType } from "../../../types";
import { formatMoney } from "../../../data/constants";
import { useOwnerDashboard } from "../ownerDashboardContext";

export default function OwnerPromotionsTab() {
  const { promotions, promoForm, setPromoForm, addPromo, togglePromo, deletePromo } = useOwnerDashboard();

  return (
    <div className="owner-dash__panel">
      <h2 className="owner-dash__h2">โปรโมชั่น</h2>

      <div className="owner-dash__card">
        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            void addPromo(e);
          }}
        >
          <div className="owner-dash__filters">
            <div className="owner-dash__filter-group">
              <label htmlFor="promo-name">ชื่อโปรโมชั่น</label>
              <input
                id="promo-name"
                value={promoForm.name}
                onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })}
                required
              />
            </div>
            <div className="owner-dash__filter-group">
              <label htmlFor="promo-type">ประเภทส่วนลด</label>
              <select
                id="promo-type"
                value={promoForm.amountType}
                onChange={(e) =>
                  setPromoForm({ ...promoForm, amountType: e.target.value as PromotionAmountType })
                }
              >
                <option value="fixed">จำนวนเงิน (บาท)</option>
                <option value="percent">เปอร์เซ็นต์ (%)</option>
              </select>
            </div>
            <div className="owner-dash__filter-group">
              <label htmlFor="promo-amt">
                {promoForm.amountType === "percent" ? "เปอร์เซ็นต์ (0–100)" : "จำนวนเงิน (บาท)"}
              </label>
              <input
                id="promo-amt"
                type="number"
                min={0}
                max={promoForm.amountType === "percent" ? 100 : undefined}
                value={promoForm.amount}
                onChange={(e) => setPromoForm({ ...promoForm, amount: e.target.value })}
                required
              />
            </div>
          </div>
          <button type="submit" className="owner-dash__btn-primary owner-dash__btn-primary--fit" style={{ marginTop: 12 }}>
            <PlusCircle size={18} strokeWidth={2} aria-hidden />
            เพิ่มโปรโมชั่น
          </button>
        </form>
      </div>

      <div style={{ marginTop: 14 }}>
        {promotions.length === 0 ? (
          <div className="owner-dash__card owner-dash__card--muted">
            <p style={{ margin: 0, textAlign: "center", color: "#636366" }}>ยังไม่มีโปรโมชั่น</p>
          </div>
        ) : (
          promotions.map((promo) => (
            <div key={promo.id} className="owner-dash__card" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{promo.name}</div>
                  <div style={{ fontSize: 12, color: "#636366", marginTop: 4 }}>
                    {promo.amountType === "percent" ? `ลด ${promo.amount}%` : `ลด ${formatMoney(promo.amount)}`}
                  </div>
                </div>
                <div className="promo-row-actions">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={promo.active}
                    className={`promo-toggle${promo.active ? " promo-toggle--on" : " promo-toggle--off"}`}
                    onClick={() => void togglePromo(promo.id, !promo.active)}
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
                    onClick={() => void deletePromo(promo.id)}
                  >
                    <X size={18} strokeWidth={2.5} aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

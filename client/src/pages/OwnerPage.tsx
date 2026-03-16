import { useEffect, useState, type FormEvent } from "react";
import { formatMoney } from "../data/constants";
import { api } from "../lib/api";
import type { OwnerDashboard } from "../types";

type PromotionFormState = {
  name: string;
  amount: string;
};

export default function OwnerPage() {
  const now = new Date();
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [month] = useState<number>(now.getMonth() + 1);
  const [year] = useState<number>(now.getFullYear());
  const [promoForm, setPromoForm] = useState<PromotionFormState>({ name: "", amount: "" });

  async function loadPage(): Promise<void> {
    const data = await api.ownerDashboard(month, year);
    setDashboard(data);
  }

  useEffect(() => {
    void loadPage();
  }, [month, year]);

  async function addPromo(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await api.createPromotion({
      name: promoForm.name,
      amount: Number(promoForm.amount),
      active: true
    });
    setPromoForm({ name: "", amount: "" });
    await loadPage();
  }

  async function togglePromo(id: number, active: boolean): Promise<void> {
    await api.togglePromotion(id, active);
    await loadPage();
  }

  async function deletePromo(id: number): Promise<void> {
    await api.deletePromotion(id);
    await loadPage();
  }

  if (!dashboard) {
    return <main className="owrap"><div className="empty"><p>กำลังโหลด...</p></div></main>;
  }

  return (
    <main className="owrap">
      <div className="sgrid">
        <div className="scard c1"><label>รายรับรวม</label><div className="val">{formatMoney(dashboard.summary.income)}</div></div>
        <div className="scard c2"><label>ต้นทุนรวม</label><div className="val">{formatMoney(dashboard.summary.cost)}</div></div>
        <div className="scard c3"><label>กำไรสุทธิ</label><div className="val">{formatMoney(dashboard.summary.profit)}</div></div>
        <div className="scard c4"><label>Margin</label><div className="val">{dashboard.summary.margin.toFixed(1)}%</div></div>
      </div>

      <section className="card">
        <h3>🏷️ จัดการโปรโมชั่น</h3>
        <form onSubmit={addPromo}>
          <div className="frow">
            <div className="fg">
              <label>ชื่อโปรโมชั่น</label>
              <input value={promoForm.name} onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })} />
            </div>
            <div className="fg">
              <label>ส่วนลด</label>
              <input type="number" value={promoForm.amount} onChange={(e) => setPromoForm({ ...promoForm, amount: e.target.value })} />
            </div>
          </div>
          <button className="btnok" type="submit">➕ เพิ่มโปรโมชั่น</button>
        </form>
        <div style={{ marginTop: 16 }}>
          {dashboard.promotions.map((promo) => (
            <div key={promo.id} className="crow">
              <div className="crow-l">
                <div>
                  <div className="ctxt">{promo.name}</div>
                  <div className="csub">{formatMoney(promo.amount)}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => togglePromo(promo.id, !promo.active)}>
                  {promo.active ? "ปิด" : "เปิด"}
                </button>
                <button type="button" onClick={() => deletePromo(promo.id)}>ลบ</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>📋 รายการขาย</h3>
        {dashboard.sales.length === 0 ? (
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
                </tr>
              </thead>
              <tbody>
                {dashboard.sales.map((sale) => (
                  <tr key={sale.id}>
                    <td>{sale.orderNumber}</td>
                    <td>{sale.type}</td>
                    <td>{sale.qty}</td>
                    <td>{formatMoney(sale.grandTotal)}</td>
                    <td>{sale.payStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import type { InventoryMovement, InventorySummaryItem } from "../types";

type InventoryFormState = {
  type: string;
  qty: number;
  note: string;
};

export default function InventoryPage() {
  const [summary, setSummary] = useState<InventorySummaryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [form, setForm] = useState<InventoryFormState>({ type: "", qty: 1, note: "" });
  const [loading, setLoading] = useState<boolean>(true);

  async function loadPage(): Promise<void> {
    setLoading(true);
    try {
      const data = await api.inventorySummary();
      setSummary(data.summary || []);
      setMovements(data.movements || []);
      if (!form.type && data.summary?.[0]?.type) {
        setForm((current) => ({ ...current, type: data.summary[0].type }));
      }
    } catch (error) {
      console.error("Failed to load inventory:", error);
      alert(error instanceof Error ? error.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!form.type) {
      alert("Please select a product type");
      return;
    }
    try {
      await api.addInventoryStock({
        type: form.type,
        qty: Number(form.qty),
        note: form.note
      });
      setForm((current) => ({ ...current, qty: 1, note: "" }));
      await loadPage();
    } catch (error) {
      console.error("Failed to add inventory stock:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to add inventory stock";
      if (errorMessage.includes("501") || errorMessage.includes("not yet implemented")) {
        alert("Inventory feature is not yet fully implemented. The product list is shown for reference.");
      } else {
        alert(errorMessage);
      }
    }
  }

  return (
    <main className="owrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontFamily: "Prompt", fontSize: 17, fontWeight: 700, color: "var(--dark)" }}>📦 คลังสินค้า</div>
      </div>

      {loading ? (
        <div className="empty"><p>กำลังโหลด...</p></div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 18 }}>
            {summary.length === 0 ? (
              <div className="empty"><p>ไม่มีสินค้าในระบบ</p></div>
            ) : (
              summary.map((item) => (
                <div key={item.type} className="card" style={{ borderLeft: `4px solid ${item.qty <= 0 ? "var(--red)" : item.qty <= 1 ? "var(--gold)" : "var(--green)"}` }}>
                  <div style={{ fontSize: 12, color: "var(--gray)", fontWeight: 600 }}>{item.type}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                    <span style={{ fontFamily: "Prompt", fontSize: 26, fontWeight: 700 }}>{item.qty}</span>
                    <span style={{ fontSize: 11, color: "var(--gray)" }}>ชุด</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <form className="card" onSubmit={handleSubmit}>
            <h3>➕ รับสินค้าเข้าคลัง</h3>
            <div className="frow">
              <div className="fg">
                <label>ประเภทสินค้า</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required>
                  <option value="">-- เลือกประเภท --</option>
                  {summary.map((item) => (
                    <option key={item.type} value={item.type}>{item.type}</option>
                  ))}
                </select>
              </div>
              <div className="fg">
                <label>จำนวนที่รับเข้า</label>
                <input type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) || 1 })} required />
              </div>
            </div>
            <div className="frow s1">
              <div className="fg">
                <label>หมายเหตุ</label>
                <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
            <button className="btnok" type="submit" disabled={!form.type}>✅ บันทึกรับเข้า</button>
            {summary.length === 0 && (
              <p style={{ marginTop: 10, fontSize: 12, color: "var(--gray)" }}>
                Note: Inventory tracking models are not yet implemented. This page shows available products for reference.
              </p>
            )}
          </form>

          <section className="card">
            <h3>🕐 ประวัติการรับ/ขาย</h3>
            {movements.length === 0 ? (
              <div className="empty"><p>ยังไม่มีรายการ</p></div>
            ) : (
              movements.map((item) => (
                <div key={item.id} className="crow">
                  <div className="crow-l">
                    <div className="ctxt">{item.type}</div>
                    {item.note && <div className="csub">{item.note}</div>}
                  </div>
                  <div className="crow-r">
                    <span style={{ color: item.direction === "IN" ? "var(--green)" : "var(--red)" }}>
                      {item.direction === "IN" ? "+" : "-"}
                      {item.qty}
                    </span>
                  </div>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </main>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import type { RepairItem, RepairKind, RepairStatus } from "../types";

type RepairFormState = {
  type: string;
  qty: number;
  size: string;
  color: string;
  reason: string;
  kind: RepairKind;
  date: string;
};

export default function RepairPage() {
  const [items, setItems] = useState<RepairItem[]>([]);
  const [productTypes, setProductTypes] = useState<string[]>([]);
  const [form, setForm] = useState<RepairFormState>({
    type: "",
    qty: 1,
    size: "",
    color: "",
    reason: "",
    kind: "repair",
    date: new Date().toISOString().slice(0, 10)
  });

  async function loadProducts(): Promise<void> {
    try {
      const data = await api.getProducts();
      const types = data.items.map(item => item.name);
      setProductTypes(types);
      if (types.length > 0 && !form.type) {
        setForm((current) => ({ ...current, type: types[0] }));
      }
    } catch (error) {
      console.error("Failed to load products:", error);
    }
  }

  async function loadRepairs(): Promise<void> {
    try {
      const data = await api.repairs();
      setItems(data.items || []);
    } catch (error) {
      console.error("Failed to load repairs:", error);
    }
  }

  useEffect(() => {
    void loadProducts();
    void loadRepairs();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      await api.createRepair({
        ...form,
        qty: Number(form.qty)
      });
      setForm({
        type: productTypes[0] || "",
        qty: 1,
        size: "",
        color: "",
        reason: "",
        kind: "repair",
        date: new Date().toISOString().slice(0, 10)
      });
      await loadRepairs();
    } catch (error) {
      console.error("Failed to create repair:", error);
      alert(error instanceof Error ? error.message : "Failed to create repair");
    }
  }

  async function updateStatus(id: string, status: RepairStatus): Promise<void> {
    try {
      await api.updateRepairStatus(id, status);
      await loadRepairs();
    } catch (error) {
      console.error("Failed to update repair status:", error);
      alert(error instanceof Error ? error.message : "Failed to update repair status");
    }
  }

  async function deleteRepair(id: string): Promise<void> {
    try {
      await api.deleteRepair(id);
      await loadRepairs();
    } catch (error) {
      console.error("Failed to delete repair:", error);
      alert(error instanceof Error ? error.message : "Failed to delete repair");
    }
  }

  return (
    <main className="wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: "Prompt", fontSize: 17, fontWeight: 700, color: "var(--dark)" }}>🔧 สินค้ารอซ่อม / เคลม</div>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <h3>⚠️ แจ้งสินค้าซ่อม/เคลม</h3>
        <div className="frow">
          <div className="fg">
            <label>ประเภทสินค้า</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required>
              <option value="">-- เลือกประเภท --</option>
              {productTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div className="fg">
            <label>จำนวน</label>
            <input type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) || 1 })} required />
          </div>
        </div>
        <div className="frow">
          <div className="fg">
            <label>ขนาด / รุ่น</label>
            <input type="text" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
          </div>
          <div className="fg">
            <label>สี</label>
            <input type="text" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </div>
        </div>
        <div className="frow s1">
          <div className="fg">
            <label>สาเหตุ / อาการ</label>
            <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
          </div>
        </div>
        <div className="frow">
          <div className="fg">
            <label>ประเภท</label>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as RepairKind })}>
              <option value="repair">รอซ่อม</option>
              <option value="claim">รอเคลม</option>
            </select>
          </div>
          <div className="fg">
            <label>วันที่แจ้ง</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
        </div>
        <button className="btnok" type="submit" disabled={!form.type || !form.reason}>⚠️ บันทึกแจ้ง</button>
      </form>

      <section>
        {items.length === 0 ? (
          <div className="empty"><p>✅ ไม่มีสินค้ารอซ่อม/เคลม</p></div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="card">
              <h3>{item.type}</h3>
              <div className="sdetail">
                <span>📐 {item.size}</span>
                <span>🎨 {item.color}</span>
                <span>🔢 {item.qty} ชุด</span>
                <span>{item.status}</span>
              </div>
              <p style={{ marginTop: 10 }}>{item.reason}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {item.status === "open" && <button type="button" onClick={() => updateStatus(item.id, "inprogress")}>เริ่มซ่อม</button>}
                {item.status === "inprogress" && <button type="button" onClick={() => updateStatus(item.id, "done")}>ทำเสร็จ</button>}
                <button type="button" onClick={() => deleteRepair(item.id)}>ลบ</button>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

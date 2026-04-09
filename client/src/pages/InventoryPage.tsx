import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Clock, Package, Pencil, PlusCircle, Receipt, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import type { InventoryMovement, InventorySummaryItem, ProductItem } from "../types";

type InventoryFormState = {
  type: string;
  qty: number;
  note: string;
};

type ProductFormState = {
  name: string;
  onsitePrice: number;
  deliveryPrice: number;
};

type MovementEditFormState = {
  type: string;
  qty: number;
  note: string;
  reason: string;
};

export default function InventoryPage() {
  const [summary, setSummary] = useState<InventorySummaryItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [form, setForm] = useState<InventoryFormState>({ type: "", qty: 1, note: "" });
  const [productForm, setProductForm] = useState<ProductFormState>({ name: "", onsitePrice: 0, deliveryPrice: 0 });
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null);
  const [movementEditForm, setMovementEditForm] = useState<MovementEditFormState>({
    type: "",
    qty: 1,
    note: "",
    reason: "miscount",
  });
  const [loading, setLoading] = useState<boolean>(true);

  async function loadPage(): Promise<void> {
    setLoading(true);
    try {
      const [data, productData] = await Promise.all([
        api.inventorySummary(),
        api.inventoryProducts(),
      ]);
      setSummary(data.summary || []);
      setMovements(data.movements || []);
      setProducts(productData.items || []);
      if (!form.type && productData.items?.[0]?.name) {
        setForm((current) => ({ ...current, type: productData.items[0].name }));
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

  async function handleCreateProduct(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!productForm.name.trim()) {
      alert("Please enter product name");
      return;
    }

    try {
      await api.createInventoryProduct({
        name: productForm.name.trim(),
        onsitePrice: Number(productForm.onsitePrice),
        deliveryPrice: Number(productForm.deliveryPrice),
      });
      setProductForm({ name: "", onsitePrice: 0, deliveryPrice: 0 });
      setIsProductModalOpen(false);
      await loadPage();
    } catch (error) {
      console.error("Failed to create product:", error);
      alert(error instanceof Error ? error.message : "Failed to create product");
    }
  }

  async function handleEditProduct(product: ProductItem): Promise<void> {
    const name = window.prompt("ชื่อสินค้า", product.name);
    if (!name) return;

    const onsitePriceRaw = window.prompt("ราคาหน้าร้าน", String(product.onsitePrice));
    if (!onsitePriceRaw) return;

    const deliveryPriceRaw = window.prompt("ราคาส่ง", String(product.deliveryPrice));
    if (!deliveryPriceRaw) return;

    const onsitePrice = Number(onsitePriceRaw);
    const deliveryPrice = Number(deliveryPriceRaw);
    if (Number.isNaN(onsitePrice) || Number.isNaN(deliveryPrice) || onsitePrice < 0 || deliveryPrice < 0) {
      alert("Invalid price");
      return;
    }

    try {
      await api.updateInventoryProduct(product.id, {
        name: name.trim(),
        onsitePrice,
        deliveryPrice,
      });
      await loadPage();
    } catch (error) {
      console.error("Failed to update product:", error);
      alert(error instanceof Error ? error.message : "Failed to update product");
    }
  }

  async function handleDeleteProduct(product: ProductItem): Promise<void> {
    const confirmed = window.confirm(`Delete product "${product.name}" ?`);
    if (!confirmed) return;

    try {
      await api.deleteInventoryProduct(product.id);
      if (form.type === product.name) {
        setForm((current) => ({ ...current, type: "" }));
      }
      await loadPage();
    } catch (error) {
      console.error("Failed to delete product:", error);
      alert(error instanceof Error ? error.message : "Failed to delete product");
    }
  }

  function startEditMovement(movement: InventoryMovement): void {
    if (movement.direction !== "IN") return;
    setEditingMovementId(movement.id);
    setMovementEditForm({
      type: movement.type,
      qty: movement.qty,
      note: movement.note || "",
      reason: "miscount",
    });
  }

  function cancelEditMovement(): void {
    setEditingMovementId(null);
    setMovementEditForm({ type: "", qty: 1, note: "", reason: "miscount" });
  }

  async function submitEditMovement(movementId: string): Promise<void> {
    if (!movementEditForm.type.trim()) {
      alert("กรุณาเลือกประเภทสินค้า");
      return;
    }
    if (Number(movementEditForm.qty) <= 0) {
      alert("จำนวนต้องมากกว่า 0");
      return;
    }
    try {
      await api.updateInventoryMovement(movementId, {
        type: movementEditForm.type.trim(),
        qty: Number(movementEditForm.qty),
        note: movementEditForm.note,
        reason: movementEditForm.reason,
      });
      cancelEditMovement();
      await loadPage();
    } catch (error) {
      console.error("Failed to update movement:", error);
      alert(error instanceof Error ? error.message : "Failed to update movement");
    }
  }

  function getMovementPresentation(movement: InventoryMovement): {
    badgeLabel: string;
    badgeStyle: React.CSSProperties;
    secondaryText: string | null;
  } {
    const rawNote = String(movement.note || "").trim();
    const adjustmentMatch = rawNote.match(/^(inventory adjustment|adjustment)\s*:?\s*(.*)$/i);

    if (adjustmentMatch) {
      const reason = (adjustmentMatch[2] || "").trim();
      const isNegative = movement.direction === "OUT";
      return {
        badgeLabel: "Inventory Adjustment",
        badgeStyle: isNegative
          ? {
              background: "#fee2e2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
            }
          : {
              background: "#dcfce7",
              color: "#166534",
              border: "1px solid #bbf7d0",
            },
        secondaryText: reason ? `Reason: ${reason}` : "Reason: manual correction",
      };
    }

    if (/^sale(\s+order)?\s+/i.test(rawNote)) {
      return {
        badgeLabel: "Sale Order",
        badgeStyle: {
          background: "#dbeafe",
          color: "#1d4ed8",
          border: "1px solid #bfdbfe",
        },
        secondaryText: rawNote,
      };
    }

    return {
      badgeLabel: movement.direction === "IN" ? "Stock In" : "Stock Out",
      badgeStyle: {
        background: "#f1f5f9",
        color: "#475569",
        border: "1px solid #e2e8f0",
      },
      secondaryText: rawNote || null,
    };
  }

  return (
    <main className="owrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div className="h-with-icon" style={{ fontFamily: "Prompt", fontSize: 17, fontWeight: 700, color: "var(--dark)" }}>
          <Package size={22} strokeWidth={2} aria-hidden />
          คลังสินค้า
        </div>
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
            <h3 className="h-with-icon">
              <PlusCircle size={20} strokeWidth={2} aria-hidden />
              รับสินค้าเข้าคลัง
            </h3>
            <div className="frow">
              <div className="fg">
                <label>ประเภทสินค้า</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required>
                  <option value="">-- เลือกประเภท --</option>
                  {products.map((item) => (
                    <option key={item.id} value={item.name}>{item.name}</option>
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
            <button className="btnok" type="submit" disabled={!form.type}>
              <CheckCircle2 size={18} strokeWidth={2} aria-hidden />
              บันทึกรับเข้า
            </button>
            {products.length === 0 && (
              <p style={{ marginTop: 10, fontSize: 12, color: "var(--gray)" }}>
                เพิ่มสินค้าก่อน จึงจะรับเข้าสต็อกได้
              </p>
            )}
          </form>

          <section className="card">
            <h3 className="h-with-icon">
              <Clock size={20} strokeWidth={2} aria-hidden />
              ประวัติการรับ/ขาย
            </h3>
            {movements.length === 0 ? (
              <div className="empty"><p>ยังไม่มีรายการ</p></div>
            ) : (
              movements.map((item) => (
                <div key={item.id} style={{ borderBottom: "1px solid #e2e8f0", padding: "14px 2px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>{item.type}</div>
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span
                          style={{
                            ...getMovementPresentation(item).badgeStyle,
                            borderRadius: 9999,
                            padding: "2px 8px",
                            fontSize: 11,
                            fontWeight: 600,
                            lineHeight: 1.2,
                          }}
                        >
                          {getMovementPresentation(item).badgeLabel}
                        </span>
                        {getMovementPresentation(item).secondaryText && (
                          <span style={{ fontSize: 12, color: "#64748b" }}>{getMovementPresentation(item).secondaryText}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, minWidth: 120 }}>
                      <span
                        style={{
                          color: item.direction === "IN" ? "#166534" : "#b91c1c",
                          fontWeight: 700,
                          fontSize: 18,
                          minWidth: 56,
                          textAlign: "right",
                        }}
                      >
                        {item.direction === "IN" ? "+" : "-"}
                        {item.qty}
                      </span>
                      {item.direction === "IN" && (
                        <button
                          type="button"
                          className="crow-icon-btn"
                          aria-label="แก้ไขรายการรับเข้า"
                          title="แก้ไขรายการรับเข้า"
                          onClick={() => startEditMovement(item)}
                        >
                          <Pencil size={16} strokeWidth={2} aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                  {editingMovementId === item.id && (
                    <div className="card" style={{ marginTop: 8, marginBottom: 8, background: "#fafafa", border: "1px solid #eee" }}>
                      <div className="frow">
                        <div className="fg">
                          <label>ประเภทสินค้า</label>
                          <select
                            value={movementEditForm.type}
                            onChange={(e) => setMovementEditForm((current) => ({ ...current, type: e.target.value }))}
                          >
                            <option value="">-- เลือกประเภท --</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.name}>{product.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="fg">
                          <label>จำนวนรับเข้า</label>
                          <input
                            type="number"
                            min="1"
                            value={movementEditForm.qty}
                            onChange={(e) =>
                              setMovementEditForm((current) => ({
                                ...current,
                                qty: Number(e.target.value) || 1,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="frow s1">
                        <div className="fg">
                          <label>หมายเหตุ</label>
                          <input
                            type="text"
                            value={movementEditForm.note}
                            onChange={(e) => setMovementEditForm((current) => ({ ...current, note: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="frow s1">
                        <div className="fg">
                          <label>เหตุผลการปรับ</label>
                          <input
                            type="text"
                            value={movementEditForm.reason}
                            onChange={(e) => setMovementEditForm((current) => ({ ...current, reason: e.target.value }))}
                            placeholder="miscount"
                          />
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button type="button" className="btnwarn" onClick={cancelEditMovement}>ยกเลิก</button>
                        <button
                          type="button"
                          className="btnok btnok--fit"
                          onClick={() => {
                            void submitEditMovement(item.id);
                          }}
                        >
                          บันทึกการแก้ไข
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </section>

          <section className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <h3 className="h-with-icon" style={{ margin: 0 }}>
                <Receipt size={20} strokeWidth={2} aria-hidden />
                จัดการสินค้า
              </h3>
              <button
                type="button"
                className="btnok btnok--fit"
                onClick={() => setIsProductModalOpen(true)}
              >
                <PlusCircle size={18} strokeWidth={2} aria-hidden />
                เพิ่มสินค้า
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              {products.length === 0 ? (
                <div className="empty"><p>ยังไม่มีสินค้า</p></div>
              ) : (
                products.map((item) => (
                  <div key={item.id} className="crow">
                    <div className="crow-l">
                      <div className="ctxt">{item.name}</div>
                      <div className="csub">หน้าร้าน {item.onsitePrice} | ส่ง {item.deliveryPrice}</div>
                    </div>
                    <div className="crow-r" style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="crow-icon-btn"
                        aria-label="แก้ไข"
                        title="แก้ไข"
                        onClick={() => void handleEditProduct(item)}
                      >
                        <Pencil size={18} strokeWidth={2} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="crow-icon-btn"
                        aria-label="ลบ"
                        title="ลบ"
                        onClick={() => void handleDeleteProduct(item)}
                      >
                        <Trash2 size={18} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {isProductModalOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: 16,
              }}
              onClick={() => setIsProductModalOpen(false)}
            >
              <form
                className="card"
                onSubmit={handleCreateProduct}
                onClick={(e) => e.stopPropagation()}
                style={{ width: "min(560px, 100%)", margin: 0 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h3 className="h-with-icon" style={{ margin: 0 }}>
                    <PlusCircle size={20} strokeWidth={2} aria-hidden />
                    เพิ่มสินค้าใหม่
                  </h3>
                  <button
                    type="button"
                    className="btndel"
                    onClick={() => setIsProductModalOpen(false)}
                  >
                    ปิด
                  </button>
                </div>
                <div className="fg">
                  <label>ชื่อสินค้า</label>
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="frow">
                  <div className="fg">
                    <label>ราคาหน้าร้าน</label>
                    <input
                      type="number"
                      min="0"
                      value={productForm.onsitePrice}
                      onChange={(e) => setProductForm({ ...productForm, onsitePrice: Number(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div className="fg">
                    <label>ราคาส่ง</label>
                    <input
                      type="number"
                      min="0"
                      value={productForm.deliveryPrice}
                      onChange={(e) => setProductForm({ ...productForm, deliveryPrice: Number(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, gap: 8 }}>
                  <button type="button" className="btnwarn" onClick={() => setIsProductModalOpen(false)}>
                    ยกเลิก
                  </button>
                  <button className="btnok btnok--fit" type="submit">
                    <CheckCircle2 size={18} strokeWidth={2} aria-hidden />
                    บันทึกสินค้า
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </main>
  );
}

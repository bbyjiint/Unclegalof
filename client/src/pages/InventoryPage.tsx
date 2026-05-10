import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Clock, Package, Pencil, Plus, PlusCircle, Receipt, Scale, Trash2, X } from "lucide-react";
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

type ManualAdjustFormState = {
  direction: "IN" | "OUT";
  type: string;
  qty: number;
  reason: string;
};

function formatMovementDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

export default function InventoryPage() {
  const [summary, setSummary] = useState<InventorySummaryItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [form, setForm] = useState<InventoryFormState>({ type: "", qty: 1, note: "" });
  const [productForm, setProductForm] = useState<ProductFormState>({ name: "", onsitePrice: 0, deliveryPrice: 0 });
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null);
  const [movementEditForm, setMovementEditForm] = useState<MovementEditFormState>({
    type: "", qty: 1, note: "", reason: "miscount",
  });
  const [manualAdjustForm, setManualAdjustForm] = useState<ManualAdjustFormState>({
    direction: "IN", type: "", qty: 1, reason: "",
  });
  const [loading, setLoading] = useState(true);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

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
        setForm((c) => ({ ...c, type: productData.items[0].name }));
      }
      if (!manualAdjustForm.type && productData.items?.[0]?.name) {
        setManualAdjustForm((c) => ({ ...c, type: productData.items[0].name }));
      }
    } catch (error) {
      console.error("Failed to load inventory:", error);
      alert(error instanceof Error ? error.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPage(); }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!form.type) { alert("กรุณาเลือกประเภทสินค้า"); return; }
    try {
      await api.addInventoryStock({ type: form.type, qty: Number(form.qty), note: form.note });
      setForm((c) => ({ ...c, qty: 1, note: "" }));
      setReceiveOpen(false);
      await loadPage();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to add inventory stock";
      if (msg.includes("501") || msg.includes("not yet implemented")) {
        alert("Inventory feature is not yet fully implemented.");
      } else {
        alert(msg);
      }
    }
  }

  async function handleManualAdjust(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!manualAdjustForm.type.trim()) { alert("กรุณาเลือกประเภทสินค้า"); return; }
    const reason = manualAdjustForm.reason.trim();
    if (!reason) { alert("กรุณาระบุเหตุผล"); return; }
    const qty = Number(manualAdjustForm.qty);
    if (!Number.isFinite(qty) || qty < 1) { alert("จำนวนต้องเป็นตัวเลขบวก"); return; }
    const dirLabel = manualAdjustForm.direction === "IN" ? "เพิ่ม" : "ลด";
    if (!window.confirm(`ยืนยันปรับสต็อก: ${dirLabel} ${qty} ชุด (${manualAdjustForm.type.trim()})\nเหตุผล: ${reason}`)) return;
    try {
      await api.manualInventoryAdjust({ type: manualAdjustForm.type.trim(), direction: manualAdjustForm.direction, qty, reason });
      setManualAdjustForm((c) => ({ ...c, qty: 1, reason: "" }));
      await loadPage();
    } catch (error) {
      alert(error instanceof Error ? error.message : "บันทึกการปรับสต็อกไม่สำเร็จ");
    }
  }

  async function handleCreateProduct(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!productForm.name.trim()) { alert("กรุณากรอกชื่อสินค้า"); return; }
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
      alert("Invalid price"); return;
    }
    try {
      await api.updateInventoryProduct(product.id, { name: name.trim(), onsitePrice, deliveryPrice });
      await loadPage();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update product");
    }
  }

  async function handleDeleteProduct(product: ProductItem): Promise<void> {
    if (!window.confirm(`ลบสินค้า "${product.name}" ?`)) return;
    try {
      await api.deleteInventoryProduct(product.id);
      if (form.type === product.name) setForm((c) => ({ ...c, type: "" }));
      await loadPage();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete product");
    }
  }

  function startEditMovement(movement: InventoryMovement): void {
    if (movement.direction !== "IN") return;
    setEditingMovementId(movement.id);
    setMovementEditForm({ type: movement.type, qty: movement.qty, note: movement.note || "", reason: "miscount" });
  }

  function cancelEditMovement(): void {
    setEditingMovementId(null);
    setMovementEditForm({ type: "", qty: 1, note: "", reason: "miscount" });
  }

  async function submitEditMovement(movementId: string): Promise<void> {
    if (!movementEditForm.type.trim()) { alert("กรุณาเลือกประเภทสินค้า"); return; }
    if (Number(movementEditForm.qty) <= 0) { alert("จำนวนต้องมากกว่า 0"); return; }
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
      alert(error instanceof Error ? error.message : "Failed to update movement");
    }
  }

  function getMovementPresentation(movement: InventoryMovement): {
    badgeLabel: string;
    badgeClass: string;
    secondaryText: string | null;
  } {
    const rawNote = String(movement.note || "").trim();
    if (/^ปรับสต็อก/.test(rawNote)) {
      const isIn = movement.direction === "IN";
      return { badgeLabel: isIn ? "ปรับเพิ่มสต็อก" : "ปรับลดสต็อก", badgeClass: isIn ? "inv-bdg inv-bdg--green" : "inv-bdg inv-bdg--red", secondaryText: rawNote };
    }
    const adjMatch = rawNote.match(/^(inventory adjustment|adjustment)\s*:?\s*(.*)$/i);
    if (adjMatch) {
      const reason = (adjMatch[2] || "").trim();
      return { badgeLabel: "ปรับแก้รายการ", badgeClass: movement.direction === "OUT" ? "inv-bdg inv-bdg--red" : "inv-bdg inv-bdg--green", secondaryText: reason ? `เหตุผล: ${reason}` : "ปรับสต็อกจากการแก้รายการรับเข้า" };
    }
    if (/^sale(\s+order)?\s+/i.test(rawNote)) {
      return { badgeLabel: "ขายออก", badgeClass: "inv-bdg inv-bdg--blue", secondaryText: rawNote };
    }
    return { badgeLabel: movement.direction === "IN" ? "รับเข้าคลัง" : "ตัดออกคลัง", badgeClass: movement.direction === "IN" ? "inv-bdg inv-bdg--green" : "inv-bdg inv-bdg--gray", secondaryText: rawNote || null };
  }

  return (
    <main className="owrap inv-page">
      {/* Header */}
      <div className="inv-page__header">
        <div className="h-with-icon inv-page__title">
          <Package size={20} strokeWidth={2} aria-hidden />
          คลังสินค้า
        </div>
      </div>

      {loading ? (
        <div className="empty"><p>กำลังโหลด...</p></div>
      ) : (
        <>
          {/* 2×2 stat cards */}
          <div className="inv-stat-grid">
            {summary.length === 0 ? (
              <p style={{ gridColumn: "1/-1", fontSize: 13, color: "#64748b" }}>ไม่มีสินค้าในระบบ</p>
            ) : (
              summary.map((item) => (
                <div
                  key={item.type}
                  className={`inv-stat-card${item.qty <= 0 ? " inv-stat-card--empty" : item.qty <= 2 ? " inv-stat-card--low" : ""}`}
                >
                  <div className="inv-stat-card__label">{item.type}</div>
                  <div className="inv-stat-card__numrow">
                    <span className="inv-stat-card__num">{item.qty}</span>
                    <span className="inv-stat-card__unit">ชุด</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* History list */}
          <button type="button" className={`inv-adjust-toggle${historyExpanded ? " inv-hist-toggle--open" : ""}`} style={{ marginBottom: 0 }} onClick={() => setHistoryExpanded((v) => !v)}>
            <Clock size={15} strokeWidth={2} aria-hidden />
            ประวัติการรับ/ขาย
            {movements.length > 0 && <span style={{ marginLeft: 4, fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>{movements.length} รายการ</span>}
            <span className="inv-adjust-toggle__chevron" aria-hidden>{historyExpanded ? "▲" : "▼"}</span>
          </button>

          <div className="inv-hist-list" style={{ borderRadius: historyExpanded ? "0 0 12px 12px" : "0 0 12px 12px", marginBottom: 12 }}>
            {movements.length === 0 ? (
              <div className="empty" style={{ padding: "20px 0" }}><p>ยังไม่มีรายการ</p></div>
            ) : (
              (historyExpanded ? movements : movements.slice(0, 3)).map((item) => {
                const { badgeLabel, badgeClass, secondaryText } = getMovementPresentation(item);
                return (
                  <div key={item.id} className="inv-hist-item">
                    {editingMovementId === item.id ? (
                      <div className="inv-edit-inline">
                        <div className="frow">
                          <div className="fg">
                            <label>ประเภท</label>
                            <select value={movementEditForm.type} onChange={(e) => setMovementEditForm((c) => ({ ...c, type: e.target.value }))}>
                              <option value="">-- เลือก --</option>
                              {products.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                            </select>
                          </div>
                          <div className="fg">
                            <label>จำนวน</label>
                            <input type="number" min="1" value={movementEditForm.qty} onChange={(e) => setMovementEditForm((c) => ({ ...c, qty: Number(e.target.value) || 1 }))} />
                          </div>
                        </div>
                        <div className="fg" style={{ marginBottom: 6 }}>
                          <label>เหตุผล</label>
                          <input type="text" value={movementEditForm.reason} onChange={(e) => setMovementEditForm((c) => ({ ...c, reason: e.target.value }))} placeholder="เช่น นับผิด" />
                        </div>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button type="button" className="btnwarn" style={{ fontSize: 12, padding: "5px 10px" }} onClick={cancelEditMovement}>ยกเลิก</button>
                          <button type="button" className="btnok btnok--fit" style={{ fontSize: 12 }} onClick={() => { void submitEditMovement(item.id); }}>บันทึก</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="inv-hist-item__left">
                          <div className="inv-hist-item__type">{item.type}</div>
                          <div className="inv-hist-item__meta-row">
                            <span className={badgeClass}>{badgeLabel}</span>
                            {secondaryText && <span className="inv-hist-item__note">{secondaryText}</span>}
                          </div>
                          {item.createdAt ? <div className="inv-hist-item__date">{formatMovementDate(item.createdAt)}</div> : null}
                        </div>
                        <div className="inv-hist-item__right">
                          <span className={`inv-hist-item__qty ${item.direction === "IN" ? "inv-hist-item__qty--in" : "inv-hist-item__qty--out"}`}>
                            {item.direction === "IN" ? "+" : "−"}{item.qty}
                          </span>
                          {item.direction === "IN" && (
                            <button type="button" className="crow-icon-btn" aria-label="แก้ไข" title="แก้ไข" onClick={() => startEditMovement(item)}>
                              <Pencil size={14} strokeWidth={2} aria-hidden />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
            {!historyExpanded && movements.length > 3 && (
              <button
                type="button"
                className="stbl-see-all-btn"
                onClick={() => setHistoryExpanded(true)}
              >
                ดูทั้งหมด {movements.length} รายการ →
              </button>
            )}
          </div>

          {/* Manual adjust (collapsible) */}
          <div className="inv-adjust-section">
            <button type="button" className="inv-adjust-toggle" onClick={() => setAdjustOpen((v) => !v)}>
              <Scale size={15} strokeWidth={2} aria-hidden />
              แก้สต็อกเมื่อลงผิด
              <span className="inv-adjust-toggle__chevron" aria-hidden>{adjustOpen ? "▲" : "▼"}</span>
            </button>
            {adjustOpen ? (
              <form className="card inv-adjust-form" onSubmit={(e) => void handleManualAdjust(e)}>
                <div className="frow">
                  <div className="fg">
                    <label>ทิศทาง</label>
                    <select value={manualAdjustForm.direction} onChange={(e) => setManualAdjustForm((c) => ({ ...c, direction: e.target.value as "IN" | "OUT" }))}>
                      <option value="IN">เพิ่มสต็อก</option>
                      <option value="OUT">ลดสต็อก</option>
                    </select>
                  </div>
                  <div className="fg">
                    <label>ประเภทสินค้า</label>
                    <select value={manualAdjustForm.type} onChange={(e) => setManualAdjustForm((c) => ({ ...c, type: e.target.value }))} required>
                      <option value="">-- เลือกประเภท --</option>
                      {products.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="frow">
                  <div className="fg">
                    <label>จำนวน (ชุด)</label>
                    <input type="number" min={1} value={manualAdjustForm.qty} onChange={(e) => setManualAdjustForm((c) => ({ ...c, qty: Number(e.target.value) || 1 }))} required />
                  </div>
                  <div className="fg">
                    <label>เหตุผล</label>
                    <input type="text" value={manualAdjustForm.reason} onChange={(e) => setManualAdjustForm((c) => ({ ...c, reason: e.target.value }))} placeholder="เช่น นับซ้ำแล้วถูกต้อง" required />
                  </div>
                </div>
                <button className="btnok" type="submit" disabled={!manualAdjustForm.type} style={{ width: "100%" }}>บันทึกการปรับสต็อก</button>
              </form>
            ) : null}
          </div>

          {/* Product management — collapsible */}
          <div className="inv-adjust-section">
            <button type="button" className={`inv-adjust-toggle${productsOpen ? " inv-hist-toggle--open" : ""}`} onClick={() => setProductsOpen((v) => !v)}>
              <Receipt size={15} strokeWidth={2} aria-hidden />
              จัดการสินค้า
              <span className="inv-adjust-toggle__chevron" aria-hidden>{productsOpen ? "▲" : "▼"}</span>
            </button>
            {productsOpen ? (
              <div className="card" style={{ borderRadius: "0 0 10px 10px", borderTop: "none", marginTop: 0 }}>
                <button type="button" className="btnok btnok--fit" style={{ marginBottom: 10, fontSize: 12, padding: "6px 12px" }} onClick={() => setIsProductModalOpen(true)}>
                  <PlusCircle size={13} strokeWidth={2} aria-hidden />
                  เพิ่มสินค้า
                </button>
                {products.length === 0 ? (
                  <div className="empty"><p>ยังไม่มีสินค้า</p></div>
                ) : (
                  products.map((item) => (
                    <div key={item.id} className="crow">
                      <div className="crow-l">
                        <div className="ctxt">{item.name}</div>
                        <div className="csub">หน้าร้าน {item.onsitePrice} · ส่ง {item.deliveryPrice}</div>
                      </div>
                      <div className="crow-r" style={{ display: "flex", gap: 6 }}>
                        <button type="button" className="crow-icon-btn" aria-label="แก้ไข" onClick={() => void handleEditProduct(item)}><Pencil size={16} strokeWidth={2} aria-hidden /></button>
                        <button type="button" className="crow-icon-btn" aria-label="ลบ" onClick={() => void handleDeleteProduct(item)}><Trash2 size={16} strokeWidth={2} aria-hidden /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </>
      )}

      {/* FAB — opens receive form */}
      <button type="button" className="inv-fab" aria-label="รับสินค้าเข้าคลัง" onClick={() => setReceiveOpen(true)}>
        <Plus size={26} strokeWidth={2.5} aria-hidden />
      </button>

      {/* Receive form bottom sheet */}
      {receiveOpen && (
        <div className="inv-modal-backdrop" onClick={() => setReceiveOpen(false)}>
          <form className="inv-modal-sheet" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="inv-modal-sheet__header">
              <div className="inv-modal-sheet__title">
                <PlusCircle size={17} strokeWidth={2} aria-hidden />
                รับสินค้าเข้าคลัง
              </div>
              <button type="button" className="crow-icon-btn" aria-label="ปิด" onClick={() => setReceiveOpen(false)}>
                <X size={18} strokeWidth={2.5} aria-hidden />
              </button>
            </div>
            <div className="frow">
              <div className="fg">
                <label>ประเภทสินค้า</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required>
                  <option value="">-- เลือกประเภท --</option>
                  {products.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                </select>
              </div>
              <div className="fg">
                <label>จำนวนที่รับเข้า</label>
                <input type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) || 1 })} required />
              </div>
            </div>
            <div className="fg" style={{ marginBottom: 16 }}>
              <label>หมายเหตุ</label>
              <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <button className="btnok" type="submit" disabled={!form.type} style={{ width: "100%" }}>
              <CheckCircle2 size={17} strokeWidth={2} aria-hidden />
              บันทึกรับเข้า
            </button>
          </form>
        </div>
      )}

      {/* Add product modal */}
      {isProductModalOpen && (
        <div className="inv-product-modal-backdrop" onClick={() => setIsProductModalOpen(false)}>
          <form className="inv-product-modal-card" onSubmit={handleCreateProduct} onClick={(e) => e.stopPropagation()}>
            <div className="inv-modal-card__header">
              <div className="h-with-icon inv-section-title" style={{ margin: 0 }}>
                <PlusCircle size={16} strokeWidth={2} aria-hidden />
                เพิ่มสินค้าใหม่
              </div>
              <button type="button" className="crow-icon-btn" aria-label="ปิด" onClick={() => setIsProductModalOpen(false)}>
                <X size={18} strokeWidth={2.5} aria-hidden />
              </button>
            </div>
            <div className="fg" style={{ marginBottom: 8 }}>
              <label>ชื่อสินค้า</label>
              <input type="text" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required />
            </div>
            <div className="frow">
              <div className="fg">
                <label>ราคาหน้าร้าน</label>
                <input type="number" min="0" value={productForm.onsitePrice} onChange={(e) => setProductForm({ ...productForm, onsitePrice: Number(e.target.value) || 0 })} required />
              </div>
              <div className="fg">
                <label>ราคาส่ง</label>
                <input type="number" min="0" value={productForm.deliveryPrice} onChange={(e) => setProductForm({ ...productForm, deliveryPrice: Number(e.target.value) || 0 })} required />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button className="btnok btnok--fit" type="submit">
                <CheckCircle2 size={16} strokeWidth={2} aria-hidden />
                บันทึกสินค้า
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

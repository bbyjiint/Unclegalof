import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ClipboardList, PlusCircle, Tag, Truck, UserPlus, X } from "lucide-react";
import { PaymentSlipLightbox } from "../components/PaymentSlipLightbox";
import { formatMoney } from "../data/constants";
import { api } from "../lib/api";
import type {
  OwnerDashboard,
  PipelineItem,
  PipelinePriority,
  PipelineStatus,
  PromotionAmountType
} from "../types";

type PromotionFormState = {
  name: string;
  amountType: PromotionAmountType;
  amount: string;
};

type PipelineFormState = {
  deskItemId: string;
  qty: string;
  costEst: string;
  expectedDate: string;
  note: string;
  status: PipelineStatus;
  priority: PipelinePriority;
};

export default function OwnerPage() {
  const now = new Date();
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month] = useState<number>(now.getMonth() + 1);
  const [year] = useState<number>(now.getFullYear());
  const [promoForm, setPromoForm] = useState<PromotionFormState>({ name: "", amountType: "fixed", amount: "" });
  const [pipelineItems, setPipelineItems] = useState<PipelineItem[]>([]);
  const [catalogOptions, setCatalogOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [pipeForm, setPipeForm] = useState<PipelineFormState>({
    deskItemId: "",
    qty: "1",
    costEst: "0",
    expectedDate: "",
    note: "",
    status: "planned",
    priority: "normal"
  });
  const [updatingSaleId, setUpdatingSaleId] = useState<string | null>(null);
  const [slipPreviewSrc, setSlipPreviewSrc] = useState<string | null>(null);
  const closeSlipPreview = useCallback(() => setSlipPreviewSrc(null), []);
  const [staffForm, setStaffForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
  });
  const [staffMessage, setStaffMessage] = useState<string | null>(null);
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [staffModalOpen, setStaffModalOpen] = useState(false);

  async function loadPage(): Promise<void> {
    try {
      setError(null);
      const data = await api.ownerDashboard(month, year);
      setDashboard(data);
      try {
        const [pipe, products] = await Promise.all([api.pipeline(), api.getProducts()]);
        setPipelineItems(pipe.items || []);
        setCatalogOptions(products.items.map((p) => ({ id: p.id, name: p.name })));
        setPipeForm((current) => ({
          ...current,
          deskItemId: current.deskItemId || products.items[0]?.id || ""
        }));
      } catch (pipeErr) {
        setPipelineItems([]);
        setCatalogOptions([]);
        setError(pipeErr instanceof Error ? pipeErr.message : "โหลดแผนสั่งซื้อไม่สำเร็จ");
      }
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

  async function addPipeline(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    const qty = Number(pipeForm.qty);
    const costEst = Number(pipeForm.costEst);
    if (!pipeForm.deskItemId || Number.isNaN(qty) || qty < 1) {
      setError("เลือกสินค้าและจำนวนให้ครบ");
      return;
    }
    try {
      await api.createPipeline({
        deskItemId: pipeForm.deskItemId,
        qty,
        costEst: Number.isNaN(costEst) ? 0 : Math.max(0, costEst),
        date: pipeForm.expectedDate.trim()
          ? new Date(pipeForm.expectedDate).toISOString()
          : null,
        note: pipeForm.note.trim(),
        status: pipeForm.status,
        priority: pipeForm.priority
      });
      setPipeForm((current) => ({
        ...current,
        qty: "1",
        costEst: "0",
        expectedDate: "",
        note: ""
      }));
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เพิ่มแผนสั่งซื้อไม่สำเร็จ");
    }
  }

  async function updatePipelineRow(id: string, patch: Partial<{ status: PipelineStatus; priority: PipelinePriority }>): Promise<void> {
    try {
      setError(null);
      await api.updatePipeline(id, patch);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปเดตไม่สำเร็จ");
    }
  }

  async function removePipelineRow(id: string): Promise<void> {
    if (!window.confirm("ลบรายการนี้จากแผนสั่งซื้อ?")) {
      return;
    }
    try {
      setError(null);
      await api.deletePipeline(id);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    }
  }

  async function createStaffAccount(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setStaffMessage(null);
    if (!staffForm.fullName.trim() || !staffForm.email.trim() || staffForm.password.length < 8) {
      setError("กรอกชื่อ อีเมล และรหัสผ่านอย่างน้อย 8 ตัวอักษร");
      return;
    }
    try {
      setStaffSubmitting(true);
      await api.createStaff({
        fullName: staffForm.fullName.trim(),
        email: staffForm.email.trim(),
        password: staffForm.password,
        phone: staffForm.phone.trim() || undefined,
      });
      setStaffForm({ fullName: "", email: "", password: "", phone: "" });
      setStaffMessage("สร้างบัญชีพนักงานเรียบร้อยแล้ว");
      setStaffModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างบัญชีพนักงานไม่สำเร็จ");
    } finally {
      setStaffSubmitting(false);
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
          <UserPlus size={20} strokeWidth={2} aria-hidden />
          พนักงาน
        </h3>
        <p style={{ fontSize: 13, color: "var(--gray)", marginBottom: 12 }}>
          สร้างบัญชีให้พนักงานในสาขาของคุณ (ไม่มีการสมัครสมาชิกแบบสาธารณะ)
        </p>
        <button
          type="button"
          className="btnok with-icon btnok--fit"
          onClick={() => {
            setError(null);
            setStaffModalOpen(true);
          }}
        >
          <UserPlus size={18} strokeWidth={2} aria-hidden />
          + เพิ่มพนักงาน
        </button>
        {staffMessage ? (
          <div
            className="card"
            style={{ marginBottom: 12, borderLeft: "4px solid var(--green, #2e7d32)" }}
            role="status"
          >
            {staffMessage}
          </div>
        ) : null}
      </section>

      {staffModalOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-add-staff-title"
          onClick={() => {
            if (!staffSubmitting) {
              setStaffModalOpen(false);
            }
          }}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 id="owner-add-staff-title" className="h-with-icon">
                <UserPlus size={20} strokeWidth={2} aria-hidden />
                เพิ่มพนักงาน
              </h3>
              <button
                type="button"
                className="modal-close"
                aria-label="ปิดหน้าต่างเพิ่มพนักงาน"
                onClick={() => setStaffModalOpen(false)}
                disabled={staffSubmitting}
              >
                <X size={18} strokeWidth={2.5} aria-hidden />
              </button>
            </div>
            <form onSubmit={createStaffAccount}>
              <div className="frow">
                <div className="fg">
                  <label>ชื่อ–นามสกุล</label>
                  <input
                    value={staffForm.fullName}
                    onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                    autoComplete="name"
                    required
                    disabled={staffSubmitting}
                  />
                </div>
                <div className="fg">
                  <label>อีเมล (ใช้เข้าสู่ระบบ)</label>
                  <input
                    type="email"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    autoComplete="email"
                    required
                    disabled={staffSubmitting}
                  />
                </div>
              </div>
              <div className="frow">
                <div className="fg">
                  <label>รหัสผ่าน (อย่างน้อย 8 ตัว)</label>
                  <input
                    type="password"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    disabled={staffSubmitting}
                  />
                </div>
                <div className="fg">
                  <label>เบอร์โทร (ไม่บังคับ)</label>
                  <input
                    type="tel"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    autoComplete="tel"
                    disabled={staffSubmitting}
                  />
                </div>
              </div>
              <button className="btnok with-icon" type="submit" disabled={staffSubmitting}>
                <UserPlus size={18} strokeWidth={2} aria-hidden />
                {staffSubmitting ? "กำลังสร้าง…" : "สร้างบัญชีพนักงาน"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

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
          <Truck size={20} strokeWidth={2} aria-hidden />
          แผนสั่งซื้อ / สายการจัดหา
        </h3>
        <p style={{ fontSize: 13, color: "var(--gray)", marginBottom: 12 }}>
          ใช้ติดตามคำสั่งซื้อที่ยังไม่เข้าคลัง (คนละส่วนกับสต็อกจริงในหน้าคลัง)
        </p>
        <form onSubmit={addPipeline}>
          <div className="frow">
            <div className="fg">
              <label>สินค้า</label>
              <select
                value={pipeForm.deskItemId}
                onChange={(e) => setPipeForm({ ...pipeForm, deskItemId: e.target.value })}
                required
              >
                <option value="">-- เลือก --</option>
                {catalogOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="fg">
              <label>จำนวน</label>
              <input
                type="number"
                min={1}
                value={pipeForm.qty}
                onChange={(e) => setPipeForm({ ...pipeForm, qty: e.target.value })}
                required
              />
            </div>
            <div className="fg">
              <label>ต้นทุนประมาณ (บาท)</label>
              <input
                type="number"
                min={0}
                value={pipeForm.costEst}
                onChange={(e) => setPipeForm({ ...pipeForm, costEst: e.target.value })}
              />
            </div>
          </div>
          <div className="frow">
            <div className="fg">
              <label>คาดว่าถึง (ไม่บังคับ)</label>
              <input
                type="date"
                value={pipeForm.expectedDate}
                onChange={(e) => setPipeForm({ ...pipeForm, expectedDate: e.target.value })}
              />
            </div>
            <div className="fg">
              <label>สถานะ</label>
              <select
                value={pipeForm.status}
                onChange={(e) => setPipeForm({ ...pipeForm, status: e.target.value as PipelineStatus })}
              >
                <option value="planned">วางแผน</option>
                <option value="ordered">สั่งแล้ว</option>
                <option value="transit">ระหว่างจัดส่ง</option>
                <option value="arrived">ถึงแล้ว</option>
              </select>
            </div>
            <div className="fg">
              <label>ความเร่งด่วน</label>
              <select
                value={pipeForm.priority}
                onChange={(e) => setPipeForm({ ...pipeForm, priority: e.target.value as PipelinePriority })}
              >
                <option value="low">ต่ำ</option>
                <option value="normal">ปกติ</option>
                <option value="urgent">ด่วน</option>
              </select>
            </div>
          </div>
          <div className="fg" style={{ marginBottom: 12 }}>
            <label>หมายเหตุ</label>
            <input
              value={pipeForm.note}
              onChange={(e) => setPipeForm({ ...pipeForm, note: e.target.value })}
            />
          </div>
          <button className="btnok with-icon" type="submit">
            <PlusCircle size={18} strokeWidth={2} aria-hidden />
            เพิ่มรายการ
          </button>
        </form>

        <div style={{ marginTop: 16 }}>
          {pipelineItems.length === 0 ? (
            <div className="empty">
              <p>ยังไม่มีรายการแผนสั่งซื้อ</p>
            </div>
          ) : (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>สินค้า</th>
                    <th>จำนวน</th>
                    <th>ต้นทุนประมาณ</th>
                    <th>คาดถึง</th>
                    <th>สถานะ</th>
                    <th>ความสำคัญ</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pipelineItems.map((row) => (
                    <tr key={row.id}>
                      <td>{row.productName}</td>
                      <td>{row.qty}</td>
                      <td>{formatMoney(row.costEst)}</td>
                      <td>
                        {row.expectedDate
                          ? new Date(row.expectedDate).toLocaleDateString("th-TH")
                          : "—"}
                      </td>
                      <td>
                        <select
                          value={row.status}
                          onChange={(e) => {
                            void updatePipelineRow(row.id, { status: e.target.value as PipelineStatus });
                          }}
                        >
                          <option value="planned">วางแผน</option>
                          <option value="ordered">สั่งแล้ว</option>
                          <option value="transit">ระหว่างจัดส่ง</option>
                          <option value="arrived">ถึงแล้ว</option>
                        </select>
                      </td>
                      <td>
                        <select
                          value={row.priority}
                          onChange={(e) => {
                            void updatePipelineRow(row.id, { priority: e.target.value as PipelinePriority });
                          }}
                        >
                          <option value="low">ต่ำ</option>
                          <option value="normal">ปกติ</option>
                          <option value="urgent">ด่วน</option>
                        </select>
                      </td>
                      <td>
                        <button type="button" className="btndel" onClick={() => void removePipelineRow(row.id)}>
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

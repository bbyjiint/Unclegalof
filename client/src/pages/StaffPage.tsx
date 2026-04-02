import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ClipboardList,
  ImagePlus,
  MapPin,
  Package,
  PlusCircle,
  Save,
  Truck,
  Warehouse,
  Wallet,
  X
} from "lucide-react";
import { PaymentSlipLightbox } from "../components/PaymentSlipLightbox";
import { useAuth } from "../components/AuthProvider";
import { formatMoney, getZoneByKm } from "../data/constants";
import { api } from "../lib/api";
import { zoneForKm } from "../lib/deliveryZones";
import { formatPromoValueLabel, promoUnitDiscountBaht } from "../lib/promotions";
import { uploadFileToR2 } from "../lib/upload";
import type {
  DeliveryMode,
  DeliveryZoneRow,
  PayStatus,
  Promotion,
  Sale,
  SalesCommissionInsights
} from "../types";

type StaffFormState = {
  date: string;
  type: string;
  qty: number;
  price: number | "";
  pay: PayStatus;
  promoId: string;
  discount: number;
  manualDisc: number;
  manualReason: string;
  delivery: DeliveryMode;
  km: number | "";
  addr: string;
  deliveryAddress: string;
  note: string;
};

type Product = {
  id: string;
  name: string;
  onsitePrice: number;
  deliveryPrice: number;
};

const initialForm = (today: string): StaffFormState => ({
  date: today,
  type: "",
  qty: 1,
  price: "",
  pay: "pending",
  promoId: "",
  discount: 0,
  manualDisc: 0,
  manualReason: "",
  delivery: "selfpickup",
  km: "",
  addr: "",
  deliveryAddress: "",
  note: ""
});

export default function StaffPage() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const paymentSlipInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZoneRow[]>([]);
  const [commissionInsights, setCommissionInsights] = useState<SalesCommissionInsights | null>(null);
  const [uploadingSaleId, setUploadingSaleId] = useState<string | null>(null);
  const [slipPreviewSrc, setSlipPreviewSrc] = useState<string | null>(null);
  const closeSlipPreview = useCallback(() => setSlipPreviewSrc(null), []);
  const [form, setForm] = useState<StaffFormState>(initialForm(today));

  const selectedProduct = useMemo(
    () => products.find((product) => product.name === form.type) || null,
    [products, form.type]
  );

  const ICE_RATES: Record<string, number> = {
    "ลอฟขาเอียง": 100,
    "ลอฟขาตรง": 100,
    "แกรนิต": 100,
    "ทรงยู": 100,
    "1.5 เมตร": 400,
    "1.8 เมตร": 400,
  };

  async function loadPage(): Promise<void> {
    setLoading(true);
    try {
      const now = new Date();
      const [promoData, salesData, productsData, feesData, insightsData] = await Promise.all([
        api.promotions(),
        api.sales(now.getMonth() + 1, now.getFullYear()),
        api.getProducts(),
        api.deliveryFees().catch(() => ({ zones: [] as DeliveryZoneRow[] })),
        api.salesCommissionInsights().catch(() => ({ applies: false } as SalesCommissionInsights)),
      ]);
      setDeliveryZones(feesData.zones || []);
      setCommissionInsights(insightsData.applies ? insightsData : null);
      const nextProducts = productsData.items || [];
      setPromotions(promoData.items || []);
      setSales(salesData.items || []);
      setProducts(nextProducts);
      setForm((current) => {
        if (current.type || nextProducts.length === 0) {
          return current;
        }

        const firstProduct = nextProducts[0];
        return {
          ...current,
          type: firstProduct.name,
          price: current.delivery === "delivery" ? firstProduct.deliveryPrice : firstProduct.onsitePrice,
        };
      });
    } catch (error) {
      console.error("Failed to load page:", error);
      alert(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
  }, []);

  const unitDiscount = Number(form.discount || 0) + Number(form.manualDisc || 0);
  const unitNet = Math.max(0, Number(form.price || 0) - unitDiscount);
  const kmNum = Number(form.km || 0);
  const zone =
    form.delivery === "delivery"
      ? deliveryZones.length > 0
        ? zoneForKm(deliveryZones, kmNum)
        : getZoneByKm(kmNum)
      : null;
  const workerFee = form.delivery === "delivery" ? zone?.fee || 0 : (ICE_RATES[form.type] || 0) * Number(form.qty || 1);
  const grandTotal = unitNet * Number(form.qty || 1) + workerFee;

  useEffect(() => {
    if (!selectedProduct) {
      return;
    }

    setForm((current) => ({
      ...current,
      price: current.delivery === "delivery" ? selectedProduct.deliveryPrice : selectedProduct.onsitePrice,
    }));
  }, [selectedProduct, form.delivery]);

  useEffect(() => {
    const promo = promotions.find((p) => String(p.id) === String(form.promoId));
    if (!promo) {
      setForm((current) => ({ ...current, discount: 0 }));
      return;
    }
    const unitPrice = Number(form.price) || 0;
    const discount = promoUnitDiscountBaht(promo, unitPrice);
    setForm((current) => ({ ...current, discount }));
  }, [form.promoId, form.price, promotions]);

  const stats = useMemo(() => {
    const total = sales.reduce((sum, sale) => sum + Number(sale.grandTotal || 0), 0);
    return { total, count: sales.length };
  }, [sales]);

  function getPayStatusLabel(status: PayStatus): string {
    if (status === "paid") {
      return "ชำระแล้ว";
    }

    if (status === "deposit") {
      return "มัดจำแล้ว";
    }

    return "ค้างชำระ";
  }

  function handleProductChange(productName: string) {
    const product = products.find((item) => item.name === productName);

    setForm((current) => ({
      ...current,
      type: productName,
      price: product
        ? current.delivery === "delivery"
          ? product.deliveryPrice
          : product.onsitePrice
        : "",
    }));
  }

  function handleDeliveryChange(delivery: DeliveryMode) {
    setForm((current) => ({
      ...current,
      delivery,
      price: selectedProduct
        ? delivery === "delivery"
          ? selectedProduct.deliveryPrice
          : selectedProduct.onsitePrice
        : current.price,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (Number(form.manualDisc) > 0 && !form.manualReason.trim()) {
      alert("กรุณาระบุเหตุผลลดเพิ่ม");
      return;
    }

    if (form.delivery === "delivery") {
      if (!Number(form.km) || Number(form.km) <= 0) {
        alert("กรุณากรอกระยะทาง (กม.) สำหรับการจัดส่ง");
        return;
      }
      if (!form.addr.trim()) {
        alert("กรุณากรอกชื่อลูกค้าสำหรับการจัดส่ง");
        return;
      }
      if (!form.deliveryAddress.trim()) {
        alert("กรุณากรอกที่อยู่จัดส่ง");
        return;
      }
    }

    try {
      await api.createSale({
        date: form.date,
        type: form.type,
        qty: Number(form.qty),
        price: Number(form.price),
        pay: form.pay,
        discount: Number(form.discount),
        manualDisc: Number(form.manualDisc),
        manualReason: form.manualReason,
        delivery: form.delivery,
        km: form.delivery === "delivery" ? Number(form.km || 0) : null,
        zoneName: zone?.label || null,
        addr: form.addr,
        deliveryAddress: form.deliveryAddress,
        note: form.note,
        wFee: workerFee,
        wType: form.delivery === "delivery" ? "po" : "ice",
        promoId: form.promoId || null
      });
      setForm(initialForm(today));
      await loadPage();
    } catch (error) {
      console.error("Failed to create sale:", error);
      alert(error instanceof Error ? error.message : "Failed to create sale");
    }
  }

  async function handleDeleteSale(id: string): Promise<void> {
    try {
      await api.deleteSale(id);
      await loadPage();
    } catch (error) {
      console.error("Failed to delete sale:", error);
      alert(error instanceof Error ? error.message : "Failed to delete sale");
    }
  }

  async function handleRemovePaymentSlip(saleId: string): Promise<void> {
    const confirmed = window.confirm("ลบสลิปที่แนบไว้รายการนี้?");
    if (!confirmed) {
      return;
    }
    try {
      setUploadingSaleId(saleId);
      await api.removeSalePaymentSlip(saleId);
      await loadPage();
    } catch (error) {
      console.error("Failed to remove payment slip:", error);
      alert(error instanceof Error ? error.message : "Failed to remove payment slip");
    } finally {
      setUploadingSaleId(null);
    }
  }

  function openPaymentSlipPicker(saleId: string) {
    paymentSlipInputRefs.current[saleId]?.click();
  }

  async function handlePaymentSlipUpload(saleId: string, event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("กรุณาอัปโหลดไฟล์รูปภาพ");
      event.target.value = "";
      return;
    }

    try {
      setUploadingSaleId(saleId);
      const fileUrl = await uploadFileToR2(file, "PAYMENT_SLIP");
      await api.uploadSalePaymentSlip(saleId, { fileUrl });
      await loadPage();
    } catch (error) {
      console.error("Failed to upload payment slip:", error);
      alert(error instanceof Error ? error.message : "Failed to upload payment slip");
    } finally {
      setUploadingSaleId(null);
      event.target.value = "";
    }
  }

  return (
    <main className="wrap">
      {user?.role === "SALES" && commissionInsights ? (
        <section
          className="card"
          style={{
            marginBottom: 16,
            borderLeft: "4px solid #c9a227",
            background: "linear-gradient(180deg, #fffdf7 0%, #fff 100%)"
          }}
        >
          <h3 className="h-with-icon" style={{ fontSize: 16, marginBottom: 8 }}>
            <Wallet size={18} strokeWidth={2} aria-hidden />
            คอมมิชชั่น & โบนัส
          </h3>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#555" }}>
            โต๊ะเดือนนี้: <strong>{commissionInsights.monthlyUnitsSold ?? 0}</strong> ชุด · โต๊ะปีนี้:{" "}
            <strong>{commissionInsights.yearlyUnitsSold ?? 0}</strong> ชุด
            {commissionInsights.yearlyCurrentTier ? (
              <>
                {" "}
                · โบนัสปีที่ถึงแล้ว:{" "}
                <strong>{formatMoney(commissionInsights.yearlyCurrentTier.bonusBaht)}</strong>
              </>
            ) : null}
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.55, color: "#1c1c1e" }}>
            {(commissionInsights.encouragementLines ?? []).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="stats2">
        <div className="stat">
          <label>ยอดขายของคุณเดือนนี้</label>
          <div className="val">{formatMoney(stats.total)}</div>
        </div>
        <div className="stat gold">
          <label>จำนวนรายการของคุณ</label>
          <div className="val">{stats.count}</div>
        </div>
      </section>

      <form className="card" onSubmit={handleSubmit}>
        <h3 className="h-with-icon">
          <PlusCircle size={20} strokeWidth={2} aria-hidden />
          บันทึกการขาย
        </h3>
        <div className="frow">
          <div className="fg">
            <label>วันที่ขาย</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div className="fg">
            <label>ประเภทสินค้า</label>
            <select value={form.type} onChange={(e) => handleProductChange(e.target.value)} required>
              <option value="">-- เลือกประเภท --</option>
              {products.map((product) => <option key={product.id} value={product.name}>{product.name}</option>)}
            </select>
          </div>
        </div>

        <div className="frow">
          <div className="fg">
            <label>จำนวน (ชุด)</label>
            <input type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) || 1 })} required />
          </div>
          <div className="fg">
            <label>ราคาขาย (บาท)</label>
            <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value === "" ? "" : Number(e.target.value) })} required />
          </div>
        </div>

        <div className="frow">
          <div className="fg">
            <label>สถานะชำระเงิน</label>
            <select value={form.pay} onChange={(e) => setForm({ ...form, pay: e.target.value as PayStatus })}>
              <option value="paid">ชำระแล้ว</option>
              <option value="pending">ค้างชำระ</option>
              <option value="deposit">มัดจำแล้ว</option>
            </select>
          </div>
          <div className="fg">
            <label>โปรโมชั่น</label>
            <select value={form.promoId} onChange={(e) => setForm({ ...form, promoId: e.target.value })}>
              <option value="">— ไม่มีส่วนลด —</option>
              {promotions.filter((promo) => promo.active).map((promo) => (
                <option key={promo.id} value={promo.id}>
                  {promo.name} (ลด {formatPromoValueLabel(promo)})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="frow">
          <div className="fg">
            <label>ส่วนลดโปรโมชั่น</label>
            <input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) || 0 })} />
          </div>
          <div className="fg">
            <label>ลดเพิ่มโดยแอดมิน</label>
            <input type="number" value={form.manualDisc} onChange={(e) => setForm({ ...form, manualDisc: Number(e.target.value) || 0 })} />
          </div>
        </div>

        <div className="frow s1">
          <div className="fg">
            <label>เหตุผลลดเพิ่ม</label>
            <input
              type="text"
              value={form.manualReason}
              onChange={(e) => setForm({ ...form, manualReason: e.target.value })}
              required={Number(form.manualDisc) > 0}
            />
          </div>
        </div>

        <div className="dtoggle">
          <label>วิธีรับสินค้า</label>
          <div className="dopts">
            <button type="button" className={`dopt${form.delivery === "selfpickup" ? " sel" : ""}`} onClick={() => handleDeliveryChange("selfpickup")}>
              <Warehouse size={16} strokeWidth={2} aria-hidden />
              รับที่โกดัง
            </button>
            <button type="button" className={`dopt${form.delivery === "delivery" ? " sel" : ""}`} onClick={() => handleDeliveryChange("delivery")}>
              <Truck size={16} strokeWidth={2} aria-hidden />
              ส่งถึงบ้าน
            </button>
          </div>
        </div>

        {form.delivery === "delivery" && (
          <div className="delbox show">
            <div className="delbox-title">
              <MapPin size={14} strokeWidth={2} aria-hidden />
              ข้อมูลการจัดส่ง
            </div>
            <div className="frow">
              <div className="fg">
                <label>ระยะทาง (กม.)</label>
                <input
                  type="number"
                  min="1"
                  required={form.delivery === "delivery"}
                  value={form.km}
                  onChange={(e) => setForm({ ...form, km: e.target.value === "" ? "" : Number(e.target.value) })}
                />
              </div>
              <div className="fg">
                <label>ชื่อลูกค้า</label>
                <input
                  type="text"
                  required={form.delivery === "delivery"}
                  value={form.addr}
                  onChange={(e) => setForm({ ...form, addr: e.target.value })}
                  placeholder="ชื่อผู้รับ / ติดต่อ"
                />
              </div>
            </div>
            <div className="frow s1">
              <div className="fg">
                <label>ที่อยู่จัดส่ง</label>
                <textarea
                  required={form.delivery === "delivery"}
                  value={form.deliveryAddress}
                  onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
                  placeholder="บ้านเลขที่ ซอย ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
                  rows={3}
                />
              </div>
            </div>
            {zone && (
              <div className={`zone-result show ${zone.fee === 0 ? "free" : "zone"}`}>
                <span>{zone.label}</span>
                <span>{formatMoney(zone.fee)}</span>
              </div>
            )}
          </div>
        )}

        <div className="frow s1">
          <div className="fg">
            <label>หมายเหตุเพิ่มเติม</label>
            <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>

        <div className="card" style={{ background: "linear-gradient(135deg,var(--green),var(--green-light))", color: "white" }}>
          <h3 className="h-with-icon" style={{ color: "white" }}>
            <Wallet size={20} strokeWidth={2} aria-hidden />
            ยอดรวม
          </h3>
          <div className="crow">
            <div className="ctxt">ราคาสินค้าสุทธิ</div>
            <div className="crow-r">{formatMoney(unitNet * Number(form.qty || 1))}</div>
          </div>
          <div className="crow">
            <div className="ctxt">{form.delivery === "delivery" ? "ค่าจัดส่ง" : "ค่าแรงยก"}</div>
            <div className="crow-r">{formatMoney(workerFee)}</div>
          </div>
          <div className="crow">
            <div className="ctxt">รวมทั้งหมด</div>
            <div className="crow-r">{formatMoney(grandTotal)}</div>
          </div>
        </div>

        <button className="btnok" type="submit" disabled={!form.type || !form.price}>
          <Save size={18} strokeWidth={2} aria-hidden />
          บันทึกการขาย
        </button>
      </form>

      <section>
        <div className="slist-title with-icon">
          <ClipboardList size={16} strokeWidth={2} aria-hidden />
          รายการขายเดือนนี้
        </div>
        {loading ? (
          <div className="empty"><p>กำลังโหลด...</p></div>
        ) : sales.length === 0 ? (
          <div className="empty">
            <div className="ico" aria-hidden>
              <Package size={26} strokeWidth={1.75} />
            </div>
            <p>ยังไม่มีรายการขายของคุณในเดือนนี้</p>
          </div>
        ) : (
          sales.map((sale) => (
            <div key={sale.id} className={`sitem ${sale.delivery}`}>
              <div className="sitem-l">
                <div className="soid">{sale.orderNumber}</div>
                <div className="sdetail">
                  <span>{sale.type}</span>
                  <span>x{sale.qty}</span>
                  <span className={`bdg with-icon-sm ${sale.delivery === "delivery" ? "del" : "pick"}`}>
                    {sale.delivery === "delivery" ? (
                      <>
                        <Truck size={11} strokeWidth={2.5} aria-hidden />
                        ส่งบ้าน
                      </>
                    ) : (
                      <>
                        <Warehouse size={11} strokeWidth={2.5} aria-hidden />
                        รับเอง
                      </>
                    )}
                  </span>
                  <span className={`bdg ${sale.payStatus === "paid" ? "paid" : sale.payStatus === "deposit" ? "dep" : "pend"}`}>
                    {getPayStatusLabel(sale.payStatus)}
                  </span>
                </div>
                <div className="smeta" style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                  บันทึกโดย {sale.createdByName || sale.createdByUsername || "—"}
                  {sale.recordedAt
                    ? ` · ${new Date(sale.recordedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}`
                    : null}
                </div>
              </div>
              <div className="sitem-right">
                <div className="sprice">{formatMoney(sale.grandTotal)}</div>
                <div className="sale-actions sale-actions--staff-row">
                  <input
                    ref={(node) => {
                      paymentSlipInputRefs.current[sale.id] = node;
                    }}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      void handlePaymentSlipUpload(sale.id, event);
                    }}
                  />
                  <button
                    type="button"
                    className="sale-action-btn sale-action-btn--prominent"
                    onClick={() => openPaymentSlipPicker(sale.id)}
                    disabled={uploadingSaleId === sale.id}
                  >
                    {uploadingSaleId === sale.id ? (
                      "กำลังอัปโหลด..."
                    ) : sale.paymentSlipImage ? (
                      <>
                        <ImagePlus size={16} strokeWidth={2} aria-hidden />
                        อัปเดตสลิป
                      </>
                    ) : (
                      <>
                        <ImagePlus size={16} strokeWidth={2} aria-hidden />
                        แนบสลิปโอนเงิน
                      </>
                    )}
                  </button>
                  {sale.paymentSlipImage && (
                    <>
                      <button
                        type="button"
                        className="sale-slip-link sale-slip-link--staff"
                        onClick={() => setSlipPreviewSrc(sale.paymentSlipImage!)}
                      >
                        ดูสลิป
                      </button>
                      <button
                        type="button"
                        className="sale-slip-link sale-slip-link--staff"
                        onClick={() => {
                          void handleRemovePaymentSlip(sale.id);
                        }}
                        disabled={uploadingSaleId === sale.id}
                      >
                        ลบสลิป
                      </button>
                    </>
                  )}
                </div>
              </div>
              <button className="bdel" type="button" aria-label="ลบรายการ" onClick={() => handleDeleteSale(sale.id)}>
                <X size={16} strokeWidth={2.5} aria-hidden />
              </button>
            </div>
          ))
        )}
      </section>

      <PaymentSlipLightbox imageSrc={slipPreviewSrc} onClose={closeSlipPreview} />
    </main>
  );
}

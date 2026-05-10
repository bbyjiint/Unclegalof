import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  ClipboardList,
  FileUp,
  ImagePlus,
  MapPin,
  Plus,
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
import { formatMoney, getZoneByKm, lineWorkerLiftFee } from "../data/constants";
import { api } from "../lib/api";
import { zoneForKm } from "../lib/deliveryZones";
import { normalizeThaiMobile10Digits } from "../lib/thaiPhone";
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

function formatSaleDateThMedium(isoDate?: string | null): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("th-TH", { dateStyle: "medium" });
}

type StaffFormState = {
  date: string;
  items: StaffFormLine[];
  pay: PayStatus;
  promoId: string;
  discount: number;
  manualDisc: number;
  manualReason: string;
  delivery: DeliveryMode;
  km: number | "";
  addr: string;
  customerPhone: string;
  deliveryAddress: string;
  note: string;
};

type Product = {
  id: string;
  name: string;
  onsitePrice: number;
  deliveryPrice: number;
};

type StaffFormLine = {
  rowId: string;
  deskItemId: string;
  qty: number;
  price: number | "";
  photos: PendingSalePhoto[];
};

type PendingSalePhoto = {
  file: File;
  url: string;
};

type LightboxState = {
  images: string[];
  index: number;
};

type StaffView = "home" | "newOrder" | "salesList";

const MAX_SALE_PHOTOS = 4;
const SALE_PHOTO_BLOCK_START = "[SALE_PHOTOS]";
const SALE_PHOTO_BLOCK_END = "[/SALE_PHOTOS]";

function splitSaleNoteAndPhotos(rawNote?: string | null): { note: string; photos: string[] } {
  const source = String(rawNote ?? "");
  const start = source.indexOf(SALE_PHOTO_BLOCK_START);
  const end = source.indexOf(SALE_PHOTO_BLOCK_END);

  if (start === -1 || end === -1 || end < start) {
    return { note: source.trim(), photos: [] };
  }

  const visibleNote = `${source.slice(0, start)}${source.slice(end + SALE_PHOTO_BLOCK_END.length)}`.trim();
  const photoBlock = source
    .slice(start + SALE_PHOTO_BLOCK_START.length, end)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return { note: visibleNote, photos: photoBlock };
}

function buildSaleNotePayload(note: string, photos: string[]): string {
  const cleanNote = note.trim();
  const cleanPhotos = photos.map((photo) => photo.trim()).filter(Boolean);

  if (cleanPhotos.length === 0) {
    return cleanNote;
  }

  const parts = [cleanNote, SALE_PHOTO_BLOCK_START, ...cleanPhotos, SALE_PHOTO_BLOCK_END].filter(Boolean);
  return parts.join("\n");
}

function makeRowId(): string {
  return globalThis.crypto?.randomUUID?.() || `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createOrderLine(product?: Product, delivery: DeliveryMode = "delivery"): StaffFormLine {
  return {
    rowId: makeRowId(),
    deskItemId: product?.id || "",
    qty: 1,
    price: product ? (delivery === "delivery" ? product.deliveryPrice : product.onsitePrice) : "",
    photos: [],
  };
}

const initialForm = (today: string): StaffFormState => ({
  date: today,
  items: [],
  pay: "pending",
  promoId: "",
  discount: 0,
  manualDisc: 0,
  manualReason: "",
  delivery: "delivery",
  km: "",
  addr: "",
  customerPhone: "",
  deliveryAddress: "",
  note: ""
});

export default function StaffPage() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const paymentSlipInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const salePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZoneRow[]>([]);
  const [commissionInsights, setCommissionInsights] = useState<SalesCommissionInsights | null>(null);
  const [uploadingSaleId, setUploadingSaleId] = useState<string | null>(null);
  const [batchUploading, setBatchUploading] = useState<boolean>(false);
  const [selectedBatchSaleIds, setSelectedBatchSaleIds] = useState<string[]>([]);
  const [lightboxState, setLightboxState] = useState<LightboxState | null>(null);
  const closeSlipPreview = useCallback(() => setLightboxState(null), []);
  const batchSlipInputRef = useRef<HTMLInputElement | null>(null);
  const [newSalePhotos, setNewSalePhotos] = useState<PendingSalePhoto[]>([]);
  const newSalePhotosRef = useRef<PendingSalePhoto[]>([]);
  newSalePhotosRef.current = newSalePhotos;
  const [form, setForm] = useState<StaffFormState>(initialForm(today));
  const formRef = useRef<StaffFormState>(form);
  formRef.current = form;
  /** Picker: choose one desk type, then “add to order”. */
  const [pickDeskItemId, setPickDeskItemId] = useState<string>("");
  const [pickQty, setPickQty] = useState<number>(1);
  const [pickPrice, setPickPrice] = useState<number | "">("");
  const [view, setView] = useState<StaffView>("home");
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const hasPendingSalePhotos = newSalePhotos.length > 0;

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
      setPickDeskItemId((current) => (current || (nextProducts[0]?.id ?? "")));
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

  const pickProduct = useMemo(
    () => products.find((p) => p.id === pickDeskItemId) || null,
    [products, pickDeskItemId]
  );

  useEffect(() => {
    if (!pickProduct) {
      setPickPrice("");
      return;
    }
    setPickPrice(form.delivery === "delivery" ? pickProduct.deliveryPrice : pickProduct.onsitePrice);
  }, [pickProduct, form.delivery]);

  const lineItems = useMemo(
    () =>
      form.items.map((line) => ({
        ...line,
        product: products.find((product) => product.id === line.deskItemId) || null,
        lineBaseTotal: Math.max(0, Number(line.price || 0)) * Math.max(1, Number(line.qty || 1)),
      })),
    [form.items, products]
  );
  const subtotal = lineItems.reduce((sum, line) => sum + line.lineBaseTotal, 0);
  const kmNum = Number(form.km || 0);
  const zone =
    form.delivery === "delivery"
      ? deliveryZones.length > 0
        ? zoneForKm(deliveryZones, kmNum)
        : getZoneByKm(kmNum)
      : null;
  const workerFee = form.delivery === "delivery" ? zone?.fee || 0 : 0;
  const grandTotal = Math.max(0, subtotal - Number(form.discount || 0) - Number(form.manualDisc || 0) + workerFee);
  const workerLiftFeeTotal = lineItems.reduce(
    (sum, line) => sum + lineWorkerLiftFee(line.product?.name, Number(line.qty || 0), form.delivery),
    0
  );
  const workerDistanceFeeTotal = form.delivery === "delivery" ? workerFee : 0;
  const employeePayoutTotal = workerLiftFeeTotal + workerDistanceFeeTotal;
  const ownerNetTotal = Math.max(0, grandTotal - employeePayoutTotal);

  useEffect(() => {
    const promo = promotions.find((p) => String(p.id) === String(form.promoId));
    if (!promo) {
      setForm((current) => ({ ...current, discount: 0 }));
      return;
    }
    const discount = lineItems.reduce(
      (sum, line) =>
        sum +
        promoUnitDiscountBaht(promo, Number(line.price || 0)) * Math.max(1, Number(line.qty || 1)),
      0
    );
    setForm((current) => ({ ...current, discount }));
  }, [form.promoId, lineItems, promotions]);

  const stats = useMemo(() => {
    const total = sales.reduce((sum, sale) => sum + Number(sale.grandTotal || 0), 0);
    return { total, count: sales.length };
  }, [sales]);

  const batchEligibleSales = useMemo(
    () => sales.filter((sale) => sale.payStatus !== "paid" && !sale.paymentBatchId),
    [sales]
  );

  useEffect(() => {
    setSelectedBatchSaleIds((current) =>
      current.filter((id) => batchEligibleSales.some((sale) => sale.id === id))
    );
  }, [batchEligibleSales]);

  useEffect(() => {
    return () => {
      newSalePhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
      formRef.current.items.forEach((line) => line.photos.forEach((photo) => URL.revokeObjectURL(photo.url)));
    };
  }, []);

  function getPayStatusLabel(status: PayStatus): string {
    if (status === "paid") {
      return "ชำระแล้ว";
    }

    if (status === "deposit") {
      return "มัดจำแล้ว";
    }

    return "ค้างชำระ";
  }

  function addPickerToOrder(): void {
    if (!pickDeskItemId) {
      alert("กรุณาเลือกประเภทโต๊ะ");
      return;
    }
    if (!pickProduct) {
      alert("ไม่พบสินค้าที่เลือก");
      return;
    }
    if (Number(pickQty) < 1) {
      alert("จำนวนต้องอย่างน้อย 1 ชุด");
      return;
    }
    if (pickPrice === "" || Number(pickPrice) < 0) {
      alert("กรุณากรอกราคาขายต่อชุด");
      return;
    }
    const qtyAdd = Number(pickQty);
    const priceNum = Number(pickPrice);
    setForm((current) => {
      const photosForLine = newSalePhotos;
      const matchIdx = photosForLine.length === 0
        ? current.items.findIndex(
            (line) =>
              line.deskItemId === pickDeskItemId &&
              Number(line.price || 0) === priceNum &&
              line.photos.length === 0
          )
        : -1;
      if (matchIdx !== -1) {
        return {
          ...current,
          items: current.items.map((line, i) =>
            i === matchIdx ? { ...line, qty: line.qty + qtyAdd } : line
          ),
        };
      }
      const line = createOrderLine(pickProduct, current.delivery);
      line.qty = qtyAdd;
      line.price = priceNum;
      line.photos = photosForLine;
      return { ...current, items: [...current.items, line] };
    });
    setNewSalePhotos([]);
    setPickQty(1);
  }

  function removeLineItem(rowId: string) {
    setForm((current) => {
      const target = current.items.find((line) => line.rowId === rowId);
      target?.photos.forEach((photo) => URL.revokeObjectURL(photo.url));
      return {
        ...current,
        items: current.items.filter((line) => line.rowId !== rowId),
      };
    });
  }

  function handleDeliveryChange(delivery: DeliveryMode) {
    setForm((current) => ({
      ...current,
      delivery,
      items: current.items.map((line) => {
        const product = products.find((item) => item.id === line.deskItemId);
        return {
          ...line,
          price: product ? (delivery === "delivery" ? product.deliveryPrice : product.onsitePrice) : line.price,
        };
      }),
    }));
  }

  function openSalePhotoPicker(): void {
    salePhotoInputRef.current?.click();
  }

  function handleSalePhotosSelected(event: ChangeEvent<HTMLInputElement>): void {
    const picked = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    if (picked.length === 0) {
      return;
    }

    setNewSalePhotos((current) => {
      const remaining = Math.max(0, MAX_SALE_PHOTOS - current.length);
      if (remaining <= 0) {
        alert(`แนบได้สูงสุด ${MAX_SALE_PHOTOS} รูปต่อออเดอร์`);
        return current;
      }
      const nextPhotos = picked.slice(0, remaining).map((file) => ({
        file,
        url: URL.createObjectURL(file),
      }));
      return [...current, ...nextPhotos];
    });
  }

  function removeSalePhoto(index: number): void {
    setNewSalePhotos((current) => {
      const target = current[index];
      if (target) {
        URL.revokeObjectURL(target.url);
      }
      return current.filter((_, idx) => idx !== index);
    });
  }

  function openImageLightbox(images: string[], index = 0): void {
    const validImages = images.filter(Boolean);
    if (validImages.length === 0) {
      return;
    }
    setLightboxState({
      images: validImages,
      index: Math.max(0, Math.min(index, validImages.length - 1)),
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (Number(form.manualDisc) > 0 && !form.manualReason.trim()) {
      alert("กรุณาระบุเหตุผลลดเพิ่ม");
      return;
    }

    if (lineItems.length === 0) {
      alert("กรุณาเพิ่มสินค้าลงในออเดอร์อย่างน้อย 1 รายการ");
      return;
    }
    const invalidLine = lineItems.find(
      (line) => !line.deskItemId || Number(line.qty || 0) <= 0 || Number(line.price) < 0 || line.price === ""
    );
    if (invalidLine) {
      alert("กรุณาแก้รายการในออเดอร์ให้ครบ (จำนวนและราคา)");
      return;
    }

    let customerPhonePayload = "";
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
        alert("กรุณากรอกลิงค์กูเกิ้ลแมพหรือที่อยู่จัดส่ง");
        return;
      }
      const phoneNorm = normalizeThaiMobile10Digits(form.customerPhone);
      if (!phoneNorm) {
        alert("เบอร์โทรต้องเป็นตัวเลข 10 หลัก ขึ้นต้นด้วย 0 (เช่น 0812345678)");
        return;
      }
      customerPhonePayload = phoneNorm;
    }

    try {
      const linePhotoEntries = await Promise.all(
        lineItems.map(async (line) => ({
          rowId: line.rowId,
          urls:
            line.photos.length > 0
              ? await Promise.all(line.photos.map((photo) => uploadFileToR2(photo.file, "SALE_IMAGE")))
              : [],
        }))
      );
      const photoUrlsByRowId = new Map(linePhotoEntries.map((entry) => [entry.rowId, entry.urls]));

      await api.createSale({
        date: form.date,
        items: lineItems.map((line) => ({
          deskItemId: line.deskItemId,
          type: line.product?.name || "",
          qty: Number(line.qty),
          price: Number(line.price),
          deskPhotos: photoUrlsByRowId.get(line.rowId) || [],
        })),
        pay: form.pay,
        discount: Number(form.discount),
        manualDisc: Number(form.manualDisc),
        manualReason: form.manualReason,
        delivery: form.delivery,
        km: form.delivery === "delivery" ? Number(form.km || 0) : null,
        zoneName: zone?.label || null,
        addr: form.addr,
        customerPhone: customerPhonePayload,
        deliveryAddress: form.deliveryAddress,
        note: form.note.trim(),
        wFee: workerFee,
        wType: form.delivery === "delivery" ? "po" : "ice",
        promoId: form.promoId || null
      });
      form.items.forEach((line) => line.photos.forEach((photo) => URL.revokeObjectURL(photo.url)));
      newSalePhotos.forEach((photo) => URL.revokeObjectURL(photo.url));
      setNewSalePhotos([]);
      setForm(initialForm(today));
      setPickDeskItemId(products[0]?.id ?? "");
      setPickQty(1);
      await loadPage();
      setView("salesList");
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

  function toggleBatchSaleSelection(saleId: string, checked: boolean): void {
    setSelectedBatchSaleIds((current) => {
      if (checked) {
        if (current.includes(saleId)) return current;
        return [...current, saleId];
      }
      return current.filter((id) => id !== saleId);
    });
  }

  function openBatchSlipPicker(): void {
    if (selectedBatchSaleIds.length < 2) {
      alert("เลือกอย่างน้อย 2 ออเดอร์เพื่อแนบสลิปรวม");
      return;
    }
    batchSlipInputRef.current?.click();
  }

  async function handleBatchSlipUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("กรุณาอัปโหลดไฟล์รูปภาพ");
      event.target.value = "";
      return;
    }
    if (selectedBatchSaleIds.length < 2) {
      alert("เลือกอย่างน้อย 2 ออเดอร์ก่อนแนบสลิปรวม");
      event.target.value = "";
      return;
    }

    try {
      setBatchUploading(true);
      const fileUrl = await uploadFileToR2(file, "PAYMENT_SLIP");
      const response = await api.createBatchPayment({
        saleIds: selectedBatchSaleIds,
        fileUrl,
      });
      alert(
        `สร้างสลิปรวมสำเร็จ\nBatch: ${response.batch.batchNumber}\nรวม ${formatMoney(
          response.batch.totalAmount
        )}\nจำนวน ${response.batch.saleCount} ออเดอร์`
      );
      setSelectedBatchSaleIds([]);
      await loadPage();
    } catch (error) {
      console.error("Failed to create batch payment:", error);
      alert(error instanceof Error ? error.message : "Failed to create batch payment");
    } finally {
      setBatchUploading(false);
      event.target.value = "";
    }
  }

  return (
    <main className="wrap staff-page">
      {view !== "home" ? (
        <button type="button" className="staff-page-back-btn" onClick={() => setView("home")} aria-label="กลับหน้าหลัก">
          <ArrowLeft size={16} strokeWidth={2} aria-hidden />
          กลับหน้าหลัก
        </button>
      ) : null}

      {view === "home" ? (
        <>
          {user?.role === "SALES" && commissionInsights ? (
            <section
              className="card"
              style={{
                marginBottom: 10,
                borderLeft: "4px solid #c9a227",
                background: "linear-gradient(180deg, #fffdf7 0%, #fff 100%)"
              }}
            >
              <button
                type="button"
                className="staff-insights-toggle"
                onClick={() => setInsightsOpen((v) => !v)}
                aria-expanded={insightsOpen}
              >
                <span className="staff-insights-toggle__teaser">
                  <Wallet size={14} strokeWidth={2} aria-hidden style={{ marginRight: 5, verticalAlign: "middle" }} />
                  คอมมิชชั่น · เดือนนี้ {commissionInsights.monthlyUnitsSold ?? 0} ชุด
                  {commissionInsights.yearlyCurrentTier
                    ? ` · โบนัส ${formatMoney(commissionInsights.yearlyCurrentTier.bonusBaht)}`
                    : ""}
                </span>
                <ChevronDown
                  size={16}
                  strokeWidth={2}
                  aria-hidden
                  className={`staff-insights-toggle__chevron${insightsOpen ? " staff-insights-toggle__chevron--open" : ""}`}
                />
              </button>
              {insightsOpen ? (
                <div className="staff-insights-body">
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "#555" }}>
                    โต๊ะปีนี้: <strong>{commissionInsights.yearlyUnitsSold ?? 0}</strong> ชุด
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.55, color: "#1c1c1e" }}>
                    {(commissionInsights.encouragementLines ?? []).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
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

          <section className="staff-home-sales-link">
            <h3>รายการขายเดือนนี้</h3>
            <button type="button" onClick={() => setView("salesList")} aria-label="ไปหน้ารายการขายทั้งหมด">
              ทั้งหมด
            </button>
          </section>

          {/* Preview table — latest 10 orders */}
          {loading ? (
            <div className="empty" style={{ padding: "20px 0" }}><p>กำลังโหลด...</p></div>
          ) : sales.length === 0 ? (
            <div className="empty" style={{ padding: "20px 0" }}>
              <p>ยังไม่มีรายการขายในเดือนนี้</p>
            </div>
          ) : (
            <div className="stbl-wrap">
              <table className="stbl">
                <thead>
                  <tr>
                    <th className="stbl-th">คำสั่งซื้อ</th>
                    <th className="stbl-th">วันที่</th>
                    <th className="stbl-th stbl-th--r">ยอดรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.slice(0, 10).map((sale) => {
                    const isDelivery = sale.delivery === "delivery";
                    const isSelected = selectedSaleId === sale.id;
                    return (
                      <tr
                        key={sale.id}
                        className={`stbl-row ${isDelivery ? "stbl-row--del" : "stbl-row--pick"}${isSelected ? " stbl-row--active" : ""}`}
                        onClick={() => setSelectedSaleId(isSelected ? null : sale.id)}
                      >
                        <td className="stbl-td">
                          <span className="stbl-order-num">{sale.orderNumber}</span>
                        </td>
                        <td className="stbl-td stbl-td--date">
                          {formatSaleDateThMedium(sale.date)}
                        </td>
                        <td className="stbl-td stbl-td--total">
                          {formatMoney(sale.grandTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sales.length > 10 ? (
                <button
                  type="button"
                  className="stbl-see-all-btn"
                  onClick={() => setView("salesList")}
                >
                  ดูทั้งหมด {sales.length} รายการ →
                </button>
              ) : null}
            </div>
          )}
        </>
      ) : null}

      {view === "newOrder" ? (
      <form className="card staff-sale-form" onSubmit={handleSubmit}>
        <h3 className="h-with-icon">
          <PlusCircle size={20} strokeWidth={2} aria-hidden />
          บันทึกการขาย
        </h3>
        <div className="frow">
          <div className="fg">
            <label>วันที่ขาย</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
        </div>

        <div className="staff-order-picker">
          <div className="staff-order-picker__title">เลือกสินค้า</div>
          {/* Full-width product dropdown */}
          <div className="fg" style={{ marginBottom: 10 }}>
            <label>ประเภทโต๊ะ</label>
            <select
              value={pickDeskItemId}
              onChange={(e) => setPickDeskItemId(e.target.value)}
              disabled={products.length === 0}
            >
              <option value="">-- เลือกประเภท --</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
          {/* Qty + Price side by side */}
          <div className="frow frow--2col" style={{ marginBottom: 0 }}>
            <div className="fg">
              <label>จำนวน (ชุด)</label>
              <input
                type="number"
                min={1}
                value={pickQty}
                onChange={(e) => setPickQty(Number(e.target.value) || 1)}
                disabled={products.length === 0}
              />
            </div>
            <div className="fg">
              <label>ราคาต่อชุด (บาท)</label>
              <input
                type="number"
                value={pickPrice}
                readOnly
                tabIndex={-1}
                style={{ pointerEvents: "none", background: "#f8fafc", color: "#334155" }}
              />
            </div>
          </div>
          <div className="staff-order-picker__action">
            <button
              type="button"
              className="picker-add-btn"
              disabled={!pickDeskItemId || !pickProduct || pickPrice === "" || products.length === 0}
              onClick={addPickerToOrder}
            >
              <Plus size={16} strokeWidth={2.5} aria-hidden />
              เพิ่มลงในออเดอร์
            </button>
          </div>
          <div className="staff-order-picker__photos">
            <label className="staff-order-picker__photos-label">แนบรูปสินค้า/หน้างาน</label>
            <input
              ref={salePhotoInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={handleSalePhotosSelected}
            />
            {newSalePhotos.length === 0 ? (
              <button
                type="button"
                className="staff-order-picker__photos-placeholder"
                onClick={openSalePhotoPicker}
              >
                <Camera size={32} strokeWidth={1.5} className="staff-order-picker__photos-placeholder-icon" aria-hidden />
                <span className="staff-order-picker__photos-placeholder-text">เลือกรูป</span>
                <span className="staff-order-picker__photos-hint">แนบได้สูงสุด {MAX_SALE_PHOTOS} รูป สำหรับรูปสินค้า/หน้างาน</span>
              </button>
            ) : (
              <div className="staff-order-picker__photos-toolbar">
                <button
                  type="button"
                  className="sale-action-btn"
                  onClick={openSalePhotoPicker}
                  disabled={newSalePhotos.length >= MAX_SALE_PHOTOS}
                >
                  <ImagePlus size={16} strokeWidth={2} aria-hidden />
                  เพิ่มรูป ({newSalePhotos.length}/{MAX_SALE_PHOTOS})
                </button>
                <span className="staff-order-picker__photos-hint">
                  แนบได้สูงสุด {MAX_SALE_PHOTOS} รูป
                </span>
              </div>
            )}
            {newSalePhotos.length > 0 ? (
              <div className="staff-order-picker__photos-grid">
                {newSalePhotos.map((photo, index) => (
                  <div key={`${photo.file.name}-${index}`} className="staff-order-picker__photo-card">
                    <button
                      type="button"
                      onClick={() => openImageLightbox(newSalePhotos.map((item) => item.url), index)}
                      className="staff-order-picker__photo-preview-btn"
                      aria-label={`ดูรูปที่ ${index + 1}`}
                    >
                      <img
                        src={photo.url}
                        alt={`รูปออเดอร์ ${index + 1}`}
                        className="staff-order-picker__photo-img"
                      />
                    </button>
                    <button
                      type="button"
                      className="sale-slip-link sale-slip-link--staff staff-order-picker__photo-remove"
                      onClick={() => removeSalePhoto(index)}
                    >
                      ลบรูป
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="staff-order-cart">
          <h4 className="h-with-icon" style={{ fontSize: 14, marginBottom: 10 }}>
            <ClipboardList size={16} strokeWidth={2} aria-hidden />
            รายการในออเดอร์ ({form.items.length})
          </h4>
          {form.items.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              ยังไม่มีสินค้า — เลือกโต๊ะด้านบนแล้วกด “เพิ่มลงในออเดอร์”
            </p>
          ) : (
            <div className="staff-order-cart__grid-scroll">
              <div className="staff-order-cart__head">
                <span>สินค้า</span>
                <span className="staff-order-cart__head-num">จำนวน</span>
                <span className="staff-order-cart__head-num">ราคา/ชุด</span>
                <span className="staff-order-cart__head-num">รวม</span>
                <span className="staff-order-cart__head-action" aria-hidden="true" />
              </div>
              <ul className="staff-order-cart__list">
                {lineItems.map((line, index) => (
                  <li
                    key={line.rowId}
                    className={`staff-order-cart__row${index < lineItems.length - 1 ? " staff-order-cart__row--sep" : ""}`}
                  >
                    <div
                      className="staff-order-cart__row-name"
                      title={line.product?.name || undefined}
                    >
                      <div className="staff-order-cart__name-main">
                        <span className="staff-order-cart__name-txt">{line.product?.name || "—"}</span>
                        <span className="staff-order-cart__name-idx">#{index + 1}</span>
                      </div>
                      {line.photos.length > 0 ? (
                        <button
                          type="button"
                          className="sale-slip-link sale-slip-link--staff staff-order-cart__photo-link"
                          onClick={() => openImageLightbox(line.photos.map((photo) => photo.url), 0)}
                        >
                          ดูรูปแนบ ({line.photos.length})
                        </button>
                      ) : null}
                    </div>
                    <div className="staff-order-cart__row-qty">
                      <span className="staff-order-cart__field-label">จำนวน (ชุด)</span>
                      <input
                        type="number"
                        min={1}
                        readOnly
                        tabIndex={-1}
                        className="staff-order-cart__input staff-order-cart__input--locked"
                        aria-label={`จำนวน ${line.product?.name || "สินค้า"}`}
                        value={line.qty}
                      />
                    </div>
                    <div className="staff-order-cart__row-price">
                      <span className="staff-order-cart__field-label">ราคา/ชุด (บาท)</span>
                      <input
                        type="number"
                        min={0}
                        readOnly
                        tabIndex={-1}
                        className="staff-order-cart__input staff-order-cart__input--locked"
                        aria-label={`ราคาต่อชุด ${line.product?.name || "สินค้า"}`}
                        value={line.price}
                      />
                    </div>
                    <div className="staff-order-cart__row-total">
                      <span className="staff-order-cart__total-label">รวม</span>
                      <span className="staff-order-cart__total-val">{formatMoney(line.lineBaseTotal)}</span>
                    </div>
                    <div className="staff-order-cart__row-remove">
                      <button
                        type="button"
                        className="sale-action-btn staff-order-cart__remove-btn"
                        onClick={() => removeLineItem(line.rowId)}
                        aria-label="ลบรายการ"
                      >
                        <X size={14} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <section className="staff-sale-form__section">
          <div className="staff-sale-form__section-title">การชำระเงินและส่วนลด</div>
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

          {discountOpen ? (
            <>
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
            </>
          ) : (
            <button type="button" className="staff-discount-toggle-link" onClick={() => setDiscountOpen(true)}>
              <Plus size={12} strokeWidth={2.5} aria-hidden />
              เพิ่มส่วนลดพิเศษ
            </button>
          )}
        </section>

        <section className="staff-sale-form__section">
          <div className="staff-sale-form__section-title">การจัดส่ง</div>
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
                  <label>เบอร์โทร</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    required={form.delivery === "delivery"}
                    title="ตัวเลข 10 หลัก ขึ้นต้นด้วย 0"
                    maxLength={14}
                    value={form.customerPhone}
                    onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                    placeholder="0812345678"
                  />
                </div>
              </div>
              <div className="frow s1">
                <div className="fg">
                  <label>ลิงค์กูเกิ้ลแมพ</label>
                  <textarea
                    required={form.delivery === "delivery"}
                    value={form.deliveryAddress}
                    onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
                    placeholder="ลิงก์กูเกิ้ลแมพ — วางลิงก์จาก Google Maps"
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
        </section>

        <div className="frow s1 staff-sale-form__note-row">
          <div className="fg">
            <label>หมายเหตุเพิ่มเติม</label>
            <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>

        {/* spacer so content isn't hidden behind sticky bar */}
        <div style={{ height: 72 }} aria-hidden />

        <div className="staff-form-sticky-bar">
          <div>
            <div className="staff-form-sticky-bar__label">ลูกค้าจ่าย</div>
            <div className="staff-form-sticky-bar__total">{formatMoney(grandTotal)}</div>
          </div>
          <div className="staff-form-sticky-bar__payout">
            พนง. {formatMoney(employeePayoutTotal)} · เจ้าของ {formatMoney(ownerNetTotal)}
          </div>
          <button
            className="btnok"
            type="submit"
            disabled={
              lineItems.length === 0 ||
              lineItems.some((line) => !line.deskItemId || line.price === "" || Number(line.qty || 0) <= 0)
            }
          >
            <Save size={16} strokeWidth={2} aria-hidden />
            บันทึก
          </button>
        </div>
      </form>
      ) : null}

      {view === "salesList" ? (
      <section className="staff-sales-section">

        {/* Batch slip card */}
        <div className="batch-card">
          <div className="batch-card__header">
            <div className="batch-card__icon-wrap" aria-hidden>
              <FileUp size={22} strokeWidth={2} />
            </div>
            <div className="batch-card__title">แนบสลิปรวมหลายออเดอร์</div>
          </div>
          <div className="batch-card__desc">
            เลือกออเดอร์ค้างชำระ/มัดจำ อย่างน้อย 2 รายการ<br />แล้วแนบสลิปโอนครั้งเดียว
          </div>
          <input
            ref={batchSlipInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(event) => { void handleBatchSlipUpload(event); }}
          />
          <button
            type="button"
            className="batch-card__btn"
            disabled={batchUploading || selectedBatchSaleIds.length < 2}
            onClick={openBatchSlipPicker}
          >
            {batchUploading ? "กำลังอัปโหลดสลิปรวม..." : "แนบสลิปรวมให้รายการที่เลือก"}
          </button>
          <div className="batch-card__count">
            เลือกแล้ว {selectedBatchSaleIds.length} รายการ (พร้อมรวม {batchEligibleSales.length} รายการ)
          </div>
        </div>

        <div className="slist-title with-icon" style={{ marginTop: 12 }}>
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
          <div className="stbl-wrap">
            <table className="stbl">
              <thead>
                <tr>
                  <th className="stbl-th stbl-th--chk">
                    <input
                      type="checkbox"
                      className="stbl-chk"
                      checked={batchEligibleSales.length > 0 && selectedBatchSaleIds.length === batchEligibleSales.length}
                      ref={(el) => { if (el) el.indeterminate = selectedBatchSaleIds.length > 0 && selectedBatchSaleIds.length < batchEligibleSales.length; }}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBatchSaleIds(batchEligibleSales.map((s) => s.id));
                        } else {
                          setSelectedBatchSaleIds([]);
                        }
                      }}
                      aria-label="เลือกทั้งหมด"
                      title="เลือก/ยกเลิกทั้งหมด"
                    />
                  </th>
                  <th className="stbl-th">คำสั่งซื้อ</th>
                  <th className="stbl-th">วันที่</th>
                  <th className="stbl-th stbl-th--r">ยอดรวม</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => {
                  const isDelivery = sale.delivery === "delivery";
                  const isSelected = selectedSaleId === sale.id;
                  return (
                    <tr
                      key={sale.id}
                      className={`stbl-row ${isDelivery ? "stbl-row--del" : "stbl-row--pick"}${isSelected ? " stbl-row--active" : ""}`}
                      onClick={() => setSelectedSaleId(isSelected ? null : sale.id)}
                    >
                      <td className="stbl-td stbl-td--chk" onClick={(e) => e.stopPropagation()}>
                        {sale.payStatus !== "paid" && !sale.paymentBatchId ? (
                          <input
                            type="checkbox"
                            className="stbl-chk"
                            checked={selectedBatchSaleIds.includes(sale.id)}
                            onChange={(event) => toggleBatchSaleSelection(sale.id, event.target.checked)}
                            aria-label="เลือกเข้ากลุ่มสลิปรวม"
                          />
                        ) : null}
                      </td>
                      <td className="stbl-td">
                        <span className="stbl-order-num">{sale.orderNumber}</span>
                      </td>
                      <td className="stbl-td stbl-td--date">
                        {formatSaleDateThMedium(sale.date)}
                      </td>
                      <td className="stbl-td stbl-td--total">
                        {formatMoney(sale.grandTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </section>
      ) : null}

      {/* Detail drawer — shared across home + salesList views */}
      {view !== "newOrder" && (() => {
        const sale = sales.find((s) => s.id === selectedSaleId);
        if (!sale) return null;
        const salePhotos = Array.from(
          new Set([...(sale.deskPhotos || []), ...splitSaleNoteAndPhotos(sale.note).photos])
        );
        const productLine = sale.items && sale.items.length > 1
          ? sale.items.map((item) => `${item.type} × ${item.qty} ชุด`).join(", ")
          : `${sale.type} × ${sale.qty} ชุด`;
        const isDelivery = sale.delivery === "delivery";
        return (
          <>
            <div className="sale-drawer-backdrop" onClick={() => setSelectedSaleId(null)} aria-hidden />
            <aside className="sale-drawer" aria-label="รายละเอียดคำสั่งซื้อ">
              <div className="sale-drawer__header">
                <div>
                  <div className="sale-drawer__header-label">รายละเอียดคำสั่งซื้อ:</div>
                  <div className="sale-drawer__header-num">{sale.orderNumber}</div>
                </div>
                <button type="button" className="sale-drawer__close" onClick={() => setSelectedSaleId(null)} aria-label="ปิด">
                  <X size={18} strokeWidth={2.5} aria-hidden />
                </button>
              </div>
              <div className="sale-drawer__body">
                <div className="sale-drawer__section">
                  <div className="sale-drawer__section-title">ข้อมูลคำสั่งซื้อ</div>
                  <div className="sale-drawer__kv"><span className="sale-drawer__kv-label">วันที่ขาย</span><span className="sale-drawer__kv-val">{formatSaleDateThMedium(sale.date)}</span></div>
                  <div className="sale-drawer__kv"><span className="sale-drawer__kv-label">ขนาด / รุ่น</span><span className="sale-drawer__kv-val">{productLine}</span></div>
                  {sale.customerName ? <div className="sale-drawer__kv"><span className="sale-drawer__kv-label">ลูกค้า</span><span className="sale-drawer__kv-val">{sale.customerName}</span></div> : null}
                  {sale.customerPhone ? <div className="sale-drawer__kv"><span className="sale-drawer__kv-label">เบอร์โทร</span><span className="sale-drawer__kv-val">{sale.customerPhone}</span></div> : null}
                </div>
                <div className="sale-drawer__section">
                  <div className="sale-drawer__section-title">สถานะ</div>
                  <div className="sale-drawer__badges">
                    <span className={`bdg with-icon-sm ${isDelivery ? "del" : "pick"}`}>
                      {isDelivery ? <><Truck size={11} strokeWidth={2.5} aria-hidden />ส่งบ้าน</> : <><Warehouse size={11} strokeWidth={2.5} aria-hidden />รับเอง</>}
                    </span>
                    <span className={`bdg ${sale.payStatus === "paid" ? "paid" : sale.payStatus === "deposit" ? "dep" : "pend"}`}>{getPayStatusLabel(sale.payStatus)}</span>
                    {isDelivery ? (sale.deliveryCompletedAt ? <span className="bdg with-icon-sm ship-done">ส่งแล้ว</span> : <span className="bdg with-icon-sm ship-wait">รอส่ง</span>) : null}
                    {sale.paymentBatchNumber ? <span className="bdg" style={{ background: "#dbeafe", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>{sale.paymentBatchNumber}</span> : null}
                  </div>
                  <div className="sale-drawer__meta">
                    บันทึกโดย {sale.createdByName || sale.createdByUsername || "—"}
                    {sale.recordedAt ? ` · ${new Date(sale.recordedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}` : null}
                  </div>
                </div>
                <div className="sale-drawer__section">
                  <div className="sale-drawer__section-title">สรุปทางการเงิน</div>
                  <div className="sale-drawer__grand-total">{formatMoney(sale.grandTotal)}</div>
                  {sale.workerLiftFee != null && sale.workerLiftFee > 0 ? <div className="sale-drawer__fin-row"><span>ค่ายก/แบก</span><span>{formatMoney(sale.workerLiftFee)}</span></div> : null}
                  {isDelivery && sale.workerDistanceFee != null && sale.workerDistanceFee > 0 ? <div className="sale-drawer__fin-row"><span>ค่าจัดส่ง</span><span>{formatMoney(sale.workerDistanceFee)}</span></div> : null}
                  {sale.employeePayout != null ? <div className="sale-drawer__fin-row"><span>พนักงานรับ</span><span>{formatMoney(sale.employeePayout)}</span></div> : null}
                  {sale.ownerNet != null ? <div className="sale-drawer__fin-row sale-drawer__fin-row--net"><span>เจ้าของได้</span><span>{formatMoney(sale.ownerNet)}</span></div> : null}
                </div>
                {salePhotos.length > 0 ? (
                  <div className="sale-drawer__section">
                    <div className="sale-drawer__section-title">รูปภาพ</div>
                    <div className="sale-drawer__photos">
                      {salePhotos.map((url, i) => (
                        <button key={i} type="button" className="sale-drawer__photo-btn" onClick={() => openImageLightbox(salePhotos, i)}>
                          <img src={url} alt={`รูป ${i + 1}`} className="sale-drawer__photo-img" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="sale-drawer__section">
                  <button type="button" className="sale-drawer__delete-btn" onClick={() => { void handleDeleteSale(sale.id); setSelectedSaleId(null); }}>
                    <X size={14} strokeWidth={2.5} aria-hidden />ลบรายการนี้
                  </button>
                </div>
              </div>
              <div className="sale-drawer__footer">
                <input ref={(node) => { paymentSlipInputRefs.current[sale.id] = node; }} type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => { void handlePaymentSlipUpload(sale.id, event); }} />
                <button type="button" className="btnok" onClick={() => openPaymentSlipPicker(sale.id)} disabled={uploadingSaleId === sale.id}>
                  {uploadingSaleId === sale.id ? "กำลังอัปโหลด..." : <><ImagePlus size={16} strokeWidth={2} aria-hidden />{sale.paymentSlipImage ? "อัปเดตสลิปโอนเงิน" : "แนบสลิปโอนเงิน"}</>}
                </button>
                {sale.paymentSlipImage ? (
                  <button type="button" className="sale-slip-link sale-slip-link--staff" style={{ textAlign: "center" }} onClick={() => openImageLightbox([sale.paymentSlipImage!], 0)}>ดูสลิปที่แนบ</button>
                ) : null}
              </div>
            </aside>
          </>
        );
      })()}

      {view === "home" ? (
        <button type="button" className="mobile-fab" onClick={() => setView("newOrder")} aria-label="สร้างออเดอร์ใหม่">
          <Plus size={24} strokeWidth={2.5} aria-hidden />
        </button>
      ) : null}

      <PaymentSlipLightbox
        imageSources={lightboxState?.images}
        initialIndex={lightboxState?.index ?? 0}
        onClose={closeSlipPreview}
      />
    </main>
  );
}

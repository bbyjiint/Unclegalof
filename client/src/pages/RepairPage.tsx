import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Hash,
  Palette,
  Ruler,
  Wrench,
  X
} from "lucide-react";
import { api } from "../lib/api";
import { uploadFileToR2 } from "../lib/upload";
import type { RepairItem, RepairKind, RepairStatus } from "../types";

type PendingRepairPhoto = { file: File; url: string };

const MAX_REPAIR_PHOTOS = 8;

const STATUS_LABEL: Record<RepairStatus, string> = {
  open: "รอซ่อม",
  inprogress: "กำลังซ่อม",
  done: "เสร็จแล้ว",
};

const KIND_LABEL: Record<RepairKind, string> = {
  repair: "ซ่อม",
  claim: "เคลม",
};

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
  const [newRepairPhotos, setNewRepairPhotos] = useState<PendingRepairPhoto[]>([]);
  const newRepairPhotosRef = useRef(newRepairPhotos);
  newRepairPhotosRef.current = newRepairPhotos;
  const [uploadingRepairId, setUploadingRepairId] = useState<string | null>(null);
  const repairPhotoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
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
      setForm((current) => {
        if (types.length === 0) return current;
        if (current.type && types.includes(current.type)) return current;
        return { ...current, type: types[0] };
      });
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
      const images =
        newRepairPhotos.length > 0
          ? await Promise.all(newRepairPhotos.map((p) => uploadFileToR2(p.file, "REPAIR_IMAGE")))
          : undefined;

      await api.createRepair({
        ...form,
        reason: form.reason.trim(),
        qty: Number(form.qty),
        ...(images && images.length > 0 ? { images } : {})
      });
      newRepairPhotos.forEach((p) => URL.revokeObjectURL(p.url));
      setNewRepairPhotos([]);
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

  function onNewRepairPhotosSelected(event: ChangeEvent<HTMLInputElement>): void {
    const picked = Array.from(event.target.files || []).filter((f) => f.type.startsWith("image/"));
    event.target.value = "";
    if (picked.length === 0) return;
    setNewRepairPhotos((prev) => {
      const withUrls = picked.map((file) => ({ file, url: URL.createObjectURL(file) }));
      return [...prev, ...withUrls].slice(0, MAX_REPAIR_PHOTOS);
    });
  }

  function removeNewRepairPhoto(index: number): void {
    setNewRepairPhotos((prev) => {
      const row = prev[index];
      if (row) URL.revokeObjectURL(row.url);
      return prev.filter((_, i) => i !== index);
    });
  }

  useEffect(() => {
    return () => {
      newRepairPhotosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

  function openRepairPhotoPicker(repairId: string): void {
    repairPhotoInputRefs.current[repairId]?.click();
  }

  async function handleRepairPhotoUpload(repairId: string, event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("กรุณาอัปโหลดไฟล์รูปภาพ");
      event.target.value = "";
      return;
    }
    const existing = items.find((i) => i.id === repairId)?.images?.length ?? 0;
    if (existing >= MAX_REPAIR_PHOTOS) {
      alert(`แนบได้สูงสุด ${MAX_REPAIR_PHOTOS} รูปต่อรายการ`);
      event.target.value = "";
      return;
    }
    try {
      setUploadingRepairId(repairId);
      const fileUrl = await uploadFileToR2(file, "REPAIR_IMAGE");
      await api.uploadRepairImage(repairId, { fileUrl });
      await loadRepairs();
    } catch (error) {
      console.error("Failed to upload repair photo:", error);
      alert(error instanceof Error ? error.message : "Failed to upload repair photo");
    } finally {
      setUploadingRepairId(null);
      event.target.value = "";
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

  async function removeRepairPhoto(repairId: string, fileUrl: string): Promise<void> {
    const confirmed = window.confirm("ลบรูปภาพนี้ออกจากรายการซ่อม/เคลม?");
    if (!confirmed) {
      return;
    }
    try {
      setUploadingRepairId(repairId);
      await api.removeRepairImage(repairId, { fileUrl });
      await loadRepairs();
    } catch (error) {
      console.error("Failed to remove repair photo:", error);
      alert(error instanceof Error ? error.message : "Failed to remove repair photo");
    } finally {
      setUploadingRepairId(null);
    }
  }

  return (
    <main className="wrap repair-page">
      <div className="repair-page__head">
        <div className="h-with-icon repair-page__title">
          <Wrench size={22} strokeWidth={2} aria-hidden />
          สินค้ารอซ่อม / เคลม
        </div>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <h3 className="h-with-icon">
          <AlertTriangle size={20} strokeWidth={2} aria-hidden />
          แจ้งสินค้าซ่อม/เคลม
        </h3>
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
        <div className="frow s1">
          <div className="fg">
            <label>รูปประกอบ (ไม่บังคับ, สูงสุด {MAX_REPAIR_PHOTOS} รูป)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={onNewRepairPhotosSelected}
              disabled={newRepairPhotos.length >= MAX_REPAIR_PHOTOS}
            />
            {newRepairPhotos.length > 0 && (
              <div className="repair-page__photo-strip">
                {newRepairPhotos.map((row, index) => (
                  <div key={`${row.file.name}-${index}`} className="repair-page__photo-wrap">
                    <img src={row.url} alt="" className="repair-page__photo-thumb" />
                    <button
                      type="button"
                      className="repair-page__photo-remove"
                      onClick={() => removeNewRepairPhoto(index)}
                      aria-label="ลบรูป"
                    >
                      <X size={14} strokeWidth={2.5} aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {productTypes.length === 0 && (
          <p className="repair-page__form-note">
            ยังไม่มีประเภทสินค้าในระบบ — เพิ่มสินค้าที่หน้าคลังก่อนจึงจะบันทึกแจ้งซ่อมได้
          </p>
        )}
        <button
          className="btnok"
          type="submit"
          disabled={productTypes.length === 0 || !form.type.trim() || !form.reason.trim()}
        >
          <AlertTriangle size={18} strokeWidth={2} aria-hidden />
          บันทึกแจ้ง
        </button>
      </form>

      <section>
        {items.length === 0 ? (
          <div className="empty">
            <div className="h-with-icon" style={{ justifyContent: "center", color: "var(--gray)" }}>
              <CheckCircle2 size={18} strokeWidth={2} aria-hidden style={{ color: "var(--green)" }} />
              ไม่มีสินค้ารอซ่อม/เคลม
            </div>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="card repair-page__item">
              <div className="repair-page__item-head">
                <h3 className="repair-page__item-title">{item.type}</h3>
                <div className="repair-page__item-badges">
                  <span className={`repair-page__kind repair-page__kind--${item.kind}`}>
                    {KIND_LABEL[item.kind] ?? item.kind}
                  </span>
                  <span className={`repair-page__status repair-page__status--${item.status}`}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>
              </div>
              <div className="sdetail">
                <span className="with-icon-sm">
                  <Ruler size={12} strokeWidth={2} aria-hidden />
                  {item.size || "—"}
                </span>
                <span className="with-icon-sm">
                  <Palette size={12} strokeWidth={2} aria-hidden />
                  {item.color || "—"}
                </span>
                <span className="with-icon-sm">
                  <Hash size={12} strokeWidth={2} aria-hidden />
                  {item.qty} ชุด
                </span>
              </div>
              <p className="repair-page__reason">{item.reason}</p>
              {(item.images?.length ?? 0) > 0 && (
                <div className="repair-page__photo-strip repair-page__photo-strip--listed">
                  {item.images!.map((src, idx) => (
                    <div key={`${item.id}-img-${idx}`} className="repair-page__photo-wrap">
                      <a href={src} target="_blank" rel="noreferrer">
                        <img src={src} alt={`รูป ${idx + 1}`} className="repair-page__photo-thumb repair-page__photo-thumb--listed" />
                      </a>
                      <button
                        type="button"
                        className="repair-page__photo-remove"
                        onClick={() => {
                          void removeRepairPhoto(item.id, src);
                        }}
                        aria-label="ลบรูปนี้"
                        disabled={uploadingRepairId === item.id}
                      >
                        <X size={14} strokeWidth={2.5} aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="repair-page__item-actions">
                <input
                  ref={(node) => {
                    repairPhotoInputRefs.current[item.id] = node;
                  }}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    void handleRepairPhotoUpload(item.id, e);
                  }}
                />
                {(item.images?.length ?? 0) < MAX_REPAIR_PHOTOS && (
                  <button
                    type="button"
                    className="with-icon-sm repair-page__pill-btn"
                    onClick={() => openRepairPhotoPicker(item.id)}
                    disabled={uploadingRepairId === item.id}
                  >
                    {uploadingRepairId === item.id ? (
                      "กำลังอัปโหลด..."
                    ) : (
                      <>
                        <Camera size={14} strokeWidth={2} aria-hidden />
                        แนบรูป
                      </>
                    )}
                  </button>
                )}
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

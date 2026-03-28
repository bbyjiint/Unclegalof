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
import type { RepairItem, RepairKind, RepairStatus } from "../types";

type PendingRepairPhoto = { file: File; url: string };

const MAX_REPAIR_PHOTOS = 8;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

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
          ? await Promise.all(newRepairPhotos.map((p) => readFileAsDataUrl(p.file)))
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
      const imageData = await readFileAsDataUrl(file);
      await api.uploadRepairImage(repairId, { imageData });
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

  return (
    <main className="wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div className="h-with-icon" style={{ fontFamily: "Prompt", fontSize: 17, fontWeight: 700, color: "var(--dark)" }}>
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {newRepairPhotos.map((row, index) => (
                  <div key={`${row.file.name}-${index}`} style={{ position: "relative" }}>
                    <img
                      src={row.url}
                      alt=""
                      style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, display: "block" }}
                    />
                    <button
                      type="button"
                      onClick={() => removeNewRepairPhoto(index)}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        border: "none",
                        background: "var(--dark)",
                        color: "#fff",
                        fontSize: 12,
                        cursor: "pointer",
                        lineHeight: 1
                      }}
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
          <p style={{ marginBottom: 12, color: "var(--dark)", opacity: 0.85 }}>
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
            <div key={item.id} className="card">
              <h3>{item.type}</h3>
              <div className="sdetail">
                <span className="with-icon-sm">
                  <Ruler size={12} strokeWidth={2} aria-hidden />
                  {item.size}
                </span>
                <span className="with-icon-sm">
                  <Palette size={12} strokeWidth={2} aria-hidden />
                  {item.color}
                </span>
                <span className="with-icon-sm">
                  <Hash size={12} strokeWidth={2} aria-hidden />
                  {item.qty} ชุด
                </span>
                <span>{item.status}</span>
              </div>
              <p style={{ marginTop: 10 }}>{item.reason}</p>
              {(item.images?.length ?? 0) > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {item.images!.map((src, idx) => (
                    <a key={`${item.id}-img-${idx}`} href={src} target="_blank" rel="noreferrer">
                      <img
                        src={src}
                        alt={`รูป ${idx + 1}`}
                        style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 8, display: "block" }}
                      />
                    </a>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
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
                    className="with-icon-sm"
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
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

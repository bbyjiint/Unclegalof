import { useEffect, useMemo, useState } from "react";

type Props = {
  imageSrc?: string | null;
  imageSources?: string[];
  initialIndex?: number;
  onClose: () => void;
};

export function PaymentSlipLightbox({ imageSrc = null, imageSources, initialIndex = 0, onClose }: Props) {
  const images = useMemo(() => {
    const list = imageSources?.filter(Boolean) ?? [];
    return list.length > 0 ? list : imageSrc ? [imageSrc] : [];
  }, [imageSources, imageSrc]);
  const [activeIndex, setActiveIndex] = useState<number>(initialIndex);

  useEffect(() => {
    setActiveIndex(Math.max(0, Math.min(initialIndex, Math.max(0, images.length - 1))));
  }, [images, initialIndex]);

  useEffect(() => {
    if (images.length === 0) {
      return;
    }
    function onKeyDown(e: globalThis.KeyboardEvent): void {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (images.length <= 1) {
        return;
      }
      if (e.key === "ArrowRight") {
        setActiveIndex((current) => (current + 1) % images.length);
      }
      if (e.key === "ArrowLeft") {
        setActiveIndex((current) => (current - 1 + images.length) % images.length);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [images, onClose]);

  if (images.length === 0) {
    return null;
  }

  const currentImageSrc = images[activeIndex] || images[0];
  const hasMultiple = images.length > 1;

  function showPrevious(): void {
    setActiveIndex((current) => (current - 1 + images.length) % images.length);
  }

  function showNext(): void {
    setActiveIndex((current) => (current + 1) % images.length);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ดูสลิปโอนเงิน"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        cursor: "pointer"
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "relative",
          maxWidth: "min(920px, 96vw)",
          maxHeight: "92vh",
          cursor: "default",
          background: "#111",
          borderRadius: 12,
          padding: 12,
          boxShadow: "0 12px 48px rgba(0,0,0,0.45)"
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {hasMultiple ? (
          <>
            <button
              type="button"
              aria-label="รูปก่อนหน้า"
              onClick={showPrevious}
              style={{
                position: "absolute",
                left: 16,
                top: "50%",
                transform: "translateY(-50%)",
                width: 40,
                height: 40,
                borderRadius: 9999,
                border: "none",
                background: "rgba(255,255,255,0.18)",
                color: "#fff",
                fontSize: 24,
                cursor: "pointer",
                zIndex: 1,
              }}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="รูปถัดไป"
              onClick={showNext}
              style={{
                position: "absolute",
                right: 16,
                top: "50%",
                transform: "translateY(-50%)",
                width: 40,
                height: 40,
                borderRadius: 9999,
                border: "none",
                background: "rgba(255,255,255,0.18)",
                color: "#fff",
                fontSize: 24,
                cursor: "pointer",
                zIndex: 1,
              }}
            >
              ›
            </button>
          </>
        ) : null}
        <img
          src={currentImageSrc}
          alt={hasMultiple ? `รูปแนบ ${activeIndex + 1}` : "สลิปโอนเงิน"}
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: "calc(92vh - 56px)",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            borderRadius: 8
          }}
        />
        {hasMultiple ? (
          <div style={{ marginTop: 10, textAlign: "center", color: "#fff", fontSize: 13 }}>
            รูป {activeIndex + 1} / {images.length}
          </div>
        ) : null}
        <button type="button" className="btnok" style={{ marginTop: 10, width: "100%" }} onClick={onClose}>
          ปิด
        </button>
      </div>
    </div>
  );
}

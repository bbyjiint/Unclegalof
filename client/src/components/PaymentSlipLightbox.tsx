import { useEffect } from "react";

type Props = {
  imageSrc: string | null;
  onClose: () => void;
};

export function PaymentSlipLightbox({ imageSrc, onClose }: Props) {
  useEffect(() => {
    if (!imageSrc) {
      return;
    }
    function onKeyDown(e: globalThis.KeyboardEvent): void {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [imageSrc, onClose]);

  if (!imageSrc) {
    return null;
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
        <img
          src={imageSrc}
          alt="สลิปโอนเงิน"
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
        <button type="button" className="btnok" style={{ marginTop: 10, width: "100%" }} onClick={onClose}>
          ปิด
        </button>
      </div>
    </div>
  );
}

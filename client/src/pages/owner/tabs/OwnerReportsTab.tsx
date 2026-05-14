import { CheckCircle2, ChevronDown, ChevronUp, FileText, RefreshCw, SlidersHorizontal, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "../../../data/constants";
import { api } from "../../../lib/api";
import type { Sale } from "../../../types";
import { useOwnerDashboard } from "../ownerDashboardContext";

const MONTH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** Must match `--rep-wheel-item-h` in owner-dashboard.css */
const WHEEL_ITEM_PX = 44;

const MONTH_CYCLE = 12;
const MONTH_CANONICAL = MONTH_CYCLE * 3;
const INFINITE_MONTHS = Array.from({ length: MONTH_CYCLE * 7 }, (_, i) => i % MONTH_CYCLE);

function wheelScrollTopForIndex(idx: number) {
  return idx * WHEEL_ITEM_PX;
}
function wheelCenterIndexFromScroll(scrollTop: number) {
  return Math.round(scrollTop / WHEEL_ITEM_PX);
}

type MonthYearWheelProps = {
  month: number;
  year: number;
  setMonth: (m: number) => void;
  setYear: (y: number) => void;
  selectableYears: number[];
  filtersOpen: boolean;
};

function MonthYearWheel({ month, year, setMonth, setYear, selectableYears, filtersOpen }: MonthYearWheelProps) {
  const monthColRef = useRef<HTMLDivElement>(null);
  const yearColRef = useRef<HTMLDivElement>(null);
  const [mCenterIdx, setMCenterIdx] = useState(MONTH_CANONICAL + month - 1);
  const [yCenterIdx, setYCenterIdx] = useState(0);
  const mTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mTeleport = useRef(false);
  const yTeleport = useRef(false);

  const yearLen = selectableYears.length;
  const YEAR_COPIES = 7;
  const infiniteYears = useMemo(
    () =>
      yearLen > 0
        ? Array.from({ length: yearLen * YEAR_COPIES }, (_, i) => selectableYears[i % yearLen])
        : [],
    [selectableYears, yearLen]
  );
  const YEAR_CANONICAL = yearLen * 3;

  function jumpToWheelIndex(strip: HTMLDivElement, idx: number) {
    strip.scrollTop = wheelScrollTopForIndex(idx);
  }

  function teleportMonth(strip: HTMLDivElement, idx: number) {
    mTeleport.current = true;
    jumpToWheelIndex(strip, idx);
    setMCenterIdx(idx);
    setTimeout(() => {
      mTeleport.current = false;
    }, 60);
  }

  function teleportYear(strip: HTMLDivElement, idx: number) {
    yTeleport.current = true;
    jumpToWheelIndex(strip, idx);
    setYCenterIdx(idx);
    setTimeout(() => {
      yTeleport.current = false;
    }, 60);
  }

  useEffect(() => {
    if (!filtersOpen || yearLen === 0) return;
    requestAnimationFrame(() => {
      const mc = monthColRef.current;
      const yc = yearColRef.current;
      if (mc) teleportMonth(mc, MONTH_CANONICAL + month - 1);
      if (yc) {
        const yi = Math.max(0, selectableYears.indexOf(year));
        teleportYear(yc, YEAR_CANONICAL + yi);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snap wheels when filter panel opens
  }, [filtersOpen]);

  function handleMonthScroll() {
    const el = monthColRef.current;
    if (!el) return;
    setMCenterIdx(wheelCenterIndexFromScroll(el.scrollTop));
    if (mTeleport.current) return;
    if (mTimer.current) clearTimeout(mTimer.current);
    mTimer.current = setTimeout(() => {
      const s = monthColRef.current;
      if (!s) return;
      const idx = wheelCenterIndexFromScroll(s.scrollTop);
      const mZero = INFINITE_MONTHS[idx] ?? 0;
      const canon = MONTH_CANONICAL + mZero;
      teleportMonth(s, canon);
      setMonth(mZero + 1);
    }, 180);
  }

  function handleYearScroll() {
    const el = yearColRef.current;
    if (!el || yearLen === 0) return;
    setYCenterIdx(wheelCenterIndexFromScroll(el.scrollTop));
    if (yTeleport.current) return;
    if (yTimer.current) clearTimeout(yTimer.current);
    yTimer.current = setTimeout(() => {
      const s = yearColRef.current;
      if (!s) return;
      const idx = wheelCenterIndexFromScroll(s.scrollTop);
      const yVal = infiniteYears[idx];
      if (yVal == null) return;
      const yi = Math.max(0, selectableYears.indexOf(yVal));
      teleportYear(s, YEAR_CANONICAL + yi);
      setYear(yVal);
    }, 180);
  }

  function cellOpacity(dist: number) {
    if (dist === 0) return 1;
    if (dist === 1) return 0.35;
    return 0.1;
  }

  if (yearLen === 0) {
    return null;
  }

  return (
    <div className="rep-date-wheel" role="group" aria-label="เลือกเดือนและปี">
      <div className="rep-date-wheel__mask">
        <div className="rep-date-wheel__highlight" aria-hidden />
        <div className="rep-date-wheel__cols">
          <div ref={monthColRef} className="rep-date-wheel__col" onScroll={handleMonthScroll}>
            <div className="rep-date-wheel__inner">
              {INFINITE_MONTHS.map((mi, i) => {
                const d = Math.abs(i - mCenterIdx);
                return (
                  <button
                    key={i}
                    type="button"
                    className={`rep-date-wheel__cell${d === 0 ? " rep-date-wheel__cell--active" : ""}`}
                    style={{ opacity: cellOpacity(d), transition: "opacity 0.15s ease" }}
                    onClick={() => monthColRef.current?.scrollTo({ top: wheelScrollTopForIndex(i), behavior: "smooth" })}
                  >
                    {MONTH_ABBR[mi]}
                  </button>
                );
              })}
            </div>
          </div>
          <div ref={yearColRef} className="rep-date-wheel__col" onScroll={handleYearScroll}>
            <div className="rep-date-wheel__inner">
              {infiniteYears.map((yy, i) => {
                const d = Math.abs(i - yCenterIdx);
                return (
                  <button
                    key={i}
                    type="button"
                    className={`rep-date-wheel__cell${d === 0 ? " rep-date-wheel__cell--active" : ""}`}
                    style={{ opacity: cellOpacity(d), transition: "opacity 0.15s ease" }}
                    onClick={() => yearColRef.current?.scrollTo({ top: wheelScrollTopForIndex(i), behavior: "smooth" })}
                  >
                    {yy}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PAY_LABELS: Record<string, string> = { all: "ทั้งหมด", paid: "ชำระแล้ว", pending: "ค้างชำระ", deposit: "มัดจำ" };
const SORT_LABELS: Record<string, string> = { time: "เวลา", total: "ยอดรวม" };
const DIR_LABELS: Record<string, string> = { desc: "ใหม่ก่อน", asc: "เก่าก่อน" };

const PAY_OPTIONS = Object.entries(PAY_LABELS).map(([value, label]) => ({ value, label }));
const SORT_OPTIONS = Object.entries(SORT_LABELS).map(([value, label]) => ({ value, label }));
const DIR_OPTIONS = Object.entries(DIR_LABELS).map(([value, label]) => ({ value, label }));

type RepFilterSelectProps = {
  label: string;
  ariaLabel: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
};

function RepFilterSelect({ label, ariaLabel, value, options, onChange }: RepFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value)?.label ?? value;

  return (
    <div className="rep-ctrl-group" ref={rootRef}>
      <span className="rep-ctrl-label">{label}</span>
      <div className={`rep-dd${open ? " rep-dd--open" : ""}`}>
        <button
          type="button"
          className="rep-dd-btn"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="rep-dd-btn__text">{current}</span>
          <ChevronDown size={16} strokeWidth={2} className="rep-dd-btn__chev" aria-hidden />
        </button>
        {open ? (
          <ul className="rep-dd-menu" role="listbox" aria-label={ariaLabel}>
            {options.map((opt) => (
              <li key={opt.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  className={`rep-dd-item${opt.value === value ? " rep-dd-item--active" : ""}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function useMinWidth(minWidth: number) {
  const [matches, setMatches] = useState(() => (typeof window === "undefined" ? false : window.matchMedia(`(min-width: ${minWidth}px)`).matches));

  useEffect(() => {
    if (typeof window === "undefined") return;

    const query = window.matchMedia(`(min-width: ${minWidth}px)`);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    setMatches(query.matches);
    if (query.addEventListener) {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    }

    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, [minWidth]);

  return matches;
}

export default function OwnerReportsTab() {
  const {
    month,
    year,
    setMonth,
    setYear,
    payStatusFilter,
    setPayStatusFilter,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    filteredAndSortedSales,
    statusCount,
    selectableYears,
    loadPage,
    confirmSalePaid,
    updatingSaleId
  } = useOwnerDashboard();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const isDesktopReports = useMinWidth(900);
  const [slipModalSale, setSlipModalSale] = useState<Sale | null>(null);

  /** Sum of `ownerNet ?? grandTotal` per payment batch in the current list (combined owner net). */
  const batchPaymentAggregates = useMemo(() => {
    const combinedOwnerNetByBatchId = new Map<string, number>();
    const batchHasNonPaid = new Set<string>();
    for (const s of filteredAndSortedSales) {
      if (!s.paymentBatchId) continue;
      const line = Number(s.ownerNet ?? s.grandTotal ?? 0);
      combinedOwnerNetByBatchId.set(
        s.paymentBatchId,
        (combinedOwnerNetByBatchId.get(s.paymentBatchId) ?? 0) + line
      );
      if (s.payStatus !== "paid") batchHasNonPaid.add(s.paymentBatchId);
    }
    return { combinedOwnerNetByBatchId, batchHasNonPaid };
  }, [filteredAndSortedSales]);

  function displayCombinedBatchTotal(sale: Sale): number {
    if (!sale.paymentBatchId) return 0;
    const summed = batchPaymentAggregates.combinedOwnerNetByBatchId.get(sale.paymentBatchId) ?? 0;
    const stored = Number(sale.paymentBatchTotalAmount || 0);
    return summed > 0 ? summed : stored;
  }

  async function openSlipModal(sale: Sale): Promise<void> {
    setSlipModalSale(sale);
    try {
      await api.markSaleSlipViewed(sale.id);
      await loadPage();
    } catch {
      // marking viewed is best-effort
    }
  }

  async function handleSlipModalConfirm(): Promise<void> {
    if (!slipModalSale) return;
    await confirmSalePaid(slipModalSale.id);
    setSlipModalSale(null);
  }

  async function handleSlipModalReject(): Promise<void> {
    if (!slipModalSale) return;
    if (!window.confirm("ลบสลิปที่แนบไว้รายการนี้?")) return;
    try {
      await api.removeSalePaymentSlip(slipModalSale.id);
      await loadPage();
    } catch {
      // ignore
    }
    setSlipModalSale(null);
  }

  const batchMap = new Map<string, { total: number; paid: boolean }>();
  for (const sale of filteredAndSortedSales) {
    if (!sale.paymentBatchId) continue;
    if (!batchMap.has(sale.paymentBatchId)) {
      const summed = batchPaymentAggregates.combinedOwnerNetByBatchId.get(sale.paymentBatchId) ?? 0;
      const stored = Number(sale.paymentBatchTotalAmount || 0);
      batchMap.set(sale.paymentBatchId, {
        total: summed > 0 ? summed : stored,
        paid: !batchPaymentAggregates.batchHasNonPaid.has(sale.paymentBatchId),
      });
    }
  }
  const batchCount = batchMap.size;
  const batchTotal = Array.from(batchMap.values()).reduce((sum, row) => sum + row.total, 0);
  const unpaidBatchTotal = Array.from(batchMap.values())
    .filter((row) => !row.paid)
    .reduce((sum, row) => sum + row.total, 0);

  return (
    <div className="owner-dash__panel">
      <div className={`owner-dash__card owner-dash__card--muted rep-filters-card${filtersOpen ? "" : " rep-filters-card--collapsed"}`}>
        {/* Collapsible header */}
        <button
          type="button"
          className="rep-filters-toggle"
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal size={15} strokeWidth={2} aria-hidden />
          <span>ตัวกรอง</span>
          {filtersOpen
            ? <ChevronUp size={15} strokeWidth={2} aria-hidden />
            : <ChevronDown size={15} strokeWidth={2} aria-hidden />}
        </button>

        {filtersOpen && (
          <>
            <MonthYearWheel
              month={month}
              year={year}
              setMonth={setMonth}
              setYear={setYear}
              selectableYears={selectableYears}
              filtersOpen={filtersOpen}
            />

            {/* Bottom controls row */}
            <div className="rep-controls-row">
              <RepFilterSelect
                label="สถานะ"
                ariaLabel="สถานะการชำระ"
                value={payStatusFilter}
                options={PAY_OPTIONS}
                onChange={(v) => setPayStatusFilter(v as "all" | "paid" | "pending" | "deposit")}
              />
              <RepFilterSelect
                label="เรียง"
                ariaLabel="เรียงตาม"
                value={sortBy}
                options={SORT_OPTIONS}
                onChange={(v) => setSortBy(v as "time" | "total")}
              />
              <RepFilterSelect
                label="ทิศทาง"
                ariaLabel="ทิศทางการเรียง"
                value={sortDir}
                options={DIR_OPTIONS}
                onChange={(v) => setSortDir(v as "asc" | "desc")}
              />
              <div className="rep-ctrl-group rep-ctrl-group--refresh">
                <span className="rep-ctrl-label">รีเฟรช</span>
                <button
                  type="button"
                  className="rep-refresh-icon-btn"
                  aria-label="โหลดรายการใหม่"
                  onClick={() => void loadPage()}
                >
                  <RefreshCw size={18} strokeWidth={2} aria-hidden />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="owner-dash__card" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13, color: "#3a3a3c" }}>
          <span>ชำระแล้ว {statusCount.paid}</span>
          <span>ค้างชำระ {statusCount.pending}</span>
          <span>มัดจำ {statusCount.deposit}</span>
          <span>สลิปรวมทั้งหมด {batchCount}</span>
          <span>ยอดรวมสลิปรวม {formatMoney(batchTotal)}</span>
          <span>ยอดสลิปรวมรอตรวจ {formatMoney(unpaidBatchTotal)}</span>
        </div>
      </div>

      {filteredAndSortedSales.length === 0 ? (
        <div className="owner-dash__card owner-dash__card--muted" style={{ marginTop: 12 }}>
          <p style={{ margin: 0, textAlign: "center", color: "#636366" }}>ไม่มีรายการตามตัวกรอง</p>
        </div>
      ) : (
        <>
          {!isDesktopReports ? (
            <>
              {/* ── Mobile: card list ── */}
              <div className="rep-list">
                {filteredAndSortedSales.map((sale) => {
                  const slipBadgeClass = !sale.paymentSlipImage
                    ? "rep-badge--no-slip"
                    : sale.slipViewedAt
                      ? "rep-badge--slip-seen"
                      : "rep-badge--slip-unseen";
                  const slipLabel = !sale.paymentSlipImage
                    ? "ยังไม่มีสลิป"
                    : sale.slipViewedAt
                      ? "ดูสลิปแล้ว"
                      : "ยังไม่ดูสลิป";
                  const payLabel: Record<string, string> = {
                    paid: "ชำระแล้ว",
                    pending: "ค้างชำระ",
                    deposit: "มัดจำ",
                  };

                  return (
                    <div className="rep-card" key={sale.id}>
                      <div className="rep-card__head">
                        <div>
                          <div className="rep-card__order">{sale.orderNumber}</div>
                          <div className="rep-card__meta">
                            {sale.type}
                            {sale.qty != null ? ` × ${sale.qty}` : ""}
                            {sale.recordedAt
                              ? ` · ${new Date(sale.recordedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}`
                              : ""}
                          </div>
                        </div>
                        <div className="rep-card__total">{formatMoney(sale.ownerNet ?? sale.grandTotal)}</div>
                      </div>

                      <div className="rep-card__badges">
                        <span className={`rep-badge rep-badge--${sale.payStatus}`}>
                          {payLabel[sale.payStatus] ?? sale.payStatus}
                        </span>
                        <span className={`rep-badge ${slipBadgeClass}`}>{slipLabel}</span>
                        {sale.paymentBatchNumber ? (
                          <span className="rep-badge rep-badge--deposit">{sale.paymentBatchNumber}</span>
                        ) : null}
                      </div>

                      {sale.paymentBatchNumber ? (
                        <div className="rep-card__batch-expected">
                          ยอดรวม: {formatMoney(displayCombinedBatchTotal(sale))}
                        </div>
                      ) : null}

                      {sale.paymentSlipImage ? (
                        <div className="rep-card__actions">
                          {sale.slipViewedAt ? (
                            <button
                              type="button"
                              className="sale-slip-link sale-slip-link--rep-card"
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(46,125,50,0.12)", color: "#1b5e20" }}
                              onClick={() => void openSlipModal(sale)}
                            >
                              <FileText size={14} strokeWidth={2} aria-hidden />
                              ดูอีกครั้ง
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="sale-slip-link sale-slip-link--rep-card"
                              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                              onClick={() => void openSlipModal(sale)}
                            >
                              <FileText size={14} strokeWidth={2} aria-hidden />
                              ดูสลิป
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {isDesktopReports ? (
            <>
              {/* ── Desktop: full table ── */}
              <div className="rep-tbl">
                <table>
                  <thead>
                    <tr>
                      <th>ออเดอร์</th>
                      <th>สินค้า</th>
                      <th>ชุด</th>
                      <th>เจ้าของได้</th>
                      <th>ต้นทุน/ชิ้น</th>
                      <th>กำไร</th>
                      <th>สถานะ</th>
                      <th>Batch</th>
                      <th>ผู้บันทึก</th>
                      <th>สลิป</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedSales.map((sale) => {
                      const payLabel: Record<string, string> = { paid: "ชำระแล้ว", pending: "ค้างชำระ", deposit: "มัดจำ" };

                      return (
                        <tr key={sale.id}>
                          <td>{sale.orderNumber}</td>
                          <td>{sale.type}</td>
                          <td>{sale.qty}</td>
                          <td>{formatMoney(sale.ownerNet ?? sale.grandTotal)}</td>
                          <td className="csub" style={{ fontSize: 12 }}>
                            {sale.avgUnitCost != null ? formatMoney(sale.avgUnitCost) : "—"}
                          </td>
                          <td className="csub" style={{ fontSize: 12 }}>
                            {sale.grossProfit != null ? formatMoney(sale.grossProfit) : "—"}
                          </td>
                          <td>
                            <span className={`rep-badge rep-badge--${sale.payStatus}`}>
                              {payLabel[sale.payStatus] ?? sale.payStatus}
                            </span>
                          </td>
                          <td>
                            {sale.paymentBatchNumber ? (
                              <div>
                                <div style={{ fontWeight: 600, color: "#1d4ed8" }}>{sale.paymentBatchNumber}</div>
                                <div className="csub" style={{ fontSize: 11 }}>
                                  {formatMoney(displayCombinedBatchTotal(sale))}
                                </div>
                              </div>
                            ) : "—"}
                          </td>
                          <td>
                            <div>{sale.createdByName || sale.createdByUsername || "—"}</div>
                            {sale.recordedAt ? (
                              <div className="csub" style={{ fontSize: 11 }}>
                                {new Date(sale.recordedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                              </div>
                            ) : null}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {!sale.paymentSlipImage ? (
                              <span className="rep-badge rep-badge--no-slip">ยังไม่มีสลิป</span>
                            ) : sale.slipViewedAt ? (
                              <button
                                type="button"
                                className="sale-slip-link"
                                style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(46,125,50,0.12)", color: "#1b5e20" }}
                                onClick={() => void openSlipModal(sale)}
                              >
                                <FileText size={13} strokeWidth={2} aria-hidden />
                                ดูอีกครั้ง
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="sale-slip-link"
                                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                                onClick={() => void openSlipModal(sale)}
                              >
                                <FileText size={13} strokeWidth={2} aria-hidden />
                                ดูสลิป
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {slipModalSale?.paymentSlipImage ? (
            <div
              style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
              onClick={() => setSlipModalSale(null)}
            >
              <div
                style={{ background: "#fff", borderRadius: 16, width: 440, maxWidth: "96vw", boxShadow: "0 20px 60px rgba(0,0,0,0.22)", overflow: "hidden" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: "1px solid #f0f0f0" }}>
                  <FileText size={18} strokeWidth={2} color="#1d4ed8" aria-hidden />
                  <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>สลิปการชำระเงิน</span>
                  <button
                    type="button"
                    onClick={() => setSlipModalSale(null)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4, display: "flex" }}
                    aria-label="ปิด"
                  >
                    <X size={20} strokeWidth={2} />
                  </button>
                </div>

                <div style={{ padding: "14px 16px 0" }}>
                  <div style={{ background: "#f5f5f7", borderRadius: 12, padding: 12, display: "flex", justifyContent: "center", alignItems: "center", minHeight: 160 }}>
                    <img
                      src={slipModalSale.paymentSlipImage}
                      alt="สลิปโอนเงิน"
                      style={{ maxWidth: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 8 }}
                    />
                  </div>
                </div>

                <div style={{ padding: "12px 20px", fontSize: 13, color: "#334155", lineHeight: 1.9 }}>
                  <div>ออเดอร์: <strong>{slipModalSale.orderNumber}</strong></div>
                  <div>ยอด: <strong style={{ color: "#1b5e20" }}>{formatMoney(slipModalSale.ownerNet ?? slipModalSale.grandTotal)}</strong></div>
                  {slipModalSale.recordedAt ? (
                    <div>เวลา: {new Date(slipModalSale.recordedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</div>
                  ) : null}
                  {slipModalSale.paymentBatchNumber ? (
                    <div>Batch: <strong style={{ color: "#1d4ed8" }}>{slipModalSale.paymentBatchNumber}</strong></div>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 8, padding: "0 16px 16px" }}>
                  <button
                    type="button"
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      background: slipModalSale.payStatus === "paid" ? "#e2e8f0" : "#16a34a",
                      color: slipModalSale.payStatus === "paid" ? "#64748b" : "#fff",
                      border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 700,
                      cursor: slipModalSale.payStatus === "paid" ? "default" : "pointer",
                      fontFamily: "inherit",
                    }}
                    disabled={slipModalSale.payStatus === "paid" || updatingSaleId === slipModalSale.id}
                    onClick={() => void handleSlipModalConfirm()}
                  >
                    <CheckCircle2 size={16} strokeWidth={2.5} aria-hidden />
                    {slipModalSale.payStatus === "paid" ? "ชำระแล้ว" : "ยืนยันชำระ"}
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      background: "#dc2626", color: "#fff",
                      border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                    disabled={updatingSaleId === slipModalSale.id}
                    onClick={() => void handleSlipModalReject()}
                  >
                    <XCircle size={16} strokeWidth={2.5} aria-hidden />
                    ปฏิเสธ
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

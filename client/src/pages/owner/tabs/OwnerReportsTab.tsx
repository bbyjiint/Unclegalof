import { ChevronDown, ChevronUp, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "../../../data/constants";
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
    viewPaymentSlipAndMark,
    removePaymentSlipByOwner,
    updatingSaleId
  } = useOwnerDashboard();

  const [filtersOpen, setFiltersOpen] = useState(true);
  const isDesktopReports = useMinWidth(900);

  const batchMap = new Map<string, { total: number; paid: boolean }>();
  for (const sale of filteredAndSortedSales) {
    if (!sale.paymentBatchId) continue;
    if (!batchMap.has(sale.paymentBatchId)) {
      batchMap.set(sale.paymentBatchId, {
        total: Number(sale.paymentBatchTotalAmount || 0),
        paid: sale.payStatus === "paid",
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
      <div className="owner-dash__card owner-dash__card--muted rep-filters-card">
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
                  const isUpdating = updatingSaleId === sale.id;
                  const canConfirm =
                    sale.payStatus !== "paid" &&
                    !!sale.paymentSlipImage &&
                    !!sale.slipViewedAt &&
                    !isUpdating;

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
                        <div className="rep-card__total">{formatMoney(sale.grandTotal)}</div>
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

                      <div className="rep-card__actions">
                        {sale.paymentSlipImage ? (
                          <>
                            <button
                              type="button"
                              className="rep-btn rep-btn--view"
                              onClick={() => void viewPaymentSlipAndMark(sale.id, sale.paymentSlipImage!)}
                            >
                              ดูสลิป
                            </button>
                            <button
                              type="button"
                              className="rep-btn rep-btn--danger"
                              onClick={() => void removePaymentSlipByOwner(sale.id)}
                              disabled={isUpdating}
                            >
                              ลบสลิป
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          className="rep-btn rep-btn--confirm"
                          disabled={!canConfirm}
                          onClick={() => void confirmSalePaid(sale.id)}
                        >
                          {sale.payStatus === "paid"
                            ? "ชำระแล้ว"
                            : isUpdating
                              ? "กำลังอัปเดต..."
                              : "ยืนยันชำระ"}
                        </button>
                      </div>
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
                  <th>ยอดรวม</th>
                  <th>ต้นทุนเฉลี่ย/ชิ้น</th>
                  <th>กำไรขาย</th>
                  <th>สถานะ</th>
                  <th>Batch</th>
                  <th>ผู้บันทึก</th>
                  <th>สลิป/ยืนยัน</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>{sale.orderNumber}</td>
                    <td>{sale.type}</td>
                    <td>{sale.qty}</td>
                    <td>{formatMoney(sale.grandTotal)}</td>
                    <td className="csub" style={{ fontSize: 12 }}>
                      {sale.avgUnitCost != null ? formatMoney(sale.avgUnitCost) : "—"}
                    </td>
                    <td className="csub" style={{ fontSize: 12 }}>
                      {sale.grossProfit != null ? formatMoney(sale.grossProfit) : "—"}
                    </td>
                    <td>{sale.payStatus}</td>
                    <td>
                      {sale.paymentBatchNumber ? (
                        <div>
                          <div style={{ fontWeight: 600, color: "#1d4ed8" }}>{sale.paymentBatchNumber}</div>
                          <div className="csub" style={{ fontSize: 11 }}>
                            รวมบิล {formatMoney(Number(sale.paymentBatchTotalAmount || 0))}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <div>{sale.createdByName || sale.createdByUsername || "—"}</div>
                      {sale.recordedAt ? (
                        <div className="csub" style={{ fontSize: 11 }}>
                          {new Date(sale.recordedAt).toLocaleString("th-TH", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                        {sale.paymentSlipImage ? (
                          <>
                            <button
                              type="button"
                              className="btnok"
                              style={{ padding: "8px 12px", fontSize: 13, minHeight: 44 }}
                              onClick={() => void viewPaymentSlipAndMark(sale.id, sale.paymentSlipImage!)}
                            >
                              ดูสลิป
                            </button>
                            <button
                              type="button"
                              className="owner-dash__btn-danger"
                              onClick={() => void removePaymentSlipByOwner(sale.id)}
                              disabled={updatingSaleId === sale.id}
                            >
                              ลบสลิป
                            </button>
                          </>
                        ) : (
                          <span style={{ opacity: 0.7, fontSize: 13 }}>ไม่มีสลิป</span>
                        )}
                        <button
                          type="button"
                          className="btnok"
                          style={{ padding: "8px 12px", fontSize: 13, minHeight: 44 }}
                          disabled={
                            sale.payStatus === "paid" ||
                            !sale.paymentSlipImage ||
                            !sale.slipViewedAt ||
                            updatingSaleId === sale.id
                          }
                          onClick={() => void confirmSalePaid(sale.id)}
                        >
                          {sale.payStatus === "paid"
                            ? "ชำระแล้ว"
                            : updatingSaleId === sale.id
                              ? "กำลังอัปเดต..."
                              : "ยืนยันชำระ"}
                        </button>
                      </div>
                      <div style={{ marginTop: 6, textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: 12,
                            fontWeight: 600,
                            padding: "4px 10px",
                            borderRadius: 8,
                            background: !sale.paymentSlipImage
                              ? "rgba(128,128,128,0.12)"
                              : sale.slipViewedAt
                                ? "rgba(46,125,50,0.14)"
                                : "rgba(245,124,0,0.16)",
                            color: !sale.paymentSlipImage ? "#666" : sale.slipViewedAt ? "#1b5e20" : "#b45309",
                          }}
                        >
                          {!sale.paymentSlipImage
                            ? "ยังไม่มีสลิป"
                            : sale.slipViewedAt
                              ? "ดูสลิปแล้ว"
                              : "ยังไม่ดูสลิป"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
                </table>
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

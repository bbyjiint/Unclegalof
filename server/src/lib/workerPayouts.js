/**
 * Employee payout (worker lift fee + delivery distance fee) calculation.
 *
 * Pricing rules (from product spec):
 *
 *  PICKUP at warehouse:
 *    - 70cm / loft / granite / u   → 100 baht/unit
 *    - 1.5m                        → 500 baht/unit
 *    - 1.8m                        → 500 baht/unit
 *
 *  DELIVERY:
 *    - loft / granite / u          → 500 baht/unit
 *    - 1.5m                        → 800 baht/unit
 *    - 1.8m                        → 1000 baht/unit
 *    - 70cm (bare 70cm tables)     → 0 baht/unit (not specified)
 *
 *  worker_distance_fee = the same delivery zone fee that the customer pays.
 *  employee_payout     = worker_lift_fee + worker_distance_fee (0 for pickup).
 *  owner_net           = customer_total − employee_payout.
 */

/**
 * Map a desk item name to a coarse category used by the lift-fee table.
 * Matches both Thai and English fragments to be robust against minor naming
 * differences across the catalog.
 */
export function categorizeDeskItemByName(name) {
  const raw = String(name || "").trim();
  if (!raw) return "other";
  const lower = raw.toLowerCase();

  if (/1\.5\s*ม|1\.5\s*m|1\.5เมตร|1\.5 เมตร/i.test(raw) || /\b1\.5m\b/.test(lower)) {
    return "1.5m";
  }
  if (/1\.8\s*ม|1\.8\s*m|1\.8เมตร|1\.8 เมตร/i.test(raw) || /\b1\.8m\b/.test(lower)) {
    return "1.8m";
  }
  if (/ลอฟ|loft/i.test(raw)) return "loft";
  if (/แกรนิต|granite/i.test(raw)) return "granite";
  if (/ทรงยู|รูปตัวยู|\bยู\b|\bu\b/i.test(raw)) return "u";
  if (/70|เปล่า/.test(raw)) return "70cm";

  return "other";
}

/**
 * Lift-fee per single unit, given product category and delivery mode.
 * Returns 0 for unknown categories or chairs / accessories.
 */
export function computeUnitWorkerLiftFee(category, deliveryMode) {
  const mode = deliveryMode === "delivery" ? "delivery" : "selfpickup";

  if (mode === "selfpickup") {
    if (category === "70cm" || category === "loft" || category === "granite" || category === "u") {
      return 100;
    }
    if (category === "1.5m" || category === "1.8m") {
      return 500;
    }
    return 0;
  }

  if (category === "loft" || category === "granite" || category === "u") {
    return 500;
  }
  if (category === "1.5m") return 800;
  if (category === "1.8m") return 1000;
  return 0;
}

/**
 * Convenience: per-line lift fee = unit lift fee × qty.
 */
export function computeLineWorkerLiftFee({ name, qty, deliveryMode }) {
  const category = categorizeDeskItemByName(name);
  const unit = computeUnitWorkerLiftFee(category, deliveryMode);
  return unit * Math.max(0, Number(qty || 0));
}

/**
 * Aggregate payout summary for an order.
 *
 * Inputs:
 *  - lines:           [{ name, qty }]
 *  - deliveryMode:    "selfpickup" | "delivery"
 *  - deliveryFee:     baht the customer pays for distance (0 if pickup)
 *  - customerTotal:   baht the customer pays in total (subtotal − discounts + delivery fee)
 *
 * Returns:
 *  { workerLiftFee, workerDistanceFee, employeePayout, ownerNet, perLineLiftFees }
 */
export function computeEmployeePayout({ lines, deliveryMode, deliveryFee, customerTotal }) {
  const mode = deliveryMode === "delivery" ? "delivery" : "selfpickup";
  const safeLines = Array.isArray(lines) ? lines : [];

  const perLineLiftFees = safeLines.map((line) =>
    computeLineWorkerLiftFee({
      name: line.name,
      qty: line.qty,
      deliveryMode: mode,
    })
  );

  const workerLiftFee = perLineLiftFees.reduce((sum, value) => sum + value, 0);
  const workerDistanceFee = mode === "delivery" ? Math.max(0, Number(deliveryFee || 0)) : 0;
  const employeePayout = workerLiftFee + workerDistanceFee;
  const ownerNet = Math.max(0, Number(customerTotal || 0) - employeePayout);

  return {
    workerLiftFee,
    workerDistanceFee,
    employeePayout,
    ownerNet,
    perLineLiftFees,
  };
}

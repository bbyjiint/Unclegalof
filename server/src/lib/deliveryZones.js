/**
 * Fixed km bands ↔ zone id (1–31). Prices live in DB (`DeliveryFee.cost`).
 */

export const DELIVERY_ZONE_BANDS = [
  { range: 1, minKm: 1, maxKm: 10 },
  { range: 2, minKm: 11, maxKm: 15 },
  { range: 3, minKm: 16, maxKm: 29 },
  { range: 4, minKm: 30, maxKm: 39 },
  { range: 5, minKm: 40, maxKm: 49 },
  { range: 6, minKm: 50, maxKm: 59 },
  { range: 7, minKm: 60, maxKm: 69 },
  { range: 8, minKm: 70, maxKm: 79 },
  { range: 9, minKm: 80, maxKm: 89 },
  { range: 10, minKm: 90, maxKm: 99 },
  { range: 11, minKm: 100, maxKm: 109 },
  { range: 12, minKm: 110, maxKm: 119 },
  { range: 13, minKm: 120, maxKm: 129 },
  { range: 14, minKm: 130, maxKm: 139 },
  { range: 15, minKm: 140, maxKm: 149 },
  { range: 16, minKm: 150, maxKm: 159 },
  { range: 17, minKm: 160, maxKm: 169 },
  { range: 18, minKm: 170, maxKm: 179 },
  { range: 19, minKm: 180, maxKm: 189 },
  { range: 20, minKm: 190, maxKm: 199 },
  { range: 21, minKm: 200, maxKm: 209 },
  { range: 22, minKm: 210, maxKm: 219 },
  { range: 23, minKm: 220, maxKm: 229 },
  { range: 24, minKm: 230, maxKm: 239 },
  { range: 25, minKm: 240, maxKm: 249 },
  { range: 26, minKm: 250, maxKm: 259 },
  { range: 27, minKm: 260, maxKm: 269 },
  { range: 28, minKm: 270, maxKm: 279 },
  { range: 29, minKm: 280, maxKm: 289 },
  { range: 30, minKm: 290, maxKm: 299 },
  { range: 31, minKm: 300, maxKm: 99999 },
];

export const DELIVERY_ZONE_COUNT = DELIVERY_ZONE_BANDS.length;

/** Default costs when DB row missing (same as seed). */
export const DEFAULT_DELIVERY_FEES = [
  { range: 1, cost: 0 },
  { range: 2, cost: 100 },
  { range: 3, cost: 200 },
  { range: 4, cost: 300 },
  { range: 5, cost: 400 },
  { range: 6, cost: 500 },
  { range: 7, cost: 600 },
  { range: 8, cost: 700 },
  { range: 9, cost: 800 },
  { range: 10, cost: 900 },
  { range: 11, cost: 1000 },
  { range: 12, cost: 1100 },
  { range: 13, cost: 1200 },
  { range: 14, cost: 1300 },
  { range: 15, cost: 1400 },
  { range: 16, cost: 1500 },
  { range: 17, cost: 1600 },
  { range: 18, cost: 1700 },
  { range: 19, cost: 1800 },
  { range: 20, cost: 1900 },
  { range: 21, cost: 2000 },
  { range: 22, cost: 2100 },
  { range: 23, cost: 2200 },
  { range: 24, cost: 2300 },
  { range: 25, cost: 2400 },
  { range: 26, cost: 2500 },
  { range: 27, cost: 2600 },
  { range: 28, cost: 2700 },
  { range: 29, cost: 2800 },
  { range: 30, cost: 2900 },
  { range: 31, cost: 3000 },
];

const defaultCostByRange = Object.fromEntries(DEFAULT_DELIVERY_FEES.map((r) => [r.range, r.cost]));

/**
 * Map distance (km) to zone id (must match DELIVERY_ZONE_BANDS).
 */
export function getDeliveryRangeFromKm(km) {
  if (!km || km <= 0) return null;
  for (const b of DELIVERY_ZONE_BANDS) {
    if (km >= b.minKm && km <= b.maxKm) {
      return b.range;
    }
  }
  return DELIVERY_ZONE_BANDS[DELIVERY_ZONE_BANDS.length - 1].range;
}

/**
 * @param {Array<{ range: number, cost: number }>} feeRows from Prisma
 */
export function mergeDeliveryZonesWithFees(feeRows) {
  const costByRange = { ...defaultCostByRange };
  for (const row of feeRows) {
    costByRange[row.range] = row.cost;
  }
  return DELIVERY_ZONE_BANDS.map((band) => ({
    range: band.range,
    minKm: band.minKm,
    maxKm: band.maxKm,
    cost: costByRange[band.range] ?? 0,
  }));
}

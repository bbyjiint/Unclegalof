/** โต๊ะที่ 21 ขึ้นไปของเดือน — คอมมิชชั่น 200/ตัว (รีเซ็ตทุกเดือน) */
export const MONTHLY_COMMISSION_FREE_UNITS = 20;
export const MONTHLY_COMMISSION_PER_UNIT_BAHT = 200;

/** โบนัสรายปีตามยอดโต๊ะสะสมในปี (รีเซ็ตทุกปี) */
export const YEARLY_BONUS_TIERS = [
  { units: 250, bonusBaht: 10000 },
  { units: 280, bonusBaht: 15000 },
  { units: 300, bonusBaht: 20000 },
  { units: 350, bonusBaht: 30000 },
  { units: 400, bonusBaht: 40000 },
  { units: 450, bonusBaht: 50000 },
];

/**
 * จำนวนโต๊ะในรายการขายนี้ที่ได้รับคอม 200/ตัว (หลังโต๊ะที่ 20 ของเดือน)
 * @param {number} priorUnitsInMonth - ยอดโต๊ะสะสมในเดือนเดียวกันก่อนรายการนี้
 * @param {number} qty - จำนวนในบิลนี้
 */
export function commissionEligibleUnitsForLine(priorUnitsInMonth, qty) {
  const prior = priorUnitsInMonth;
  const after = prior + qty;
  const overAfter = Math.max(0, after - MONTHLY_COMMISSION_FREE_UNITS);
  const overPrior = Math.max(0, prior - MONTHLY_COMMISSION_FREE_UNITS);
  return overAfter - overPrior;
}

export function commissionBahtForLine(priorUnitsInMonth, qty) {
  return commissionEligibleUnitsForLine(priorUnitsInMonth, qty) * MONTHLY_COMMISSION_PER_UNIT_BAHT;
}

/**
 * @param {number} yearlyUnitsSold
 * @returns {{ currentTier: { units: number, bonusBaht: number } | null, nextTier: { units: number, bonusBaht: number } | null, tablesUntilNext: number | null }}
 */
export function yearlyBonusProgress(yearlyUnitsSold) {
  const tiers = [...YEARLY_BONUS_TIERS].sort((a, b) => a.units - b.units);
  let currentTier = null;
  for (const t of tiers) {
    if (yearlyUnitsSold >= t.units) {
      currentTier = t;
    }
  }
  const nextTier = tiers.find((t) => t.units > yearlyUnitsSold) ?? null;
  const tablesUntilNext = nextTier ? nextTier.units - yearlyUnitsSold : null;
  return { currentTier, nextTier, tablesUntilNext };
}

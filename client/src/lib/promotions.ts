import { formatMoney } from "../data/constants";
import type { Promotion } from "../types";

/** Baht discount per unit from a promotion, given current unit list price. */
export function promoUnitDiscountBaht(promo: Promotion, unitPrice: number): number {
  const price = Math.max(0, Math.floor(Number(unitPrice) || 0));
  if (promo.amountType === "percent") {
    const p = Math.min(100, Math.max(0, Math.floor(promo.amount)));
    return Math.min(price, Math.round((price * p) / 100));
  }
  return Math.min(price, Math.max(0, Math.floor(promo.amount)));
}

export function formatPromoValueLabel(promo: Pick<Promotion, "amountType" | "amount">): string {
  if (promo.amountType === "percent") {
    return `${promo.amount}%`;
  }
  return formatMoney(promo.amount);
}

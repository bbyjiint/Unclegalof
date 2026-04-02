import type { DeliveryZoneRow } from "../types";

/** Resolve zone and delivery fee for a distance using API zone list. */
export function zoneForKm(
  zones: DeliveryZoneRow[],
  km: number
): { label: string; fee: number; range: number } | null {
  if (!km || km <= 0 || zones.length === 0) {
    return null;
  }
  const row =
    zones.find((z) => km >= z.minKm && km <= z.maxKm) ?? zones[zones.length - 1];
  if (!row) {
    return null;
  }
  const maxLabel = row.maxKm >= 9999 ? "300+" : String(row.maxKm);
  return {
    range: row.range,
    fee: row.cost,
    label: `โซน ${row.range} (${row.minKm}–${maxLabel} กม.)`
  };
}

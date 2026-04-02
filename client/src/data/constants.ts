type PriceRow = {
  self: number | null;
  delivery: number | null;
};

export type DeliveryZone = {
  label: string;
  min: number;
  max: number;
  fee: number;
};

export const PRODUCT_TYPES = [
  "โต๊ะลอฟ 70",
  "โต๊ะเปล่า",
  "โต๊ะ 70 แกรนิต",
  "โต๊ะ 85 ทรงยู",
  "โต๊ะ 1.5 ม.",
  "โต๊ะ 1.8 ม.",
  "เก้าอี้เทา",
  "เก้าอี้ขาว/ดำ"
] as const;

export const PRICE_TABLE: Record<string, PriceRow> = {
  "โต๊ะลอฟ 70": { self: 2500, delivery: 3000 },
  "โต๊ะ 70 แกรนิต": { self: 2800, delivery: 3300 },
  "โต๊ะ 85 ทรงยู": { self: 2800, delivery: 3300 },
  "โต๊ะ 1.5 ม.": { self: 6000, delivery: 6500 },
  "โต๊ะ 1.8 ม.": { self: 7000, delivery: 7500 },
  "โต๊ะเปล่า": { self: null, delivery: null },
  "เก้าอี้เทา": { self: null, delivery: null },
  "เก้าอี้ขาว/ดำ": { self: null, delivery: null }
};

export const ICE_RATES: Record<string, number> = {
  "โต๊ะลอฟ 70": 100,
  "โต๊ะ 70 แกรนิต": 100,
  "โต๊ะ 85 ทรงยู": 100,
  "โต๊ะ 1.5 ม.": 400,
  "โต๊ะ 1.8 ม.": 400,
  "โต๊ะเปล่า": 20,
  "เก้าอี้เทา": 20,
  "เก้าอี้ขาว/ดำ": 20
};

/** Fallback when API delivery fees unavailable; mirrors server `deliveryZones.js` bands. */
export const DELIVERY_ZONES: DeliveryZone[] = [
  { label: "โซน 1 (ฟรี)", min: 1, max: 10, fee: 0 },
  { label: "โซน 2", min: 11, max: 15, fee: 100 },
  { label: "โซน 3", min: 16, max: 29, fee: 200 },
  { label: "โซน 4", min: 30, max: 39, fee: 300 },
  { label: "โซน 5", min: 40, max: 49, fee: 400 },
  { label: "โซน 6", min: 50, max: 59, fee: 500 },
  { label: "โซน 7", min: 60, max: 69, fee: 600 },
  { label: "โซน 8", min: 70, max: 79, fee: 700 },
  { label: "โซน 9", min: 80, max: 89, fee: 800 },
  { label: "โซน 10", min: 90, max: 99, fee: 900 },
  { label: "โซน 11", min: 100, max: 109, fee: 1000 },
  { label: "โซน 12", min: 110, max: 119, fee: 1100 },
  { label: "โซน 13", min: 120, max: 129, fee: 1200 },
  { label: "โซน 14", min: 130, max: 139, fee: 1300 },
  { label: "โซน 15", min: 140, max: 149, fee: 1400 },
  { label: "โซน 16", min: 150, max: 159, fee: 1500 },
  { label: "โซน 17", min: 160, max: 169, fee: 1600 },
  { label: "โซน 18", min: 170, max: 179, fee: 1700 },
  { label: "โซน 19", min: 180, max: 189, fee: 1800 },
  { label: "โซน 20", min: 190, max: 199, fee: 1900 },
  { label: "โซน 21", min: 200, max: 209, fee: 2000 },
  { label: "โซน 22", min: 210, max: 219, fee: 2100 },
  { label: "โซน 23", min: 220, max: 229, fee: 2200 },
  { label: "โซน 24", min: 230, max: 239, fee: 2300 },
  { label: "โซน 25", min: 240, max: 249, fee: 2400 },
  { label: "โซน 26", min: 250, max: 259, fee: 2500 },
  { label: "โซน 27", min: 260, max: 269, fee: 2600 },
  { label: "โซน 28", min: 270, max: 279, fee: 2700 },
  { label: "โซน 29", min: 280, max: 289, fee: 2800 },
  { label: "โซน 30", min: 290, max: 299, fee: 2900 },
  { label: "โซน 31", min: 300, max: 99999, fee: 3000 }
];

export function formatMoney(value: number): string {
  return `฿${Math.round(value || 0).toLocaleString("th-TH")}`;
}

export function getZoneByKm(km: number): DeliveryZone | null {
  if (!km || km <= 0) return null;
  return DELIVERY_ZONES.find((zone) => km >= zone.min && km <= zone.max) || DELIVERY_ZONES[DELIVERY_ZONES.length - 1];
}

import { prisma } from "./prisma.js";
import { DEFAULT_DELIVERY_FEES } from "./deliveryZones.js";

const defaultDeskItems = [
  { name: "ลอฟขาเอียง", onsitePrice: 2500, deliveryPrice: 3000 },
  { name: "ลอฟขาตรง", onsitePrice: 2500, deliveryPrice: 3000 },
  { name: "แกรนิต", onsitePrice: 2800, deliveryPrice: 3300 },
  { name: "ทรงยู", onsitePrice: 2800, deliveryPrice: 3300 },
  { name: "1.5 เมตร", onsitePrice: 6000, deliveryPrice: 6500 },
  { name: "1.8 เมตร", onsitePrice: 7000, deliveryPrice: 7500 },
];

const defaultPromotions = [
  { name: "ส่วนลดเปิดร้าน 100 บาท", amountType: "fixed", amount: 100, isActive: true },
  { name: "ส่วนลดหน้าร้าน 5%", amountType: "percent", amount: 5, isActive: true },
];

/** Ensure all delivery zone rows exist (does not overwrite existing costs). */
export async function ensureAllDeliveryFeeRows() {
  await Promise.all(
    DEFAULT_DELIVERY_FEES.map((row) =>
      prisma.deliveryFee.upsert({
        where: { range: row.range },
        update: {},
        create: row,
      })
    )
  );
}

export async function ensureDefaultCatalog() {
  const [deskItemCount, deliveryFeeCount, promotionCount] = await Promise.all([
    prisma.deskItem.count(),
    prisma.deliveryFee.count(),
    prisma.promotion.count(),
  ]);

  if (deskItemCount === 0) {
    await prisma.deskItem.createMany({ data: defaultDeskItems });
  }

  if (deliveryFeeCount === 0) {
    await prisma.deliveryFee.createMany({ data: DEFAULT_DELIVERY_FEES });
  } else {
    await ensureAllDeliveryFeeRows();
  }

  if (promotionCount === 0) {
    await prisma.promotion.createMany({ data: defaultPromotions });
  }
}

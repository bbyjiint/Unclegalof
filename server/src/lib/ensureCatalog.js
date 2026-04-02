import { prisma } from "./prisma.js";

const defaultDeskItems = [
  { name: "ลอฟขาเอียง", onsitePrice: 2500, deliveryPrice: 3000 },
  { name: "ลอฟขาตรง", onsitePrice: 2500, deliveryPrice: 3000 },
  { name: "แกรนิต", onsitePrice: 2800, deliveryPrice: 3300 },
  { name: "ทรงยู", onsitePrice: 2800, deliveryPrice: 3300 },
  { name: "1.5 เมตร", onsitePrice: 6000, deliveryPrice: 6500 },
  { name: "1.8 เมตร", onsitePrice: 7000, deliveryPrice: 7500 },
];

const defaultDeliveryFees = [
  { range: 1, cost: 0 },
  { range: 2, cost: 100 },
  { range: 3, cost: 200 },
  { range: 4, cost: 300 },
  { range: 5, cost: 400 },
  { range: 6, cost: 500 },
  { range: 7, cost: 600 },
  { range: 8, cost: 700 },
  { range: 9, cost: 1000 },
  { range: 10, cost: 1100 },
  { range: 11, cost: 1200 },
  { range: 12, cost: 1300 },
  { range: 13, cost: 1400 },
  { range: 14, cost: 1500 },
  { range: 15, cost: 1600 },
  { range: 16, cost: 1700 },
  { range: 17, cost: 1800 },
  { range: 18, cost: 1900 },
  { range: 19, cost: 2000 },
  { range: 20, cost: 2500 },
];

const defaultPromotions = [
  { name: "ส่วนลดเปิดร้าน 100 บาท", amountType: "fixed", amount: 100, isActive: true },
  { name: "ส่วนลดหน้าร้าน 5%", amountType: "percent", amount: 5, isActive: true },
];

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
    await prisma.deliveryFee.createMany({ data: defaultDeliveryFees });
  }

  if (promotionCount === 0) {
    await prisma.promotion.createMany({ data: defaultPromotions });
  }
}

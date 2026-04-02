import "../scripts/prisma-env.mjs";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_DELIVERY_FEES } from "../src/lib/deliveryZones.js";

const prisma = new PrismaClient();

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

async function main() {
  for (const item of defaultDeskItems) {
    await prisma.deskItem.upsert({
      where: { name: item.name },
      update: {
        onsitePrice: item.onsitePrice,
        deliveryPrice: item.deliveryPrice,
      },
      create: item,
    });
  }

  for (const fee of DEFAULT_DELIVERY_FEES) {
    await prisma.deliveryFee.upsert({
      where: { range: fee.range },
      update: { cost: fee.cost },
      create: fee,
    });
  }

  for (const promo of defaultPromotions) {
    await prisma.promotion.upsert({
      where: { name: promo.name },
      update: {
        amountType: promo.amountType,
        amount: promo.amount,
        isActive: promo.isActive,
      },
      create: promo,
    });
  }

  console.log("Seeded default catalog, delivery fees, and promotions.");
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

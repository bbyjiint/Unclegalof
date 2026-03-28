import { prisma } from "./prisma.js";

/**
 * Load promotions with amountType via raw SQL so it works even when @prisma/client
 * was generated before Promotion.amountType existed.
 */
export async function findAllPromotionsRows() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, name, amount, "isActive", "createdAt", "updatedAt", ("amountType"::text) AS atype
    FROM "Promotion"
    ORDER BY "createdAt" DESC
  `);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    amount: row.amount,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    amountType: row.atype === "percent" ? "percent" : "fixed",
  }));
}

export async function findPromotionRowById(id) {
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT id, name, amount, "isActive", "createdAt", "updatedAt", ("amountType"::text) AS atype
    FROM "Promotion"
    WHERE id = $1::uuid
    LIMIT 1
  `,
    id
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    amountType: row.atype === "percent" ? "percent" : "fixed",
  };
}

/**
 * Create promotion without passing amountType into prisma.create (stale client),
 * then set enum via SQL when needed.
 */
export async function createPromotionWithAmountType(payload) {
  const promotion = await prisma.promotion.create({
    data: {
      name: payload.name,
      amount: payload.amount,
      isActive: payload.active,
    },
  });

  if (payload.amountType === "percent") {
    await prisma.$executeRawUnsafe(
      `UPDATE "Promotion" SET "amountType" = $1::"PromotionAmountType" WHERE id = $2::uuid`,
      "percent",
      promotion.id
    );
  }

  return findPromotionRowById(promotion.id);
}

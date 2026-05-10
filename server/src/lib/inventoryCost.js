/**
 * Simple arithmetic mean of recorded ต้นทุน/หน่วย (each stock receipt with cost = one sample).
 */

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} deskItemId
 * @returns {Promise<{ avgUnitCost: number } | null>}
 */
export async function getAverageRecordedCost(prisma, deskItemId) {
  const agg = await prisma.deskItemCostLog.aggregate({
    where: { deskItemId },
    _avg: { costPerUnit: true },
    _count: { _all: true },
  });
  if (!agg._count || agg._count._all === 0 || agg._avg.costPerUnit == null) {
    return null;
  }
  return { avgUnitCost: Math.round(agg._avg.costPerUnit) };
}

/**
 * Owner dashboard: all active lots per product in FIFO order (oldest first).
 * Returns raw lot-level data — no averaging, no aggregation.
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function getAllCostPositionsForOwner(prisma) {
  const deskItems = await prisma.deskItem.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Fetch all lots with remaining stock, oldest first (= FIFO consumption order).
  const lots = await prisma.inventoryLot.findMany({
    where: { remainingQty: { gt: 0 } },
    select: {
      id: true,
      deskItemId: true,
      remainingQty: true,
      costPerUnit: true,
      createdAt: true,
      note: true,
    },
    orderBy: [{ deskItemId: "asc" }, { createdAt: "asc" }],
  });

  const lotsByDesk = new Map();
  for (const lot of lots) {
    if (!lotsByDesk.has(lot.deskItemId)) {
      lotsByDesk.set(lot.deskItemId, []);
    }
    lotsByDesk.get(lot.deskItemId).push({
      id: lot.id,
      remainingQty: lot.remainingQty,
      costPerUnit: lot.costPerUnit,
      totalValue: lot.remainingQty * lot.costPerUnit,
      receivedAt: lot.createdAt.toISOString(),
      note: lot.note ?? null,
    });
  }

  return deskItems.map((d) => {
    const productLots = lotsByDesk.get(d.id) ?? [];
    const onHandQty = productLots.reduce((s, l) => s + l.remainingQty, 0);
    const pendingQty = productLots
      .filter((l) => l.costPerUnit === 0)
      .reduce((s, l) => s + l.remainingQty, 0);
    return {
      deskItemId: d.id,
      name: d.name,
      onHandQty,
      pendingQty,
      lots: productLots,
    };
  });
}

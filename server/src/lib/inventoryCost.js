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
 * Owner dashboard: คงคลัง from lots + ต้นทุนเฉลี่ยจาก mean(บันทึกรับของ).
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function getAllCostPositionsForOwner(prisma) {
  const deskItems = await prisma.deskItem.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const lots = await prisma.inventoryLot.findMany({
    where: { remainingQty: { gt: 0 } },
    select: { deskItemId: true, remainingQty: true },
  });
  const onHandByDesk = new Map();
  for (const l of lots) {
    onHandByDesk.set(l.deskItemId, (onHandByDesk.get(l.deskItemId) ?? 0) + l.remainingQty);
  }
  const logAggs = await prisma.deskItemCostLog.groupBy({
    by: ["deskItemId"],
    _avg: { costPerUnit: true },
    _count: { _all: true },
  });
  const logByDesk = new Map(
    logAggs.map((row) => [
      row.deskItemId,
      {
        avgUnitCost: row._avg.costPerUnit != null ? Math.round(row._avg.costPerUnit) : null,
        costSampleCount: row._count._all,
      },
    ])
  );
  return deskItems.map((d) => {
    const log = logByDesk.get(d.id);
    return {
      deskItemId: d.id,
      name: d.name,
      onHandQty: onHandByDesk.get(d.id) ?? 0,
      avgUnitCost: log?.avgUnitCost ?? null,
      costSampleCount: log?.costSampleCount ?? 0,
    };
  });
}

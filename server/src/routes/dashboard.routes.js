import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOwner } from "../middleware/authorize.middleware.js";
import { promotionToFrontend } from "../lib/adapters.js";
import { findAllPromotionsRows } from "../lib/promotions.db.js";
import { getAllCostPositionsForOwner } from "../lib/inventoryCost.js";
import { saleRecordFrontendInclude, saleRecordsToFrontendSales } from "../lib/salesOrders.js";

const router = Router();

const queryMonthYearSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

const queryYearSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

/** Monthly revenue for bar chart — same totals as dashboard summary income (sum of SaleRecord.amount). */
router.get(
  "/owner/monthly-income",
  authenticate,
  requireOwner,
  validate(queryYearSchema, "query"),
  async (req, res, next) => {
    try {
      const yr = Number(req.query.year);
      const promises = [];
      for (let m = 1; m <= 12; m++) {
        const start = new Date(Date.UTC(yr, m - 1, 1));
        const end = new Date(Date.UTC(yr, m, 1));
        promises.push(
          prisma.saleRecord.aggregate({
            where: { saleDate: { gte: start, lt: end } },
            _sum: { amount: true },
          }),
        );
      }
      const results = await Promise.all(promises);
      const incomeByMonth = results.map((row) => Number(row._sum.amount ?? 0));
      res.json({ year: yr, incomeByMonth });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/dashboard/owner — sales list for selected month; financial summary = all-time (รายรับ − ต้นทุนสินค้า)
router.get(
  "/owner",
  authenticate,
  requireOwner,
  validate(queryMonthYearSchema, "query"),
  async (req, res, next) => {
    try {
      const month = Number(req.query.month);
      const year = Number(req.query.year);
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));

      const saleRecordsMonth = await prisma.saleRecord.findMany({
        where: {
          saleDate: {
            gte: start,
            lt: end,
          },
        },
        include: {
          ...saleRecordFrontendInclude,
          commissions: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const promotionRows = await findAllPromotionsRows();

      const sales = saleRecordsToFrontendSales(saleRecordsMonth, { includeCost: true });

      const promotionsFrontend = promotionRows.map((promo, index) => promotionToFrontend(promo, index));

      // Monthly totals for the selected month/year — same date window as the sales list above.
      const [allIncomeAgg, confirmedAgg, pendingCostRecords, legacyRows] = await Promise.all([
        // Total revenue — all sales regardless of cost status.
        prisma.saleRecord.aggregate({
          where: { saleDate: { gte: start, lt: end } },
          _sum: { amount: true },
        }),
        // Confirmed-cost records only — used for profit/margin so pending cost does not inflate profit.
        prisma.saleRecord.aggregate({
          where: { saleDate: { gte: start, lt: end }, costStatus: "confirmed" },
          _sum: { amount: true, cogsTotal: true },
        }),
        // Pending-cost records — returned in full so the owner can see exactly which lines need attention.
        prisma.saleRecord.findMany({
          where: { saleDate: { gte: start, lt: end }, costStatus: "pending_owner_review" },
          select: {
            id: true,
            orderNumber: true,
            quantity: true,
            amount: true,
            saleDate: true,
            deskItem: { select: { name: true } },
            salesOrder: { select: { orderNumber: true } },
          },
          orderBy: [{ saleDate: "asc" }, { createdAt: "asc" }],
        }),
        // Legacy rows: confirmed but cogsTotal=0 yet have avgUnitCostSnapshot (pre-FIFO orders).
        prisma.saleRecord.findMany({
          where: {
            saleDate: { gte: start, lt: end },
            costStatus: "confirmed",
            cogsTotal: { lte: 0 },
            avgUnitCostSnapshot: { gt: 0 },
          },
          select: { quantity: true, avgUnitCostSnapshot: true },
        }),
      ]);

      const income = Number(allIncomeAgg._sum.amount ?? 0);
      const confirmedIncome = Number(confirmedAgg._sum.amount ?? 0);
      let cogsFromSales = Number(confirmedAgg._sum.cogsTotal ?? 0);
      for (const r of legacyRows) {
        cogsFromSales += Number(r.avgUnitCostSnapshot) * Number(r.quantity ?? 0);
      }
      const cost = cogsFromSales;
      const profit = confirmedIncome - cost;
      const margin = confirmedIncome > 0 ? Math.round((profit / confirmedIncome) * 1000) / 10 : 0;
      const pendingCostLineCount = pendingCostRecords.length;
      const pendingCostRevenue = pendingCostRecords.reduce((s, r) => s + Number(r.amount), 0);

      // For each pending line, fetch the individual consumed lots that still have zero cost
      // so the owner can see exactly which lot dates to fill in — not just a count.
      const pendingConsumedLots =
        pendingCostRecords.length > 0
          ? await prisma.salesOrderLineConsumedLot.findMany({
              where: {
                saleRecordId: { in: pendingCostRecords.map((r) => r.id) },
                costPerUnitAtSale: 0,
              },
              select: {
                saleRecordId: true,
                consumedQty: true,
                inventoryLotId: true,
                inventoryLot: { select: { createdAt: true } },
              },
              orderBy: { createdAt: "asc" },
            })
          : [];

      const pendingLotsBySaleRecord = new Map();
      for (const cl of pendingConsumedLots) {
        if (!pendingLotsBySaleRecord.has(cl.saleRecordId)) {
          pendingLotsBySaleRecord.set(cl.saleRecordId, []);
        }
        pendingLotsBySaleRecord.get(cl.saleRecordId).push({
          consumedQty: cl.consumedQty,
          // null = unallocated shortage — cost can never be recovered from a lot
          receivedAt: cl.inventoryLot?.createdAt?.toISOString() ?? null,
        });
      }

      const pendingCostOrders = pendingCostRecords.map((r) => ({
        id: r.id,
        orderNumber: r.salesOrder?.orderNumber ?? r.orderNumber.replace(/-L\d+$/, ""),
        productName: r.deskItem?.name ?? "",
        qty: r.quantity,
        amount: Number(r.amount),
        saleDate: r.saleDate.toISOString(),
        pendingLots: pendingLotsBySaleRecord.get(r.id) ?? [],
      }));

      const costPositions = await getAllCostPositionsForOwner(prisma);

      /** Commissions + worker payouts — grouped `sales` avoid double-counting order-level lift/distance. */
      let salesCommission = 0;
      for (const r of saleRecordsMonth) {
        for (const c of r.commissions || []) {
          salesCommission += Number(c.amount || 0);
        }
      }
      let liftingFees = 0;
      let deliveryWorkerFees = 0;
      for (const s of sales) {
        liftingFees += Number(s.workerLiftFee || 0);
        deliveryWorkerFees += Number(s.workerDistanceFee || 0);
      }
      const staffExpenseTotal = salesCommission + liftingFees + deliveryWorkerFees;

      res.json({
        summary: {
          income,
          cost,
          cogsFromSales,
          profit,
          margin,
          pendingCostLineCount,
          pendingCostRevenue,
          staffExpenses: {
            salesCommission,
            liftingFees,
            deliveryWorkerFees,
            total: staffExpenseTotal,
          },
          ownerNetIncome: Math.max(0, Math.round(profit - staffExpenseTotal)),
        },
        pendingCostOrders,
        costPositions,
        promotions: promotionsFrontend,
        sales,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

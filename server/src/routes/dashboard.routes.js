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

/** Monthly revenue for bar chart — single GROUP BY query instead of 12 aggregates. */
router.get(
  "/owner/monthly-income",
  authenticate,
  requireOwner,
  validate(queryYearSchema, "query"),
  async (req, res, next) => {
    try {
      const yr = Number(req.query.year);
      const yearStart = new Date(Date.UTC(yr, 0, 1));
      const yearEnd = new Date(Date.UTC(yr + 1, 0, 1));

      const rows = await prisma.$queryRaw`
        SELECT
          EXTRACT(MONTH FROM "saleDate")::int AS month,
          COALESCE(SUM(amount), 0)::float8     AS total
        FROM "SaleRecord"
        WHERE "saleDate" >= ${yearStart} AND "saleDate" < ${yearEnd}
        GROUP BY EXTRACT(MONTH FROM "saleDate")
      `;

      const incomeByMonth = Array.from({ length: 12 }, (_, i) => {
        const row = rows.find((r) => Number(r.month) === i + 1);
        return Number(row?.total ?? 0);
      });

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

      // All independent queries run in parallel — collapses 5 serial DB round-trips into 1.
      const [saleRecordsMonth, promotionRows, costPositions] = await Promise.all([
        prisma.saleRecord.findMany({
          where: { saleDate: { gte: start, lt: end } },
          include: { ...saleRecordFrontendInclude, commissions: true },
          orderBy: { createdAt: "desc" },
        }),
        findAllPromotionsRows(),
        getAllCostPositionsForOwner(prisma),
      ]);

      const sales = saleRecordsToFrontendSales(saleRecordsMonth, { includeCost: true });
      const promotionsFrontend = promotionRows.map((promo, index) => promotionToFrontend(promo, index));

      // Compute monthly financial aggregates from the already-fetched records —
      // avoids 4 additional DB queries (allIncomeAgg, confirmedAgg, legacyRows, pendingCostRecords).
      let income = 0;
      let confirmedIncome = 0;
      let cogsFromSales = 0;
      const pendingCostRecords = [];

      for (const r of saleRecordsMonth) {
        const amount = Number(r.amount || 0);
        income += amount;

        if (r.costStatus === "confirmed") {
          confirmedIncome += amount;
          const cogs = Number(r.cogsTotal || 0);
          if (cogs > 0) {
            cogsFromSales += cogs;
          } else if (Number(r.avgUnitCostSnapshot || 0) > 0) {
            // Legacy rows: confirmed but FIFO COGS not recorded — fall back to snapshot average.
            cogsFromSales += Number(r.avgUnitCostSnapshot) * Number(r.quantity || 0);
          }
        } else if (r.costStatus === "pending_owner_review") {
          pendingCostRecords.push(r);
        }
      }

      const cost = cogsFromSales;
      const profit = confirmedIncome - cost;
      const margin = confirmedIncome > 0 ? Math.round((profit / confirmedIncome) * 1000) / 10 : 0;
      const pendingCostLineCount = pendingCostRecords.length;
      const pendingCostRevenue = pendingCostRecords.reduce((s, r) => s + Number(r.amount), 0);

      // One conditional round-trip — depends on pendingCostRecords computed above.
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

      // Sort pending records saleDate asc, createdAt asc — matches original DB ordering.
      const sortedPending = [...pendingCostRecords].sort((a, b) => {
        const dateDiff = new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime();
        return dateDiff !== 0 ? dateDiff : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      const pendingCostOrders = sortedPending.map((r) => ({
        id: r.id,
        orderNumber: r.salesOrder?.orderNumber ?? r.orderNumber.replace(/-L\d+$/, ""),
        productName: r.deskItem?.name ?? "",
        qty: r.quantity,
        amount: Number(r.amount),
        saleDate: r.saleDate.toISOString(),
        pendingLots: pendingLotsBySaleRecord.get(r.id) ?? [],
      }));

      /** Commissions + worker payouts — grouped `sales` avoids double-counting order-level lift/distance. */
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

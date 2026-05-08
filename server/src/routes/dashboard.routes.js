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

      // All-time totals — aggregate in the DB rather than loading every row into memory.
      // Note: rows where cogsTotal <= 0 but avgUnitCostSnapshot > 0 need the fallback
      // (quantity * avgUnitCostSnapshot). We fetch that subset only — typically a tiny
      // fraction of total rows (legacy data before cogsTotal was populated).
      const [aggResult, legacyRows] = await Promise.all([
        prisma.saleRecord.aggregate({
          _sum: { amount: true, cogsTotal: true },
        }),
        prisma.saleRecord.findMany({
          where: { cogsTotal: { lte: 0 }, avgUnitCostSnapshot: { gt: 0 } },
          select: { quantity: true, avgUnitCostSnapshot: true },
        }),
      ]);

      const income = Number(aggResult._sum.amount ?? 0);
      let cogsFromSales = Number(aggResult._sum.cogsTotal ?? 0);
      for (const r of legacyRows) {
        cogsFromSales += Number(r.avgUnitCostSnapshot) * Number(r.quantity ?? 0);
      }
      const cost = cogsFromSales;
      const profit = income - cost;
      const margin = income > 0 ? Math.round((profit / income) * 1000) / 10 : 0;

      const costPositions = await getAllCostPositionsForOwner(prisma);

      res.json({
        summary: {
          income,
          cost,
          cogsFromSales,
          profit,
          margin,
        },
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

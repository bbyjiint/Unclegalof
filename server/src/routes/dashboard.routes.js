import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOwner } from "../middleware/authorize.middleware.js";
import { saleRecordToSale, promotionToFrontend } from "../lib/adapters.js";
import { findAllPromotionsRows } from "../lib/promotions.db.js";
import { getAllCostPositionsForOwner } from "../lib/inventoryCost.js";

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
          promotion: true,
          deskItem: true,
          commissions: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const promotionRows = await findAllPromotionsRows();

      const sales = saleRecordsMonth.map((sale, index) => saleRecordToSale(sale, index, { includeCost: true }));

      const promotionsFrontend = promotionRows.map((promo, index) => promotionToFrontend(promo, index));

      const allSalesAgg = await prisma.saleRecord.aggregate({
        _sum: { amount: true, cogsTotal: true },
      });
      const income = allSalesAgg._sum.amount ?? 0;
      const cogsFromSales = allSalesAgg._sum.cogsTotal ?? 0;
      const cost = cogsFromSales;
      const profit = income - cost;
      const margin = income > 0 ? (profit / income) * 100 : 0;

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

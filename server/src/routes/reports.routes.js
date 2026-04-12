import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOwner } from "../middleware/authorize.middleware.js";

const router = Router();

const queryMonthYearSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

/**
 * GET /api/reports?month=&year=
 * Owner only — aggregates for the whole company.
 */
router.get(
  "/",
  authenticate,
  requireOwner,
  validate(queryMonthYearSchema, "query"),
  async (req, res, next) => {
    try {
      const month = Number(req.query.month);
      const year = Number(req.query.year);
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));

      const saleRecords = await prisma.saleRecord.findMany({
        where: {
          saleDate: {
            gte: start,
            lt: end,
          },
        },
        include: {
          commissions: true,
        },
      });

      const orderCount = new Set(saleRecords.map((sale) => sale.salesOrderId || sale.id)).size;
      const grossIncome = saleRecords.reduce((sum, s) => sum + s.amount, 0);
      const commissionTotal = saleRecords.reduce((sum, s) => {
        const c = s.commissions?.reduce((a, b) => a + b.amount, 0) || 0;
        return sum + c;
      }, 0);

      res.json({
        month,
        year,
        summary: {
          orderCount,
          grossIncome,
          commissionTotal,
          netAfterCommissions: grossIncome - commissionTotal,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireStaff, requireTenant } from "../middleware/authorize.middleware.js";
import { saleRecordToSale } from "../lib/adapters.js";

const router = Router();

const queryMonthYearSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

/**
 * GET /api/orders?month=&year=
 * Orders for the current tenant (same underlying data as sales list).
 */
router.get(
  "/",
  authenticate,
  requireTenant,
  requireStaff,
  validate(queryMonthYearSchema, "query"),
  async (req, res, next) => {
    try {
      const month = Number(req.query.month);
      const year = Number(req.query.year);
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));

      const saleRecords = await prisma.saleRecord.findMany({
        where: {
          ownerId: req.tenantOwnerId,
          saleDate: {
            gte: start,
            lt: end,
          },
        },
        include: {
          promotion: true,
          deskItem: true,
          deliveryFee: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const items = saleRecords.map((sale, index) => saleRecordToSale(sale, index));
      res.json({ items });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

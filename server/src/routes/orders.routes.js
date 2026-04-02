import { Router } from "express";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireSales } from "../middleware/authorize.middleware.js";
import { saleRecordToSale } from "../lib/adapters.js";

const router = Router();

const queryMonthYearSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

/**
 * GET /api/orders?month=&year=
 * Same rules as GET /api/sales: OWNER sees all, SALES only own.
 */
router.get(
  "/",
  authenticate,
  requireSales,
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
          ...(req.role === UserRole.SALES ? { createdByUserId: req.user.id } : {}),
        },
        include: {
          promotion: true,
          deskItem: true,
          deliveryFee: true,
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

      const includeCost = req.role === UserRole.OWNER;
      const items = saleRecords.map((sale, index) => saleRecordToSale(sale, index, { includeCost }));
      res.json({ items });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

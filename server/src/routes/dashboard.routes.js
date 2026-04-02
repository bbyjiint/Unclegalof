import { Router } from "express";
import { z } from "zod";
import { InventoryDirection } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOwner } from "../middleware/authorize.middleware.js";
import { saleRecordToSale, promotionToFrontend } from "../lib/adapters.js";
import { findAllPromotionsRows } from "../lib/promotions.db.js";

const router = Router();

const queryMonthYearSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

// GET /api/dashboard/owner - Owner dashboard data
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

      const tenantMembers = await prisma.user.findMany({
        where: {
          OR: [{ id: req.tenantOwnerId }, { ownerId: req.tenantOwnerId }],
        },
        select: { id: true },
      });
      const tenantUserIds = tenantMembers.map((u) => u.id);

      // Get sales for the month (tenant-scoped)
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
          commissions: true,
        },
        orderBy: { createdAt: "desc" },
      });
      
      const promotionRows = await findAllPromotionsRows();

      // Transform sales to frontend format
      const sales = saleRecords.map((sale, index) => saleRecordToSale(sale, index));

      const promotionsFrontend = promotionRows.map((promo, index) => promotionToFrontend(promo, index));
      
      // Calculate summary
      const income = sales.reduce((sum, sale) => sum + sale.grandTotal, 0);
      
      // Calculate worker costs from commissions
      const workerCost = saleRecords.reduce((sum, sale) => {
        const saleCommissions = sale.commissions?.reduce((cSum, comm) => cSum + comm.amount, 0) || 0;
        return sum + saleCommissions;
      }, 0);
      
      // Get payroll records for the month (workers under this tenant)
      const payrollRecords = await prisma.payrollRecord.findMany({
        where: {
          year,
          month,
          userId: { in: tenantUserIds },
        },
      });
      
      const baseCosts = payrollRecords.reduce((sum, pr) => sum + pr.baseSalary + (pr.bonus || 0) - (pr.deduction || 0), 0);

      const stockInMovements = await prisma.inventoryMovement.findMany({
        where: {
          direction: InventoryDirection.IN,
          createdByUserId: { in: tenantUserIds },
          createdAt: {
            gte: start,
            lt: end,
          },
        },
        include: { lot: true },
      });
      const inventoryCost = stockInMovements.reduce((sum, m) => {
        const cpu = m.lot?.costPerUnit ?? 0;
        return sum + m.qty * cpu;
      }, 0);

      const cost = inventoryCost + workerCost + baseCosts;
      const profit = income - cost;
      const margin = income > 0 ? (profit / income) * 100 : 0;
      
      res.json({
        summary: { income, cost, profit, margin },
        promotions: promotionsFrontend,
        sales,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

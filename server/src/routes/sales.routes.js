import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireBusinessAccess, requireStaff } from "../middleware/authorize.middleware.js";
import { writeRateLimiter } from "../middleware/rateLimit.middleware.js";
import { saleRecordToSale, salePayloadToSaleRecord } from "../lib/adapters.js";

const router = Router();

// Frontend sale schema - matches what frontend sends
const frontendSaleSchema = z.object({
  date: z.string().min(1),
  type: z.string().min(1), // Product type name (e.g., "โต๊ะลอฟ 70")
  qty: z.number().int().positive(),
  price: z.number().nonnegative(),
  pay: z.enum(["paid", "pending", "deposit"]),
  discount: z.number().nonnegative().optional().default(0),
  manualDisc: z.number().nonnegative().optional().default(0),
  manualReason: z.string().optional().default(""),
  delivery: z.enum(["self", "delivery"]),
  km: z.number().nullable().optional(),
  zoneName: z.string().nullable().optional(),
  addr: z.string().optional().default(""),
  note: z.string().optional().default(""),
  wFee: z.number().nonnegative().optional().default(0),
  wType: z.enum(["po", "ice"]),
  promoId: z.union([z.string(), z.number()]).nullable().optional().transform(val => val === null || val === "" ? null : String(val)),
});

const queryMonthYearSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

const paramsIdSchema = z.object({
  id: z.coerce.number().int().positive(), // Frontend sends number IDs
});

// GET /api/sales - Get sales for a month/year
router.get(
  "/",
  authenticate,
  requireBusinessAccess,
  requireStaff,
  validate(queryMonthYearSchema, "query"),
  async (req, res, next) => {
    try {
      const { month, year } = req.query;
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      
      const saleRecords = await prisma.saleRecord.findMany({
        where: {
          businessId: req.businessId,
          createdAt: {
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
      
      // Transform to frontend format
      const items = saleRecords.map((sale, index) => saleRecordToSale(sale, index));
      
      res.json({ items });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/sales - Create a new sale
router.post(
  "/",
  authenticate,
  requireBusinessAccess,
  requireStaff,
  writeRateLimiter,
  validate(frontendSaleSchema),
  async (req, res, next) => {
    try {
      const payload = req.body;
      
      // Find desk item by name (type) for this business
      const deskItem = await prisma.deskItem.findFirst({
        where: {
          businessId: req.businessId,
          name: payload.type,
        },
      });
      
      if (!deskItem) {
        return res.status(404).json({ error: `Desk item "${payload.type}" not found. Please create it first in catalog.` });
      }
      
      // Find promotion if promoId provided
      let promotionId = null;
      if (payload.promoId) {
        // Frontend sends numeric ID (index), so get all promotions and find by index
        const promotions = await prisma.promotion.findMany({
          where: {
            businessId: req.businessId,
          },
          orderBy: { createdAt: "desc" },
        });
        
        // Convert promoId to number if it's a string
        const promoIndex = typeof payload.promoId === "string" 
          ? parseInt(payload.promoId, 10) - 1 
          : payload.promoId - 1;
        
        if (promoIndex >= 0 && promoIndex < promotions.length) {
          promotionId = promotions[promoIndex].id;
        }
      }
      
      // Transform frontend payload to database format
      const saleRecordData = salePayloadToSaleRecord(payload, req.businessId, deskItem.id);
      if (promotionId) {
        saleRecordData.appliedPromotion = promotionId;
      }
      
      // Get sequence number for orderNumber
      const year = new Date(payload.date).getFullYear();
      const month = new Date(payload.date).getMonth() + 1;
      const sequence = await prisma.saleRecord.count({
        where: {
          businessId: req.businessId,
          createdAt: {
            gte: new Date(Date.UTC(year, month - 1, 1)),
            lt: new Date(Date.UTC(year, month, 1)),
          },
        },
      });
      
      const saleRecord = await prisma.saleRecord.create({
        data: saleRecordData,
        include: {
          promotion: true,
          deskItem: true,
          deliveryFee: true,
        },
      });
      
      // Transform to frontend format
      const item = saleRecordToSale(saleRecord, sequence);
      
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/sales/:id - Delete a sale
router.delete(
  "/:id",
  authenticate,
  requireBusinessAccess,
  requireStaff,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Frontend sends numeric ID, but we need to find by UUID
      // For now, we'll need to get all sales and find by sequence
      // This is not ideal - consider adding a sequenceNumber field to SaleRecord
      const saleRecords = await prisma.saleRecord.findMany({
        where: {
          businessId: req.businessId,
        },
        orderBy: { createdAt: "desc" },
      });
      
      const sale = saleRecords[id - 1]; // Frontend uses 1-based index
      
      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }
      
      if (sale.businessId !== req.businessId) {
        return res.status(403).json({ error: "Access denied: Cannot delete other business data" });
      }
      
      await prisma.saleRecord.delete({
        where: { id: sale.id },
      });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

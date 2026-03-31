import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOwnerOrAdmin, requireStaff, requireTenant } from "../middleware/authorize.middleware.js";
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
  delivery: z.enum(["selfpickup", "delivery"]),
  km: z.number().nullable().optional(),
  zoneName: z.string().nullable().optional(),
  addr: z.string().optional().default(""),
  deliveryAddress: z.string().optional().default(""),
  note: z.string().optional().default(""),
  wFee: z.number().nonnegative().optional().default(0),
  wType: z.enum(["po", "ice"]),
  promoId: z.string().uuid().nullable().optional(),
});

const queryMonthYearSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

const paramsIdSchema = z.object({
  id: z.string().uuid(),
});

const uploadPaymentSlipSchema = z.object({
  imageData: z.string().min(1),
});

const updateSaleStatusSchema = z.object({
  status: z.enum(["paid", "pending", "deposit"]),
});

// GET /api/sales - Get sales for a month/year
router.get(
  "/",
  authenticate,
  requireTenant,
  requireStaff,
  validate(queryMonthYearSchema, "query"),
  async (req, res, next) => {
    try {
      const { month, year } = req.query;
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
  requireTenant,
  requireStaff,
  writeRateLimiter,
  validate(frontendSaleSchema),
  async (req, res, next) => {
    try {
      const payload = req.body;
      
      // Find desk item by name (type) for this business
      const deskItem = await prisma.deskItem.findFirst({
        where: {
          name: payload.type,
        },
      });
      
      if (!deskItem) {
        return res.status(404).json({ error: `Desk item "${payload.type}" not found. Please create it first in catalog.` });
      }
      
      if (payload.promoId) {
        const promotion = await prisma.promotion.findUnique({
          where: { id: payload.promoId },
        });

        if (!promotion) {
          return res.status(404).json({ error: "Promotion not found" });
        }
      }

      const saleRecordData = salePayloadToSaleRecord(
        payload,
        deskItem.id,
        req.tenantOwnerId
      );
      const saleDate = new Date(payload.date);
      const year = saleDate.getUTCFullYear();
      const month = saleDate.getUTCMonth() + 1;
      const sequence = await prisma.saleRecord.count({
        where: {
          ownerId: req.tenantOwnerId,
          saleDate: {
            gte: new Date(Date.UTC(year, month - 1, 1)),
            lt: new Date(Date.UTC(year, month, 1)),
          },
        },
      });

      saleRecordData.orderNumber = `SO-${year}${String(month).padStart(2, "0")}-${String(sequence + 1).padStart(4, "0")}`;
      
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
router.patch(
  "/:id/payment-slip",
  authenticate,
  requireTenant,
  requireStaff,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  validate(uploadPaymentSlipSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { imageData } = req.body;

      const sale = await prisma.saleRecord.findUnique({
        where: { id },
        include: {
          promotion: true,
          deskItem: true,
          deliveryFee: true,
        },
      });

      if (!sale || sale.ownerId !== req.tenantOwnerId) {
        return res.status(404).json({ error: "Sale not found" });
      }

      const updatedSale = await prisma.saleRecord.update({
        where: { id },
        data: {
          paymentSlipImage: imageData,
        },
        include: {
          promotion: true,
          deskItem: true,
          deliveryFee: true,
        },
      });

      res.json(saleRecordToSale(updatedSale));
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/:id/status",
  authenticate,
  requireTenant,
  requireOwnerOrAdmin,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  validate(updateSaleStatusSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const sale = await prisma.saleRecord.findUnique({
        where: { id },
        include: {
          promotion: true,
          deskItem: true,
          deliveryFee: true,
        },
      });

      if (!sale || sale.ownerId !== req.tenantOwnerId) {
        return res.status(404).json({ error: "Sale not found" });
      }

      if (status === "paid" && !sale.paymentSlipImage) {
        return res.status(400).json({ error: "Payment slip image is required before marking as paid" });
      }

      const updatedSale = await prisma.saleRecord.update({
        where: { id },
        data: {
          status,
          paidAt: status === "paid" ? new Date() : null,
        },
        include: {
          promotion: true,
          deskItem: true,
          deliveryFee: true,
        },
      });

      res.json(saleRecordToSale(updatedSale));
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id",
  authenticate,
  requireTenant,
  requireStaff,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const sale = await prisma.saleRecord.findUnique({
        where: { id },
      });

      if (!sale || sale.ownerId !== req.tenantOwnerId) {
        return res.status(404).json({ error: "Sale not found" });
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

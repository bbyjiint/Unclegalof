import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireBusinessAccess, requireOwnerOrAdmin } from "../middleware/authorize.middleware.js";
import { writeRateLimiter } from "../middleware/rateLimit.middleware.js";
import { promotionToFrontend } from "../lib/adapters.js";

const router = Router();

// Frontend promotion schema
const frontendPromotionSchema = z.object({
  name: z.string().min(1).max(200),
  amount: z.number().nonnegative(), // Frontend sends amount, but schema doesn't have it
  active: z.boolean().optional().default(true), // Frontend sends active, but schema doesn't have it
});

const updatePromotionSchema = z.object({
  active: z.boolean(),
});

const paramsIdSchema = z.object({
  id: z.coerce.number().int().positive(), // Frontend sends number IDs
});

// GET /api/promotions - Get all promotions for business
router.get(
  "/",
  authenticate,
  requireBusinessAccess,
  async (req, res, next) => {
    try {
      const promotions = await prisma.promotion.findMany({
        where: {
          businessId: req.businessId,
        },
        orderBy: { createdAt: "desc" },
      });
      
      // Transform to frontend format
      const items = promotions.map((promo, index) => promotionToFrontend(promo, index));
      
      res.json({ items });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/promotions - Create a new promotion (Owner/Admin only)
router.post(
  "/",
  authenticate,
  requireBusinessAccess,
  requireOwnerOrAdmin,
  writeRateLimiter,
  validate(frontendPromotionSchema),
  async (req, res, next) => {
    try {
      const payload = req.body;
      
      // Check if promotion name already exists for this business
      const existing = await prisma.promotion.findUnique({
        where: {
          businessId_name: {
            businessId: req.businessId,
            name: payload.name,
          },
        },
      });
      
      if (existing) {
        return res.status(409).json({ error: "Promotion with this name already exists" });
      }
      
      // Store amount in name format: "Name (100)" if amount > 0
      const promotionName = payload.amount > 0 
        ? `${payload.name} (${payload.amount})`
        : payload.name;
      
      const promotion = await prisma.promotion.create({
        data: {
          businessId: req.businessId,
          name: promotionName,
          // Note: amount and active fields don't exist in schema
          // Storing amount in name format: "Name (100)"
        },
      });
      
      // Transform to frontend format
      const item = promotionToFrontend(promotion);
      
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/promotions/:id - Update a promotion (toggle active) (Owner/Admin only)
router.patch(
  "/:id",
  authenticate,
  requireBusinessAccess,
  requireOwnerOrAdmin,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  validate(updatePromotionSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const payload = req.body;
      
      // Frontend sends numeric ID, find by index
      const promotions = await prisma.promotion.findMany({
        where: {
          businessId: req.businessId,
        },
        orderBy: { createdAt: "desc" },
      });
      
      const promotion = promotions[id - 1]; // Frontend uses 1-based index
      
      if (!promotion) {
        return res.status(404).json({ error: "Promotion not found" });
      }
      
      // Note: active field doesn't exist in schema
      // For now, we'll just return the promotion as-is
      // Consider adding active field to schema
      const item = promotionToFrontend(promotion, id - 1);
      
      res.json(item);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/promotions/:id - Delete a promotion (Owner/Admin only)
router.delete(
  "/:id",
  authenticate,
  requireBusinessAccess,
  requireOwnerOrAdmin,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Frontend sends numeric ID, find by index
      const promotions = await prisma.promotion.findMany({
        where: {
          businessId: req.businessId,
        },
        orderBy: { createdAt: "desc" },
      });
      
      const promotion = promotions[id - 1]; // Frontend uses 1-based index
      
      if (!promotion) {
        return res.status(404).json({ error: "Promotion not found" });
      }
      
      await prisma.promotion.delete({
        where: { id: promotion.id },
      });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

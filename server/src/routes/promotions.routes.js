import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOwner } from "../middleware/authorize.middleware.js";
import { writeRateLimiter } from "../middleware/rateLimit.middleware.js";
import { promotionToFrontend } from "../lib/adapters.js";
import {
  createPromotionWithAmountType,
  findAllPromotionsRows,
  findPromotionRowById,
} from "../lib/promotions.db.js";

const router = Router();

// Frontend promotion schema
const frontendPromotionSchema = z
  .object({
    name: z.string().min(1).max(200),
    amountType: z.enum(["fixed", "percent"]).optional().default("fixed"),
    amount: z.number().int().nonnegative(),
    active: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.amountType === "percent" && data.amount > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percent discount cannot exceed 100",
        path: ["amount"],
      });
    }
  });

const updatePromotionSchema = z.object({
  active: z.boolean(),
});

const paramsIdSchema = z.object({
  id: z.string().uuid(),
});

// GET /api/promotions - Get all promotions
router.get(
  "/",
  authenticate,
  async (req, res, next) => {
    try {
      const rows = await findAllPromotionsRows();
      const items = rows.map((promo, index) => promotionToFrontend(promo, index));
      
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
  requireOwner,
  writeRateLimiter,
  validate(frontendPromotionSchema),
  async (req, res, next) => {
    try {
      const payload = req.body;
      
      // Check if promotion name already exists
      const existing = await prisma.promotion.findUnique({
        where: { name: payload.name },
      });
      
      if (existing) {
        return res.status(409).json({ error: "Promotion with this name already exists" });
      }
      
      const row = await createPromotionWithAmountType(payload);
      const item = promotionToFrontend(row);
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
  requireOwner,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  validate(updatePromotionSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const payload = req.body;
      
      const promotion = await prisma.promotion.findUnique({
        where: { id },
      });

      if (!promotion) {
        return res.status(404).json({ error: "Promotion not found" });
      }

      await prisma.promotion.update({
        where: { id },
        data: {
          isActive: payload.active,
        },
      });

      const row = await findPromotionRowById(id);
      const item = promotionToFrontend(row);
      
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
  requireOwner,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const promotion = await prisma.promotion.findUnique({
        where: { id },
      });

      if (!promotion) {
        return res.status(404).json({ error: "Promotion not found" });
      }

      await prisma.promotion.delete({
        where: { id },
      });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireBusinessAccess, requireOwnerOrAdmin } from "../middleware/authorize.middleware.js";
import { writeRateLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

const deskItemSchema = z.object({
  name: z.string().min(1).max(200),
  onsitePrice: z.number().int().nonnegative(),
  deliveryPrice: z.number().int().nonnegative(),
});

const paramsIdSchema = z.object({
  id: z.string().uuid(),
});

// GET /api/catalog/products - Get all desk items for business
router.get(
  "/products",
  authenticate,
  requireBusinessAccess,
  async (req, res, next) => {
    try {
      const items = await prisma.deskItem.findMany({
        where: {
          businessId: req.businessId,
        },
        orderBy: { name: "asc" },
      });
      
      res.json({ items });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/catalog/products - Create a new desk item (Owner/Admin only)
router.post(
  "/products",
  authenticate,
  requireBusinessAccess,
  requireOwnerOrAdmin,
  writeRateLimiter,
  validate(deskItemSchema),
  async (req, res, next) => {
    try {
      const payload = req.body;
      
      // Check if desk item name already exists for this business
      const existing = await prisma.deskItem.findUnique({
        where: {
          businessId_name: {
            businessId: req.businessId,
            name: payload.name,
          },
        },
      });
      
      if (existing) {
        return res.status(409).json({ error: "Desk item with this name already exists" });
      }
      
      const item = await prisma.deskItem.create({
        data: {
          businessId: req.businessId,
          name: payload.name,
          onsitePrice: payload.onsitePrice,
          deliveryPrice: payload.deliveryPrice,
        },
      });
      
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/catalog/products/:id - Update a desk item (Owner/Admin only)
router.patch(
  "/products/:id",
  authenticate,
  requireBusinessAccess,
  requireOwnerOrAdmin,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  validate(deskItemSchema.partial()),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const payload = req.body;
      
      // Verify desk item belongs to this business
      const deskItem = await prisma.deskItem.findUnique({
        where: {
          businessId_id: {
            businessId: req.businessId,
            id,
          },
        },
      });
      
      if (!deskItem) {
        return res.status(404).json({ error: "Desk item not found" });
      }
      
      const item = await prisma.deskItem.update({
        where: { id },
        data: payload,
      });
      
      res.json(item);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/catalog/products/:id - Delete a desk item (Owner/Admin only)
router.delete(
  "/products/:id",
  authenticate,
  requireBusinessAccess,
  requireOwnerOrAdmin,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Verify desk item belongs to this business
      const deskItem = await prisma.deskItem.findUnique({
        where: {
          businessId_id: {
            businessId: req.businessId,
            id,
          },
        },
      });
      
      if (!deskItem) {
        return res.status(404).json({ error: "Desk item not found" });
      }
      
      await prisma.deskItem.delete({
        where: { id },
      });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

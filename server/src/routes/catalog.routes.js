import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOwner, requireSales } from "../middleware/authorize.middleware.js";
import { writeRateLimiter } from "../middleware/rateLimit.middleware.js";
import { mergeDeliveryZonesWithFees, DELIVERY_ZONE_COUNT } from "../lib/deliveryZones.js";
import { ensureAllDeliveryFeeRows } from "../lib/ensureCatalog.js";

const router = Router();

const deskItemSchema = z.object({
  name: z.string().min(1).max(200),
  onsitePrice: z.number().int().nonnegative(),
  deliveryPrice: z.number().int().nonnegative(),
});

const paramsIdSchema = z.object({
  id: z.string().uuid(),
});

const putDeliveryFeesSchema = z.object({
  items: z
    .array(
      z.object({
        range: z.number().int().min(1).max(DELIVERY_ZONE_COUNT),
        cost: z.number().int().nonnegative(),
      })
    )
    .min(1)
    .max(DELIVERY_ZONE_COUNT),
});

// GET /api/catalog/delivery-fees — zone bands + current prices (sales staff + owners)
router.get("/delivery-fees", authenticate, requireSales, async (_req, res, next) => {
  try {
    let rows = await prisma.deliveryFee.findMany({ orderBy: { range: "asc" } });
    if (rows.length < DELIVERY_ZONE_COUNT) {
      await ensureAllDeliveryFeeRows();
      rows = await prisma.deliveryFee.findMany({ orderBy: { range: "asc" } });
    }
    res.json({ zones: mergeDeliveryZonesWithFees(rows) });
  } catch (error) {
    next(error);
  }
});

// PUT /api/catalog/delivery-fees — owner sets price per zone
router.put(
  "/delivery-fees",
  authenticate,
  requireOwner,
  writeRateLimiter,
  validate(putDeliveryFeesSchema),
  async (req, res, next) => {
    try {
      await ensureAllDeliveryFeeRows();
      for (const { range, cost } of req.body.items) {
        await prisma.deliveryFee.update({
          where: { range },
          data: { cost },
        });
      }
      const rows = await prisma.deliveryFee.findMany({ orderBy: { range: "asc" } });
      res.json({ zones: mergeDeliveryZonesWithFees(rows) });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/catalog/products - Get all desk items
router.get(
  "/products",
  authenticate,
  async (req, res, next) => {
    try {
      const items = await prisma.deskItem.findMany({
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
  requireOwner,
  writeRateLimiter,
  validate(deskItemSchema),
  async (req, res, next) => {
    try {
      const payload = req.body;
      
      // Check if desk item name already exists
      const existing = await prisma.deskItem.findUnique({
        where: { name: payload.name },
      });
      
      if (existing) {
        return res.status(409).json({ error: "Desk item with this name already exists" });
      }
      
      const item = await prisma.deskItem.create({
        data: {
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
  requireOwner,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  validate(deskItemSchema.partial()),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const payload = req.body;
      
      const deskItem = await prisma.deskItem.findUnique({
        where: { id },
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
  requireOwner,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const deskItem = await prisma.deskItem.findUnique({
        where: { id },
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

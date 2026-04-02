import { Router } from "express";
import { z } from "zod";
import { InventoryDirection } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireSales } from "../middleware/authorize.middleware.js";
import { writeRateLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

const frontendStockInSchema = z.object({
  type: z.string().min(1),
  qty: z.number().int().positive(),
  note: z.string().optional().default(""),
});

const batchLotsSchema = z.object({
  note: z.string().optional().default(""),
  items: z
    .array(
      z.object({
        deskItemId: z.string().uuid(),
        qty: z.number().int().positive(),
        costPerUnit: z.number().nonnegative(),
      })
    )
    .min(1),
});

const paramsIdSchema = z.object({
  id: z.string().uuid(),
});

const inventoryProductSchema = z.object({
  name: z.string().min(1).max(200),
  onsitePrice: z.number().int().nonnegative(),
  deliveryPrice: z.number().int().nonnegative(),
});

function movementToFrontend(m) {
  return {
    id: m.id,
    type: m.deskItem?.name ?? "",
    qty: m.qty,
    direction: m.direction === InventoryDirection.IN ? "IN" : "OUT",
    note: m.note,
    createdAt: m.createdAt.toISOString(),
  };
}

// GET /api/inventory/products - Get all products available for inventory management
router.get(
  "/products",
  authenticate,
  requireSales,
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

// POST /api/inventory/products - Create a new product
router.post(
  "/products",
  authenticate,
  requireSales,
  writeRateLimiter,
  validate(inventoryProductSchema),
  async (req, res, next) => {
    try {
      const payload = req.body;
      const existing = await prisma.deskItem.findUnique({
        where: { name: payload.name },
      });

      if (existing) {
        return res.status(409).json({ error: "Product with this name already exists" });
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

// PATCH /api/inventory/products/:id - Update a product
router.patch(
  "/products/:id",
  authenticate,
  requireSales,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  validate(inventoryProductSchema.partial()),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const payload = req.body;

      const existing = await prisma.deskItem.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: "Product not found" });
      }

      const updated = await prisma.deskItem.update({
        where: { id },
        data: payload,
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/inventory/products/:id - Delete a product
router.delete(
  "/products/:id",
  authenticate,
  requireSales,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const existing = await prisma.deskItem.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: "Product not found" });
      }

      const [lotCount, pipelineCount] = await Promise.all([
        prisma.inventoryLot.count({ where: { deskItemId: id } }),
        prisma.pipelineItem.count({ where: { deskItemId: id } }),
      ]);
      if (lotCount > 0 || pipelineCount > 0) {
        return res.status(409).json({
          error:
            "Cannot delete product while inventory lots or pipeline rows still reference it",
        });
      }

      try {
        await prisma.deskItem.delete({
          where: { id },
        });
      } catch (err) {
        if (err?.code === "P2003") {
          return res.status(409).json({
            error: "Cannot delete product while sales or other records still reference it",
          });
        }
        throw err;
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/inventory/summary - Get inventory summary + recent movements
router.get(
  "/summary",
  authenticate,
  requireSales,
  async (req, res, next) => {
    try {
      const deskItems = await prisma.deskItem.findMany({
        orderBy: { name: "asc" },
      });

      const sums = await prisma.inventoryLot.groupBy({
        by: ["deskItemId"],
        _sum: { remainingQty: true },
      });
      const sumByDesk = new Map(
        sums.map((row) => [row.deskItemId, row._sum.remainingQty ?? 0])
      );

      const summary = deskItems.map((item) => ({
        type: item.name,
        qty: sumByDesk.get(item.id) ?? 0,
      }));

      const movements = await prisma.inventoryMovement.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { deskItem: true },
      });

      res.json({
        summary,
        movements: movements.map(movementToFrontend),
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/inventory/lots - Get inventory lots
router.get(
  "/lots",
  authenticate,
  requireSales,
  async (req, res, next) => {
    try {
      const lots = await prisma.inventoryLot.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { deskItem: true },
      });

      res.json({
        items: lots.map((lot) => ({
          id: lot.id,
          deskItemId: lot.deskItemId,
          productName: lot.deskItem.name,
          qty: lot.qty,
          remainingQty: lot.remainingQty,
          costPerUnit: lot.costPerUnit,
          note: lot.note,
          createdAt: lot.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/inventory/movements/stock-in - Add stock (single product by name)
router.post(
  "/movements/stock-in",
  authenticate,
  requireSales,
  writeRateLimiter,
  validate(frontendStockInSchema),
  async (req, res, next) => {
    try {
      const payload = req.body;

      const deskItem = await prisma.deskItem.findFirst({
        where: { name: payload.type },
      });

      if (!deskItem) {
        return res.status(404).json({
          error: `Desk item "${payload.type}" not found. Please create it first in catalog.`,
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const lot = await tx.inventoryLot.create({
          data: {
            deskItemId: deskItem.id,
            qty: payload.qty,
            remainingQty: payload.qty,
            costPerUnit: 0,
            note: payload.note?.trim() || null,
          },
        });

        const movement = await tx.inventoryMovement.create({
          data: {
            deskItemId: deskItem.id,
            inventoryLotId: lot.id,
            direction: InventoryDirection.IN,
            qty: payload.qty,
            note: payload.note?.trim() || null,
            createdByUserId: req.user.id,
          },
          include: { deskItem: true },
        });

        return { lot, movement };
      });

      res.status(201).json({
        lot: {
          id: result.lot.id,
          deskItemId: result.lot.deskItemId,
          qty: result.lot.qty,
          remainingQty: result.lot.remainingQty,
          costPerUnit: result.lot.costPerUnit,
        },
        movement: movementToFrontend(result.movement),
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/inventory/lots/batch - Create batch of inventory lots
router.post(
  "/lots/batch",
  authenticate,
  requireSales,
  writeRateLimiter,
  validate(batchLotsSchema),
  async (req, res, next) => {
    try {
      const payload = req.body;
      const note = payload.note?.trim() || null;

      for (const item of payload.items) {
        const deskItem = await prisma.deskItem.findUnique({
          where: { id: item.deskItemId },
        });

        if (!deskItem) {
          return res.status(404).json({ error: `Desk item ${item.deskItemId} not found` });
        }
      }

      const created = await prisma.$transaction(async (tx) => {
        const lots = [];
        for (const item of payload.items) {
          const lot = await tx.inventoryLot.create({
            data: {
              deskItemId: item.deskItemId,
              qty: item.qty,
              remainingQty: item.qty,
              costPerUnit: item.costPerUnit,
              note,
            },
          });
          await tx.inventoryMovement.create({
            data: {
              deskItemId: item.deskItemId,
              inventoryLotId: lot.id,
              direction: InventoryDirection.IN,
              qty: item.qty,
              note,
              createdByUserId: req.user.id,
            },
          });
          lots.push(lot);
        }
        return lots;
      });

      res.status(201).json({
        count: created.length,
        lotIds: created.map((l) => l.id),
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/inventory/lots/:id - Remove lot (writes OUT movement if remaining qty > 0)
router.delete(
  "/lots/:id",
  authenticate,
  requireSales,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const lot = await prisma.inventoryLot.findUnique({
        where: { id },
      });

      if (!lot) {
        return res.status(404).json({ error: "Lot not found" });
      }

      await prisma.$transaction(async (tx) => {
        if (lot.remainingQty > 0) {
          await tx.inventoryMovement.create({
            data: {
              deskItemId: lot.deskItemId,
              inventoryLotId: lot.id,
              direction: InventoryDirection.OUT,
              qty: lot.remainingQty,
              note: "Lot removed",
              createdByUserId: req.user.id,
            },
          });
        }
        await tx.inventoryLot.delete({ where: { id: lot.id } });
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

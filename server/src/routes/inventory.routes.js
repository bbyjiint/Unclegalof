import { Router } from "express";
import { z } from "zod";
import { InventoryDirection, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOwner, requireSales } from "../middleware/authorize.middleware.js";
import { writeRateLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

const frontendStockInSchema = z.object({
  type: z.string().min(1),
  qty: z.number().int().positive(),
  note: z.string().optional().default(""),
});
const patchMovementSchema = z.object({
  type: z.string().min(1),
  qty: z.number().int().positive(),
  note: z.string().optional().default(""),
  reason: z.string().optional().default("miscount"),
});

/** คนขาย/เจ้าของ: บันทึกเพิ่มหรือลดสต็อกเมื่อลงผิด (มีประวัติ IN/OUT แยกรายการ) */
const manualAdjustSchema = z.object({
  type: z.string().min(1),
  direction: z.enum(["IN", "OUT"]),
  qty: z.number().int().positive(),
  reason: z.string().min(1).max(500),
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

const patchLotCostSchema = z.object({
  costPerUnit: z.number().int().nonnegative(),
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

function lotToFrontend(lot, includeCost) {
  const row = {
    id: lot.id,
    deskItemId: lot.deskItemId,
    productName: lot.deskItem.name,
    qty: lot.qty,
    remainingQty: lot.remainingQty,
    note: lot.note,
    createdAt: lot.createdAt.toISOString(),
  };
  if (includeCost) {
    row.costPerUnit = lot.costPerUnit;
  }
  return row;
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
        take: 200,
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

      const includeCost = req.role === UserRole.OWNER;
      res.json({
        items: lots.map((lot) => lotToFrontend(lot, includeCost)),
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

      const includeCost = req.role === UserRole.OWNER;
      const lotPayload = {
        id: result.lot.id,
        deskItemId: result.lot.deskItemId,
        qty: result.lot.qty,
        remainingQty: result.lot.remainingQty,
      };
      if (includeCost) {
        lotPayload.costPerUnit = result.lot.costPerUnit;
      }
      res.status(201).json({
        lot: lotPayload,
        movement: movementToFrontend(result.movement),
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/inventory/movements/manual-adjust — เพิ่มหรือลดสต็อกด้วยมือ (FIFO เมื่อลด)
router.post(
  "/movements/manual-adjust",
  authenticate,
  requireSales,
  writeRateLimiter,
  validate(manualAdjustSchema),
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

      const reason = String(payload.reason).trim();
      const qty = Number(payload.qty);

      if (payload.direction === "IN") {
        const noteIn = `ปรับสต็อก — เพิ่ม: ${reason}`;
        const result = await prisma.$transaction(async (tx) => {
          const lot = await tx.inventoryLot.create({
            data: {
              deskItemId: deskItem.id,
              qty,
              remainingQty: qty,
              costPerUnit: 0,
              note: noteIn,
            },
          });
          const movement = await tx.inventoryMovement.create({
            data: {
              deskItemId: deskItem.id,
              inventoryLotId: lot.id,
              direction: InventoryDirection.IN,
              qty,
              note: noteIn,
              createdByUserId: req.user.id,
            },
            include: { deskItem: true },
          });
          return movement;
        });
        return res.status(201).json({ movement: movementToFrontend(result) });
      }

      const noteOut = `ปรับสต็อก — ลด: ${reason}`;
      const movementsOut = await prisma.$transaction(async (tx) => {
        let remaining = qty;
        const created = [];
        const sourceLots = await tx.inventoryLot.findMany({
          where: {
            deskItemId: deskItem.id,
            remainingQty: { gt: 0 },
          },
          orderBy: { createdAt: "asc" },
        });

        for (const lot of sourceLots) {
          if (remaining <= 0) break;
          const takeQty = Math.min(lot.remainingQty, remaining);
          if (takeQty <= 0) continue;

          await tx.inventoryLot.update({
            where: { id: lot.id },
            data: { remainingQty: lot.remainingQty - takeQty },
          });

          const m = await tx.inventoryMovement.create({
            data: {
              deskItemId: deskItem.id,
              inventoryLotId: lot.id,
              direction: InventoryDirection.OUT,
              qty: takeQty,
              note: noteOut,
              createdByUserId: req.user.id,
            },
            include: { deskItem: true },
          });
          created.push(m);
          remaining -= takeQty;
        }

        if (remaining > 0) {
          const m = await tx.inventoryMovement.create({
            data: {
              deskItemId: deskItem.id,
              inventoryLotId: null,
              direction: InventoryDirection.OUT,
              qty: remaining,
              note: `${noteOut} (ยอดคงคลังไม่พอ — บันทึกขาด ${remaining} ชิ้น)`,
              createdByUserId: req.user.id,
            },
            include: { deskItem: true },
          });
          created.push(m);
        }

        return created;
      });

      return res.status(201).json({
        movements: movementsOut.map((m) => movementToFrontend(m)),
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/inventory/movements/:id - Adjust stock-in via audit movements (with reason)
router.patch(
  "/movements/:id",
  authenticate,
  requireSales,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  validate(patchMovementSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const payload = req.body;

      const movement = await prisma.inventoryMovement.findUnique({
        where: { id },
      });

      if (!movement) {
        return res.status(404).json({ error: "Movement not found" });
      }
      if (movement.direction !== InventoryDirection.IN) {
        return res.status(400).json({ error: "Only stock-in movements can be edited" });
      }

      const targetDeskItem = await prisma.deskItem.findFirst({
        where: { name: payload.type },
      });
      if (!targetDeskItem) {
        return res.status(404).json({
          error: `Desk item "${payload.type}" not found. Please create it first in catalog.`,
        });
      }

      const nextQty = Number(payload.qty);
      const nextNote = payload.note?.trim() || null;
      const reason = payload.reason?.trim() || "miscount";

      const updatedMovement = await prisma.$transaction(async (tx) => {
        const lot = movement.inventoryLotId
          ? await tx.inventoryLot.findUnique({ where: { id: movement.inventoryLotId } })
          : null;

        if (!lot) {
          throw Object.assign(new Error("Linked lot not found for this movement"), { statusCode: 404 });
        }

        const consumedQty = Math.max(0, lot.qty - lot.remainingQty);
        const currentDeskItemId = lot.deskItemId;
        const currentQty = lot.qty;

        // Same product: adjust quantity and record delta as movement for audit trail.
        if (targetDeskItem.id === currentDeskItemId) {
          if (nextQty < consumedQty) {
            throw Object.assign(new Error("New quantity cannot be less than already consumed quantity"), {
              statusCode: 400,
            });
          }

          const delta = nextQty - currentQty;
          const nextRemainingQty = nextQty - consumedQty;

          await tx.inventoryLot.update({
            where: { id: lot.id },
            data: {
              qty: nextQty,
              remainingQty: nextRemainingQty,
              note: nextNote,
            },
          });

          if (delta !== 0) {
            await tx.inventoryMovement.create({
              data: {
                deskItemId: currentDeskItemId,
                inventoryLotId: lot.id,
                direction: delta > 0 ? InventoryDirection.IN : InventoryDirection.OUT,
                qty: Math.abs(delta),
                note: `Inventory Adjustment: ${reason}`,
                createdByUserId: req.user.id,
              },
            });
          }
        } else {
          // Product type correction: reverse old lot and create a new corrected lot.
          if (consumedQty > 0) {
            throw Object.assign(
              new Error("Cannot change product type after this lot has already been consumed"),
              { statusCode: 409 }
            );
          }

          if (currentQty > 0) {
            await tx.inventoryMovement.create({
              data: {
                deskItemId: currentDeskItemId,
                inventoryLotId: lot.id,
                direction: InventoryDirection.OUT,
                qty: currentQty,
                note: `Inventory Adjustment: ${reason} (type correction out)`,
                createdByUserId: req.user.id,
              },
            });
          }

          await tx.inventoryLot.update({
            where: { id: lot.id },
            data: {
              qty: 0,
              remainingQty: 0,
              note: `Replaced by correction (${reason})`,
            },
          });

          const newLot = await tx.inventoryLot.create({
            data: {
              deskItemId: targetDeskItem.id,
              qty: nextQty,
              remainingQty: nextQty,
              costPerUnit: lot.costPerUnit ?? 0,
              note: nextNote,
            },
          });

          await tx.inventoryMovement.create({
            data: {
              deskItemId: targetDeskItem.id,
              inventoryLotId: newLot.id,
              direction: InventoryDirection.IN,
              qty: nextQty,
              note: `Inventory Adjustment: ${reason} (type correction in)`,
              createdByUserId: req.user.id,
            },
          });
        }

        return tx.inventoryMovement.findUnique({
          where: { id: movement.id },
          include: { deskItem: true },
        });
      });

      res.json({ movement: movementToFrontend(updatedMovement) });
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
          if (item.costPerUnit > 0) {
            await tx.deskItemCostLog.create({
              data: {
                deskItemId: item.deskItemId,
                costPerUnit: item.costPerUnit,
              },
            });
          }
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

// PATCH /api/inventory/lots/:id/cost — OWNER: ใส่/แก้ ต้นทุนต่อชิ้นรอบรับของ (ถ้าเคยเป็น 0 จะเพิ่ม DeskItemCostLog)
router.patch(
  "/lots/:id/cost",
  authenticate,
  requireOwner,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  validate(patchLotCostSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { costPerUnit } = req.body;

      const lot = await prisma.inventoryLot.findUnique({
        where: { id },
        include: { deskItem: true },
      });

      if (!lot) {
        return res.status(404).json({ error: "Lot not found" });
      }

      const prevCost = lot.costPerUnit;

      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.inventoryLot.update({
          where: { id },
          data: { costPerUnit },
          include: { deskItem: true },
        });
        if (prevCost === 0 && costPerUnit > 0) {
          await tx.deskItemCostLog.create({
            data: {
              deskItemId: lot.deskItemId,
              costPerUnit,
            },
          });
        }
        return row;
      });

      res.json({
        item: lotToFrontend(updated, true),
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

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

      // For owner: count how many consumed-lot records per lot still have costPerUnitAtSale = 0
      // (i.e. this lot is directly causing pending-cost order lines)
      const pendingCountMap = new Map();
      if (includeCost && lots.length > 0) {
        const pendingCounts = await prisma.salesOrderLineConsumedLot.groupBy({
          by: ["inventoryLotId"],
          where: {
            inventoryLotId: { in: lots.map((l) => l.id) },
            costPerUnitAtSale: 0,
          },
          _count: { _all: true },
        });
        for (const row of pendingCounts) {
          if (row.inventoryLotId) {
            pendingCountMap.set(row.inventoryLotId, row._count._all);
          }
        }
      }

      res.json({
        items: lots.map((lot) => {
          const row = lotToFrontend(lot, includeCost);
          if (includeCost) {
            row.pendingOrderCount = pendingCountMap.get(lot.id) ?? 0;
          }
          return row;
        }),
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

      // Single query instead of one findUnique per item
      const requestedDeskItemIds = payload.items.map((item) => item.deskItemId);
      const foundDeskItems = await prisma.deskItem.findMany({
        where: { id: { in: requestedDeskItemIds } },
        select: { id: true },
      });
      const foundDeskItemIdSet = new Set(foundDeskItems.map((d) => d.id));
      const missingDeskItemId = requestedDeskItemIds.find((id) => !foundDeskItemIdSet.has(id));
      if (missingDeskItemId) {
        return res.status(404).json({ error: `Desk item ${missingDeskItemId} not found` });
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

      // Interactive tx default timeout is 5s. Retroactive COGS can touch many sale lines
      // (especially on serverless + remote Postgres), which previously hit P2028
      // ("Transaction not found" / timed-out interactive transaction).
      const updated = await prisma.$transaction(
        async (tx) => {
          const row = await tx.inventoryLot.update({
            where: { id },
            data: { costPerUnit },
            include: { deskItem: true },
          });

          // Maintain DeskItemCostLog for display/reporting (average cost overview).
          if (prevCost === 0 && costPerUnit > 0) {
            await tx.deskItemCostLog.create({
              data: {
                deskItemId: lot.deskItemId,
                costPerUnit,
              },
            });
          }

          // Retroactively recalculate COGS for every sale line that consumed this lot.
          const consumedRecords = await tx.salesOrderLineConsumedLot.findMany({
            where: { inventoryLotId: id },
            select: { salesOrderLineId: true, saleRecordId: true },
          });

          if (consumedRecords.length === 0) {
            return row;
          }

          // Propagate the new cost to all consumed-lot snapshots referencing this lot.
          await tx.salesOrderLineConsumedLot.updateMany({
            where: { inventoryLotId: id },
            data: { costPerUnitAtSale: costPerUnit },
          });

          const uniqueLineIds = [...new Set(consumedRecords.map((r) => r.salesOrderLineId))];
          const lineIdToSaleRecordId = new Map();
          for (const r of consumedRecords) {
            if (!lineIdToSaleRecordId.has(r.salesOrderLineId)) {
              lineIdToSaleRecordId.set(r.salesOrderLineId, r.saleRecordId);
            }
          }

          // Bulk-fetch once instead of N+1 findUnique/findMany per line (was the main
          // reason this interactive transaction exceeded the default 5s timeout).
          const [orderLines, allConsumedLots] = await Promise.all([
            tx.salesOrderLine.findMany({ where: { id: { in: uniqueLineIds } } }),
            tx.salesOrderLineConsumedLot.findMany({
              where: { salesOrderLineId: { in: uniqueLineIds } },
            }),
          ]);

          const orderLineById = new Map(orderLines.map((ol) => [ol.id, ol]));
          const consumedByLineId = new Map();
          for (const cl of allConsumedLots) {
            const list = consumedByLineId.get(cl.salesOrderLineId);
            if (list) list.push(cl);
            else consumedByLineId.set(cl.salesOrderLineId, [cl]);
          }

          for (const lineId of uniqueLineIds) {
            const orderLine = orderLineById.get(lineId);
            if (!orderLine) continue;

            const allConsumedForLine = consumedByLineId.get(lineId) || [];
            const newCogsTotal = allConsumedForLine.reduce(
              (sum, cl) => sum + cl.consumedQty * cl.costPerUnitAtSale,
              0
            );
            const newAvgUnitCost =
              orderLine.quantity > 0 ? Math.round(newCogsTotal / orderLine.quantity) : 0;
            const stillPending = allConsumedForLine.some((cl) => cl.costPerUnitAtSale === 0);
            const newCostStatus = stillPending ? "pending_owner_review" : "confirmed";
            const baseRevenue =
              orderLine.unitPrice * orderLine.quantity -
              orderLine.promoDiscount -
              orderLine.manualDiscount;
            const newGrossProfit = baseRevenue - newCogsTotal;
            const costPatch = {
              cogsTotal: newCogsTotal,
              avgUnitCostSnapshot: newAvgUnitCost,
              grossProfit: newGrossProfit,
              costStatus: newCostStatus,
            };

            await tx.salesOrderLine.update({
              where: { id: lineId },
              data: costPatch,
            });

            const saleRecordId = lineIdToSaleRecordId.get(lineId);
            if (saleRecordId) {
              await tx.saleRecord.update({
                where: { id: saleRecordId },
                data: costPatch,
              });
            }
          }

          return row;
        },
        {
          maxWait: 15_000,
          timeout: 60_000,
        }
      );

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

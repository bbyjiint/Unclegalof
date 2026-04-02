import { Router } from "express";
import { z } from "zod";
import { PipelinePriority, PipelineStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOwner } from "../middleware/authorize.middleware.js";
import { writeRateLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

const optionalIsoDate = z
  .union([z.string().datetime(), z.literal(""), z.null()])
  .optional()
  .transform((value) => {
    if (value === "" || value == null) {
      return null;
    }
    return value;
  });

const pipelineSchema = z.object({
  deskItemId: z.string().uuid(),
  qty: z.number().int().positive(),
  costEst: z.number().nonnegative().optional().default(0),
  date: optionalIsoDate,
  note: z.string().optional().default(""),
  status: z.nativeEnum(PipelineStatus).optional(),
  priority: z.nativeEnum(PipelinePriority).optional(),
});

const paramsIdSchema = z.object({
  id: z.string().uuid(),
});

function pipelineToJson(row) {
  return {
    id: row.id,
    deskItemId: row.deskItemId,
    productName: row.deskItem?.name ?? "",
    qty: row.qty,
    costEst: row.costEst,
    expectedDate: row.expectedDate ? row.expectedDate.toISOString() : null,
    note: row.note,
    status: row.status,
    priority: row.priority,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// GET /api/pipeline - Get all pipeline items
router.get(
  "/",
  authenticate,
  requireOwner,
  async (req, res, next) => {
    try {
      const rows = await prisma.pipelineItem.findMany({
        orderBy: { createdAt: "desc" },
        include: { deskItem: true },
      });

      res.json({
        items: rows.map(pipelineToJson),
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/pipeline - Create pipeline item
router.post(
  "/",
  authenticate,
  requireOwner,
  writeRateLimiter,
  validate(pipelineSchema),
  async (req, res, next) => {
    try {
      const payload = req.body;

      const deskItem = await prisma.deskItem.findUnique({
        where: { id: payload.deskItemId },
      });

      if (!deskItem) {
        return res.status(404).json({ error: "Desk item not found" });
      }

      const row = await prisma.pipelineItem.create({
        data: {
          deskItemId: payload.deskItemId,
          qty: payload.qty,
          costEst: payload.costEst ?? 0,
          expectedDate: payload.date ? new Date(payload.date) : null,
          note: payload.note?.trim() || null,
          status: payload.status ?? PipelineStatus.planned,
          priority: payload.priority ?? PipelinePriority.normal,
        },
        include: { deskItem: true },
      });

      res.status(201).json(pipelineToJson(row));
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/pipeline/:id - Update pipeline item
router.patch(
  "/:id",
  authenticate,
  requireOwner,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  validate(pipelineSchema.partial()),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const payload = req.body;

      const existing = await prisma.pipelineItem.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: "Pipeline item not found" });
      }

      const data = {};
      if (payload.deskItemId != null) {
        const deskItem = await prisma.deskItem.findUnique({
          where: { id: payload.deskItemId },
        });
        if (!deskItem) {
          return res.status(404).json({ error: "Desk item not found" });
        }
        data.deskItemId = payload.deskItemId;
      }
      if (payload.qty != null) {
        data.qty = payload.qty;
      }
      if (payload.costEst != null) {
        data.costEst = payload.costEst;
      }
      if (payload.date !== undefined) {
        data.expectedDate = payload.date ? new Date(payload.date) : null;
      }
      if (payload.note !== undefined) {
        data.note = payload.note?.trim() || null;
      }
      if (payload.status != null) {
        data.status = payload.status;
      }
      if (payload.priority != null) {
        data.priority = payload.priority;
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      const row = await prisma.pipelineItem.update({
        where: { id },
        data,
        include: { deskItem: true },
      });

      res.json(pipelineToJson(row));
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/pipeline/:id - Delete pipeline item
router.delete(
  "/:id",
  authenticate,
  requireOwner,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const existing = await prisma.pipelineItem.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: "Pipeline item not found" });
      }

      await prisma.pipelineItem.delete({
        where: { id },
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

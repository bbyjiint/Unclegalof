import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireStaff } from "../middleware/authorize.middleware.js";
import { writeRateLimiter } from "../middleware/rateLimit.middleware.js";
import { repairRecordToRepairItem, repairPayloadToRepairRecord } from "../lib/adapters.js";

const router = Router();

// Frontend repair schema
const frontendRepairSchema = z.object({
  type: z.string().min(1), // Product type name
  qty: z.number().int().positive(),
  size: z.string().min(1),
  color: z.string().min(1),
  reason: z.string().min(1),
  kind: z.enum(["repair", "claim"]),
  date: z.string().min(1),
});

const updateRepairStatusSchema = z.object({
  status: z.enum(["open", "inprogress", "done"]),
});

const paramsIdSchema = z.object({
  id: z.string().uuid(),
});

// GET /api/repairs - Get all repair records
router.get(
  "/",
  authenticate,
  requireStaff,
  async (req, res, next) => {
    try {
      const repairRecords = await prisma.repairRecord.findMany({
        include: {
          deskItem: true,
          reporter: true,
        },
        orderBy: { createdAt: "desc" },
      });
      
      // Transform to frontend format
      const items = repairRecords.map((repair, index) => repairRecordToRepairItem(repair, index));
      
      res.json({ items });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/repairs - Create a new repair record
router.post(
  "/",
  authenticate,
  requireStaff,
  writeRateLimiter,
  validate(frontendRepairSchema),
  async (req, res, next) => {
    try {
      const payload = req.body;
      
      // Find desk item by name (type)
      const deskItem = await prisma.deskItem.findFirst({
        where: {
          name: payload.type,
        },
      });
      
      if (!deskItem) {
        return res.status(404).json({ error: `Desk item "${payload.type}" not found. Please create it first in catalog.` });
      }
      
      // Transform frontend payload to database format
      const repairRecordData = repairPayloadToRepairRecord(
        payload,
        deskItem.id,
        req.user.id
      );
      
      const repairRecord = await prisma.repairRecord.create({
        data: repairRecordData,
        include: {
          deskItem: true,
          reporter: true,
        },
      });
      
      // Transform to frontend format
      const items = await prisma.repairRecord.findMany({
        include: {
          deskItem: true,
          reporter: true,
        },
        orderBy: { createdAt: "desc" },
      });
      
      const item = repairRecordToRepairItem(repairRecord, items.findIndex(r => r.id === repairRecord.id));
      
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/repairs/:id/status - Update repair status
// Note: Status field doesn't exist in schema - this will need schema update
router.patch(
  "/:id/status",
  authenticate,
  requireStaff,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  validate(updateRepairStatusSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const payload = req.body;
      
      const repair = await prisma.repairRecord.findUnique({
        where: { id },
      });
      
      if (!repair) {
        return res.status(404).json({ error: "Repair record not found" });
      }

      const updated = await prisma.repairRecord.update({
        where: { id },
        data: {
          status: payload.status,
        },
        include: {
          deskItem: true,
          reporter: true,
        },
      });
      
      // Transform to frontend format
      const item = repairRecordToRepairItem(updated);
      
      res.json(item);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/repairs/:id - Delete a repair record
router.delete(
  "/:id",
  authenticate,
  requireStaff,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const repair = await prisma.repairRecord.findUnique({
        where: { id },
      });
      
      if (!repair) {
        return res.status(404).json({ error: "Repair record not found" });
      }
      
      await prisma.repairRecord.delete({
        where: { id: repair.id },
      });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

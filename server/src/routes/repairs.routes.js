import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRepairs } from "../middleware/authorize.middleware.js";
import { writeRateLimiter } from "../middleware/rateLimit.middleware.js";
import { repairRecordToRepairItem } from "../lib/adapters.js";
import { deleteUploadedFileFromR2, deleteUploadedFilesFromR2 } from "../lib/r2Cleanup.js";

function coerceRepairImages(value) {
  if (Array.isArray(value) && value.every((x) => typeof x === "string")) {
    return value;
  }
  return [];
}

/** Prisma table name for RepairRecord (matches schema, no @@map). */
const REPAIR_TABLE = "RepairRecord";

/**
 * Read/write `images` via raw SQL so it still works if @prisma/client was
 * generated before the `images` column existed (avoids Unknown argument `images`).
 */
async function getRepairRecordImagesFromDb(id) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT images FROM "${REPAIR_TABLE}" WHERE id = $1::uuid`,
    id
  );
  const raw = rows[0]?.images;
  if (raw == null) {
    return [];
  }
  if (Array.isArray(raw) && raw.every((x) => typeof x === "string")) {
    return raw;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.every((x) => typeof x === "string") ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function setRepairRecordImagesInDb(id, imageStrings) {
  await prisma.$executeRawUnsafe(
    `UPDATE "${REPAIR_TABLE}" SET images = $1::jsonb WHERE id = $2::uuid`,
    JSON.stringify(imageStrings),
    id
  );
}

function mergeRepairRowWithImages(row, images) {
  return row ? { ...row, images: coerceRepairImages(images) } : row;
}

const router = Router();

const MAX_REPAIR_IMAGES = 8;

// Frontend repair schema
const frontendRepairSchema = z.object({
  type: z.string().min(1), // Product type name
  qty: z.number().int().positive(),
  // Optional in UI — empty string is stored as null in DB
  size: z.string().max(500).optional().default(""),
  color: z.string().max(500).optional().default(""),
  reason: z.string().min(1).max(5000),
  kind: z.enum(["repair", "claim"]),
  date: z.string().min(1),
  images: z.array(z.string().min(1)).max(MAX_REPAIR_IMAGES).optional().default([]),
});

const appendRepairImageSchema = z.object({
  fileUrl: z.string().url(),
});

const removeRepairImageSchema = z.object({
  fileUrl: z.string().url(),
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
  requireRepairs,
  async (req, res, next) => {
    try {
      const repairRecords = await prisma.repairRecord.findMany({
        include: {
          deskItem: true,
          reporter: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const items = await Promise.all(
        repairRecords.map(async (repair, index) => {
          const imgs = await getRepairRecordImagesFromDb(repair.id);
          return repairRecordToRepairItem(mergeRepairRowWithImages(repair, imgs), index);
        })
      );

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
  requireRepairs,
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

      const images = coerceRepairImages(payload.images);
      const sizeTrim = String(payload.size ?? "").trim();
      const colorTrim = String(payload.color ?? "").trim();

      // Never pass `images` into prisma.create — stale generated clients throw
      // Unknown argument `images`. Persist photos via raw SQL instead.
      const data = {
        deskItemId: deskItem.id,
        reportedBy: req.user.id,
        reportDate: new Date(payload.date),
        quantity: payload.qty,
        size: sizeTrim.length > 0 ? sizeTrim : null,
        color: colorTrim.length > 0 ? colorTrim : null,
        description: String(payload.reason).trim(),
        kind: payload.kind,
        status: "open",
        amount: 0,
      };

      const repairRecord = await prisma.repairRecord.create({
        data,
        include: {
          deskItem: true,
          reporter: true,
        },
      });

      if (images.length > 0) {
        await setRepairRecordImagesInDb(repairRecord.id, images);
      }

      const storedImages =
        images.length > 0 ? images : await getRepairRecordImagesFromDb(repairRecord.id);

      const item = repairRecordToRepairItem(
        mergeRepairRowWithImages(repairRecord, storedImages),
        0
      );

      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/repairs/:id/images - Append one uploaded image URL
router.patch(
  "/:id/images",
  authenticate,
  requireRepairs,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  validate(appendRepairImageSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { fileUrl } = req.body;

      const repair = await prisma.repairRecord.findUnique({
        where: { id },
        include: {
          deskItem: true,
          reporter: true,
        },
      });

      if (!repair) {
        return res.status(404).json({ error: "Repair record not found" });
      }

      const current = await getRepairRecordImagesFromDb(id);
      if (current.length >= MAX_REPAIR_IMAGES) {
        return res.status(400).json({ error: `สูงสุด ${MAX_REPAIR_IMAGES} รูปต่อรายการ` });
      }

      const nextImages = [...current, fileUrl];
      await setRepairRecordImagesInDb(id, nextImages);

      res.json(repairRecordToRepairItem(mergeRepairRowWithImages(repair, nextImages)));
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/repairs/:id/images - Remove one uploaded image URL
router.delete(
  "/:id/images",
  authenticate,
  requireRepairs,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  validate(removeRepairImageSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { fileUrl } = req.body;

      const repair = await prisma.repairRecord.findUnique({
        where: { id },
        include: {
          deskItem: true,
          reporter: true,
        },
      });

      if (!repair) {
        return res.status(404).json({ error: "Repair record not found" });
      }

      const current = await getRepairRecordImagesFromDb(id);
      const nextImages = current.filter((img) => img !== fileUrl);

      if (nextImages.length === current.length) {
        return res.status(404).json({ error: "Image not found in this repair record" });
      }

      await deleteUploadedFileFromR2(fileUrl);
      await setRepairRecordImagesInDb(id, nextImages);
      res.json(repairRecordToRepairItem(mergeRepairRowWithImages(repair, nextImages)));
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/repairs/:id/status - Update repair status
router.patch(
  "/:id/status",
  authenticate,
  requireRepairs,
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
  requireRepairs,
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

      const images = await getRepairRecordImagesFromDb(id);
      await deleteUploadedFilesFromR2(images);

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

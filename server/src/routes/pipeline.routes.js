import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireBusinessAccess, requireOwnerOrAdmin } from "../middleware/authorize.middleware.js";
import { writeRateLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

// NOTE: PipelineItem model doesn't exist in current schema
// This route is placeholder and will need schema update to work properly

const pipelineSchema = z.object({
  deskItemId: z.string().uuid(),
  qty: z.number().int().positive(),
  costEst: z.number().nonnegative().optional().default(0),
  date: z.string().datetime().optional().nullable(),
  note: z.string().optional().default(""),
  status: z.enum(["planned", "ordered", "transit", "arrived"]).optional(),
  priority: z.enum(["normal", "urgent", "low"]).optional(),
});

const paramsIdSchema = z.object({
  id: z.string().uuid(),
});

// GET /api/pipeline - Get all pipeline items
// TODO: Implement when PipelineItem model is added to schema
router.get(
  "/",
  authenticate,
  requireBusinessAccess,
  requireOwnerOrAdmin,
  async (req, res, next) => {
    try {
      // Placeholder - pipeline model doesn't exist yet
      res.json({
        items: [],
        message: "Pipeline model not yet implemented in schema",
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/pipeline - Create pipeline item
// TODO: Implement when PipelineItem model is added to schema
router.post(
  "/",
  authenticate,
  requireBusinessAccess,
  requireOwnerOrAdmin,
  writeRateLimiter,
  validate(pipelineSchema),
  async (req, res, next) => {
    try {
      const payload = req.body;
      
      // Verify deskItem belongs to this business
      const deskItem = await prisma.deskItem.findUnique({
        where: {
          businessId_id: {
            businessId: req.businessId,
            id: payload.deskItemId,
          },
        },
      });
      
      if (!deskItem) {
        return res.status(404).json({ error: "Desk item not found" });
      }
      
      // TODO: Create pipeline item when model is added
      return res.status(501).json({
        error: "Pipeline model not yet implemented in schema",
        message: "Please add PipelineItem model to schema.prisma",
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/pipeline/:id - Update pipeline item
// TODO: Implement when PipelineItem model is added to schema
router.patch(
  "/:id",
  authenticate,
  requireBusinessAccess,
  requireOwnerOrAdmin,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  validate(pipelineSchema.partial()),
  async (req, res, next) => {
    try {
      // TODO: Update pipeline item when model is added
      return res.status(501).json({
        error: "Pipeline model not yet implemented in schema",
        message: "Please add PipelineItem model to schema.prisma",
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/pipeline/:id - Delete pipeline item
// TODO: Implement when PipelineItem model is added to schema
router.delete(
  "/:id",
  authenticate,
  requireBusinessAccess,
  requireOwnerOrAdmin,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  async (req, res, next) => {
    try {
      // TODO: Delete pipeline item when model is added
      return res.status(501).json({
        error: "Pipeline model not yet implemented in schema",
        message: "Please add PipelineItem model to schema.prisma",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

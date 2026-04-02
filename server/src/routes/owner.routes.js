import { Router } from "express";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/password.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOwnerOrAdmin, requireTenant } from "../middleware/authorize.middleware.js";
import { writeRateLimiter } from "../middleware/rateLimit.middleware.js";
import { ensureDefaultCatalog } from "../lib/ensureCatalog.js";

const router = Router();

const createStaffSchema = z.object({
  fullName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
});

/**
 * POST /api/owner/staff
 * Owner (or legacy ADMIN) creates a staff account under their tenant.
 */
router.post(
  "/staff",
  authenticate,
  requireTenant,
  requireOwnerOrAdmin,
  writeRateLimiter,
  validate(createStaffSchema),
  async (req, res, next) => {
    try {
      const { tenantOwnerId } = req;
      const { fullName, email, password, phone } = req.body;

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(409).json({ error: "User with this email already exists" });
      }

      const passwordHash = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          fullName,
          email,
          passwordHash,
          phone,
          role: UserRole.STAFF,
          ownerId: tenantOwnerId,
        },
      });

      await ensureDefaultCatalog();

      res.status(201).json({
        message: "Staff user created",
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
          ownerId: user.ownerId,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

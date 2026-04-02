import { Router } from "express";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { generateToken } from "../lib/jwt.js";
import { validate } from "../middleware/validate.middleware.js";
import { authRateLimiter } from "../middleware/rateLimit.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOwner } from "../middleware/authorize.middleware.js";
import { ensureDefaultCatalog } from "../lib/ensureCatalog.js";

const router = Router();

// Registration schema
const registerSchema = z.object({
  fullName: z.string().min(1).max(100),
  username: z.string().min(3).max(50),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
  role: z.enum([UserRole.OWNER, UserRole.SALES]).optional().default(UserRole.SALES),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const createStaffSchema = z.object({
  fullName: z.string().min(1).max(100),
  username: z.string().min(3).max(50),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
  role: z.enum([UserRole.SALES, UserRole.REPAIRS]).default(UserRole.SALES),
});

const paramsStaffIdSchema = z.object({
  id: z.string().uuid(),
});

async function getBootstrapStatus() {
  const userCount = await prisma.user.count();

  return {
    allowOwnerSignup: userCount === 0,
  };
}

/**
 * GET /api/auth/bootstrap-status
 * Public registration is disabled; owners are provisioned manually / seed. Staff are created by owner.
 */
router.get("/bootstrap-status", async (_req, res, next) => {
  try {
    const status = await getBootstrapStatus();
    res.json({
      allowOwnerSignup: status.allowOwnerSignup,
      allowPublicStaffSignup: false,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post(
  "/register",
  authRateLimiter,
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const { fullName, username, password, phone, role } = req.body;

      const existingUser = await prisma.user.findUnique({
        where: { username },
      });

      if (existingUser) {
        return res.status(409).json({ error: "User with this username already exists" });
      }

      const { allowOwnerSignup } = await getBootstrapStatus();

      if (role === UserRole.OWNER && !allowOwnerSignup) {
        return res.status(403).json({
          error: "Owner signup is only available for the very first account. Please sign up as sales instead.",
        });
      }

      const passwordHash = await hashPassword(password);
      const assignedRole = role === UserRole.OWNER && allowOwnerSignup ? UserRole.OWNER : UserRole.SALES;

      const user = await prisma.user.create({
        data: {
          fullName,
          username,
          passwordHash,
          phone,
          role: assignedRole,
        },
      });

      await ensureDefaultCatalog();

      const token = generateToken({
        userId: user.id,
        role: user.role,
        username: user.username,
      });

      res.status(201).json({
        message: "User registered successfully",
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { username, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: "Account is disabled" });
      }

      const isValid = await verifyPassword(user.passwordHash, password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      await ensureDefaultCatalog();

      const token = generateToken({
        userId: user.id,
        role: user.role,
        username: user.username,
      });

      res.json({
        message: "Login successful",
        token,
        user: {
          id: user.id,
          username: user.username,
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

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        phone: true,
        role: true,
        ownerId: true,
      },
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        ownerId: user.ownerId,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/staff
 * Owner-only: list active staff members
 */
router.get("/staff", authenticate, requireOwner, async (_req, res, next) => {
  try {
    const staff = await prisma.user.findMany({
      where: {
        role: {
          in: [UserRole.SALES, UserRole.REPAIRS],
        },
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        username: true,
        phone: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            createdSales: true,
          },
        },
      },
    });

    res.json({
      items: staff.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        totalSales: user._count.createdSales,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/staff
 * Owner-only: create staff account
 */
router.post(
  "/staff",
  authenticate,
  requireOwner,
  validate(createStaffSchema),
  async (req, res, next) => {
    try {
      const { fullName, username, password, phone, role } = req.body;

      const existingUser = await prisma.user.findUnique({
        where: { username },
      });
      if (existingUser) {
        return res.status(409).json({ error: "User with this username already exists" });
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          fullName,
          username,
          passwordHash,
          phone,
          role,
          isActive: true,
        },
        select: {
          id: true,
          fullName: true,
          username: true,
          phone: true,
          role: true,
          createdAt: true,
        },
      });

      res.status(201).json({
        user: {
          ...user,
          createdAt: user.createdAt.toISOString(),
          totalSales: 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/auth/staff/:id
 * Owner-only: remove staff by deactivating account
 */
router.delete(
  "/staff/:id",
  authenticate,
  requireOwner,
  validate(paramsStaffIdSchema, "params"),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const existing = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          role: true,
          isActive: true,
        },
      });

      if (!existing || !existing.isActive) {
        return res.status(404).json({ error: "Staff member not found" });
      }

      if (existing.role === UserRole.OWNER) {
        return res.status(400).json({ error: "Owner account cannot be removed" });
      }

      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

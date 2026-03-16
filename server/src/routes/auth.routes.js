import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { generateToken } from "../lib/jwt.js";
import { validate } from "../middleware/validate.middleware.js";
import { authRateLimiter } from "../middleware/rateLimit.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { UserRole } from "@prisma/client";

const router = Router();

const defaultDeskItems = [
  { name: "ลอฟขาเอียง", onsitePrice: 2500, deliveryPrice: 3000 },
  { name: "ลอฟขาตรง", onsitePrice: 2500, deliveryPrice: 3000 },
  { name: "แกรนิต", onsitePrice: 2800, deliveryPrice: 3300 },
  { name: "ทรงยู", onsitePrice: 2800, deliveryPrice: 3300 },
  { name: "1.5 เมตร", onsitePrice: 6000, deliveryPrice: 6500 },
  { name: "1.8 เมตร", onsitePrice: 7000, deliveryPrice: 7500 },
];

const defaultDeliveryFees = [
  { range: 1, cost: 0 },
  { range: 2, cost: 100 },
  { range: 3, cost: 200 },
  { range: 4, cost: 300 },
  { range: 5, cost: 400 },
  { range: 6, cost: 500 },
  { range: 7, cost: 600 },
  { range: 8, cost: 700 },
  { range: 9, cost: 1000 },
  { range: 10, cost: 1100 },
  { range: 11, cost: 1200 },
  { range: 12, cost: 1300 },
  { range: 13, cost: 1400 },
  { range: 14, cost: 1500 },
  { range: 15, cost: 1600 },
  { range: 16, cost: 1700 },
  { range: 17, cost: 1800 },
  { range: 18, cost: 1900 },
  { range: 19, cost: 2000 },
  { range: 20, cost: 2500 },
];

// Registration schema
const registerSchema = z.object({
  fullName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
  role: z.enum([UserRole.OWNER, UserRole.STAFF]),
});

// Login schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function ensureDefaultData() {
  const [deskItemCount, deliveryFeeCount] = await Promise.all([
    prisma.deskItem.count(),
    prisma.deliveryFee.count(),
  ]);

  if (deskItemCount === 0) {
    await prisma.deskItem.createMany({
      data: defaultDeskItems,
    });
  }

  if (deliveryFeeCount === 0) {
    await prisma.deliveryFee.createMany({
      data: defaultDeliveryFees,
    });
  }
}

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
      const { fullName, email, password, phone, role } = req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(409).json({ error: "User with this email already exists" });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          fullName,
          email,
          passwordHash,
          phone,
          role,
        },
      });

      await ensureDefaultData();

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        role: user.role,
        email: user.email,
      });

      res.status(201).json({
        message: "User registered successfully",
        token,
        user: {
          id: user.id,
          email: user.email,
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
 * Login with email and password
 */
router.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Don't reveal if user exists (security best practice)
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: "Account is disabled" });
      }

      // Verify password
      const isValid = await verifyPassword(user.passwordHash, password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        role: user.role,
        email: user.email,
      });

      res.json({
        message: "Login successful",
        token,
        user: {
          id: user.id,
          email: user.email,
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
 * GET /api/auth/me
 * Get current authenticated user info
 * Requires authentication
 */
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
      },
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

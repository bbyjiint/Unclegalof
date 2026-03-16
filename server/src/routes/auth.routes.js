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

// Registration schema
const registerSchema = z.object({
  fullName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
  businessId: z.string().uuid().optional(), // Optional: create new business or join existing
  businessName: z.string().min(1).max(100).optional(), // Required if creating new business
  role: z.nativeEnum(UserRole).default(UserRole.OWNER), // Default to OWNER for new businesses
});

// Login schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  businessId: z.string().uuid().optional(), // Optional: if user has multiple businesses
});

/**
 * POST /api/auth/register
 * Register a new user and optionally create/join a business
 */
router.post(
  "/register",
  authRateLimiter,
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const { fullName, email, password, phone, businessId, businessName, role } = req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(409).json({ error: "User with this email already exists" });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user and business membership
      let businessUserId;
      let finalBusinessId = businessId;

      if (businessId) {
        // Join existing business
        const business = await prisma.business.findUnique({
          where: { id: businessId },
        });

        if (!business) {
          return res.status(404).json({ error: "Business not found" });
        }

        // Create user
        const user = await prisma.user.create({
          data: {
            fullName,
            email,
            passwordHash,
            phone,
          },
        });

        // Create business membership
        const businessUser = await prisma.businessUser.create({
          data: {
            businessId,
            userId: user.id,
            role: role || UserRole.STAFF, // Default to STAFF when joining existing business
          },
        });

        businessUserId = businessUser.id;
        finalBusinessId = businessId;
      } else if (businessName) {
        // Create new business
        const user = await prisma.user.create({
          data: {
            fullName,
            email,
            passwordHash,
            phone,
          },
        });

        // Create business
        const business = await prisma.business.create({
          data: {
            name: businessName,
            users: {
              create: {
                userId: user.id,
                role: role || UserRole.OWNER, // Default to OWNER for new business
              },
            },
          },
          include: {
            users: {
              where: { userId: user.id },
            },
          },
        });

        businessUserId = business.users[0].id;
        finalBusinessId = business.id;
      } else {
        return res.status(400).json({
          error: "Either businessId or businessName must be provided",
        });
      }

      // Get the business user with role
      const businessUser = await prisma.businessUser.findUnique({
        where: { id: businessUserId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      });

      // Generate JWT token
      const token = generateToken({
        userId: businessUser.user.id,
        businessUserId: businessUser.id,
        businessId: finalBusinessId,
        role: businessUser.role,
        email: businessUser.user.email,
      });

      res.status(201).json({
        message: "User registered successfully",
        token,
        user: {
          id: businessUser.user.id,
          email: businessUser.user.email,
          fullName: businessUser.user.fullName,
          businessId: finalBusinessId,
          role: businessUser.role,
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
      const { email, password, businessId } = req.body;

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

      // Find business membership(s)
      const memberships = await prisma.businessUser.findMany({
        where: {
          userId: user.id,
        },
        include: {
          business: {
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          },
        },
      });

      if (memberships.length === 0) {
        return res.status(403).json({ error: "User has no business memberships" });
      }

      // Filter active businesses
      const activeMemberships = memberships.filter((m) => m.business.isActive);

      if (activeMemberships.length === 0) {
        return res.status(403).json({ error: "No active business memberships" });
      }

      // If businessId specified, use that membership
      let selectedMembership = activeMemberships[0];
      if (businessId) {
        const found = activeMemberships.find((m) => m.businessId === businessId);
        if (!found) {
          return res.status(403).json({
            error: "User does not have access to this business",
            availableBusinesses: activeMemberships.map((m) => ({
              id: m.business.id,
              name: m.business.name,
            })),
          });
        }
        selectedMembership = found;
      }

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        businessUserId: selectedMembership.id,
        businessId: selectedMembership.businessId,
        role: selectedMembership.role,
        email: user.email,
      });

      res.json({
        message: "Login successful",
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          businessId: selectedMembership.businessId,
          businessName: selectedMembership.business.name,
          role: selectedMembership.role,
        },
        // If user has multiple businesses, return list
        availableBusinesses:
          activeMemberships.length > 1
            ? activeMemberships.map((m) => ({
                id: m.business.id,
                name: m.business.name,
                role: m.role,
              }))
            : undefined,
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
    const businessUser = await prisma.businessUser.findUnique({
      where: { id: req.businessUser.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
          },
        },
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      user: {
        id: businessUser.user.id,
        email: businessUser.user.email,
        fullName: businessUser.user.fullName,
        phone: businessUser.user.phone,
        businessId: businessUser.business.id,
        businessName: businessUser.business.name,
        role: businessUser.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

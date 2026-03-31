import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { generateToken } from "../lib/jwt.js";
import { validate } from "../middleware/validate.middleware.js";
import { authRateLimiter } from "../middleware/rateLimit.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { ensureDefaultCatalog } from "../lib/ensureCatalog.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * GET /api/auth/bootstrap-status
 * Public registration is disabled; owners are provisioned manually / seed. Staff are created by owner.
 */
router.get("/bootstrap-status", (_req, res) => {
  res.json({
    allowOwnerSignup: false,
    allowPublicStaffSignup: false,
  });
});

/**
 * POST /api/auth/login — single entry; role returned in payload for client redirect.
 */
router.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: "Account is disabled" });
      }

      const isValid = await verifyPassword(user.passwordHash, password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      await ensureDefaultCatalog();

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
        email: true,
        fullName: true,
        phone: true,
        role: true,
        ownerId: true,
      },
    });

    res.json({
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
});

export default router;

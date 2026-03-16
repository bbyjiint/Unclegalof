import { verifyToken, extractTokenFromHeader } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

/**
 * Authentication middleware - verifies JWT token and attaches user to request
 * Requires: Authorization header with "Bearer <token>"
 * Attaches: req.user, req.businessUser, req.businessId, req.role
 */
export async function authenticate(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({ error: "Authentication required: No token provided" });
    }

    // Verify token
    const decoded = verifyToken(token);

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not found or inactive" });
    }

    // Verify BusinessUser membership still exists and is active
    const businessUser = await prisma.businessUser.findUnique({
      where: { id: decoded.businessUserId },
      select: {
        id: true,
        businessId: true,
        userId: true,
        role: true,
      },
    });

    if (!businessUser || businessUser.userId !== decoded.userId) {
      return res.status(401).json({ error: "Invalid membership" });
    }

    // Verify business still exists and is active
    const business = await prisma.business.findUnique({
      where: { id: businessUser.businessId },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!business || !business.isActive) {
      return res.status(401).json({ error: "Business not found or inactive" });
    }

    // Attach user info to request
    req.user = user;
    req.businessUser = businessUser;
    req.businessId = businessUser.businessId;
    req.role = businessUser.role;

    next();
  } catch (error) {
    if (error.message === "Token expired") {
      return res.status(401).json({ error: "Token expired" });
    } else if (error.message === "Invalid token") {
      return res.status(401).json({ error: "Invalid token" });
    } else {
      console.error("Authentication error:", error);
      return res.status(500).json({ error: "Authentication failed" });
    }
  }
}

/**
 * Optional authentication - doesn't fail if no token, but attaches user if token is valid
 */
export async function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return next(); // No token, continue without auth
    }

    // Try to authenticate, but don't fail if it doesn't work
    const decoded = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, fullName: true, isActive: true },
    });

    if (user && user.isActive) {
      const businessUser = await prisma.businessUser.findUnique({
        where: { id: decoded.businessUserId },
        select: { id: true, businessId: true, userId: true, role: true },
      });

      if (businessUser && businessUser.userId === decoded.userId) {
        const business = await prisma.business.findUnique({
          where: { id: businessUser.businessId },
          select: { id: true, isActive: true },
        });

        if (business && business.isActive) {
          req.user = user;
          req.businessUser = businessUser;
          req.businessId = businessUser.businessId;
          req.role = businessUser.role;
        }
      }
    }

    next();
  } catch (error) {
    // Silently fail and continue without auth
    next();
  }
}

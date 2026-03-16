import { verifyToken, extractTokenFromHeader } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

/**
 * Authentication middleware - verifies JWT token and attaches user to request
 * Requires: Authorization header with "Bearer <token>"
 * Attaches: req.user, req.role
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
        phone: true,
        isActive: true,
        role: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not found or inactive" });
    }

    // Attach user info to request
    req.user = user;
    req.role = user.role;

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
      select: { id: true, email: true, fullName: true, phone: true, isActive: true, role: true },
    });

    if (user && user.isActive) {
      req.user = user;
      req.role = user.role;
    }

    next();
  } catch (error) {
    // Silently fail and continue without auth
    next();
  }
}

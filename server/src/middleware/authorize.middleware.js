import { UserRole } from "@prisma/client";

/**
 * Authorization middleware - ensures user has required role
 * Must be used after authenticate() middleware
 * 
 * @param {...UserRole} allowedRoles - Roles that are allowed to access
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.role) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(req.role)) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        required: allowedRoles,
        current: req.role
      });
    }

    next();
  };
}

export function requireAuthAndRole(...allowedRoles) {
  return [
    requireRole(...allowedRoles),
  ];
}

export const requireOwner = requireAuthAndRole(UserRole.OWNER);

export const requireSales = requireAuthAndRole(
  UserRole.OWNER,
  UserRole.SALES
);

export const requireRepairs = requireAuthAndRole(
  UserRole.OWNER,
  UserRole.REPAIRS
);

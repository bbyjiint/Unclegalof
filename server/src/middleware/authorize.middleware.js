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

/**
 * Ensure user belongs to the business they're trying to access
 * Must be used after authenticate() middleware
 * 
 * Checks:
 * 1. If businessId is in request params/body/query, verify it matches user's business
 * 2. If no businessId in request, use user's businessId
 */
export function requireBusinessAccess(req, res, next) {
  if (!req.businessId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // Extract businessId from various sources
  const requestedBusinessId = 
    req.params.businessId || 
    req.body.businessId || 
    req.query.businessId;

  // If businessId is specified in request, verify it matches user's business
  if (requestedBusinessId && requestedBusinessId !== req.businessId) {
    return res.status(403).json({ 
      error: "Access denied: Cannot access other business data",
      requested: requestedBusinessId,
      authorized: req.businessId
    });
  }

  // Ensure all database queries are scoped to user's business
  // This is a safety measure - routes should still use req.businessId in queries
  next();
}

/**
 * Combined middleware: authenticate + require role + business access
 */
export function requireAuthAndRole(...allowedRoles) {
  return [
    requireBusinessAccess,
    requireRole(...allowedRoles),
  ];
}

/**
 * Owner/Admin only - highest privilege level
 */
export const requireOwnerOrAdmin = requireAuthAndRole(UserRole.OWNER, UserRole.ADMIN);

/**
 * Owner only - absolute control
 */
export const requireOwner = requireAuthAndRole(UserRole.OWNER);

/**
 * Staff and above - can access most features
 */
export const requireStaff = requireAuthAndRole(
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.STAFF
);

/**
 * Inventory role and above
 */
export const requireInventory = requireAuthAndRole(
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.INVENTORY
);

/**
 * Delivery role and above
 */
export const requireDelivery = requireAuthAndRole(
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.DELIVERY
);

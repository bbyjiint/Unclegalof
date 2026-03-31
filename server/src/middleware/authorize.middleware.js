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

/**
 * After authenticate — ensures user is linked to a tenant (staff.ownerId or owner-class user).
 */
export function requireTenant(req, res, next) {
  if (!req.tenantOwnerId) {
    return res.status(403).json({
      error: "บัญชีนี้ยังไม่ผูกกับเจ้าของร้าน กรุณาติดต่อผู้ดูแลระบบ",
    });
  }

  next();
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

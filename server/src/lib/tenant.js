import { UserRole } from "@prisma/client";

/** Roles that act as the business owner (tenant root). */
export const TENANT_OWNER_ROLES = [UserRole.OWNER];

/**
 * UUID of the business owner for this user.
 * - Owner-class users: their own id.
 * - Staff: their ownerId (must be set).
 */
export function getTenantOwnerId(user) {
  if (!user) {
    return null;
  }

  if (TENANT_OWNER_ROLES.includes(user.role)) {
    return user.id;
  }

  return user.ownerId ?? null;
}

export function isTenantOwnerRole(role) {
  return TENANT_OWNER_ROLES.includes(role);
}

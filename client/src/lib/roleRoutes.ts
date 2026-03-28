import type { UserRole } from "../types";

const STAFF_ROLES: UserRole[] = ["OWNER", "ADMIN", "STAFF"];
const INVENTORY_ROLES: UserRole[] = ["OWNER", "ADMIN", "INVENTORY"];
const OWNER_ROLES: UserRole[] = ["OWNER", "ADMIN"];

export function getDefaultRouteForRole(role: UserRole): string {
  if (OWNER_ROLES.includes(role)) {
    return "/owner";
  }

  if (INVENTORY_ROLES.includes(role)) {
    return "/inventory";
  }

  if (STAFF_ROLES.includes(role)) {
    return "/staff";
  }

  return "/login";
}

export function canAccessRoute(role: UserRole, path: string): boolean {
  if (path === "/owner") {
    return OWNER_ROLES.includes(role);
  }

  if (path === "/inventory") {
    return INVENTORY_ROLES.includes(role);
  }

  if (path === "/staff" || path === "/repair") {
    return STAFF_ROLES.includes(role);
  }

  return false;
}

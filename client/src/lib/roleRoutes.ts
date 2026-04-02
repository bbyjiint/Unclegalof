import type { UserRole } from "../types";

export function getDefaultRouteForRole(role: UserRole): string {
  if (role === "OWNER") {
    return "/owner";
  }

  if (role === "SALES") {
    return "/staff";
  }

  if (role === "REPAIRS") {
    return "/repair";
  }

  return "/login";
}

export function canAccessRoute(role: UserRole, path: string): boolean {
  if (role === "OWNER") {
    if (path.startsWith("/owner")) {
      return true;
    }
    return ["/staff", "/inventory", "/repair", "/deliveries"].includes(path);
  }

  if (path === "/owner" || path.startsWith("/owner/")) {
    return role === "OWNER";
  }

  if (path === "/staff" || path === "/inventory") {
    return role === "SALES";
  }

  if (path === "/repair") {
    return role === "REPAIRS";
  }

  if (path === "/deliveries") {
    return role === "OWNER" || role === "REPAIRS";
  }

  return false;
}

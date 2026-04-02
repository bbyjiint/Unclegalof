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
    return ["/owner", "/staff", "/inventory", "/repair"].includes(path);
  }

  if (path === "/owner") {
    return role === "OWNER";
  }

  if (path === "/staff" || path === "/inventory") {
    return role === "SALES";
  }

  if (path === "/repair") {
    return role === "REPAIRS";
  }

  return false;
}

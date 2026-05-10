import { UserRole } from "@prisma/client";

// Module-level cache — the owner ID is constant for the lifetime of a serverless function instance.
// A cold start pays one DB query; all subsequent warm requests skip it.
let _cachedOwnerId = null;

/**
 * Single-company deployment: all users share one dataset. SaleRecord.ownerId is
 * still a required FK — we anchor it to the first active OWNER (by signup time).
 */
export async function getCanonicalCompanyOwnerId(prisma) {
  if (_cachedOwnerId) return _cachedOwnerId;

  const owner = await prisma.user.findFirst({
    where: { role: UserRole.OWNER, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!owner) {
    const err = new Error("No OWNER account exists. Create an owner user first.");
    err.statusCode = 503;
    throw err;
  }

  _cachedOwnerId = owner.id;
  return _cachedOwnerId;
}

/** All active users — for payroll / inventory rollups across the whole company. */
export async function getAllActiveUserIds(prisma) {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

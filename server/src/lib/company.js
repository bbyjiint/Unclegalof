import { UserRole } from "@prisma/client";

/**
 * Single-company deployment: all users share one dataset. SaleRecord.ownerId is
 * still a required FK — we anchor it to the first active OWNER (by signup time).
 */
export async function getCanonicalCompanyOwnerId(prisma) {
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
  return owner.id;
}

/** All active users — for payroll / inventory rollups across the whole company. */
export async function getAllActiveUserIds(prisma) {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

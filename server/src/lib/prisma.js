import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["warn", "error"]
  });

// Always store the client on globalThis so it is reused across hot-reloads in
// dev and — critically — across multiple requests within the same serverless
// function instance in production (Vercel). Without this, every invocation
// would open a new DB connection even when the function is already warm.
globalForPrisma.prisma = prisma;

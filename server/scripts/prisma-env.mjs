/**
 * Ensures DIRECT_URL is set for Prisma CLI (Neon migrations need non-pooled URL;
 * local dev can use the same value as DATABASE_URL).
 */
import "dotenv/config";

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

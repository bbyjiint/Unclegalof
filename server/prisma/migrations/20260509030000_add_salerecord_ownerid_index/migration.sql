-- CreateIndex
-- Uses CONCURRENTLY so no table lock is taken on the live production database.
-- Prisma wraps migrations in a transaction by default; CONCURRENTLY cannot run
-- inside one, so this migration must run outside a transaction.
-- prisma-migrate: no-transaction
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SaleRecord_ownerId_idx" ON "SaleRecord"("ownerId");

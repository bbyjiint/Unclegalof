-- Tenant scoping: staff link to owner; orders (sales) belong to an owner.

-- User.self reference for staff -> owner
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ownerId" UUID;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_ownerId_fkey";
ALTER TABLE "User"
  ADD CONSTRAINT "User_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "User_ownerId_idx" ON "User"("ownerId");

-- SaleRecord.tenant owner
ALTER TABLE "SaleRecord" ADD COLUMN IF NOT EXISTS "ownerId" UUID;

-- Backfill owner user (first OWNER/ADMIN by createdAt)
WITH fo AS (
  SELECT id FROM "User" WHERE role IN ('OWNER', 'ADMIN') ORDER BY "createdAt" ASC LIMIT 1
)
UPDATE "User" u
SET "ownerId" = fo.id
FROM fo
WHERE fo.id IS NOT NULL
  AND u.role NOT IN ('OWNER', 'ADMIN')
  AND u."ownerId" IS NULL;

WITH fo AS (
  SELECT id FROM "User" WHERE role IN ('OWNER', 'ADMIN') ORDER BY "createdAt" ASC LIMIT 1
)
UPDATE "SaleRecord" s
SET "ownerId" = fo.id
FROM fo
WHERE fo.id IS NOT NULL AND s."ownerId" IS NULL;

-- Enforce NOT NULL on sales when any row still null: delete orphaned sales (no owner to attach)
DELETE FROM "SaleRecord" WHERE "ownerId" IS NULL;

ALTER TABLE "SaleRecord" ALTER COLUMN "ownerId" SET NOT NULL;

ALTER TABLE "SaleRecord" DROP CONSTRAINT IF EXISTS "SaleRecord_ownerId_fkey";
ALTER TABLE "SaleRecord"
  ADD CONSTRAINT "SaleRecord_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "SaleRecord_ownerId_idx" ON "SaleRecord"("ownerId");

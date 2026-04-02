-- Restore tenant scoping after 20260402115906_update_column_name dropped SaleRecord.ownerId.
-- User.ownerId was not dropped; only its FK/index were removed. We restore both sides.

-- 1) SaleRecord: add column (idempotent for DBs that never ran the drop)
ALTER TABLE "SaleRecord" ADD COLUMN IF NOT EXISTS "ownerId" UUID;

-- 2) User: ensure column exists (safe if already present)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ownerId" UUID;

-- 3) Backfill staff -> owner link (first OWNER by createdAt)
WITH fo AS (
  SELECT id FROM "User" WHERE role = 'OWNER' ORDER BY "createdAt" ASC LIMIT 1
)
UPDATE "User" u
SET "ownerId" = fo.id
FROM fo
WHERE fo.id IS NOT NULL
  AND u.role <> 'OWNER'
  AND u."ownerId" IS NULL;

-- 4) Backfill SaleRecord.ownerId from creator / first OWNER
UPDATE "SaleRecord" s
SET "ownerId" = COALESCE(
  (
    SELECT CASE
      WHEN u.role = 'OWNER' THEN u.id
      ELSE u."ownerId"
    END
    FROM "User" u
    WHERE u.id = s."createdByUserId"
  ),
  (SELECT id FROM "User" WHERE role = 'OWNER' ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE s."ownerId" IS NULL;

-- 5) Remove rows we cannot attach to any tenant (should be rare)
DELETE FROM "SaleRecord" WHERE "ownerId" IS NULL;

-- 6) Enforce NOT NULL
ALTER TABLE "SaleRecord" ALTER COLUMN "ownerId" SET NOT NULL;

-- 7) Indexes
CREATE INDEX IF NOT EXISTS "SaleRecord_ownerId_idx" ON "SaleRecord"("ownerId");
CREATE INDEX IF NOT EXISTS "User_ownerId_idx" ON "User"("ownerId");

-- 8) Foreign keys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_ownerId_fkey') THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaleRecord_ownerId_fkey') THEN
    ALTER TABLE "SaleRecord"
      ADD CONSTRAINT "SaleRecord_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

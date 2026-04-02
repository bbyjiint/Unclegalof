-- Append-only samples of ต้นทุน/หน่วย per receipt; simple mean drives average cost.
CREATE TABLE "DeskItemCostLog" (
    "id" UUID NOT NULL,
    "deskItemId" UUID NOT NULL,
    "costPerUnit" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeskItemCostLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeskItemCostLog_deskItemId_idx" ON "DeskItemCostLog"("deskItemId");

ALTER TABLE "DeskItemCostLog" ADD CONSTRAINT "DeskItemCostLog_deskItemId_fkey" FOREIGN KEY ("deskItemId") REFERENCES "DeskItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from existing lots (one sample per lot with positive cost)
INSERT INTO "DeskItemCostLog" ("id", "deskItemId", "costPerUnit", "createdAt")
SELECT gen_random_uuid(), "deskItemId", "costPerUnit", "createdAt"
FROM "InventoryLot"
WHERE "costPerUnit" > 0;

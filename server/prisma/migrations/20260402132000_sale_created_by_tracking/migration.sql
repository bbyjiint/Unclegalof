-- AlterTable
ALTER TABLE "SaleRecord"
ADD COLUMN "createdByUserId" UUID;

-- CreateIndex
CREATE INDEX "SaleRecord_createdByUserId_idx" ON "SaleRecord"("createdByUserId");

-- AddForeignKey
ALTER TABLE "SaleRecord"
ADD CONSTRAINT "SaleRecord_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PaymentBatch" (
    "id" UUID NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "transferAmount" INTEGER,
    "paymentSlipImage" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" UUID,

    CONSTRAINT "PaymentBatch_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "SaleRecord" ADD COLUMN "paymentBatchId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentBatch_batchNumber_key" ON "PaymentBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "PaymentBatch_createdAt_idx" ON "PaymentBatch"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentBatch_createdByUserId_idx" ON "PaymentBatch"("createdByUserId");

-- CreateIndex
CREATE INDEX "SaleRecord_paymentBatchId_idx" ON "SaleRecord"("paymentBatchId");

-- AddForeignKey
ALTER TABLE "SaleRecord" ADD CONSTRAINT "SaleRecord_paymentBatchId_fkey" FOREIGN KEY ("paymentBatchId") REFERENCES "PaymentBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentBatch" ADD CONSTRAINT "PaymentBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

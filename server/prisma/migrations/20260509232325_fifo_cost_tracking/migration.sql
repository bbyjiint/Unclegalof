-- CreateEnum
CREATE TYPE "CostStatus" AS ENUM ('confirmed', 'pending_owner_review');

-- AlterTable
ALTER TABLE "SaleRecord" ADD COLUMN     "costStatus" "CostStatus" NOT NULL DEFAULT 'confirmed';

-- AlterTable
ALTER TABLE "SalesOrderLine" ADD COLUMN     "costStatus" "CostStatus" NOT NULL DEFAULT 'confirmed';

-- CreateTable
CREATE TABLE "SalesOrderLineConsumedLot" (
    "id" UUID NOT NULL,
    "salesOrderLineId" UUID NOT NULL,
    "saleRecordId" UUID NOT NULL,
    "inventoryLotId" UUID,
    "consumedQty" INTEGER NOT NULL,
    "costPerUnitAtSale" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesOrderLineConsumedLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesOrderLineConsumedLot_salesOrderLineId_idx" ON "SalesOrderLineConsumedLot"("salesOrderLineId");

-- CreateIndex
CREATE INDEX "SalesOrderLineConsumedLot_saleRecordId_idx" ON "SalesOrderLineConsumedLot"("saleRecordId");

-- CreateIndex
CREATE INDEX "SalesOrderLineConsumedLot_inventoryLotId_idx" ON "SalesOrderLineConsumedLot"("inventoryLotId");

-- CreateIndex
CREATE INDEX "SaleRecord_costStatus_idx" ON "SaleRecord"("costStatus");

-- CreateIndex
CREATE INDEX "SalesOrderLine_costStatus_idx" ON "SalesOrderLine"("costStatus");

-- AddForeignKey
ALTER TABLE "SalesOrderLineConsumedLot" ADD CONSTRAINT "SalesOrderLineConsumedLot_salesOrderLineId_fkey" FOREIGN KEY ("salesOrderLineId") REFERENCES "SalesOrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLineConsumedLot" ADD CONSTRAINT "SalesOrderLineConsumedLot_saleRecordId_fkey" FOREIGN KEY ("saleRecordId") REFERENCES "SaleRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLineConsumedLot" ADD CONSTRAINT "SalesOrderLineConsumedLot_inventoryLotId_fkey" FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

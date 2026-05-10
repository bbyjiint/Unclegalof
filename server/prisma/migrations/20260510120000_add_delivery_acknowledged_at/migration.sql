-- AlterTable
ALTER TABLE "SaleRecord" ADD COLUMN     "deliveryAcknowledgedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "deliveryAcknowledgedAt" TIMESTAMP(3);

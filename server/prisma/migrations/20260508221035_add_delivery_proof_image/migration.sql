-- AlterEnum
ALTER TYPE "StoredFilePurpose" ADD VALUE 'DELIVERY_PROOF';

-- AlterTable
ALTER TABLE "SaleRecord" ADD COLUMN     "deliveryProofImage" TEXT;

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "deliveryProofImage" TEXT;

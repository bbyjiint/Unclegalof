-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_ownerId_fkey";

-- DropIndex
DROP INDEX "SaleRecord_ownerId_idx";

-- DropIndex
DROP INDEX "User_ownerId_idx";

-- AlterTable
ALTER TABLE "SaleRecord" ADD COLUMN     "customerPhone" TEXT;

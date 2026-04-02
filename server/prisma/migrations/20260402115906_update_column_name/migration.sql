/*
  Warnings:

  - You are about to drop the column `ownerId` on the `SaleRecord` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "SaleRecord" DROP CONSTRAINT "SaleRecord_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_ownerId_fkey";

-- DropIndex
DROP INDEX "SaleRecord_ownerId_idx";

-- DropIndex
DROP INDEX "User_ownerId_idx";

-- AlterTable
ALTER TABLE "SaleRecord" DROP COLUMN "ownerId";

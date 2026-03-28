-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'INVENTORY', 'DELIVERY');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('paid', 'pending', 'deposit');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('selfpickup', 'delivery');

-- CreateEnum
CREATE TYPE "PromotionAmountType" AS ENUM ('fixed', 'percent');

-- CreateEnum
CREATE TYPE "InventoryDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('planned', 'ordered', 'transit', 'arrived');

-- CreateEnum
CREATE TYPE "PipelinePriority" AS ENUM ('normal', 'urgent', 'low');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "baseSalary" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeskItem" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "onsitePrice" INTEGER NOT NULL,
    "deliveryPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeskItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryFee" (
    "range" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryFee_pkey" PRIMARY KEY ("range")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "amountType" "PromotionAmountType" NOT NULL DEFAULT 'fixed',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleRecord" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "deskType" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "promoDiscount" INTEGER NOT NULL DEFAULT 0,
    "manualDiscount" INTEGER NOT NULL DEFAULT 0,
    "manualDiscountReason" TEXT,
    "status" "Status" NOT NULL DEFAULT 'pending',
    "appliedPromotion" UUID,
    "amount" INTEGER NOT NULL,
    "deliveryType" "DeliveryMethod" NOT NULL DEFAULT 'selfpickup',
    "deliveryRange" INTEGER,
    "workerFee" INTEGER NOT NULL DEFAULT 0,
    "workerFeeType" TEXT,
    "customerName" TEXT,
    "deliveryAddress" TEXT,
    "remarks" TEXT,
    "paymentSlipImage" TEXT,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "SaleRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairRecord" (
    "id" UUID NOT NULL,
    "deskItemId" UUID NOT NULL,
    "reportedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "size" TEXT,
    "color" TEXT,
    "description" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'repair',
    "status" TEXT NOT NULL DEFAULT 'open',
    "amount" INTEGER NOT NULL,
    "images" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "RepairRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleRecordCommission" (
    "id" UUID NOT NULL,
    "saleRecordId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleRecordCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "baseSalary" INTEGER NOT NULL,
    "commissionTotal" INTEGER NOT NULL DEFAULT 0,
    "bonus" INTEGER,
    "deduction" INTEGER,
    "totalPaid" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLot" (
    "id" UUID NOT NULL,
    "deskItemId" UUID NOT NULL,
    "qty" INTEGER NOT NULL,
    "remainingQty" INTEGER NOT NULL,
    "costPerUnit" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" UUID NOT NULL,
    "deskItemId" UUID NOT NULL,
    "inventoryLotId" UUID,
    "direction" "InventoryDirection" NOT NULL,
    "qty" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" UUID,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineItem" (
    "id" UUID NOT NULL,
    "deskItemId" UUID NOT NULL,
    "qty" INTEGER NOT NULL,
    "costEst" INTEGER NOT NULL DEFAULT 0,
    "expectedDate" TIMESTAMP(3),
    "note" TEXT,
    "status" "PipelineStatus" NOT NULL DEFAULT 'planned',
    "priority" "PipelinePriority" NOT NULL DEFAULT 'normal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DeskItem_name_key" ON "DeskItem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_name_key" ON "Promotion"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SaleRecord_orderNumber_key" ON "SaleRecord"("orderNumber");

-- CreateIndex
CREATE INDEX "SaleRecord_saleDate_idx" ON "SaleRecord"("saleDate");

-- CreateIndex
CREATE INDEX "SaleRecord_deskType_idx" ON "SaleRecord"("deskType");

-- CreateIndex
CREATE INDEX "SaleRecord_appliedPromotion_idx" ON "SaleRecord"("appliedPromotion");

-- CreateIndex
CREATE INDEX "SaleRecord_deliveryRange_idx" ON "SaleRecord"("deliveryRange");

-- CreateIndex
CREATE INDEX "RepairRecord_deskItemId_idx" ON "RepairRecord"("deskItemId");

-- CreateIndex
CREATE INDEX "RepairRecord_reportedBy_idx" ON "RepairRecord"("reportedBy");

-- CreateIndex
CREATE INDEX "SaleRecordCommission_saleRecordId_idx" ON "SaleRecordCommission"("saleRecordId");

-- CreateIndex
CREATE INDEX "SaleRecordCommission_userId_idx" ON "SaleRecordCommission"("userId");

-- CreateIndex
CREATE INDEX "SaleRecordCommission_userId_createdAt_idx" ON "SaleRecordCommission"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollRecord_userId_idx" ON "PayrollRecord"("userId");

-- CreateIndex
CREATE INDEX "PayrollRecord_year_month_idx" ON "PayrollRecord"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_userId_year_month_key" ON "PayrollRecord"("userId", "year", "month");

-- CreateIndex
CREATE INDEX "InventoryLot_deskItemId_idx" ON "InventoryLot"("deskItemId");

-- CreateIndex
CREATE INDEX "InventoryLot_createdAt_idx" ON "InventoryLot"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_deskItemId_idx" ON "InventoryMovement"("deskItemId");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_inventoryLotId_idx" ON "InventoryMovement"("inventoryLotId");

-- CreateIndex
CREATE INDEX "PipelineItem_deskItemId_idx" ON "PipelineItem"("deskItemId");

-- CreateIndex
CREATE INDEX "PipelineItem_status_idx" ON "PipelineItem"("status");

-- CreateIndex
CREATE INDEX "PipelineItem_expectedDate_idx" ON "PipelineItem"("expectedDate");

-- AddForeignKey
ALTER TABLE "SaleRecord" ADD CONSTRAINT "SaleRecord_deskType_fkey" FOREIGN KEY ("deskType") REFERENCES "DeskItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRecord" ADD CONSTRAINT "SaleRecord_deliveryRange_fkey" FOREIGN KEY ("deliveryRange") REFERENCES "DeliveryFee"("range") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRecord" ADD CONSTRAINT "SaleRecord_appliedPromotion_fkey" FOREIGN KEY ("appliedPromotion") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairRecord" ADD CONSTRAINT "RepairRecord_deskItemId_fkey" FOREIGN KEY ("deskItemId") REFERENCES "DeskItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairRecord" ADD CONSTRAINT "RepairRecord_reportedBy_fkey" FOREIGN KEY ("reportedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRecordCommission" ADD CONSTRAINT "SaleRecordCommission_saleRecordId_fkey" FOREIGN KEY ("saleRecordId") REFERENCES "SaleRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRecordCommission" ADD CONSTRAINT "SaleRecordCommission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_deskItemId_fkey" FOREIGN KEY ("deskItemId") REFERENCES "DeskItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_deskItemId_fkey" FOREIGN KEY ("deskItemId") REFERENCES "DeskItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryLotId_fkey" FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineItem" ADD CONSTRAINT "PipelineItem_deskItemId_fkey" FOREIGN KEY ("deskItemId") REFERENCES "DeskItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

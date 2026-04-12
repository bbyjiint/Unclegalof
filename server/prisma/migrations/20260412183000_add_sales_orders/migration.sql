-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" UUID NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'pending',
    "appliedPromotion" UUID,
    "promoDiscountTotal" INTEGER NOT NULL DEFAULT 0,
    "manualDiscount" INTEGER NOT NULL DEFAULT 0,
    "manualDiscountReason" TEXT,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "grandTotal" INTEGER NOT NULL DEFAULT 0,
    "deliveryType" "DeliveryMethod" NOT NULL DEFAULT 'selfpickup',
    "deliveryCompletedAt" TIMESTAMP(3),
    "deliveryRange" INTEGER,
    "workerFee" INTEGER NOT NULL DEFAULT 0,
    "workerFeeType" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "deliveryAddress" TEXT,
    "remarks" TEXT,
    "paymentSlipImage" TEXT,
    "slipViewedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdByUserId" UUID,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderLine" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "salesOrderId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "deskItemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "promoDiscount" INTEGER NOT NULL DEFAULT 0,
    "manualDiscount" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL,
    "avgUnitCostSnapshot" INTEGER NOT NULL DEFAULT 0,
    "cogsTotal" INTEGER NOT NULL DEFAULT 0,
    "grossProfit" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "SaleRecord" ADD COLUMN "salesOrderId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_orderNumber_key" ON "SalesOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "SalesOrder_saleDate_idx" ON "SalesOrder"("saleDate");

-- CreateIndex
CREATE INDEX "SalesOrder_appliedPromotion_idx" ON "SalesOrder"("appliedPromotion");

-- CreateIndex
CREATE INDEX "SalesOrder_deliveryRange_idx" ON "SalesOrder"("deliveryRange");

-- CreateIndex
CREATE INDEX "SalesOrder_createdByUserId_idx" ON "SalesOrder"("createdByUserId");

-- CreateIndex
CREATE INDEX "SalesOrderLine_salesOrderId_idx" ON "SalesOrderLine"("salesOrderId");

-- CreateIndex
CREATE INDEX "SalesOrderLine_deskItemId_idx" ON "SalesOrderLine"("deskItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrderLine_salesOrderId_lineNumber_key" ON "SalesOrderLine"("salesOrderId", "lineNumber");

-- CreateIndex
CREATE INDEX "SaleRecord_salesOrderId_idx" ON "SaleRecord"("salesOrderId");

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_appliedPromotion_fkey" FOREIGN KEY ("appliedPromotion") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_deliveryRange_fkey" FOREIGN KEY ("deliveryRange") REFERENCES "DeliveryFee"("range") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_deskItemId_fkey" FOREIGN KEY ("deskItemId") REFERENCES "DeskItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRecord" ADD CONSTRAINT "SaleRecord_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: SalesOrder — store header-level payout snapshot
ALTER TABLE "SalesOrder"
  ADD COLUMN "workerLiftFee"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "workerDistanceFee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "employeePayout"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ownerNet"          INTEGER NOT NULL DEFAULT 0;

-- AlterTable: SalesOrderLine — per-line lift fee snapshot
ALTER TABLE "SalesOrderLine"
  ADD COLUMN "workerLiftFee" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: SaleRecord (legacy mirror) — per-line lift fee snapshot
ALTER TABLE "SaleRecord"
  ADD COLUMN "workerLiftFee" INTEGER NOT NULL DEFAULT 0;

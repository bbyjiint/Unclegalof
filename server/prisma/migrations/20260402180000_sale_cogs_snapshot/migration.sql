-- Sale COGS snapshot (weighted average cost at time of sale)
ALTER TABLE "SaleRecord" ADD COLUMN "avgUnitCostSnapshot" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SaleRecord" ADD COLUMN "cogsTotal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SaleRecord" ADD COLUMN "grossProfit" INTEGER NOT NULL DEFAULT 0;

-- Add a dedicated upload purpose for sale/order desk photos.
ALTER TYPE "StoredFilePurpose" ADD VALUE IF NOT EXISTS 'SALE_IMAGE';

-- Store desk photos structurally while keeping legacy note-embedded photo URLs readable.
ALTER TABLE "SalesOrder" ADD COLUMN "deskPhotos" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "SaleRecord" ADD COLUMN "deskPhotos" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "SalesOrderLine" ADD COLUMN "deskPhotos" JSONB NOT NULL DEFAULT '[]';

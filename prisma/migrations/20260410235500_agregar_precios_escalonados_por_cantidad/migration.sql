ALTER TABLE "Product" ADD COLUMN "pricingConfigJson" TEXT;

ALTER TABLE "SaleItem" ADD COLUMN "pricingContextJson" TEXT;

ALTER TABLE "Customer" ADD COLUMN "segment" TEXT NOT NULL DEFAULT 'GENERAL';

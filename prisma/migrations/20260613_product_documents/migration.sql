-- Product documents + product status/SEO/featured + uploaded-file metadata
-- Apply with: npx prisma migrate deploy   (or run this SQL in the Supabase SQL editor)

-- Product: featured + SEO fields (status already exists)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "seoTitle" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;

-- UploadedFile: storage metadata for deletion + audit
ALTER TABLE "UploadedFile" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
ALTER TABLE "UploadedFile" ADD COLUMN IF NOT EXISTS "bucket" TEXT;
ALTER TABLE "UploadedFile" ADD COLUMN IF NOT EXISTS "mimeType" TEXT;
ALTER TABLE "UploadedFile" ADD COLUMN IF NOT EXISTS "sizeBytes" INTEGER;

-- ProductDocument: attachments (PDF, brochure, catalogue, CAD, tech sheet, drawing)
CREATE TABLE IF NOT EXISTS "ProductDocument" (
  "id"         TEXT NOT NULL,
  "productId"  TEXT NOT NULL,
  "kind"       TEXT NOT NULL DEFAULT 'DOCUMENT',
  "url"        TEXT NOT NULL,
  "storageKey" TEXT,
  "bucket"     TEXT,
  "filename"   TEXT NOT NULL,
  "mimeType"   TEXT,
  "sizeBytes"  INTEGER,
  "sort"       INTEGER NOT NULL DEFAULT 0,
  "uploaderId" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductDocument_productId_idx" ON "ProductDocument"("productId");

DO $$ BEGIN
  ALTER TABLE "ProductDocument"
    ADD CONSTRAINT "ProductDocument_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helpful indexes for admin list filtering
CREATE INDEX IF NOT EXISTS "Product_status_idx" ON "Product"("status");
CREATE INDEX IF NOT EXISTS "Product_featured_idx" ON "Product"("featured");
CREATE INDEX IF NOT EXISTS "Lead_status_idx" ON "Lead"("status");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");
CREATE INDEX IF NOT EXISTS "Quote_status_idx" ON "Quote"("status");

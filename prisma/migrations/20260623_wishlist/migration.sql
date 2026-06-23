-- DB-backed wishlist for cross-device sync. One row per (customer, product slug).

CREATE TABLE IF NOT EXISTS "WishlistItem" (
  "id"          TEXT NOT NULL,
  "customerId"  TEXT NOT NULL,
  "productSlug" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WishlistItem_customerId_productSlug_key"
  ON "WishlistItem"("customerId", "productSlug");
CREATE INDEX IF NOT EXISTS "WishlistItem_customerId_idx" ON "WishlistItem"("customerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WishlistItem_customerId_fkey'
  ) THEN
    ALTER TABLE "WishlistItem"
      ADD CONSTRAINT "WishlistItem_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

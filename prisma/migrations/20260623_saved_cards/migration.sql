-- Saved cards via Razorpay token vault. We store ONLY display fields + the token
-- handle; never a card number. PCI scope stays with Razorpay.

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "razorpayCustomerId" TEXT;

CREATE TABLE IF NOT EXISTS "SavedCard" (
  "id"                 TEXT NOT NULL,
  "customerId"         TEXT NOT NULL,
  "razorpayTokenId"    TEXT NOT NULL,
  "razorpayCustomerId" TEXT NOT NULL,
  "network"            TEXT,
  "last4"              TEXT,
  "issuer"             TEXT,
  "expiryMonth"        INTEGER,
  "expiryYear"         INTEGER,
  "isDefault"          BOOLEAN NOT NULL DEFAULT false,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SavedCard_razorpayTokenId_key" ON "SavedCard"("razorpayTokenId");
CREATE INDEX IF NOT EXISTS "SavedCard_customerId_idx" ON "SavedCard"("customerId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SavedCard_customerId_fkey') THEN
    ALTER TABLE "SavedCard"
      ADD CONSTRAINT "SavedCard_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

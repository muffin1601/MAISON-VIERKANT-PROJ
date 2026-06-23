-- Address book persistence: enrich Address with recipient + book metadata so a
-- customer's saved addresses live in the DB (were previously browser-only).
-- Purely additive; existing checkout-created Address rows remain valid.

ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "label"     TEXT;
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "name"      TEXT;
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "phone"     TEXT;
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "company"   TEXT;
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "gstin"     TEXT;
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "Address_customerId_idx" ON "Address"("customerId");

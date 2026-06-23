-- Coupons: discount codes with usage limits + per-order redemption ledger.
-- Additive: adds discount columns to Order + CheckoutSession (default 0 / null).

ALTER TABLE "Order"           ADD COLUMN IF NOT EXISTS "discountInr" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order"           ADD COLUMN IF NOT EXISTS "couponCode"  TEXT;
ALTER TABLE "CheckoutSession" ADD COLUMN IF NOT EXISTS "couponCode"  TEXT;

CREATE TABLE IF NOT EXISTS "Coupon" (
  "id"             TEXT NOT NULL,
  "code"           TEXT NOT NULL,
  "description"    TEXT,
  "type"           TEXT NOT NULL DEFAULT 'PERCENT',
  "value"          DECIMAL(10,2) NOT NULL,
  "minSubtotalInr" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "maxDiscountInr" DECIMAL(12,2),
  "usageLimit"     INTEGER,
  "perUserLimit"   INTEGER NOT NULL DEFAULT 1,
  "usedCount"      INTEGER NOT NULL DEFAULT 0,
  "startsAt"       TIMESTAMP(3),
  "expiresAt"      TIMESTAMP(3),
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "isPublic"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX IF NOT EXISTS "Coupon_isActive_idx" ON "Coupon"("isActive");

CREATE TABLE IF NOT EXISTS "CouponRedemption" (
  "id"          TEXT NOT NULL,
  "couponId"    TEXT NOT NULL,
  "customerId"  TEXT,
  "orderNumber" TEXT,
  "amountInr"   DECIMAL(12,2) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_customerId_idx" ON "CouponRedemption"("customerId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CouponRedemption_couponId_fkey') THEN
    ALTER TABLE "CouponRedemption"
      ADD CONSTRAINT "CouponRedemption_couponId_fkey"
      FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

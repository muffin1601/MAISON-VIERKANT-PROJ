-- Draft checkout sessions: defer permanent Order creation until payment is
-- confirmed (Razorpay) or explicitly placed (bank transfer). Purely additive.

CREATE TABLE IF NOT EXISTS "CheckoutSession" (
  "id"             TEXT NOT NULL,
  "token"          TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'DRAFT',
  "orderNumber"    TEXT NOT NULL,
  "paymentMethod"  TEXT,
  "customerJson"   JSONB NOT NULL,
  "itemsJson"      JSONB NOT NULL,
  "subtotalInr"    DECIMAL(12,2) NOT NULL,
  "gstInr"         DECIMAL(12,2) NOT NULL DEFAULT 0,
  "shippingInr"    DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discountInr"    DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalInr"       DECIMAL(12,2) NOT NULL,
  "advanceInr"     DECIMAL(12,2) NOT NULL,
  "gatewayOrderId" TEXT,
  "customerUserId" TEXT,
  "orderId"        TEXT,
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CheckoutSession_token_key" ON "CheckoutSession"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "CheckoutSession_orderNumber_key" ON "CheckoutSession"("orderNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CheckoutSession_gatewayOrderId_key" ON "CheckoutSession"("gatewayOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "CheckoutSession_orderId_key" ON "CheckoutSession"("orderId");
CREATE INDEX IF NOT EXISTS "CheckoutSession_status_idx" ON "CheckoutSession"("status");
CREATE INDEX IF NOT EXISTS "CheckoutSession_expiresAt_idx" ON "CheckoutSession"("expiresAt");

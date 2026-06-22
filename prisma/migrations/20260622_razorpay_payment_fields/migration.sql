-- Razorpay integration: additive payment columns + supporting indexes.
-- Purely additive (all columns NULLable or with safe defaults) → existing Order /
-- Payment data is preserved. Safe to run with `prisma migrate deploy`.

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "amountRefundedInr" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "webhookVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

-- Query helpers for the admin payments dashboard (filter/search by order + status).
CREATE INDEX IF NOT EXISTS "Payment_orderId_idx" ON "Payment"("orderId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");

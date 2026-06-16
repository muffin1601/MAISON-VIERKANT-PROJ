-- Payment gateway support (Razorpay / COD): gateway references, method, signature, updatedAt.
ALTER TABLE "Payment" ADD COLUMN "method" TEXT;
ALTER TABLE "Payment" ADD COLUMN "gatewayOrderId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "gatewayPaymentId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "signature" TEXT;
ALTER TABLE "Payment" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Gateway ids are globally unique → enforce idempotency / duplicate-order prevention at the DB level.
CREATE UNIQUE INDEX "Payment_gatewayOrderId_key" ON "Payment"("gatewayOrderId");
CREATE UNIQUE INDEX "Payment_gatewayPaymentId_key" ON "Payment"("gatewayPaymentId");

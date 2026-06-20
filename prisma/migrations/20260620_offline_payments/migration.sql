-- Offline payment workflow: customer-submitted proof of bank/UPI/NEFT/RTGS/wire payment,
-- reviewed and approved/rejected by an admin. Idempotent (safe to re-run).
-- Apply with: npx prisma migrate deploy  (or run this SQL in the Supabase SQL editor)

CREATE TABLE IF NOT EXISTS "PaymentSubmission" (
  "id"              TEXT NOT NULL,
  "orderId"         TEXT NOT NULL,
  "customerId"      TEXT,
  "method"          TEXT NOT NULL,
  "transactionId"   TEXT NOT NULL,
  "amountInr"       DECIMAL(12,2) NOT NULL,
  "paidAt"          TIMESTAMP(3) NOT NULL,
  "notes"           TEXT,
  "proofUrl"        TEXT,
  "proofBucket"     TEXT,
  "proofKey"        TEXT,
  "proofMime"       TEXT,
  "proofSizeBytes"  INTEGER,
  "status"          TEXT NOT NULL DEFAULT 'SUBMITTED',
  "rejectionReason" TEXT,
  "reviewedById"    TEXT,
  "reviewedAt"      TIMESTAMP(3),
  "submitterIp"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentSubmission_orderId_idx"    ON "PaymentSubmission"("orderId");
CREATE INDEX IF NOT EXISTS "PaymentSubmission_customerId_idx" ON "PaymentSubmission"("customerId");
CREATE INDEX IF NOT EXISTS "PaymentSubmission_status_idx"     ON "PaymentSubmission"("status");

DO $$ BEGIN
  ALTER TABLE "PaymentSubmission"
    ADD CONSTRAINT "PaymentSubmission_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentSubmission"
    ADD CONSTRAINT "PaymentSubmission_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentSubmission"
    ADD CONSTRAINT "PaymentSubmission_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

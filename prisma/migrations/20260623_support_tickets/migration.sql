-- Support / return / refund tickets.

CREATE TABLE IF NOT EXISTS "SupportTicket" (
  "id"          TEXT NOT NULL,
  "type"        TEXT NOT NULL DEFAULT 'SUPPORT',
  "status"      TEXT NOT NULL DEFAULT 'OPEN',
  "orderNumber" TEXT,
  "customerId"  TEXT,
  "name"        TEXT NOT NULL,
  "email"       TEXT NOT NULL,
  "phone"       TEXT,
  "subject"     TEXT NOT NULL,
  "message"     TEXT NOT NULL,
  "adminNote"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SupportTicket_status_idx" ON "SupportTicket"("status");
CREATE INDEX IF NOT EXISTS "SupportTicket_type_idx" ON "SupportTicket"("type");
CREATE INDEX IF NOT EXISTS "SupportTicket_customerId_idx" ON "SupportTicket"("customerId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SupportTicket_customerId_fkey') THEN
    ALTER TABLE "SupportTicket"
      ADD CONSTRAINT "SupportTicket_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

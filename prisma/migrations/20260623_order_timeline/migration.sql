-- Order status timeline + courier fields. Additive; existing orders get a
-- synthetic single-event history backfilled from their current status.

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "courier"     TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingUrl" TEXT;

CREATE TABLE IF NOT EXISTS "OrderStatusEvent" (
  "id"        TEXT NOT NULL,
  "orderId"   TEXT NOT NULL,
  "status"    TEXT NOT NULL,
  "note"      TEXT,
  "actorId"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderStatusEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrderStatusEvent_orderId_idx" ON "OrderStatusEvent"("orderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'OrderStatusEvent_orderId_fkey'
  ) THEN
    ALTER TABLE "OrderStatusEvent"
      ADD CONSTRAINT "OrderStatusEvent_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill: one synthetic event per order that has no history yet.
INSERT INTO "OrderStatusEvent" ("id", "orderId", "status", "note", "createdAt")
SELECT
  'oseh_' || o."id",
  o."id",
  o."status",
  'Backfilled from current status',
  o."createdAt"
FROM "Order" o
WHERE NOT EXISTS (SELECT 1 FROM "OrderStatusEvent" e WHERE e."orderId" = o."id");

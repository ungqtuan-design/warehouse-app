-- Additive migration: no backfill and no changes to stock or recorded timestamps.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE "InventoryTransaction" ADD COLUMN "outboundDate" date;
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_outboundDate_check"
  CHECK ("outboundDate" IS NULL OR
    (type IN ('TRANSFER', 'CUSTOMER_OUT') AND
     "outboundDate" <= ("createdAt" + INTERVAL '7 hours')::date));
CREATE INDEX "InventoryTransaction_type_outboundDate_idx" ON "InventoryTransaction" (type, "outboundDate");
COMMENT ON COLUMN "InventoryTransaction"."outboundDate" IS 'Confirmed actual outbound date in Vietnam. NULL means unconfirmed legacy data. createdAt remains the entry timestamp.';
COMMIT;

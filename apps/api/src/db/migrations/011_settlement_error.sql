-- Persists WHY the most recent settlement attempt failed, instead of only
-- logging it to the server console (paymentMonitor.ts's catch block).
-- Without this, a genuinely-paid session stuck retrying was a total black
-- box to the merchant, the SDK, and the paying customer — no way to tell
-- "temporary RPC issue, still retrying" from "will never settle".
ALTER TABLE checkout_sessions
  ADD COLUMN IF NOT EXISTS last_settlement_error TEXT,
  ADD COLUMN IF NOT EXISTS last_settlement_error_at TIMESTAMPTZ;

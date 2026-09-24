-- Manual resolution for a session that never settled (expired, or
-- underpaid) but still holds a balance at its deposit address — the
-- merchant sweeps it back out to an address of their choosing. See
-- services/refund.ts.
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS refund_tx_hash TEXT;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS refund_to TEXT;

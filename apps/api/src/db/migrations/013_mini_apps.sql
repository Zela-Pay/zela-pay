-- Mini Apps: a merchant account gains a manifest (icon/launch URL/tagline)
-- and can be listed in the Zela app's Mini App directory. Deliberately an
-- extension of `merchants`, not a parallel entity — a Mini App developer
-- gets the exact same signup/login/API-key/dashboard code merchants
-- already have, since a Mini App both charges users (Checkout, unchanged)
-- and pays them out (new, see the `payouts` table below).
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS is_mini_app BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mini_app_url TEXT,
  ADD COLUMN IF NOT EXISTS mini_app_icon_url TEXT,
  ADD COLUMN IF NOT EXISTS mini_app_tagline TEXT;

-- A payout is a Mini App paying USDC to a Zela user — always non-custodial:
-- the Mini App's own backend signs and sends the on-chain transfer itself
-- (see services/payoutResolve.ts and routes/payouts.ts), zela-checkout
-- only resolves the recipient beforehand and verifies the transfer
-- on-chain afterward. tx_hash is UNIQUE so the same payout can never be
-- reported/recorded twice.
CREATE TABLE IF NOT EXISTS payouts (
  id             TEXT PRIMARY KEY,
  merchant_id    TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  network        TEXT NOT NULL,
  to_identifier  TEXT NOT NULL,
  to_wallet      TEXT NOT NULL,
  amount         NUMERIC(20, 6) NOT NULL,
  tx_hash        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  verify_error   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_tx_hash ON payouts(tx_hash);
CREATE INDEX IF NOT EXISTS idx_payouts_merchant ON payouts(merchant_id, created_at DESC);

-- webhook_events was checkout-session-only (session_id NOT NULL). A
-- payout.completed event has no session at all, so session_id becomes
-- optional and a parallel nullable payout_id is added — exactly one of
-- the two is set per row, enforced in application code (enqueueWebhookEvent).
ALTER TABLE webhook_events
  ALTER COLUMN session_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS payout_id TEXT REFERENCES payouts(id) ON DELETE CASCADE;

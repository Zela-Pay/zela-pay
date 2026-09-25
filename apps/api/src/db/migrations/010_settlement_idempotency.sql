-- Makes the settlement sweep idempotent across retries.
--
-- Previously, a session was only ever considered "ready to settle" by
-- comparing its LIVE on-chain balance against the original checkout
-- amount every poll. If a sweep partially completed (e.g. the platform
-- fee transfer succeeded but the merchant transfer failed, or vice
-- versa) the deposit's balance would drop below the original checkout
-- amount, and every future poll would silently skip the session forever
-- (it looked identical to "customer hasn't paid yet"). The session would
-- eventually flip to 'expired' despite having been paid.
--
-- funds_confirmed_at is stamped once, the first time a session's
-- deposit balance is observed to cover the checkout amount. Once set,
-- later polls no longer gate on the live balance — they keep retrying
-- the sweep with whatever balance actually remains.
--
-- fee_tx_hash records the platform fee leg as soon as it confirms, so a
-- retry (after a crash or a failed merchant leg) never re-sends it.
ALTER TABLE checkout_sessions
  ADD COLUMN IF NOT EXISTS funds_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fee_tx_hash TEXT;

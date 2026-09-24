-- A payment link needs its own sandbox/production flag, mirroring
-- api_keys.is_test — session network selection now comes from whichever
-- key or link authenticated the request (see routes/sessions.ts and
-- routes/paymentLinks.ts), not a single global ARC_NETWORK default. A
-- payment link has no API key behind it (it's created from the dashboard,
-- session-cookie authenticated), so it needs to carry this choice itself.
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT true;

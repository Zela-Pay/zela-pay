-- Payment Links: the second Zela Payment Rail. A reusable, shareable
-- URL/QR that creates a real checkout_sessions row (same deposit address,
-- settlement and webhook machinery Checkout already uses) each time someone
-- pays through it — see services/paymentLinkService.ts.

CREATE TABLE IF NOT EXISTS payment_links (
  id               TEXT PRIMARY KEY,
  merchant_id      TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  -- NULL means the payer chooses the amount ("pay what you want" / donations).
  amount           NUMERIC(38, 18),
  settlement_token TEXT NOT NULL CHECK (settlement_token IN ('USDC')),
  success_url      TEXT,
  cancel_url       TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_links_merchant ON payment_links(merchant_id);

ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS payment_link_id TEXT REFERENCES payment_links(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_payment_link ON checkout_sessions(payment_link_id);

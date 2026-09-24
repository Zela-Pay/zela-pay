CREATE TABLE IF NOT EXISTS merchants (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  settlement_wallet  TEXT NOT NULL,
  settlement_token   TEXT NOT NULL CHECK (settlement_token IN ('USDC', 'USDT')),
  webhook_url        TEXT,
  webhook_secret     TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id                 TEXT PRIMARY KEY,
  merchant_id        TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  -- Only the publishable key is stored in full (it's meant to be public).
  -- The secret key is stored as a hash — never the plaintext — same
  -- principle as password storage; it's shown to the merchant once, on creation.
  publishable_key    TEXT NOT NULL UNIQUE,
  secret_key_hash    TEXT NOT NULL,
  is_test            BOOLEAN NOT NULL DEFAULT false,
  revoked_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_merchant ON api_keys(merchant_id);

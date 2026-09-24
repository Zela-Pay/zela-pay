ALTER TABLE merchants ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS password_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_email ON merchants (lower(email)) WHERE email IS NOT NULL;

-- Dashboard login sessions. Only a hash of the bearer token is stored.
CREATE TABLE IF NOT EXISTS dashboard_sessions (
  token_hash   TEXT PRIMARY KEY,
  merchant_id  TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dashboard_sessions_merchant ON dashboard_sessions(merchant_id);

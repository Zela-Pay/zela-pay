-- Dashboard auth security: session visibility/revocation (device, IP,
-- last-seen per active login) and a login audit log (every login attempt,
-- success or failure, for a merchant to review in Settings).

ALTER TABLE dashboard_sessions
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS ip TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS login_audit_log (
  id           TEXT PRIMARY KEY,
  merchant_id  TEXT REFERENCES merchants(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  method       TEXT NOT NULL CHECK (method IN ('password', 'google', 'email_link')),
  success      BOOLEAN NOT NULL,
  ip           TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_audit_merchant ON login_audit_log(merchant_id, created_at DESC);

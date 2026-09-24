CREATE TABLE IF NOT EXISTS webhook_events (
  id            TEXT PRIMARY KEY,
  merchant_id   TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  session_id    TEXT NOT NULL REFERENCES checkout_sessions(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  payload       JSONB NOT NULL,

  -- Delivery bookkeeping: fixed backoff schedule, matches the pattern in
  -- Zela-backend/src/jobs/runner.js for at-least-once background jobs.
  attempts      INTEGER NOT NULL DEFAULT 0,
  delivered_at  TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error    TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_pending
  ON webhook_events(next_attempt_at)
  WHERE delivered_at IS NULL;

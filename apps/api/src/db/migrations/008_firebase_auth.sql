-- Firebase Authentication (email/password + Google) for merchant
-- signup/login, alongside (not replacing) the existing password_hash
-- column — see routes/auth.ts: /signup and /login each still accept the
-- old plain `password` field for any account created before this, and now
-- also accept `idToken` (a verified Firebase ID token) for a Firebase-
-- authenticated account. Either path converges on the same
-- dashboard_sessions token, so nothing downstream of login changes.

ALTER TABLE merchants ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_firebase_uid ON merchants (firebase_uid) WHERE firebase_uid IS NOT NULL;

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id                      TEXT PRIMARY KEY,
  merchant_id             TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  cluster                 TEXT NOT NULL,

  amount_settlement       NUMERIC(20, 6) NOT NULL,
  settlement_token        TEXT NOT NULL CHECK (settlement_token IN ('USDC', 'USDT')),

  payment_path            TEXT,        -- zela_app | wallet_adapter | solana_pay
  payer_asset             TEXT,        -- SOL | USDC | USDT
  payer_address           TEXT,

  -- Ephemeral keypair per session; secret key encrypted at rest, only
  -- decrypted transiently by the settlement job to sweep funds onward.
  deposit_address         TEXT NOT NULL,
  deposit_secret_enc      TEXT NOT NULL,

  status                  TEXT NOT NULL DEFAULT 'pending',

  payment_tx_signature    TEXT,
  settlement_tx_signature TEXT,

  platform_fee_bps        INTEGER NOT NULL,
  platform_fee_amount     NUMERIC(20, 6),

  success_url             TEXT,
  cancel_url               TEXT,
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at              TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_merchant ON checkout_sessions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON checkout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_deposit_address ON checkout_sessions(deposit_address);

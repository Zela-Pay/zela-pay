-- Migrates the on-chain layer from Solana to Arc (Circle's stablecoin L1).
-- Arc's native currency IS USDC, so there is no separate "payer asset" any
-- more (a payment is always native USDC) and no swap-driven "confirming"/
-- "pending" states — see docs/ARCHITECTURE.md.

ALTER TABLE checkout_sessions RENAME COLUMN cluster TO network;
ALTER TABLE checkout_sessions RENAME COLUMN payment_tx_signature TO payment_tx_hash;
ALTER TABLE checkout_sessions RENAME COLUMN settlement_tx_signature TO settlement_tx_hash;
ALTER TABLE checkout_sessions DROP COLUMN IF EXISTS payer_asset;

-- USDT is dropped as a settlement option until a verified contract address
-- on Arc is available (see packages/shared/src/tokens.ts).
ALTER TABLE merchants DROP CONSTRAINT IF EXISTS merchants_settlement_token_check;
ALTER TABLE merchants ADD CONSTRAINT merchants_settlement_token_check CHECK (settlement_token IN ('USDC'));
ALTER TABLE checkout_sessions DROP CONSTRAINT IF EXISTS checkout_sessions_settlement_token_check;
ALTER TABLE checkout_sessions ADD CONSTRAINT checkout_sessions_settlement_token_check CHECK (settlement_token IN ('USDC'));

-- Arc's native USDC uses 18 decimals, not the 6 decimals USDC uses on
-- Solana/Ethereum/etc. NUMERIC(20,6) would silently round fee/amount values
-- computed from raw 18-decimal on-chain balances — widen both to hold full
-- 18-decimal precision without any rounding surprise.
ALTER TABLE checkout_sessions ALTER COLUMN amount_settlement TYPE NUMERIC(38, 18);
ALTER TABLE checkout_sessions ALTER COLUMN platform_fee_amount TYPE NUMERIC(38, 18);

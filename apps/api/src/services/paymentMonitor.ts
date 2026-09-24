/**
 * Watches each open session's deposit address and drives it to settlement.
 *
 * Polling keeps RPC volume predictable (one balance read per session per
 * tick); move to a webhook/log-subscription once volume justifies it.
 *
 * State is derived from the deposit account's on-chain balance, so every
 * tick is safe to repeat: balance (minus a gas reserve) ≥ amount → sweep;
 * otherwise keep waiting, or expire once the TTL passes. A session is
 * claimed atomically (awaiting_payment → settling) before any funds move,
 * so overlapping ticks or multiple API instances can't double-settle.
 *
 * No swap step exists here (unlike the project's original Solana design):
 * Arc's gas asset IS USDC, so any payment the deposit address receives
 * already IS the settlement token — no swap needed.
 */

import { query } from "../db/postgres.js";
import { accountFromEncryptedKey } from "./chain.js";
import { getSessionRow, toSession, type SessionRow } from "./sessionStore.js";
import { estimateGasReserve, rawToDecimal, sweepToMerchant, toRaw, usdcBalance } from "./settlement.js";
import { enqueueWebhook } from "./webhookDelivery.js";

const TRANSFERS_PER_SETTLEMENT = 2n; // deposit -> merchant, deposit -> fee payer

async function claim(id: string): Promise<boolean> {
  const r = await query(
    `UPDATE checkout_sessions SET status = 'settling' WHERE id = $1 AND status = 'awaiting_payment'`,
    [id],
  );
  return (r.rowCount ?? 0) === 1;
}

async function release(id: string): Promise<void> {
  await query(`UPDATE checkout_sessions SET status = 'awaiting_payment' WHERE id = $1 AND status = 'settling'`, [id]);
}

async function expireIfDue(row: SessionRow): Promise<boolean> {
  if (row.expires_at.getTime() > Date.now()) return false;
  const r = await query(`UPDATE checkout_sessions SET status = 'expired' WHERE id = $1 AND status = 'awaiting_payment'`, [row.id]);
  if ((r.rowCount ?? 0) === 1) {
    const fresh = await getSessionRow(row.id);
    if (fresh) await enqueueWebhook(toSession(fresh), "checkout.session.expired");
  }
  return true;
}

async function processSession(row: SessionRow): Promise<void> {
  const session = toSession(row);
  const address = row.deposit_address as `0x${string}`;
  const needRaw = toRaw(session.amountSettlement);

  const balance = await usdcBalance(session.network, address);
  const gasReserve = await estimateGasReserve(session.network, TRANSFERS_PER_SETTLEMENT);
  const available = balance > gasReserve ? balance - gasReserve : 0n;
  if (available < needRaw) return; // nothing (or not enough) yet

  if (!(await claim(row.id))) return;

  try {
    const deposit = accountFromEncryptedKey(row.deposit_secret_enc);

    // paymentTxHash is left null: finding the exact incoming payment would
    // need filtering the USDC contract's Transfer event logs for this
    // address (possible now that transfers are ERC-20 events, unlike a
    // plain native transfer) — not implemented, since the deposit address
    // itself is already single-use and unambiguous.

    const { rows } = await query<{ settlement_wallet: string }>(`SELECT settlement_wallet FROM merchants WHERE id = $1`, [row.merchant_id]);
    const merchantWallet = rows[0]?.settlement_wallet;
    if (!merchantWallet) throw new Error(`merchant ${row.merchant_id} missing`);

    const { hash, feeRaw } = await sweepToMerchant({
      network: session.network,
      deposit,
      merchantWallet: merchantWallet as `0x${string}`,
      balanceRaw: available,
      feeBps: session.platformFeeBps,
    });

    await query(
      `UPDATE checkout_sessions
       SET status = 'settled', settlement_tx_hash = $2, platform_fee_amount = $3
       WHERE id = $1`,
      [row.id, hash, rawToDecimal(feeRaw)],
    );
    const fresh = await getSessionRow(row.id);
    if (fresh) await enqueueWebhook(toSession(fresh), "checkout.session.completed");
  } catch (err) {
    // Funds stay in the (encrypted-key) deposit account; next tick resumes from chain state.
    console.error(`[monitor] settlement failed for ${row.id}, will retry:`, err);
    await release(row.id);
  }
}

export async function pollPendingSessions(): Promise<void> {
  const { rows } = await query<SessionRow & Record<string, unknown>>(
    `SELECT * FROM checkout_sessions WHERE status = 'awaiting_payment' ORDER BY created_at ASC LIMIT 200`,
  );

  for (const row of rows) {
    try {
      // Check funds first: a late-but-complete payment still settles rather than expiring.
      await processSession(row);
      const fresh = await getSessionRow(row.id);
      if (fresh && fresh.status === "awaiting_payment") await expireIfDue(fresh);
    } catch (err) {
      console.error(`[monitor] error on session ${row.id}:`, err);
    }
  }
}

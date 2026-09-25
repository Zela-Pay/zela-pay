/**
 * Watches each open session's deposit address and drives it to settlement.
 *
 * Settlement accounting:
 *
 *   Customer payment       = gross checkout amount
 *   Platform fee            = gross amount × feeBps
 *   Gas                     = paid from the same underlying USDC balance
 *   Merchant settlement     = whatever remains after the fee and gas
 *
 * Arc uses USDC as its native gas asset while also exposing that same
 * balance through the ERC-20 interface. The ERC-20 representation uses
 * 6 decimals; the native gas representation uses 18 decimals.
 *
 * Therefore, the customer does NOT need to send extra USDC for gas.
 * Gas is deducted from the deposit account's received USDC balance
 * during settlement.
 *
 * A payment is considered received once the deposit account's USDC
 * balance reaches the requested checkout amount.
 *
 * The session is atomically claimed (awaiting_payment -> settling)
 * before funds move, preventing overlapping pollers from double-settling.
 *
 * The sweep itself is two independent on-chain legs (fee, then merchant),
 * not one atomic operation — a chain transaction can't span both. If the
 * process crashes or a leg fails between them, `funds_confirmed_at` and
 * `fee_tx_hash` (set the moment each fact becomes true) let a retry pick
 * up exactly where it left off instead of either double-paying the fee
 * or silently abandoning a session that was actually paid.
 */

import { query } from "../db/postgres.js";
import { accountFromEncryptedKey } from "./chain.js";
import { getSessionRow, toSession, type SessionRow } from "./sessionStore.js";
import {
  calculatePlatformFee,
  estimateGasReserve,
  rawToDecimal,
  sendPlatformFee,
  sweepRemainderToMerchant,
  toRaw,
  usdcBalance,
} from "./settlement.js";
import { enqueueWebhook } from "./webhookDelivery.js";

const TRANSFERS_PER_SETTLEMENT = 2n; // deposit -> fee payer, deposit -> merchant

async function claim(id: string): Promise<boolean> {
  const r = await query(
    `
      UPDATE checkout_sessions
      SET status = 'settling',
          funds_confirmed_at = COALESCE(funds_confirmed_at, now())
      WHERE id = $1
        AND status = 'awaiting_payment'
    `,
    [id],
  );

  return (r.rowCount ?? 0) === 1;
}

async function release(id: string): Promise<void> {
  await query(
    `
      UPDATE checkout_sessions
      SET status = 'awaiting_payment'
      WHERE id = $1
        AND status = 'settling'
    `,
    [id],
  );
}

async function expireIfDue(row: SessionRow): Promise<boolean> {
  if (row.expires_at.getTime() > Date.now()) {
    return false;
  }

  const r = await query(
    `
      UPDATE checkout_sessions
      SET status = 'expired'
      WHERE id = $1
        AND status = 'awaiting_payment'
    `,
    [row.id],
  );

  if ((r.rowCount ?? 0) === 1) {
    const fresh = await getSessionRow(row.id);

    if (fresh) {
      await enqueueWebhook(toSession(fresh), "checkout.session.expired");
    }
  }

  return true;
}

async function processSession(row: SessionRow): Promise<void> {
  const session = toSession(row);

  const depositAddress = row.deposit_address as `0x${string}`;

  // This is the amount the customer is expected to pay.
  const grossAmountRaw = toRaw(session.amountSettlement);

  /*
   * Read the actual ERC-20 USDC balance of the deposit address.
   *
   * We intentionally DO NOT subtract gas here.
   *
   * The customer only needs to send the checkout amount.
   * Gas is handled during settlement from the same USDC balance.
   */
  const balanceRaw = await usdcBalance(session.network, depositAddress);

  /*
   * A payment has arrived once the deposit contains at least the
   * requested checkout amount — but that check only applies BEFORE a
   * session has ever been confirmed paid. Once funds_confirmed_at is
   * set (a previous attempt got this far), the balance may already be
   * lower than the original checkout amount because one leg of a prior
   * sweep attempt already went out. Re-requiring the full original
   * amount at that point would make the session look identical to "not
   * paid yet" forever, even though it genuinely was paid.
   */
  if (!row.funds_confirmed_at && balanceRaw < grossAmountRaw) {
    return;
  }

  if (!(await claim(row.id))) {
    return;
  }

  try {
    const deposit = accountFromEncryptedKey(row.deposit_secret_enc);

    /*
     * paymentTxHash remains null for now.
     *
     * The deposit address is generated uniquely for the session,
     * so its USDC balance is sufficient to identify the payment.
     * Exact incoming Transfer-event detection can be added later.
     */

    const { rows } = await query<{
      settlement_wallet: string;
    }>(
      `
        SELECT settlement_wallet
        FROM merchants
        WHERE id = $1
      `,
      [row.merchant_id],
    );

    const merchantWallet = rows[0]?.settlement_wallet;

    if (!merchantWallet) {
      throw new Error(`merchant ${row.merchant_id} missing settlement wallet`);
    }

    const feeRaw = calculatePlatformFee(grossAmountRaw, session.platformFeeBps);

    /*
     * Sanity check up front, before moving any funds: the original
     * checkout amount has to be able to cover the fee plus gas for
     * both legs. This is a coarse pre-flight estimate only — the
     * merchant leg itself always sweeps whatever actually remains,
     * live, rather than trusting this number.
     */
    const preflightGasReserveRaw = await estimateGasReserve(
      session.network,
      TRANSFERS_PER_SETTLEMENT,
    );

    if (grossAmountRaw - feeRaw - preflightGasReserveRaw <= 0n) {
      throw new Error(
        `Payment (${rawToDecimal(grossAmountRaw)} USDC) is insufficient to cover ` +
          `the platform fee and settlement gas`,
      );
    }

    /*
     * Leg 1: platform fee. Fixed, derived only from the original
     * checkout amount. Persisted the moment it confirms so a retry
     * (after a crash, or because leg 2 below failed) never re-sends it.
     */
    let feeTxHash = row.fee_tx_hash;

    if (!feeTxHash) {
      feeTxHash = await sendPlatformFee(session.network, deposit, feeRaw);

      await query(
        `
          UPDATE checkout_sessions
          SET fee_tx_hash = $2, platform_fee_amount = $3
          WHERE id = $1
        `,
        [row.id, feeTxHash, rawToDecimal(feeRaw)],
      );
    }

    /*
     * Leg 2: sweep whatever remains (minus a freshly-read gas reserve)
     * to the merchant.
     */
    const merchantResult = await sweepRemainderToMerchant(
      session.network,
      deposit,
      merchantWallet as `0x${string}`,
    );

    if (!merchantResult) {
      throw new Error(
        `nothing left to settle to the merchant for session ${row.id} ` +
          `after the platform fee and gas`,
      );
    }

    await query(
      `
        UPDATE checkout_sessions
        SET
          status = 'settled',
          settlement_tx_hash = $2,
          last_settlement_error = NULL,
          last_settlement_error_at = NULL
        WHERE id = $1
      `,
      [row.id, merchantResult.hash],
    );

    const fresh = await getSessionRow(row.id);

    if (fresh) {
      await enqueueWebhook(toSession(fresh), "checkout.session.completed");
    }
  } catch (err) {
    /*
     * Funds remain in the deposit account (or, at worst, only the fee
     * leg went out — which fee_tx_hash records so it isn't repeated).
     *
     * The session is released back to awaiting_payment so the next
     * polling cycle can retry settlement from here. usdcContract.ts/
     * settlement.ts already turn raw viem/RPC errors into a clean
     * sentence before they reach here, so err.message is safe to
     * persist and show directly — no raw error dump ever lands in the
     * DB or reaches the merchant/customer.
     */
    const message = err instanceof Error ? err.message : "Settlement failed for an unknown reason.";

    console.error(
      `[monitor] settlement failed for ${row.id}, will retry:`,
      err,
    );

    await query(
      `
        UPDATE checkout_sessions
        SET last_settlement_error = $2, last_settlement_error_at = now()
        WHERE id = $1
      `,
      [row.id, message],
    );

    await release(row.id);
  }
}

export async function pollPendingSessions(): Promise<void> {
  const { rows } = await query<SessionRow & Record<string, unknown>>(
    `
      SELECT *
      FROM checkout_sessions
      WHERE status = 'awaiting_payment'
      ORDER BY created_at ASC
      LIMIT 200
    `,
  );

  for (const row of rows) {
    try {
      /*
       * Check funds first.
       *
       * A late-but-complete payment should still settle rather
       * than immediately expiring.
       */
      await processSession(row);

      const fresh = await getSessionRow(row.id);

      if (fresh && fresh.status === "awaiting_payment") {
        await expireIfDue(fresh);
      }
    } catch (err) {
      console.error(`[monitor] error on session ${row.id}:`, err);
    }
  }
}

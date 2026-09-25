/**
 * Watches each open session's deposit address and drives it to settlement.
 *
 * Settlement accounting:
 *
 *   Customer payment       = gross checkout amount
 *   Platform fee            = gross amount × feeBps
 *   Gas                     = paid from the same underlying USDC balance
 *   Merchant settlement     = gross - platform fee - gas
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
 */

import { query } from "../db/postgres.js";
import { accountFromEncryptedKey } from "./chain.js";
import { getSessionRow, toSession, type SessionRow } from "./sessionStore.js";
import {
  estimateGasReserve,
  rawToDecimal,
  sweepToMerchant,
  toRaw,
  usdcBalance,
} from "./settlement.js";
import { enqueueWebhook } from "./webhookDelivery.js";

const TRANSFERS_PER_SETTLEMENT = 2n; // deposit -> merchant, deposit -> fee payer

async function claim(id: string): Promise<boolean> {
  const r = await query(
    `
      UPDATE checkout_sessions
      SET status = 'settling'
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
   * A payment has arrived once the deposit contains at least
   * the requested checkout amount.
   */
  if (balanceRaw < grossAmountRaw) {
    return;
  }

  /*
   * Estimate the USDC-equivalent native gas required for the two
   * settlement transfers:
   *
   *   1. deposit -> merchant
   *   2. deposit -> platform fee payer
   *
   * The estimate is represented in ERC-20's 6-decimal units.
   */
  const gasReserveRaw = await estimateGasReserve(
    session.network,
    TRANSFERS_PER_SETTLEMENT,
  );

  /*
   * We need enough total USDC to cover:
   *
   *   merchant amount
   * + platform fee
   * + gas
   *
   * Since merchant + fee = gross payment:
   *
   *   required = gross + gas
   *
   * If the customer sent exactly the checkout amount, the gas has
   * to be accounted for from the deposit balance. The settlement
   * function therefore deducts gas from the merchant's net amount.
   *
   * We do NOT reject the payment merely because:
   *
   *   balance < gross + gas
   *
   * because that would require the customer to overpay.
   *
   * The customer payment itself is sufficient to identify a valid
   * payment. Gas is deducted from the merchant settlement amount.
   */

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

    /*
     * Settlement accounting:
     *
     * grossAmountRaw
     *     ↓
     * platform fee (1%)
     *     ↓
     * gas reserve
     *     ↓
     * merchant receives the remainder
     *
     * The platform fee is calculated from the ORIGINAL checkout
     * amount, never from a gas-adjusted balance.
     */
    const { hash, feeRaw } = await sweepToMerchant({
      network: session.network,
      deposit,
      merchantWallet: merchantWallet as `0x${string}`,

      // Actual balance available in the deposit account.
      balanceRaw,

      // Original customer payment amount.
      grossAmountRaw,

      // Gas required for the two settlement transfers.
      gasReserveRaw,

      // Platform fee is calculated from grossAmountRaw.
      feeBps: session.platformFeeBps,
    });

    await query(
      `
        UPDATE checkout_sessions
        SET
          status = 'settled',
          settlement_tx_hash = $2,
          platform_fee_amount = $3
        WHERE id = $1
      `,
      [row.id, hash, rawToDecimal(feeRaw)],
    );

    const fresh = await getSessionRow(row.id);

    if (fresh) {
      await enqueueWebhook(toSession(fresh), "checkout.session.completed");
    }
  } catch (err) {
    /*
     * Funds remain in the deposit account.
     *
     * The session is released back to awaiting_payment so the next
     * polling cycle can retry settlement from the actual on-chain
     * balance.
     */
    console.error(
      `[monitor] settlement failed for ${row.id}, will retry:`,
      err,
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

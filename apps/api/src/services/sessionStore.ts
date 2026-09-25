import type { CheckoutSession } from "@zela-checkout/shared";
import { query } from "../db/postgres.js";

export interface SessionRow {
  id: string;
  merchant_id: string;
  network: string;
  amount_settlement: string;
  settlement_token: string;
  payment_path: string | null;
  payer_address: string | null;
  deposit_address: string;
  deposit_secret_enc: string;
  payment_link_id: string | null;
  status: string;
  payment_tx_hash: string | null;
  settlement_tx_hash: string | null;
  refund_tx_hash: string | null;
  refund_to: string | null;
  funds_confirmed_at: Date | null;
  fee_tx_hash: string | null;
  last_settlement_error: string | null;
  last_settlement_error_at: Date | null;
  platform_fee_bps: number;
  platform_fee_amount: string | null;
  success_url: string | null;
  cancel_url: string | null;
  metadata: Record<string, string>;
  created_at: Date;
  expires_at: Date;
}

/** Maps a DB row to the public session shape. Never exposes deposit_secret_enc. */
export function toSession(r: SessionRow): CheckoutSession {
  return {
    id: r.id,
    merchantId: r.merchant_id,
    network: r.network as CheckoutSession["network"],
    amountSettlement: String(r.amount_settlement),
    settlementToken: r.settlement_token as CheckoutSession["settlementToken"],
    paymentPath: r.payment_path as CheckoutSession["paymentPath"],
    payerAddress: r.payer_address,
    depositAddress: r.deposit_address,
    paymentLinkId: r.payment_link_id,
    status: r.status as CheckoutSession["status"],
    paymentTxHash: r.payment_tx_hash,
    settlementTxHash: r.settlement_tx_hash,
    refundTxHash: r.refund_tx_hash,
    refundTo: r.refund_to,
    platformFeeBps: r.platform_fee_bps,
    platformFeeAmount: r.platform_fee_amount === null ? null : String(r.platform_fee_amount),
    successUrl: r.success_url,
    cancelUrl: r.cancel_url,
    metadata: r.metadata ?? {},
    lastSettlementError: r.last_settlement_error,
    lastSettlementErrorAt: r.last_settlement_error_at ? r.last_settlement_error_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
    expiresAt: r.expires_at.toISOString(),
  };
}

export async function getSessionRow(id: string): Promise<SessionRow | null> {
  const { rows } = await query<SessionRow & Record<string, unknown>>(
    `SELECT * FROM checkout_sessions WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

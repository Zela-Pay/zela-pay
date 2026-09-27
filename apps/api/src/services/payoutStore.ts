import type { ArcNetwork, Payout } from "@zela-checkout/shared";

export interface PayoutRow {
  id: string;
  merchant_id: string;
  network: string;
  to_identifier: string;
  to_wallet: string;
  amount: string;
  tx_hash: string;
  status: string;
  verify_error: string | null;
  created_at: Date;
}

export function toPayout(r: PayoutRow): Payout {
  return {
    id: r.id,
    merchantId: r.merchant_id,
    network: r.network as ArcNetwork,
    toIdentifier: r.to_identifier,
    toWallet: r.to_wallet,
    amount: String(r.amount),
    txHash: r.tx_hash,
    status: r.status as Payout["status"],
    verifyError: r.verify_error,
    createdAt: r.created_at.toISOString(),
  };
}

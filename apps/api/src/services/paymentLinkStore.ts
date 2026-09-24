import type { PaymentLink } from "@zela-checkout/shared";
import { query } from "../db/postgres.js";

export interface PaymentLinkRow {
  id: string;
  merchant_id: string;
  name: string;
  amount: string | null;
  settlement_token: string;
  success_url: string | null;
  cancel_url: string | null;
  metadata: Record<string, string>;
  active: boolean;
  is_test: boolean;
  created_at: Date;
}

export function toPaymentLink(r: PaymentLinkRow): PaymentLink {
  return {
    id: r.id,
    merchantId: r.merchant_id,
    name: r.name,
    amount: r.amount === null ? null : String(r.amount),
    settlementToken: r.settlement_token as PaymentLink["settlementToken"],
    successUrl: r.success_url,
    cancelUrl: r.cancel_url,
    metadata: r.metadata ?? {},
    active: r.active,
    isTest: r.is_test,
    createdAt: r.created_at.toISOString(),
  };
}

export async function getPaymentLinkRow(id: string): Promise<PaymentLinkRow | null> {
  const { rows } = await query<PaymentLinkRow & Record<string, unknown>>(
    `SELECT * FROM payment_links WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

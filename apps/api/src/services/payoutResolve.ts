/**
 * Resolves a Mini App payout recipient — see docs/miniapps and the
 * architecture note in this project's own plan doc: payouts are
 * non-custodial, so this only ever tells the caller WHERE to send funds.
 * It never moves anything itself.
 *
 * Two identifier shapes, two completely different resolution paths:
 *
 *   "<handle>.zela.merchant" — a zela-checkout merchant's own settlement
 *   wallet, read live from THIS project's own `merchants` table. No
 *   network call needed — same table, same process.
 *
 *   "harry.zela" / "user@example.com" — a Zela app user. Their Zela-ID/
 *   email -> UID mapping lives in Firestore, which is only reachable from
 *   Zela-backend, so this calls its internal, shared-secret-authed
 *   resolve route. (Zela-backend's own merchant-handle branch mirrors this
 *   in reverse, resolving into zela_checkout.merchants via a local
 *   cross-schema query — see its db/merchantIdentity.js.)
 *
 * A bare wallet address is deliberately NOT accepted here — unlike the
 * Zela app's own /v1/identity/resolve (used for a payer typing/scanning
 * any destination), this endpoint exists for programmatic Mini App use,
 * where accepting raw addresses would turn it into an open "is this a
 * valid-looking address" oracle for no real benefit (a Mini App that
 * already has a raw address doesn't need to resolve anything).
 */

import { query } from "../db/postgres.js";
import { env } from "../config/env.js";
import type { ArcNetwork } from "@zela-checkout/shared";

const MERCHANT_HANDLE_RE = /^[a-z0-9_]{3,20}\.zela\.merchant$/i;
const ZELA_ID_RE = /^[a-zA-Z0-9_]{3,20}\.zela$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PayoutResolveResult =
  | { ok: true; walletAddress: `0x${string}`; network: ArcNetwork; displayName: string | null }
  | { ok: false; status: 400 | 404 | 503; error: string };

/** Arc mainnet only — see routes/payouts.ts's own note on why testnet payouts aren't supported yet (Zela-app users only have a mainnet Arc address). */
const PAYOUT_NETWORK: ArcNetwork = "arc-mainnet";

export async function resolvePayoutRecipient(identifierRaw: string): Promise<PayoutResolveResult> {
  const identifier = identifierRaw.trim();

  if (MERCHANT_HANDLE_RE.test(identifier)) {
    const handle = identifier.toLowerCase().replace(/\.zela\.merchant$/, "");
    const { rows } = await query<{ settlement_wallet: string; name: string }>(
      `SELECT c.settlement_wallet, c.name
       FROM public.merchant_identity_records m
       JOIN merchants c ON c.id = m.merchant_id
       WHERE m.handle = $1
       LIMIT 1`,
      [handle],
    );
    const row = rows[0];
    if (!row) return { ok: false, status: 404, error: "Merchant not found." };
    return { ok: true, walletAddress: row.settlement_wallet as `0x${string}`, network: PAYOUT_NETWORK, displayName: row.name };
  }

  if (!ZELA_ID_RE.test(identifier) && !EMAIL_RE.test(identifier)) {
    return {
      ok: false,
      status: 400,
      error: "to must be a Zela ID (e.g. harry.zela), an email address, or a merchant ID (e.g. store.zela.merchant).",
    };
  }

  if (!env.INTERNAL_SERVICE_SECRET) {
    console.error("[payoutResolve] INTERNAL_SERVICE_SECRET is not configured — cannot resolve Zela user identifiers.");
    return { ok: false, status: 503, error: "Payout resolution is not configured for this identifier type yet." };
  }

  let res: Response;
  try {
    res = await fetch(`${env.ZELA_BACKEND_INTERNAL_URL}/v1/internal/identity/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": env.INTERNAL_SERVICE_SECRET },
      body: JSON.stringify({ identifier }),
    });
  } catch (err) {
    console.error("[payoutResolve] could not reach Zela-backend:", err);
    return { ok: false, status: 503, error: "Could not resolve this recipient right now. Please try again shortly." };
  }

  const data = (await res.json().catch(() => ({}))) as { walletAddress?: string; chain?: string; fullName?: string | null; error?: string };

  if (!res.ok) {
    return { ok: false, status: res.status === 404 ? 404 : 400, error: data.error ?? "Recipient not found." };
  }
  if (data.chain !== "arc" || !data.walletAddress) {
    return {
      ok: false,
      status: 400,
      error: "This recipient hasn't set up an Arc wallet yet — ask them to open Zela first.",
    };
  }

  return { ok: true, walletAddress: data.walletAddress as `0x${string}`, network: PAYOUT_NETWORK, displayName: data.fullName ?? null };
}

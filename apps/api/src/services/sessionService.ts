/**
 * Shared session-creation logic — used by routes/sessions.ts (merchant
 * secret-key and widget publishable-key paths) and routes/paymentLinks.ts
 * (a session created by a customer paying through a Payment Link). Every
 * path ends up as the exact same checkout_sessions row, so settlement,
 * webhooks and the hosted checkout page don't need to know which product
 * created it.
 */

import { nanoid } from "nanoid";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { TOKEN_DECIMALS, type ArcNetwork, type CreateSessionResponse } from "@zela-checkout/shared";
import { query } from "../db/postgres.js";
import { env } from "../config/env.js";
import { calculatePlatformFee } from "./feeService.js";
import { encryptSecret } from "./keyVault.js";
import { getSessionRow, toSession } from "./sessionStore.js";

const SESSION_TTL_MINUTES = 30;
const MAX_METADATA_KEYS = 20;

/**
 * The one place "sandbox" (is_test) turns into an actual Arc network —
 * every caller (secret-key sessions, publishable-key/widget sessions,
 * payment-link sessions) derives it from whichever key or link
 * authenticated the request, not a single global default. zela-app has no
 * Arc testnet support at all, so a sandbox session is only ever
 * recognizable/payable inside this project's own checkout flow (wallet-
 * connect, generic QR) — never through the Zela app.
 */
export function networkForMode(isTest: boolean): ArcNetwork {
  return isTest ? "arc-testnet" : "arc-mainnet";
}

export interface SessionInput {
  amount: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export type SessionError = { error: string; status: number };

/** Validates amount/URLs/metadata shared by every session-creation path. Caller decides what "amount" means (e.g. a Payment Link may pin it). */
export function validateSessionInput(body: unknown): SessionError | null {
  const b = (body ?? {}) as Partial<SessionInput>;
  const amount = Number(b.amount);
  if (typeof b.amount !== "string" || !/^\d{1,12}(\.\d{1,6})?$/.test(b.amount) || !(amount > 0)) {
    return { error: "amount must be a positive decimal string with at most 6 decimal places", status: 400 };
  }
  for (const [field, value] of [["successUrl", b.successUrl], ["cancelUrl", b.cancelUrl]] as const) {
    if (value === undefined || value === null) continue;
    let ok = false;
    try {
      ok = typeof value === "string" && value.length <= 2000 && ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      ok = false;
    }
    // The hosted page redirects here, so javascript:/data: URLs would be XSS on the checkout origin.
    if (!ok) return { error: `${field} must be an http(s) URL`, status: 400 };
  }
  if (b.metadata && Object.keys(b.metadata).length > MAX_METADATA_KEYS) {
    return { error: `metadata is limited to ${MAX_METADATA_KEYS} keys`, status: 400 };
  }
  return null;
}

export async function createSession(
  merchantId: string,
  body: SessionInput,
  opts: { paymentLinkId?: string; network: ArcNetwork },
): Promise<CreateSessionResponse | SessionError> {
  const invalid = validateSessionInput(body);
  if (invalid) return invalid;

  const merchantResult = await query<{ settlement_token: string }>(
    `SELECT settlement_token FROM merchants WHERE id = $1`,
    [merchantId],
  );
  const merchant = merchantResult.rows[0];
  if (!merchant) return { error: "merchant not found", status: 404 };

  const { feeAmount } = calculatePlatformFee(Number(body.amount));
  const depositKey = generatePrivateKey();
  const depositAccount = privateKeyToAccount(depositKey);
  const id = `cs_${nanoid(24)}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000);

  await query(
    `INSERT INTO checkout_sessions
       (id, merchant_id, network, amount_settlement, settlement_token,
        deposit_address, deposit_secret_enc, status, platform_fee_bps,
        platform_fee_amount, success_url, cancel_url, metadata, expires_at, payment_link_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'awaiting_payment',$8,$9,$10,$11,$12,$13,$14)`,
    [
      id,
      merchantId,
      opts.network,
      body.amount,
      merchant.settlement_token,
      depositAccount.address,
      encryptSecret(Buffer.from(depositKey.slice(2), "hex")),
      env.PLATFORM_FEE_BPS,
      feeAmount.toFixed(TOKEN_DECIMALS.USDC),
      body.successUrl ?? null,
      body.cancelUrl ?? null,
      JSON.stringify(body.metadata ?? {}),
      expiresAt.toISOString(),
      opts.paymentLinkId ?? null,
    ],
  );

  const row = await getSessionRow(id);
  return { session: toSession(row!), checkoutUrl: `${env.CHECKOUT_WEB_ORIGIN}/pay/${id}` };
}

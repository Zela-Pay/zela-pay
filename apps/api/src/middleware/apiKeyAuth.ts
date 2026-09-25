import type { NextFunction, Request, Response } from "express";
import { query } from "../db/postgres.js";
import { hashSecret } from "../services/apiKeys.js";

export interface AuthedRequest extends Request {
  merchantId?: string;
  /** Whether the authenticating key is a sandbox (sk_test_/pk_test_) or production (sk_live_/pk_live_) key. */
  isTest?: boolean;
  /** Set by requireDashboardSession — the calling session's own token hash, so a session-management UI can mark "this device". */
  sessionTokenHash?: string;
}

/**
 * Authenticates server-to-server calls (session creation, etc.) via the
 * merchant's SECRET key, Stripe-style: `Authorization: Bearer sk_live_...`.
 * The publishable key is never accepted here — it's for client-side use only
 * (embedding in the widget/hosted page), matching Stripe's own split.
 */
export async function requireSecretKey(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const secretKey = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!secretKey || !secretKey.startsWith("sk_")) {
    res.status(401).json({ error: "Missing or malformed API key" });
    return;
  }

  // Same hashing scheme used at key-creation time in routes/merchants.ts —
  // the DB never holds a secret key in plaintext, only this hash.
  const secretKeyHash = hashSecret(secretKey);
  const result = await query<{ merchant_id: string; is_test: boolean }>(
    `SELECT merchant_id, is_test FROM api_keys WHERE secret_key_hash = $1 AND revoked_at IS NULL`,
    [secretKeyHash],
  );

  const row = result.rows[0];
  if (!row) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  req.merchantId = row.merchant_id;
  req.isTest = row.is_test;
  next();
}

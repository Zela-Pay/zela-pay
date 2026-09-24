import crypto from "node:crypto";
import { nanoid } from "nanoid";
import type { ApiKeyPair } from "@zela-checkout/shared";
import { query } from "../db/postgres.js";

export const hashSecret = (secret: string) => crypto.createHash("sha256").update(secret).digest("hex");

/**
 * Creates a key pair. The secret is returned here once; only its hash is
 * stored. Defaults to sandbox (is_test) unless the caller explicitly asks
 * for a production key — a merchant getting a live key by mistake (and a
 * sandbox session that's actually mainnet, per networkForMode) is a much
 * worse default failure mode than the reverse.
 */
export async function issueApiKeyPair(
  merchantId: string,
  opts: { isTest?: boolean } = {},
): Promise<ApiKeyPair & { id: string }> {
  const isTest = opts.isTest ?? true;
  const prefix = isTest ? "test" : "live";
  const id = `key_${nanoid(16)}`;
  const publishableKey = `pk_${prefix}_${nanoid(24)}`;
  const secretKey = `sk_${prefix}_${nanoid(32)}`;
  await query(
    `INSERT INTO api_keys (id, merchant_id, publishable_key, secret_key_hash, is_test) VALUES ($1,$2,$3,$4,$5)`,
    [id, merchantId, publishableKey, hashSecret(secretKey), isTest],
  );
  return { id, publishableKey, secretKey };
}

import { Router } from "express";
import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { query } from "../db/postgres.js";
import { env } from "../config/env.js";
import { issueApiKeyPair } from "../services/apiKeys.js";
import { hashPassword, verifyPassword } from "../services/passwords.js";
import { assertSafeWebhookUrl } from "../services/urlSafety.js";
import { getSessionRow, toSession, type SessionRow } from "../services/sessionStore.js";
import { getPaymentLinkRow, toPaymentLink, type PaymentLinkRow } from "../services/paymentLinkStore.js";
import { isRefundableStatus, sweepRefund } from "../services/refund.js";
import { enqueueWebhook } from "../services/webhookDelivery.js";
import { requireDashboardSession } from "../middleware/dashboardAuth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import type { AuthedRequest } from "../middleware/apiKeyAuth.js";
import { normalizeEvmAddress } from "./auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireDashboardSession);
// Baseline for every dashboard route, on top of the stricter per-route
// limits already on the sensitive ones below (refunds, settings, API keys,
// merchant-id) — most GET routes here (stats, sessions list, api-keys
// list, merchant-id) had no limit at all before this, relying only on
// requiring a valid session, which doesn't bound what an already-
// authenticated but compromised/malicious client can do.
dashboardRouter.use(rateLimit({ windowMs: 60_000, max: 120 }));

const MAX_ACTIVE_KEYS = 10;
const STATUSES = new Set(["awaiting_payment", "settling", "settled", "expired", "failed"]);
const newWebhookSecret = () => `whsec_${crypto.randomBytes(24).toString("base64url")}`;

dashboardRouter.get("/me", async (req: AuthedRequest, res) => {
  const { rows } = await query<{
    id: string;
    name: string;
    email: string | null;
    settlement_wallet: string;
    settlement_token: string;
    webhook_url: string | null;
    webhook_secret: string | null;
  }>(
    `SELECT id, name, email, settlement_wallet, settlement_token, webhook_url, webhook_secret FROM merchants WHERE id = $1`,
    [req.merchantId],
  );
  const m = rows[0]!;
  res.json({
    id: m.id,
    name: m.name,
    email: m.email,
    settlementWallet: m.settlement_wallet,
    settlementToken: m.settlement_token,
    webhookUrl: m.webhook_url,
    hasWebhookSecret: Boolean(m.webhook_secret),
  });
});

dashboardRouter.get("/stats", async (req: AuthedRequest, res) => {
  const { rows } = await query<{
    settled_count: number;
    settled_volume: string | null;
    fees: string | null;
    open_count: number;
    expired_count: number;
    volume_30d: string | null;
  }>(
    `SELECT
       count(*) FILTER (WHERE status = 'settled')::int AS settled_count,
       sum(amount_settlement) FILTER (WHERE status = 'settled') AS settled_volume,
       sum(platform_fee_amount) FILTER (WHERE status = 'settled') AS fees,
       count(*) FILTER (WHERE status IN ('awaiting_payment','settling'))::int AS open_count,
       count(*) FILTER (WHERE status = 'expired')::int AS expired_count,
       sum(amount_settlement) FILTER (WHERE status = 'settled' AND created_at > now() - interval '30 days') AS volume_30d
     FROM checkout_sessions WHERE merchant_id = $1`,
    [req.merchantId],
  );
  const r = rows[0]!;
  res.json({
    settledCount: r.settled_count,
    openCount: r.open_count,
    expiredCount: r.expired_count,
    settledVolume: String(r.settled_volume ?? "0"),
    platformFees: String(r.fees ?? "0"),
    volume30d: String(r.volume_30d ?? "0"),
  });
});

dashboardRouter.get("/sessions", async (req: AuthedRequest, res) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "25"), 10) || 25, 1), 100);
  const status = typeof req.query.status === "string" && STATUSES.has(req.query.status) ? req.query.status : null;
  const before =
    typeof req.query.before === "string" && !Number.isNaN(Date.parse(req.query.before)) ? req.query.before : null;
  const paymentLinkId = typeof req.query.paymentLinkId === "string" ? req.query.paymentLinkId : null;

  const { rows } = await query<SessionRow & Record<string, unknown>>(
    `SELECT * FROM checkout_sessions
     WHERE merchant_id = $1
       AND ($2::text IS NULL OR status = $2)
       AND ($3::timestamptz IS NULL OR created_at < $3::timestamptz)
       AND ($5::text IS NULL OR payment_link_id = $5)
     ORDER BY created_at DESC LIMIT $4`,
    [req.merchantId, status, before, limit + 1, paymentLinkId],
  );
  const page = rows.slice(0, limit);
  res.json({
    sessions: page.map(toSession),
    nextBefore: rows.length > limit ? page[page.length - 1]!.created_at.toISOString() : null,
  });
});

// ── Payment Links ───────────────────────────────────────────────────────────

dashboardRouter.get("/payment-links", async (req: AuthedRequest, res) => {
  const { rows } = await query<PaymentLinkRow & Record<string, unknown>>(
    `SELECT * FROM payment_links WHERE merchant_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [req.merchantId],
  );
  res.json({ paymentLinks: rows.map(toPaymentLink) });
});

dashboardRouter.post("/payment-links", rateLimit({ windowMs: 60_000, max: 20 }), async (req: AuthedRequest, res) => {
  const { name, amount, successUrl, cancelUrl, metadata, isTest } = (req.body ?? {}) as Record<string, unknown>;

  if (typeof name !== "string" || !name.trim() || name.length > 100) {
    res.status(400).json({ error: "Enter a name for this link" });
    return;
  }
  if (amount !== undefined && amount !== null && (typeof amount !== "string" || !/^\d{1,12}(\.\d{1,6})?$/.test(amount) || !(Number(amount) > 0))) {
    res.status(400).json({ error: "amount must be a positive decimal string, or omitted for an open amount" });
    return;
  }
  for (const [field, value] of [["successUrl", successUrl], ["cancelUrl", cancelUrl]] as const) {
    if (value === undefined || value === null) continue;
    let ok = false;
    try {
      ok = typeof value === "string" && value.length <= 2000 && ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      ok = false;
    }
    if (!ok) {
      res.status(400).json({ error: `${field} must be an http(s) URL` });
      return;
    }
  }

  const { rows } = await query<{ settlement_token: string }>(`SELECT settlement_token FROM merchants WHERE id = $1`, [req.merchantId]);
  const id = `plink_${nanoid(20)}`;
  // Defaults to sandbox (matches issueApiKeyPair's own default) so a link
  // is never accidentally live unless the merchant explicitly chose
  // Production when creating it.
  await query(
    `INSERT INTO payment_links (id, merchant_id, name, amount, settlement_token, success_url, cancel_url, metadata, is_test)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, req.merchantId, name.trim(), amount ?? null, rows[0]!.settlement_token, successUrl ?? null, cancelUrl ?? null, JSON.stringify(metadata ?? {}), isTest !== false],
  );

  const row = await getPaymentLinkRow(id);
  res.status(201).json({ paymentLink: toPaymentLink(row!), linkUrl: `${env.CHECKOUT_WEB_ORIGIN}/pay/link/${id}` });
});

dashboardRouter.patch("/payment-links/:id", async (req: AuthedRequest, res) => {
  const row = await getPaymentLinkRow(String(req.params.id));
  if (!row || row.merchant_id !== req.merchantId) {
    res.status(404).json({ error: "payment link not found" });
    return;
  }
  const { name, active } = (req.body ?? {}) as { name?: unknown; active?: unknown };
  if (name !== undefined && (typeof name !== "string" || !name.trim() || name.length > 100)) {
    res.status(400).json({ error: "Enter a name for this link" });
    return;
  }
  if (active !== undefined && typeof active !== "boolean") {
    res.status(400).json({ error: "active must be true or false" });
    return;
  }
  await query(
    `UPDATE payment_links SET name = COALESCE($2, name), active = COALESCE($3, active) WHERE id = $1`,
    [row.id, typeof name === "string" ? name.trim() : null, active ?? null],
  );
  res.json({ ok: true });
});

// ── Refunds ─────────────────────────────────────────────────────────────────
// A session that expired, or was underpaid, can still hold a balance at its
// deposit address — sweep it back out to an address the merchant supplies.
// No platform fee is taken: the session never settled.

dashboardRouter.post("/sessions/:id/refund", rateLimit({ windowMs: 60_000, max: 10 }), async (req: AuthedRequest, res) => {
  const { toAddress } = (req.body ?? {}) as { toAddress?: unknown };
  if (typeof toAddress !== "string" || !normalizeEvmAddress(toAddress)) {
    res.status(400).json({ error: "toAddress must be a valid Arc (EVM) address" });
    return;
  }

  const row = await getSessionRow(String(req.params.id));
  if (!row || row.merchant_id !== req.merchantId) {
    res.status(404).json({ error: "session not found" });
    return;
  }
  if (row.refund_tx_hash) {
    res.status(400).json({ error: "This session has already been refunded" });
    return;
  }
  if (!isRefundableStatus(row.status)) {
    res.status(400).json({ error: `Cannot refund a session with status "${row.status}"` });
    return;
  }

  // Atomically claim it (mirrors the settlement job's own claim step) so a
  // double-click, or a refund racing the payment monitor, can't double-sweep.
  const claim = await query(
    `UPDATE checkout_sessions SET status = 'settling' WHERE id = $1 AND status = $2`,
    [row.id, row.status],
  );
  if ((claim.rowCount ?? 0) === 0) {
    res.status(409).json({ error: "This session just changed state — reload and try again" });
    return;
  }

  try {
    const { hash, amount } = await sweepRefund(row, toAddress);
    await query(
      `UPDATE checkout_sessions SET status = 'failed', refund_tx_hash = $2, refund_to = $3 WHERE id = $1`,
      [row.id, hash, normalizeEvmAddress(toAddress)],
    );
    const fresh = await getSessionRow(row.id);
    if (fresh) await enqueueWebhook(toSession(fresh), "checkout.session.failed");
    res.json({ ok: true, txHash: hash, amount });
  } catch (err) {
    await query(`UPDATE checkout_sessions SET status = $2 WHERE id = $1`, [row.id, row.status]);
    res.status(422).json({ error: err instanceof Error ? err.message : "Refund failed" });
  }
});

// ── API keys ────────────────────────────────────────────────────────────────

dashboardRouter.get("/api-keys", async (req: AuthedRequest, res) => {
  const { rows } = await query<{
    id: string;
    publishable_key: string;
    is_test: boolean;
    created_at: Date;
    revoked_at: Date | null;
  }>(
    `SELECT id, publishable_key, is_test, created_at, revoked_at FROM api_keys WHERE merchant_id = $1 ORDER BY created_at DESC`,
    [req.merchantId],
  );
  res.json({
    keys: rows.map((k) => ({
      id: k.id,
      publishableKey: k.publishable_key,
      isTest: k.is_test,
      createdAt: k.created_at.toISOString(),
      revokedAt: k.revoked_at?.toISOString() ?? null,
    })),
  });
});

dashboardRouter.post("/api-keys", async (req: AuthedRequest, res) => {
  const { rows } = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM api_keys WHERE merchant_id = $1 AND revoked_at IS NULL`,
    [req.merchantId],
  );
  if (rows[0]!.n >= MAX_ACTIVE_KEYS) {
    res.status(400).json({ error: `You can have at most ${MAX_ACTIVE_KEYS} active keys. Revoke one first.` });
    return;
  }
  const { isTest } = (req.body ?? {}) as { isTest?: unknown };
  const key = await issueApiKeyPair(req.merchantId!, { isTest: isTest === false ? false : true });
  // The secret key is returned exactly once.
  res.status(201).json({ id: key.id, publishableKey: key.publishableKey, secretKey: key.secretKey });
});

dashboardRouter.delete("/api-keys/:id", async (req: AuthedRequest, res) => {
  const r = await query(
    `UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND merchant_id = $2 AND revoked_at IS NULL`,
    [String(req.params.id), req.merchantId],
  );
  if ((r.rowCount ?? 0) === 0) {
    res.status(404).json({ error: "Key not found" });
    return;
  }
  res.json({ ok: true });
});

// ── Webhook endpoint ────────────────────────────────────────────────────────

dashboardRouter.put("/webhook", async (req: AuthedRequest, res) => {
  const { webhookUrl } = (req.body ?? {}) as { webhookUrl?: unknown };
  if (webhookUrl === null || webhookUrl === "") {
    await query(`UPDATE merchants SET webhook_url = NULL, webhook_secret = NULL WHERE id = $1`, [req.merchantId]);
    res.json({ webhookUrl: null });
    return;
  }
  if (typeof webhookUrl !== "string") {
    res.status(400).json({ error: "webhookUrl is required" });
    return;
  }
  try {
    await assertSafeWebhookUrl(webhookUrl);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid webhook URL" });
    return;
  }
  const { rows } = await query<{ webhook_secret: string | null }>(
    `SELECT webhook_secret FROM merchants WHERE id = $1`,
    [req.merchantId],
  );
  const generated = rows[0]!.webhook_secret ? null : newWebhookSecret();
  await query(`UPDATE merchants SET webhook_url = $1, webhook_secret = COALESCE(webhook_secret, $2) WHERE id = $3`, [
    webhookUrl,
    generated,
    req.merchantId,
  ]);
  res.json({ webhookUrl, webhookSecret: generated }); // secret is shown only when newly generated
});

dashboardRouter.post("/webhook/rotate-secret", async (req: AuthedRequest, res) => {
  const secret = newWebhookSecret();
  await query(`UPDATE merchants SET webhook_secret = $1 WHERE id = $2`, [secret, req.merchantId]);
  res.json({ webhookSecret: secret });
});

// ── Merchant payment ID (.zela.merchant) ────────────────────────────────────
// A handle recognizable by the Zela app itself — a Zela app user can type
// or scan "<handle>.zela.merchant" to pay this merchant directly, the same
// way they already pay another Zela app user via "<name>.zela". The row
// lives in Zela-backend's own Postgres schema (shared instance, different
// schema — see Zela-backend's migration 019), since that's what its own
// /v1/identity/resolve queries in-process; this is the only writer.

const MERCHANT_HANDLE_RE = /^[a-z0-9_]{3,20}$/;

dashboardRouter.get("/merchant-id", async (req: AuthedRequest, res) => {
  const { rows } = await query<{ handle: string }>(
    `SELECT handle FROM public.merchant_identity_records WHERE merchant_id = $1`,
    [req.merchantId],
  );
  const handle = rows[0]?.handle ?? null;
  res.json({ handle, zelaMerchantId: handle ? `${handle}.zela.merchant` : null });
});

dashboardRouter.put("/merchant-id", rateLimit({ windowMs: 60_000, max: 10 }), async (req: AuthedRequest, res) => {
  const { handle } = (req.body ?? {}) as { handle?: unknown };
  if (typeof handle !== "string" || !MERCHANT_HANDLE_RE.test(handle)) {
    res.status(400).json({ error: "handle must be 3-20 lowercase letters, numbers, or underscores" });
    return;
  }

  try {
    await query(
      `INSERT INTO public.merchant_identity_records (handle, merchant_id)
       VALUES ($1, $2)
       ON CONFLICT (merchant_id) DO UPDATE SET handle = EXCLUDED.handle`,
      [handle, req.merchantId],
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "That merchant ID is already taken" });
      return;
    }
    throw err;
  }
  res.json({ handle, zelaMerchantId: `${handle}.zela.merchant` });
});

// ── Account settings ────────────────────────────────────────────────────────
// Changing where funds are sent, or the password, requires the current password.

dashboardRouter.patch("/settings", rateLimit({ windowMs: 60_000, max: 10 }), async (req: AuthedRequest, res) => {
  const { name, settlementWallet, settlementToken, currentPassword, newPassword } = (req.body ?? {}) as Record<
    string,
    unknown
  >;
  const { rows } = await query<{ password_hash: string | null }>(`SELECT password_hash FROM merchants WHERE id = $1`, [
    req.merchantId,
  ]);
  const sensitive = settlementWallet !== undefined || settlementToken !== undefined || newPassword !== undefined;

  if (sensitive && !verifyPassword(typeof currentPassword === "string" ? currentPassword : "", rows[0]!.password_hash)) {
    res.status(403).json({ error: "Current password is incorrect" });
    return;
  }
  const wallet = settlementWallet === undefined ? undefined : normalizeEvmAddress(settlementWallet);
  if (settlementWallet !== undefined && !wallet) {
    res.status(400).json({ error: "Settlement wallet must be a valid Arc (EVM) address" });
    return;
  }
  if (settlementToken !== undefined && settlementToken !== "USDC") {
    res.status(400).json({ error: "Settlement token must be USDC" });
    return;
  }
  if (newPassword !== undefined && (typeof newPassword !== "string" || newPassword.length < 10 || newPassword.length > 200)) {
    res.status(400).json({ error: "New password must be at least 10 characters" });
    return;
  }
  if (name !== undefined && (typeof name !== "string" || !name.trim() || name.length > 100)) {
    res.status(400).json({ error: "Enter your business name" });
    return;
  }

  await query(
    `UPDATE merchants SET
       name = COALESCE($2, name),
       settlement_wallet = COALESCE($3, settlement_wallet),
       settlement_token = COALESCE($4, settlement_token),
       password_hash = COALESCE($5, password_hash)
     WHERE id = $1`,
    [
      req.merchantId,
      typeof name === "string" ? name.trim() : null,
      wallet ?? null,
      settlementToken ?? null,
      typeof newPassword === "string" ? hashPassword(newPassword) : null,
    ],
  );
  res.json({ ok: true });
});

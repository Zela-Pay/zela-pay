import { Router } from "express";
import cors from "cors";
import type { CreateSessionRequest } from "@zela-checkout/shared";
import { env } from "../config/env.js";
import { query } from "../db/postgres.js";
import { getSessionRow, toSession } from "../services/sessionStore.js";
import { createSession, networkForMode } from "../services/sessionService.js";
import { buildPaymentUri } from "../services/paymentUri.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { requireSecretKey, type AuthedRequest } from "../middleware/apiKeyAuth.js";

export const sessionsRouter = Router();

// Every route here except /public (below) is only ever called from the
// hosted checkout page's own origin (see app.ts's fuller explanation) —
// applied per-route, not as router-level middleware, so it can't shadow
// /public's own permissive cors() on preflight (OPTIONS) requests.
const restrictedCors = cors({ origin: env.CHECKOUT_WEB_ORIGIN });

// POST /v1/sessions — merchant server (secret key).
sessionsRouter.post("/", restrictedCors, requireSecretKey, async (req: AuthedRequest, res) => {
  const result = await createSession(req.merchantId!, req.body as CreateSessionRequest, {
    network: networkForMode(req.isTest!),
  });
  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(201).json(result);
});

// POST /v1/sessions/public — widget (publishable key only; never a secret key).
// The one route in this API that genuinely needs to be called from an
// arbitrary origin: this is invoked by packages/widget's JS running on a
// MERCHANT'S OWN SITE (any domain), not from apps/web. app.ts's global
// CORS policy is scoped to CHECKOUT_WEB_ORIGIN alone — correct for every
// other route (dashboard goes through Next's server-side proxy; the
// GET/session and payment-link routes only ever get called from within
// the hosted checkout page's own iframe, which carries CHECKOUT_WEB_ORIGIN
// regardless of what site embeds it) — but would silently break the
// widget on every third-party site if applied here too. Safe to open up:
// this endpoint takes no cookies/credentials, only a publishable key that
// is meant to be embedded in public client-side code.
//
// A browser sends a CORS preflight (OPTIONS) before the actual POST here,
// since it carries a custom header (X-Publishable-Key) — cors() only
// answers that automatically for the exact method it's attached to, so it
// needs its own .options() route too, or the preflight falls through to
// Express's bare default OPTIONS responder (200, no CORS headers) and the
// browser blocks the real request having never gotten this far.
const publicCors = cors({ origin: true });
sessionsRouter.options("/public", publicCors);
sessionsRouter.post("/public", publicCors, rateLimit({ windowMs: 60_000, max: 20 }), async (req, res) => {
  const pk = req.header("x-publishable-key");
  if (!pk?.startsWith("pk_")) {
    res.status(401).json({ error: "Missing or malformed publishable key" });
    return;
  }
  const { rows } = await query<{ merchant_id: string; is_test: boolean }>(
    `SELECT merchant_id, is_test FROM api_keys WHERE publishable_key = $1 AND revoked_at IS NULL`,
    [pk],
  );
  if (!rows[0]) {
    res.status(401).json({ error: "Invalid publishable key" });
    return;
  }
  const result = await createSession(rows[0].merchant_id, req.body as CreateSessionRequest, {
    network: networkForMode(rows[0].is_test),
  });
  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(201).json(result);
});

// GET /v1/sessions/:id — public read; deposit_secret_enc is never returned.
// Unauthenticated by design (a payer's own browser needs it), so rate
// limited by IP against scraping/enumeration — generous enough for the
// checkout page's own 4s status-poll (~15/min) plus normal reloads.
const publicReadLimiter = rateLimit({ windowMs: 60_000, max: 60 });
sessionsRouter.get("/:id", restrictedCors, publicReadLimiter, async (req, res) => {
  const row = await getSessionRow(String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "session not found" });
    return;
  }
  const m = await query<{ name: string }>(`SELECT name FROM merchants WHERE id = $1`, [row.merchant_id]);
  res.json({ session: toSession(row), merchant: { name: m.rows[0]?.name ?? "" } });
});

// GET /v1/sessions/:id/payment-uri — EIP-681 URI for the generic wallet QR path.
sessionsRouter.get("/:id/payment-uri", restrictedCors, publicReadLimiter, async (req, res) => {
  const row = await getSessionRow(String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "session not found" });
    return;
  }
  res.json({ uri: buildPaymentUri(toSession(row)) });
});

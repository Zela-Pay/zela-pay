import { Router } from "express";
import { query } from "../db/postgres.js";
import { requireSecretKey, type AuthedRequest } from "../middleware/apiKeyAuth.js";
import { assertSafeWebhookUrl } from "../services/urlSafety.js";
import { rateLimit } from "../middleware/rateLimit.js";

export const webhooksRouter = Router();

// PUT /v1/webhooks — merchant registers/updates their webhook endpoint.
// This is the REST-API equivalent of dashboard.ts's PUT /webhook (same
// purpose, secret-key-authenticated instead of dashboard-session) — that
// route calls assertSafeWebhookUrl before saving; this one didn't, which
// meant a caller could point webhook_url at an internal/private address
// (e.g. a cloud metadata endpoint) and the delivery job (webhookDelivery.ts)
// would later make a real outbound request to it from inside the API's own
// network — a live SSRF gap, not just a missed validation nicety.
webhooksRouter.put("/", requireSecretKey, rateLimit({ windowMs: 60_000, max: 10 }), async (req: AuthedRequest, res) => {
  const { webhookUrl, webhookSecret } = req.body as { webhookUrl?: string; webhookSecret?: string };

  if (!webhookUrl || !webhookSecret) {
    res.status(400).json({ error: "webhookUrl and webhookSecret are required" });
    return;
  }
  try {
    await assertSafeWebhookUrl(webhookUrl);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid webhook URL" });
    return;
  }

  await query(`UPDATE merchants SET webhook_url = $1, webhook_secret = $2 WHERE id = $3`, [
    webhookUrl,
    webhookSecret,
    req.merchantId,
  ]);

  res.json({ ok: true });
});

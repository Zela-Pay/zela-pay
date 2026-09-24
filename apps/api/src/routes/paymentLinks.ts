/**
 * Public (unauthenticated) Payment Link routes — anyone with the link can
 * view it and pay through it, same as any payment link/URL should work.
 * Management (create/list/activate) is dashboard-authenticated — see
 * routes/dashboard.ts.
 */

import { Router } from "express";
import { query } from "../db/postgres.js";
import { getPaymentLinkRow, toPaymentLink } from "../services/paymentLinkStore.js";
import { createSession, networkForMode, type SessionInput } from "../services/sessionService.js";
import { rateLimit } from "../middleware/rateLimit.js";

export const paymentLinksRouter = Router();

// GET /v1/payment-links/:id — public read, for the /pay/link/:id page to render.
paymentLinksRouter.get("/:id", rateLimit({ windowMs: 60_000, max: 30 }), async (req, res) => {
  const row = await getPaymentLinkRow(String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "payment link not found" });
    return;
  }
  const m = await query<{ name: string }>(`SELECT name FROM merchants WHERE id = $1`, [row.merchant_id]);
  res.json({ paymentLink: toPaymentLink(row), merchant: { name: m.rows[0]?.name ?? "" } });
});

// POST /v1/payment-links/:id/sessions — pay through the link: creates a real
// checkout session, same as /v1/sessions/public, tagged with this link's id.
paymentLinksRouter.post("/:id/sessions", rateLimit({ windowMs: 60_000, max: 20 }), async (req, res) => {
  const row = await getPaymentLinkRow(String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "payment link not found" });
    return;
  }
  if (!row.active) {
    res.status(400).json({ error: "This payment link is no longer active" });
    return;
  }

  const body = (req.body ?? {}) as { amount?: unknown; metadata?: Record<string, string> };
  let amount: string;
  if (row.amount !== null) {
    // Fixed-amount link: the amount is pinned by the link, never by the caller.
    // row.amount comes back from the NUMERIC(38,18) column padded to full
    // precision (e.g. "5.000000000000000000") — re-format to a plain decimal
    // string or it fails createSession's up-to-6-decimal-places validation.
    amount = String(Number(row.amount));
  } else {
    if (typeof body.amount !== "string") {
      res.status(400).json({ error: "This link lets the payer choose an amount — amount is required" });
      return;
    }
    amount = body.amount;
  }

  const input: SessionInput = {
    amount,
    successUrl: row.success_url ?? undefined,
    cancelUrl: row.cancel_url ?? undefined,
    metadata: body.metadata,
  };
  const result = await createSession(row.merchant_id, input, {
    paymentLinkId: row.id,
    network: networkForMode(row.is_test),
  });
  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(201).json(result);
});

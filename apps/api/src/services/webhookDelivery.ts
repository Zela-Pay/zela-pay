/**
 * Webhook outbox + delivery. Events are written to webhook_events, then
 * delivered at-least-once, HMAC-SHA256 signed with the merchant's secret in
 * X-Zela-Checkout-Signature (hex of HMAC over `${timestamp}.${body}`, with
 * the timestamp in X-Zela-Checkout-Timestamp to allow replay protection).
 */

import crypto from "node:crypto";
import { nanoid } from "nanoid";
import type { CheckoutSession, WebhookEvent, WebhookEventType } from "@zela-checkout/shared";
import { query } from "../db/postgres.js";
import { assertSafeWebhookUrl } from "./urlSafety.js";

const BACKOFF_SECONDS = [30, 120, 600, 3600, 21600]; // 30s, 2m, 10m, 1h, 6h
const REQUEST_TIMEOUT_MS = 10_000;

export function signPayload(timestamp: string, body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export async function enqueueWebhook(session: CheckoutSession, type: WebhookEventType): Promise<void> {
  const id = `evt_${nanoid(20)}`;
  const event: WebhookEvent = { id, type, createdAt: new Date().toISOString(), data: session };
  await query(
    `INSERT INTO webhook_events (id, merchant_id, session_id, type, payload) VALUES ($1,$2,$3,$4,$5)`,
    [id, session.merchantId, session.id, type, JSON.stringify(event)],
  );
}

export async function deliverPendingWebhooks(): Promise<void> {
  const { rows } = await query<{
    id: string;
    payload: WebhookEvent;
    attempts: number;
    webhook_url: string | null;
    webhook_secret: string | null;
  }>(
    `SELECT we.id, we.payload, we.attempts, m.webhook_url, m.webhook_secret
     FROM webhook_events we JOIN merchants m ON m.id = we.merchant_id
     WHERE we.delivered_at IS NULL AND we.next_attempt_at <= now() AND we.attempts <= $1
     ORDER BY we.next_attempt_at ASC
     LIMIT 50`,
    [BACKOFF_SECONDS.length],
  );

  for (const row of rows) {
    if (!row.webhook_url || !row.webhook_secret) {
      // Merchant has no endpoint yet; check again later without burning an attempt.
      await query(`UPDATE webhook_events SET next_attempt_at = now() + interval '1 hour' WHERE id = $1`, [row.id]);
      continue;
    }

    const body = JSON.stringify(row.payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    let error: string | null = null;

    try {
      const target = await assertSafeWebhookUrl(row.webhook_url);
      const res = await fetch(target, {
        redirect: "manual", // a redirect could point at an internal address
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Zela-Checkout-Timestamp": timestamp,
          "X-Zela-Checkout-Signature": signPayload(timestamp, body, row.webhook_secret),
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) error = `HTTP ${res.status}`;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    if (!error) {
      await query(`UPDATE webhook_events SET delivered_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1`, [row.id]);
    } else {
      const delay = BACKOFF_SECONDS[row.attempts] ?? BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1]!;
      await query(
        `UPDATE webhook_events
         SET attempts = attempts + 1, last_error = $2, next_attempt_at = now() + ($3 || ' seconds')::interval
         WHERE id = $1`,
        [row.id, error, String(delay)],
      );
    }
  }
}

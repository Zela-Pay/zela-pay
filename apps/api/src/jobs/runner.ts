/**
 * Background job loop — mirrors Zela-backend/src/jobs/runner.js's pattern
 * of a single interval-driven process running several independent tasks
 * rather than separate worker processes, appropriate at this project's
 * current scale.
 */

import { pollPendingSessions } from "../services/paymentMonitor.js";
import { deliverPendingWebhooks } from "../services/webhookDelivery.js";

const POLL_INTERVAL_MS = 10_000;
const WEBHOOK_INTERVAL_MS = 15_000;

export function startJobRunner(): void {
  setInterval(() => {
    pollPendingSessions().catch((err) => console.error("[jobs] pollPendingSessions failed:", err));
  }, POLL_INTERVAL_MS);

  setInterval(() => {
    deliverPendingWebhooks().catch((err) => console.error("[jobs] deliverPendingWebhooks failed:", err));
  }, WEBHOOK_INTERVAL_MS);

  console.log("[jobs] runner started");
}

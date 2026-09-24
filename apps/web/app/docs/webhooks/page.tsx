export const metadata = { title: "Webhooks" };

export default function WebhooksDocs() {
  return (
    <>
      <h1>Webhooks</h1>
      <p>
        Register an HTTPS endpoint from <strong>Settings → Webhook</strong> (or <code>PUT /v1/webhooks</code> with
        your secret key) and we&rsquo;ll POST an event there whenever a session settles or expires.
      </p>

      <h2>Events</h2>
      <ul>
        <li><code>checkout.session.completed</code> — the session settled; funds are in your wallet.</li>
        <li><code>checkout.session.expired</code> — the session&rsquo;s time limit passed with no sufficient payment.</li>
      </ul>
      <pre className="snippet">{`{
  "id": "evt_...",
  "type": "checkout.session.completed",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "data": { /* the session object — see REST API */ }
}`}</pre>

      <h2>Verifying a delivery</h2>
      <p>
        Every request carries <code>X-Zela-Checkout-Timestamp</code> and{" "}
        <code>X-Zela-Checkout-Signature</code> — a hex HMAC-SHA256 of{" "}
        <code>{"`${timestamp}.${rawBody}`"}</code>, keyed with your webhook secret (shown once, when you set the
        endpoint).
      </p>
      <pre className="snippet">{`import crypto from "node:crypto";

function verify(rawBody: string, timestamp: string, signature: string, secret: string) {
  const expected = crypto.createHmac("sha256", secret).update(\`\${timestamp}.\${rawBody}\`).digest("hex");
  const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!ok) throw new Error("invalid signature");
  // also reject a timestamp older than a few minutes to prevent replay
}`}</pre>

      <h2>Retries</h2>
      <p>
        A non-2xx response is retried on a fixed backoff: 30s, 2m, 10m, 1h, then 6h. Respond <code>2xx</code> as
        soon as you&rsquo;ve durably recorded the event — do the actual work (fulfillment, etc.) after responding,
        not before.
      </p>

      <h2>Endpoint requirements</h2>
      <p>
        HTTPS only, and the URL must resolve to a public address — an internal or loopback address is rejected
        when you set it.
      </p>
    </>
  );
}

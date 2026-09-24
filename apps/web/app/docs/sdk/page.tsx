export const metadata = { title: "Server SDK" };

export default function SdkDocs() {
  return (
    <>
      <h1>Server SDK</h1>
      <p>
        A typed Node client for creating sessions from your own backend — the same shape as stripe-node. Use this
        when your server, not the browser, decides what to charge.
      </p>

      <h2>Install</h2>
      <pre className="snippet">npm install @zela-checkout/sdk</pre>

      <h2>Usage</h2>
      <pre className="snippet">{`import { ZelaCheckoutClient } from "@zela-checkout/sdk";

const client = new ZelaCheckoutClient({
  secretKey: process.env.ZELA_SECRET_KEY!,
});

const { session, checkoutUrl } = await client.sessions.create({
  amount: "19.99",
  successUrl: "https://your.site/thanks",
  metadata: { orderId: "ord_123" },
});

// redirect your customer to checkoutUrl
console.log(session.id, session.status); // "cs_...", "awaiting_payment"`}</pre>

      <h2>Retrieving a session</h2>
      <pre className="snippet">{`const session = await client.sessions.retrieve("cs_...");
console.log(session.status); // "awaiting_payment" | "settling" | "settled" | "expired" | "failed"`}</pre>

      <p>
        The SDK talks to the same REST API described in <a href="/docs/api">REST API</a> — use whichever fits
        your stack; there&rsquo;s nothing the SDK can do that a plain HTTP call can&rsquo;t.
      </p>
    </>
  );
}

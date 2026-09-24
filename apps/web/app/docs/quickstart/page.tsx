export const metadata = { title: "Quickstart" };

export default function Quickstart() {
  return (
    <>
      <h1>Quickstart</h1>
      <p>Go from account to first checkout session in a few minutes.</p>

      <h2>1. Create a merchant account</h2>
      <p>
        Sign up with your business name, an email and password, and the Arc wallet address that should receive
        your funds. Double-check the wallet address — payouts are irreversible, and changing it later requires
        your password.
      </p>

      <h2>2. Get an API key</h2>
      <p>
        From the dashboard&rsquo;s <strong>API keys</strong> page, create a key pair. The <strong>secret key</strong>{" "}
        (<code>sk_live_…</code>) is shown once — copy it somewhere safe. Use it only on your server, never in
        client-side code. The <strong>publishable key</strong> (<code>pk_live_…</code>) is safe to embed in the
        browser widget.
      </p>

      <h2>3. Create a session</h2>
      <pre className="snippet">{`curl -X POST https://api.checkout.zelapay.xyz/v1/sessions \\
  -H "authorization: Bearer sk_live_..." \\
  -H "content-type: application/json" \\
  -d '{
    "amount": "19.99",
    "successUrl": "https://your.site/thanks"
  }'`}</pre>
      <p>The response includes a <code>checkoutUrl</code> — redirect your customer there.</p>

      <h2>4. Set a webhook</h2>
      <p>
        From <strong>Settings → Webhook</strong>, add an HTTPS endpoint on your server. You&rsquo;ll get a signed{" "}
        <code>checkout.session.completed</code> event the moment a payment settles — see{" "}
        <a href="/docs/webhooks">Webhooks</a> for how to verify it.
      </p>

      <h2>That&rsquo;s it</h2>
      <p>
        You&rsquo;re live. The 1% platform fee is deducted automatically before funds reach your wallet — see{" "}
        <a href="/docs/fees">Fees</a>.
      </p>
    </>
  );
}

export const metadata = { title: "Widget" };

export default function WidgetDocs() {
  return (
    <>
      <h1>Widget</h1>
      <p>
        The fastest way to accept payments — a single script tag, no build step, no framework required. It opens
        the same hosted checkout page in a modal.
      </p>

      <h2>Install</h2>
      <pre className="snippet">{`<script src="https://checkout.zelapay.xyz/widget.js"></script>
<script>
  ZelaCheckout.open({
    publishableKey: "pk_live_...",
    amount: "19.99",
    successUrl: "https://your.site/thanks",
  });
</script>`}</pre>

      <h2>Options</h2>
      <ul>
        <li><code>publishableKey</code> — required. Your <code>pk_live_…</code> key. Never use a secret key here.</li>
        <li><code>amount</code> — required. Decimal string, in USDC.</li>
        <li><code>successUrl</code> / <code>cancelUrl</code> — optional. Where the customer ends up after paying or closing the modal.</li>
        <li><code>metadata</code> — optional. A flat string map you&rsquo;ll get back on the session and in the webhook — order IDs, customer references, etc.</li>
      </ul>

      <p>
        The widget creates its own session using your publishable key, so it never needs your secret key. It
        closes automatically once the payment settles.
      </p>
    </>
  );
}

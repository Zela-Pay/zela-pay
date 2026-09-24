export const metadata = { title: "Documentation" };

export default function DocsOverview() {
  return (
    <>
      <h1>Documentation</h1>
      <p>
        Zela Payment Rails is payment infrastructure for native USDC on Arc, Circle&rsquo;s stablecoin-native L1.
        Two rails are live: <strong>Checkout</strong> — documented here — a hosted and embeddable checkout for
        accepting one-time payments, and <strong>Payment Links</strong>, a reusable shareable URL/QR that needs no
        website integration. USDC is the settlement currency directly — there&rsquo;s no swap, and no approval
        step on either side.
      </p>

      <h2>How a payment works</h2>
      <ol>
        <li>Your server creates a checkout <strong>session</strong> for an amount, in USDC.</li>
        <li>The customer opens the hosted checkout page (or your embedded widget) and pays with the Zela app or an EVM wallet.</li>
        <li>Checkout watches the deposit address, and once it&rsquo;s paid, sweeps the funds to your wallet minus the platform fee.</li>
        <li>You get a signed <code>checkout.session.completed</code> webhook.</li>
      </ol>

      <div className="docs-callout">
        Everything here reflects what&rsquo;s actually implemented and tested — nothing aspirational. If something
        looks missing, it probably is; check the project&rsquo;s README for current status.
      </div>

      <h2>Where to start</h2>
      <ul>
        <li><strong>Quickstart</strong> — create your first session and go live in a few minutes.</li>
        <li><strong>Widget</strong> — embed a checkout button with one script tag.</li>
        <li><strong>Server SDK</strong> — the typed Node client for your backend.</li>
        <li><strong>REST API</strong> — the underlying HTTP endpoints, for any language.</li>
        <li><strong>Webhooks</strong> — get notified the moment a payment settles.</li>
        <li><strong>Payment links</strong> — no integration at all: share a URL.</li>
      </ul>
    </>
  );
}

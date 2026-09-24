export const metadata = { title: "Payment links" };

export default function PaymentLinksDocs() {
  return (
    <>
      <h1>Payment links</h1>
      <p>
        The second Zela Payment Rail. A payment link is a reusable, shareable URL — no website integration
        required. Create one from the dashboard, share it as a link or QR code, and every payment through it
        creates a real checkout session: the same deposit-address, settlement and webhook machinery{" "}
        <a href="/docs">Checkout</a> uses.
      </p>

      <h2>Creating a link</h2>
      <p>
        From <strong>Payment links</strong> in the dashboard, give it a name and either a fixed amount, or leave
        it open for the payer to choose — useful for donations or &ldquo;pay what you want.&rdquo;
      </p>

      <h2>Fixed vs. open amount</h2>
      <ul>
        <li><strong>Fixed:</strong> visiting the link starts checkout immediately, for the pinned amount. The payer can never change it.</li>
        <li><strong>Open:</strong> the payer is asked to enter an amount before checkout starts.</li>
      </ul>

      <h2>Reusable, not single-use</h2>
      <p>
        Unlike an API-created session (single-use, expires in 30 minutes), a payment link itself never expires —
        share it once and it keeps working. Each visit that actually pays creates its own session under the hood,
        so many different customers can pay through the same link.
      </p>

      <h2>Deactivating a link</h2>
      <p>
        Turn a link off from the dashboard at any time. Existing sessions created through it are unaffected;
        visiting the link afterward shows &ldquo;no longer active&rdquo; instead of starting checkout.
      </p>

      <h2>Webhooks, fees and security</h2>
      <p>
        Payment links use the exact same <a href="/docs/webhooks">webhooks</a>, <a href="/docs/fees">fee model</a>,
        and <a href="/docs/security">security practices</a> as Checkout — a session created from a link is
        indistinguishable from one created via the API, except for its <code>paymentLinkId</code> field.
      </p>
    </>
  );
}

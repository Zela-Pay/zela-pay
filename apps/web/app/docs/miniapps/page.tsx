export const metadata = { title: "Mini Apps" };

export default function MiniAppsDocs() {
  return (
    <>
      <h1>Mini Apps</h1>
      <p>
        A Mini App is a web app you build once and run inside the Zela app — no download, no separate account. The
        Zela app loads your URL in a WebView and injects a small bridge (<code>window.Zela</code>) your frontend
        calls to know who the current user is, charge them (Checkout), and pay them out. Think Telegram Mini Apps or
        World App Mini Apps, for the Arc ecosystem.
      </p>

      <h2>1. List your Mini App</h2>
      <p>
        In your dashboard, go to <a href="/dashboard/mini-app">Mini App</a> and set a launch URL, an icon, and a
        tagline, then turn it on. That&rsquo;s what makes you show up in the Zela app&rsquo;s Mini Apps directory —
        nothing else about your account changes; you still use the same API keys as Checkout.
      </p>

      <h2>2. Install the SDK</h2>
      <pre className="snippet">npm install @zela-checkout/miniapp-sdk</pre>
      <p>
        Two halves, two entry points — use whichever runs where:
      </p>
      <ul>
        <li>
          <code>@zela-checkout/miniapp-sdk</code> — your backend (Node). Needs your secret key. Never ships to the
          browser.
        </li>
        <li>
          <code>@zela-checkout/miniapp-sdk/client</code> — your frontend, the code that actually runs inside the
          Zela app&rsquo;s WebView. Needs your publishable key. Does nothing outside that WebView.
        </li>
      </ul>

      <h2>3. Know who&rsquo;s using your Mini App</h2>
      <pre className="snippet">{`import { Zela } from "@zela-checkout/miniapp-sdk/client";

const user = await Zela.getUser();
// { zelaId: "harry.zela", arcAddress: "0x..." }`}</pre>
      <p>
        <code>arcAddress</code> is informational — you never touch a private key, and there&rsquo;s nothing to sign
        on the client. <code>zelaId</code> is what you&rsquo;ll pass to <code>payouts.resolve()</code> from your
        backend if you ever need to pay this user.
      </p>

      <h2>4. Charge the user (Checkout)</h2>
      <p>
        <code>Zela.checkout()</code> creates the session itself (the same public, publishable-key endpoint the
        embeddable widget uses) and hands it to the native host, which shows a native confirmation and sends the
        payment directly from the user&rsquo;s own already-connected Arc wallet — no QR, no wallet-connect step, no
        leaving your Mini App.
      </p>
      <pre className="snippet">{`import { Zela } from "@zela-checkout/miniapp-sdk/client";

try {
  const result = await Zela.checkout({
    publishableKey: "pk_live_...",
    amount: "4.99",
    metadata: { orderId: "ord_123" },
  });
  console.log(result); // { sessionId: "cs_...", status: "settled" }
} catch (err) {
  // user declined, or the transfer failed
}`}</pre>
      <p>
        This is exactly the session model described in <a href="/docs/api">REST API</a> and{" "}
        <a href="/docs/webhooks">Webhooks</a> — the same <code>checkout.session.completed</code> webhook fires when
        it settles, whether the customer paid through a hosted page, the widget, or a Mini App.
      </p>

      <h2 id="payouts">5. Pay the user out (Payouts)</h2>
      <p>
        <strong>Always non-custodial.</strong> Zela never holds or signs for your funds — your own backend sends the
        on-chain transfer itself, from a wallet you control. Zela&rsquo;s role is to tell you where to send it, then
        verify on-chain afterward that the transfer actually happened, for the right recipient and amount, so it can
        show up in the user&rsquo;s activity and your own payouts dashboard.
      </p>
      <pre className="snippet">{`import { ZelaMiniAppClient } from "@zela-checkout/miniapp-sdk";

const client = new ZelaMiniAppClient({ secretKey: process.env.ZELA_SECRET_KEY! });

// 1. Resolve who you're paying — a Zela ID, email, or merchant ID.
const { walletAddress } = await client.payouts.resolve("harry.zela");

// 2. Send the transfer yourself. However you already sign Arc transactions
//    (viem, ethers, your own signer) — Zela is not involved in this step.
const txHash = await sendUsdcYourself(walletAddress, "2.50");

// 3. Report it. Zela verifies the transaction on-chain before recording it.
const { payout } = await client.payouts.report({
  toIdentifier: "harry.zela",
  txHash,
  amount: "2.50",
});
console.log(payout.status); // "verified"`}</pre>
      <p>
        <code>payouts.resolve()</code> only accepts a Zela ID, email, or merchant ID (<code>store.zela.merchant</code>)
        — not a raw wallet address, since there&rsquo;s nothing to resolve for one. Payouts don&rsquo;t support
        sandbox keys: every payout is a real transfer on Arc mainnet, so use a production secret key.
      </p>

      <h2>Bridge reference</h2>
      <table>
        <thead>
          <tr>
            <th>Call</th>
            <th>Returns</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>Zela.isAvailable()</code></td>
            <td><code>boolean</code></td>
            <td>True inside the Zela app&rsquo;s Mini App host. Use it to render a fallback if your Mini App is also a plain website.</td>
          </tr>
          <tr>
            <td><code>Zela.getUser()</code></td>
            <td><code>{`{ zelaId, arcAddress }`}</code></td>
            <td>Never includes a private key or anything sensitive.</td>
          </tr>
          <tr>
            <td><code>Zela.checkout(request)</code></td>
            <td><code>{`{ sessionId, status: "settled" }`}</code></td>
            <td>Rejects if the user declines or the transfer fails.</td>
          </tr>
          <tr>
            <td><code>Zela.close()</code></td>
            <td><code>void</code></td>
            <td>Returns to the Zela app&rsquo;s own UI.</td>
          </tr>
        </tbody>
      </table>

      <p>
        Mini Apps reuse everything else already documented: the same fees (see <a href="/docs/fees">Fees</a>),
        the same webhook signing (<a href="/docs/webhooks">Webhooks</a>), and the same account/dashboard you already
        use for Checkout.
      </p>
    </>
  );
}

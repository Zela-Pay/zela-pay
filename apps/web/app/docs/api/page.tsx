export const metadata = { title: "REST API" };

export default function ApiDocs() {
  return (
    <>
      <h1>REST API</h1>
      <p>
        Base URL: <code>https://api.checkout.zelapay.xyz</code>. All requests and responses are JSON. Authenticate
        server-to-server calls with <code>Authorization: Bearer sk_live_…</code>.
      </p>

      <h2>Create a session</h2>
      <p><code>POST /v1/sessions</code> — requires a secret key.</p>
      <pre className="snippet">{`{
  "amount": "19.99",          // required — decimal string, in USDC, up to 6 decimals
  "successUrl": "https://…",  // optional — http(s) only
  "cancelUrl": "https://…",   // optional — http(s) only
  "metadata": { "orderId": "…" } // optional — up to 20 string keys
}`}</pre>
      <p>Returns <code>{"{ session, checkoutUrl }"}</code>.</p>

      <h2>Create a session (publishable key)</h2>
      <p>
        <code>POST /v1/sessions/public</code> — used by the widget. Send the publishable key in an{" "}
        <code>X-Publishable-Key</code> header instead of a bearer token. Same request/response shape as above.
        Rate-limited to 20 requests/minute/IP.
      </p>

      <h2>Retrieve a session</h2>
      <p><code>GET /v1/sessions/:id</code> — no authentication required. Returns <code>{"{ session, merchant }"}</code>.</p>

      <h2>The session object</h2>
      <pre className="snippet">{`{
  "id": "cs_...",
  "merchantId": "merch_...",
  "network": "arc-mainnet" | "arc-testnet",
  "amountSettlement": "19.99",
  "settlementToken": "USDC",
  "paymentPath": "zela_app" | "wallet_connect" | "qr_code" | null,
  "payerAddress": string | null,
  "depositAddress": "0x...",
  "status": "awaiting_payment" | "settling" | "settled" | "expired" | "failed",
  "paymentTxHash": string | null,
  "settlementTxHash": string | null,
  "platformFeeBps": 100,
  "platformFeeAmount": string | null,
  "successUrl": string | null,
  "cancelUrl": string | null,
  "metadata": { "...": "..." },
  "createdAt": "2026-01-01T00:00:00.000Z",
  "expiresAt": "2026-01-01T00:30:00.000Z"
}`}</pre>

      <h2>Payment URI</h2>
      <p>
        <code>GET /v1/sessions/:id/payment-uri</code> — returns <code>{"{ uri }"}</code>, an{" "}
        <a href="https://eips.ethereum.org/EIPS/eip-681" target="_blank" rel="noreferrer">EIP-681</a> payment
        request URI for the generic QR path.
      </p>

      <h2>Errors</h2>
      <p>
        Non-2xx responses return <code>{"{ error: string }"}</code>. <code>400</code> for invalid input,{" "}
        <code>401</code> for a missing/invalid/revoked key, <code>404</code> for an unknown session, <code>429</code>{" "}
        when rate-limited.
      </p>
    </>
  );
}

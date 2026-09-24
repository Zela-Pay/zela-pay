export const metadata = { title: "Security" };

export default function SecurityDocs() {
  return (
    <>
      <h1>Security</h1>

      <h2>Deposit keys</h2>
      <p>
        Each session gets a fresh, single-use private key for its deposit address, encrypted at rest with
        AES-256-GCM. It&rsquo;s only ever decrypted inside the settlement job, to sweep funds onward once a
        payment arrives.
      </p>

      <h2>Account credentials</h2>
      <p>
        API secret keys are never stored in plaintext — only a SHA-256 hash. Dashboard passwords use scrypt.
        Neither can be recovered from the database if it&rsquo;s ever exposed.
      </p>

      <h2>Webhooks</h2>
      <p>
        Deliveries are HMAC-SHA256 signed (see <a href="/docs/webhooks">Webhooks</a>) so you can verify a payload
        actually came from us. Your webhook URL is checked before every delivery: HTTPS only, no embedded
        credentials, and it must resolve to a public address — an internal or loopback address is rejected.
      </p>

      <h2>Rate limits</h2>
      <p>
        Sign-up and login are limited to 10 requests/minute/IP. The widget&rsquo;s publishable-key session endpoint
        is limited to 20 requests/minute/IP.
      </p>

      <h2>Refunds</h2>
      <p>
        A payment that arrives after a session expires, or an underpayment, stays at the deposit address rather
        than being swept automatically. From <strong>Transactions</strong>, you can manually sweep that balance
        back out to any address — no fee is taken, since the session never settled.
      </p>

      <h2>Known gaps</h2>
      <p>
        Wallet connect only supports browser extensions (MetaMask, Rabby, etc.) today — WalletConnect, for mobile
        wallets that connect by scanning a QR, isn&rsquo;t wired up yet.
      </p>
    </>
  );
}

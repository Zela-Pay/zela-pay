export const metadata = { title: "Payment methods" };

export default function PaymentMethods() {
  return (
    <>
      <h1>Payment methods</h1>
      <p>The hosted checkout page (and the widget, which embeds it) offers two ways to pay.</p>

      <h2>Zela app</h2>
      <p>
        On mobile, a deep link opens the Zela app directly to a pre-filled, PIN-confirmed payment — no address to
        copy, no manual entry. On desktop, the same link is shown as a QR code for the customer to scan with their
        phone.
      </p>
      <p>
        Zela&rsquo;s wallet already has an EVM address from its existing Ethereum/BNB Chain/HyperEVM support — Arc
        is just another chain ID to that same address, so no new key material is needed on Zela&rsquo;s side.
      </p>

      <h2>Wallet connect</h2>
      <p>
        Any injected EVM wallet — MetaMask, Rabby, Coinbase Wallet&rsquo;s browser extension — can connect directly
        and send the payment. The customer picks &ldquo;Pay {"{amount}"} USDC,&rdquo; confirms in their wallet, and
        that&rsquo;s it.
      </p>
      <p>
        A generic <a href="https://eips.ethereum.org/EIPS/eip-681" target="_blank" rel="noreferrer">EIP-681</a> payment-request
        QR is also available for wallets that scan to pay rather than connect.
      </p>

      <div className="docs-callout">
        WalletConnect (for mobile wallets that scan a QR to connect, rather than an installed browser extension)
        isn&rsquo;t wired up yet.
      </div>
    </>
  );
}

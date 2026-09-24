export const metadata = { title: "Fees" };

export default function FeesDocs() {
  return (
    <>
      <h1>Fees</h1>
      <p>
        A flat <strong>1%</strong> of settled volume — no monthly fee, no setup fee, no per-transaction minimum.
      </p>

      <h2>How it&rsquo;s taken</h2>
      <p>
        The fee is deducted from the amount forwarded to your wallet — never added on top of what the customer
        pays. If a customer sends more than the session asked for, the fee is taken on the full amount received,
        and the rest still goes to you.
      </p>
      <pre className="snippet">{`Customer pays:    20.00 USDC
Platform fee (1%): 0.20 USDC
You receive:      19.80 USDC`}</pre>

      <h2>Network costs</h2>
      <p>
        The session&rsquo;s deposit address pays its own network fee (gas) for the settlement transfer, out of the
        same balance it received — this is estimated from the current gas price before a payment is considered
        sufficient to settle, with a cushion for price movement.
      </p>

      <h2>No hidden costs</h2>
      <p>
        USDC is the settlement currency directly, so there&rsquo;s no swap fee and no slippage — and no token-account
        rent to worry about, unlike stablecoin checkouts on chains that require one.
      </p>
    </>
  );
}

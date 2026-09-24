"use client";

import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const DEMO_KEY = process.env.NEXT_PUBLIC_DEMO_PUBLISHABLE_KEY;
const AMOUNT_RE = /^\d{1,6}(\.\d{1,2})?$/;
const PRESETS = ["1.00", "5.00", "20.00"];

/**
 * A real "try it" demo on the landing page itself — not a mockup. It calls
 * the same POST /v1/sessions/public endpoint the embeddable widget uses,
 * against a seeded "Zela Demo Store" merchant, and opens the real hosted
 * checkout page in a modal — the actual product, live.
 */
export function DemoWidget() {
  const [amount, setAmount] = useState("1.00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  async function start() {
    if (!DEMO_KEY) {
      setError("Demo isn't configured yet.");
      return;
    }
    if (!AMOUNT_RE.test(amount) || Number(amount) <= 0) {
      setError("Enter an amount like 19.99");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/v1/sessions/public`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-publishable-key": DEMO_KEY },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the demo");
      setCheckoutUrl(data.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the demo");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setCheckoutUrl(null);
    openerRef.current?.focus();
  }

  useEffect(() => {
    if (!checkoutUrl) return;
    closeBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "zela-checkout:settled") close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("message", onMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutUrl]);

  return (
    <div className="demo-widget">
      <div className="demo-widget-presets">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className={`chip${amount === p ? " chip-active" : ""}`}
            onClick={() => setAmount(p)}
          >
            ${Number(p).toLocaleString()}
          </button>
        ))}
      </div>
      <div className="demo-widget-row">
        <label htmlFor="demo-amount" className="small muted">Amount (USDC)</label>
        <div className="demo-widget-input">
          <span aria-hidden="true">$</span>
          <input
            id="demo-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Demo amount in USDC"
          />
        </div>
        <button ref={openerRef} type="button" className="btn btn-primary" onClick={start} disabled={busy}>
          {busy ? "Starting…" : "Try the checkout"}
        </button>
      </div>
      {error && <p className="small" style={{ color: "var(--bad)", margin: "8px 0 0" }}>{error}</p>}
      <p className="small muted" style={{ margin: "8px 0 0" }}>
        This is the real product, live — not a mockup.
      </p>

      {checkoutUrl && (
        <div
          className="demo-modal-overlay"
          onClick={(e) => e.target === e.currentTarget && close()}
          role="presentation"
        >
          <div className="demo-modal" role="dialog" aria-modal="true" aria-label="Zela Checkout demo">
            <button ref={closeBtnRef} type="button" className="demo-modal-close" onClick={close} aria-label="Close demo">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <iframe src={checkoutUrl} title="Zela Payment Rails Checkout demo" />
          </div>
        </div>
      )}
    </div>
  );
}

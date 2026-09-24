"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatAmount } from "../lib/format";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface LinkInfo {
  id: string;
  name: string;
  amount: string | null;
  active: boolean;
}

export function PaymentLinkCard({ linkId }: { linkId: string }) {
  const router = useRouter();
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [merchantName, setMerchantName] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/v1/payment-links/${linkId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "This payment link doesn't exist.");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setLink(data.paymentLink);
        setMerchantName(data.merchant?.name ?? "");
        // Fixed amount: pay immediately, no extra click needed.
        if (data.paymentLink.active && data.paymentLink.amount) pay(data.paymentLink.id);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "This payment link doesn't exist.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId]);

  async function pay(id: string, chosenAmount?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/v1/payment-links/${id}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(chosenAmount ? { amount: chosenAmount } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start this payment");
      router.push(`/pay/${data.session.id}`);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not start this payment");
    }
  }

  if (error) {
    return (
      <div className="center-page">
        <div className="card checkout"><div className="alert alert-bad" style={{ marginBottom: 0 }}>{error}</div></div>
      </div>
    );
  }
  if (!link) {
    return (
      <div className="center-page">
        <div className="card checkout muted">Loading…</div>
      </div>
    );
  }
  if (!link.active) {
    return (
      <div className="center-page">
        <div className="card checkout">
          <div className="result">
            <div className="icon no">!</div>
            <h2 style={{ marginBottom: 4 }}>This link is no longer active</h2>
            <p className="muted small" style={{ marginBottom: 0 }}>Ask {merchantName || "the merchant"} for a current payment link.</p>
          </div>
        </div>
      </div>
    );
  }
  if (link.amount) {
    // Fixed-amount links redirect immediately (see the effect above) — this only
    // shows while that request is in flight.
    return (
      <div className="center-page">
        <div className="card checkout muted">Starting checkout…</div>
      </div>
    );
  }

  return (
    <div className="center-page">
      <div className="card checkout">
        <div className="head">
          {merchantName && <div className="merchant">{merchantName}</div>}
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>{link.name}</h1>
          <p className="muted small" style={{ marginBottom: 0 }}>Choose an amount to pay</p>
        </div>
        {error && <div className="alert alert-bad">{error}</div>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (amount) pay(link.id, amount);
          }}
        >
          <div className="demo-widget-input" style={{ marginBottom: 16, width: "100%" }}>
            <span aria-hidden="true">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              aria-label="Amount in USDC"
              required
              style={{ width: "100%" }}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !amount}>
            {busy ? "Starting…" : `Continue${amount ? ` — ${formatAmount(amount)} USDC` : ""}`}
          </button>
        </form>
        <p className="powered">Secured by Zela Payment Rails</p>
      </div>
    </div>
  );
}

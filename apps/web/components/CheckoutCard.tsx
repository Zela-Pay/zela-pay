"use client";

import { useEffect, useState } from "react";
import type { CheckoutSession } from "@zela-checkout/shared";
import { WalletConnectButton } from "./WalletConnectButton";
import { ZelaPayButton } from "./ZelaPayButton";
import { PaymentQR } from "./PaymentQR";
import { formatAmount } from "../lib/format";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// "Scan QR" used to be a third, equal-weight tab — but it showed a
// different QR (a generic EIP-681 URI) from the Zela app tab's own
// deep-link QR, which is genuinely confusing (scanning the wrong one with
// the wrong scanner just fails silently). Zela app leads, since it's this
// product's primary rail (see docs/ARCHITECTURE.md); the generic QR is a
// fallback tucked inside Wallet, since RainbowKit's own connect modal
// already covers WalletConnect-QR pairing for most mobile wallets.
type PayTab = "zela" | "wallet";
const TABS: { id: PayTab; label: string }[] = [
  { id: "zela", label: "Zela app" },
  { id: "wallet", label: "Wallet" },
];

const TERMINAL = new Set(["settled", "expired", "failed"]);

function CheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 8v5M12 16.5v.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="spinner">
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Live "Expires in M:SS" — ticks every second, hidden once under a minute stops mattering visually (still counts to 0). */
function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [msLeft, setMsLeft] = useState(() => new Date(expiresAt).getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => setMsLeft(new Date(expiresAt).getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (msLeft <= 0) return null;
  const totalSec = Math.floor(msLeft / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const low = totalSec < 120;

  return (
    <p className={`expiry small${low ? " expiry-low" : ""}`}>
      Expires in {m}:{String(s).padStart(2, "0")}
    </p>
  );
}

function CardSkeleton() {
  return (
    <div className="card checkout" aria-busy="true" aria-label="Loading checkout">
      <div className="head">
        <div className="skel skel-line" style={{ width: 100, height: 13, margin: "0 auto 10px" }} />
        <div className="skel skel-line" style={{ width: 160, height: 36, margin: "0 auto" }} />
      </div>
      <div className="skel skel-line" style={{ width: "100%", height: 40, borderRadius: 10, marginBottom: 16 }} />
      <div className="skel skel-line" style={{ width: "100%", height: 46, borderRadius: 8 }} />
    </div>
  );
}

export function CheckoutCard({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [merchantName, setMerchantName] = useState("");
  const [tab, setTab] = useState<PayTab>("zela");
  const [showFallbackQr, setShowFallbackQr] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`${API_URL}/v1/sessions/${sessionId}`);
        if (!res.ok) throw new Error(res.status === 404 ? "This checkout link is invalid or has been removed." : `Could not load session (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setSession(data.session);
        setMerchantName(data.merchant?.name ?? "");
        if (data.session.status === "settled") {
          window.parent?.postMessage({ type: "zela-checkout:settled", sessionId }, "*");
          if (data.session.successUrl) window.location.assign(data.session.successUrl);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load session");
      }
    }

    load();
    const interval = setInterval(() => {
      if (session && TERMINAL.has(session.status)) return;
      load();
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.status]);

  if (error) {
    return (
      <div className="center-page">
        <div className="card checkout">
          <div className="result">
            <div className="icon bad"><AlertIcon /></div>
            <h2 style={{ marginBottom: 4 }}>Couldn&rsquo;t load this checkout</h2>
            <p className="muted small" style={{ marginBottom: 16 }}>{error}</p>
            <button className="btn btn-block" onClick={() => window.location.reload()}>Try again</button>
          </div>
        </div>
      </div>
    );
  }
  if (!session) {
    return (
      <div className="center-page">
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="center-page">
      <div className="card checkout">
        <div className="head">
          {merchantName && <div className="merchant">{merchantName}</div>}
          <div className="amount">
            {formatAmount(session.amountSettlement)} <small>{session.settlementToken}</small>
          </div>
          {session.status === "awaiting_payment" && <ExpiryCountdown expiresAt={session.expiresAt} />}
        </div>

        {session.status === "settled" ? (
          <div className="result">
            <div className="icon ok"><CheckIcon /></div>
            <h2 style={{ marginBottom: 4 }}>Payment received</h2>
            <p className="muted small" style={{ marginBottom: 0 }}>
              {session.successUrl ? "Redirecting you back…" : "You can close this window."}
            </p>
          </div>
        ) : session.status === "expired" ? (
          <div className="result">
            <div className="icon muted"><AlertIcon /></div>
            <h2 style={{ marginBottom: 4 }}>This checkout has expired</h2>
            <p className="muted small" style={{ marginBottom: 0 }}>Ask the merchant for a new payment link.</p>
          </div>
        ) : session.status === "settling" ? (
          <div className="result">
            <div className="icon ok spin"><SpinnerIcon /></div>
            <h2 style={{ marginBottom: 4 }}>Confirming payment…</h2>
            <p className="muted small" style={{ marginBottom: 0 }}>This can take a few seconds.</p>
          </div>
        ) : (
          <>
            {session.lastSettlementError && (
              <div className="alert alert-bad" style={{ marginBottom: 16 }}>
                <p className="small" style={{ margin: 0 }}>
                  We saw your payment, but confirming it hit a snag: {session.lastSettlementError} We&rsquo;re retrying automatically — no action needed.
                </p>
              </div>
            )}
            <div className="tabs" role="tablist">
              {TABS.map((t) => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            {tab === "zela" && <ZelaPayButton session={session} />}
            {tab === "wallet" && (
              <>
                <WalletConnectButton session={session} />
                <div className="qr-fallback">
                  <button type="button" className="link-btn" onClick={() => setShowFallbackQr((v) => !v)}>
                    {showFallbackQr ? "Hide QR" : "Prefer to scan a QR instead?"}
                  </button>
                  {showFallbackQr && <PaymentQR session={session} />}
                </div>
              </>
            )}
          </>
        )}

        <p className="powered">Secured by Zela Payment Rails</p>
      </div>
    </div>
  );
}

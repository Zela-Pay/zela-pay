import type { ReactNode } from "react";
import { Logo } from "./Logo";

const POINTS = [
  {
    title: "Settle in seconds",
    body: "USDC lands directly in your wallet on Arc — no batching, no multi-day payout wait.",
  },
  {
    title: "Sandbox first",
    body: "Build and test your whole integration on Arc Testnet before a single real dollar moves.",
  },
  {
    title: "You hold the keys",
    body: "Non-custodial by design — Zela never takes control of your funds.",
  },
];

function CheckGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type AuthStep = { label: string; state: "done" | "active" | "upcoming" };

/** Shared split-screen chrome for the dashboard's own auth screens (login, signup, its two-step completion, password reset, email verification) — NOT the hosted checkout page, which keeps its separate .center-page/.auth-card treatment (see globals.css's own note). */
export function AuthLayout({ children, steps }: { children: ReactNode; steps?: AuthStep[] }) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand hero-stage">
        <div className="hero-grid" aria-hidden="true" />
        <div className="auth-brand-content">
          <p className="brand" style={{ padding: 0 }}>
            <Logo />
          </p>
          <h2>Payment infrastructure built for real settlement.</h2>
          <p className="lead">
            Checkout sessions, payment links, and a webhook-driven API — all settling in USDC on Arc.
          </p>
          <div className="auth-points">
            {POINTS.map((p) => (
              <div className="auth-point" key={p.title}>
                <div className="auth-point-icon">
                  <CheckGlyph />
                </div>
                <div className="auth-point-text">
                  <strong>{p.title}</strong>
                  <span>{p.body}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="auth-foot small">Secured by Zela Payment Rails</p>
      </aside>

      <div className="auth-form-side">
        <div className="auth-form-col">
          {steps && (
            <div className="auth-steps" aria-hidden="true">
              {steps.map((s, i) => (
                <div className="row" style={{ gap: 8, flex: i === steps.length - 1 ? "none" : 1 }} key={s.label}>
                  <div className={`auth-step${s.state === "done" ? " done" : s.state === "active" ? " active" : ""}`}>
                    <span className="dot">{s.state === "done" ? <CheckGlyph /> : i + 1}</span>
                    {s.label}
                  </div>
                  {i < steps.length - 1 && <div className="auth-step-line" />}
                </div>
              ))}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

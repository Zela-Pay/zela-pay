"use client";

import { useEffect, useState, type FormEvent } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { firebaseAuth } from "../lib/firebaseClient";
import { Logo } from "./Logo";

/**
 * Second half of signup (see AuthForm.tsx's header comment): the merchant
 * already has a Firebase identity (email/password or Google, established
 * on the previous screen) but no merchant account yet — this collects the
 * business details and is what actually calls POST /v1/auth/signup.
 *
 * Firebase's own auth state persists across a refresh, so this re-reads
 * `firebaseAuth.currentUser` (via onAuthStateChanged, since that
 * rehydration is async) rather than needing the previous screen to pass
 * anything through storage or the URL — closing the tab mid-setup and
 * coming back to this same link later still works.
 */
export function SignupComplete() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!firebaseAuth) {
      setChecking(false);
      return;
    }
    return onAuthStateChanged(firebaseAuth, (u) => {
      setUser(u);
      setChecking(false);
    });
  }, []);

  useEffect(() => {
    if (!checking && !user) window.location.assign("/signup");
  }, [checking, user]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    const form = Object.fromEntries(Array.from(new FormData(e.currentTarget).entries(), ([k, v]) => [k, String(v)]));
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, idToken, settlementToken: "USDC" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (checking || !user) {
    return (
      <div className="center-page">
        <div className="card auth-card muted">Loading…</div>
      </div>
    );
  }

  return (
    <div className="center-page">
      <div className="card auth-card">
        <p className="brand" style={{ padding: 0 }}>
          <Logo />
        </p>
        <h1>Tell us about your business</h1>
        <p className="muted small">
          Signed in as {user.email}.{" "}
          <button
            type="button"
            className="link-btn"
            style={{ padding: 0 }}
            onClick={() => firebaseAuth && signOut(firebaseAuth).then(() => window.location.assign("/signup"))}
          >
            Not you?
          </button>
        </p>

        {error && <div className="alert alert-bad" role="alert">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="name">Business name</label>
            <input id="name" name="name" type="text" required maxLength={100} autoComplete="organization" autoFocus />
          </div>
          <div className="field">
            <label htmlFor="settlementWallet">Payout address</label>
            <input id="settlementWallet" name="settlementWallet" type="text" required spellCheck={false} autoComplete="off" placeholder="0x…" />
            <span className="hint">
              Where we&rsquo;ll send your money. Double-check it: payouts can&rsquo;t be reversed, and changing it
              later requires your password.
            </span>
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Please wait…" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

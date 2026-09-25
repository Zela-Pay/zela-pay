"use client";

import { useEffect, useState, type FormEvent } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { firebaseAuth } from "../lib/firebaseClient";
import { Logo } from "./Logo";
import { AuthLayout, type AuthStep } from "./AuthLayout";

const STEPS: AuthStep[] = [{ label: "Account", state: "done" }, { label: "Business details", state: "active" }];

/**
 * Second half of signup (see AuthForm.tsx's header comment): the merchant
 * already has a Firebase identity (email/password or Google, established
 * on the previous screen) but no merchant account yet — this collects the
 * business details and calls POST /v1/auth/signup.
 *
 * Firebase's own auth state persists across a refresh, so this re-reads
 * firebaseAuth.currentUser via onAuthStateChanged. This allows the user
 * to return to this page after closing the tab without needing anything
 * stored in the URL or browser storage.
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
    if (!checking && !user) {
      window.location.assign("/signup");
    }
  }, [checking, user]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    const form = Object.fromEntries(
      Array.from(new FormData(e.currentTarget).entries(), ([key, value]) => [
        key,
        String(value),
      ]),
    );

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      console.error(
        "NEXT_PUBLIC_API_URL is not configured in the production build.",
      );
      setError("Payment API is not configured. Please try again later.");
      setBusy(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
    }, 15000);

    try {
      console.log("Creating merchant account...");
      console.log("API URL:", apiUrl);

      const idToken = await user.getIdToken();

      const response = await fetch(`${apiUrl}/v1/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          idToken,
          settlementToken: "USDC",
        }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));

      console.log("Signup response:", response.status, data);

      if (!response.ok) {
        setError(
          typeof data?.error === "string"
            ? data.error
            : `Request failed (${response.status})`,
        );
        return;
      }

      window.location.assign(user.emailVerified ? "/dashboard" : "/verify-email");
    } catch (err) {
      console.error("Signup request failed:", err);

      if (err instanceof DOMException && err.name === "AbortError") {
        setError("The server took too long to respond. Please try again.");
      } else if (err instanceof TypeError) {
        setError(
          "Unable to connect to the payment server. Please check your connection and try again.",
        );
      } else {
        setError("Network error. Please try again.");
      }
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  if (checking || !user) {
    return (
      <AuthLayout steps={STEPS}>
        <div className="card auth-card muted" style={{ maxWidth: "none" }}>Loading…</div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout steps={STEPS}>
      <div className="card auth-card" style={{ maxWidth: "none" }}>
        <p className="brand auth-card-brand" style={{ padding: 0 }}>
          <Logo />
        </p>

        <h1>Tell us about your business</h1>

        <p className="muted small">
          Signed in as {user.email}.{" "}
          <button
            type="button"
            className="link-btn"
            style={{ padding: 0 }}
            onClick={() => {
              if (!firebaseAuth) return;

              signOut(firebaseAuth).then(() => {
                window.location.assign("/signup");
              });
            }}
          >
            Not you?
          </button>
        </p>

        {error && (
          <div className="alert alert-bad" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="name">Business name</label>

            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={100}
              autoComplete="organization"
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="settlementWallet">Payout address</label>

            <input
              id="settlementWallet"
              name="settlementWallet"
              type="text"
              required
              spellCheck={false}
              autoComplete="off"
              placeholder="0x…"
            />

            <span className="hint">
              Where we&rsquo;ll send your money. Double-check it: payouts
              can&rsquo;t be reversed, and changing it later requires your
              password.
            </span>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={busy}
          >
            {busy ? "Please wait…" : "Create account"}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}

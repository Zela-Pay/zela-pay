"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { firebaseAuth, firebaseReady, googleProvider } from "../lib/firebaseClient";
import { Logo } from "./Logo";

/** Maps a Firebase Auth error code to copy a merchant can act on. */
function firebaseErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists. Sign in instead.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    default:
      return "Something went wrong signing in. Try again.";
  }
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03l3.05-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

/**
 * With Firebase configured, signing up is two steps: this screen only
 * establishes who you are (email/password or Google) — no business details
 * yet — then hands off to /signup/complete, which collects those and is
 * what actually creates the merchant account. Signing in stays one step,
 * since an existing merchant already has that information on file.
 *
 * Without Firebase (a deployment that hasn't configured it), signup falls
 * back to the original single-step form collecting everything at once —
 * there's no separate "identity" step to defer to without it.
 */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";
  const twoStepSignup = signup && firebaseReady;

  /** POSTs to our backend once we have a Firebase idToken (or a raw password, when Firebase isn't configured). */
  async function finishAuth(body: Record<string, unknown>) {
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    window.location.assign("/dashboard");
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = Object.fromEntries(Array.from(new FormData(e.currentTarget).entries(), ([k, v]) => [k, String(v)]));

    try {
      if (!firebaseReady || !firebaseAuth) {
        // Firebase isn't configured in this deployment — fall back to the
        // original path, straight to our own backend.
        await finishAuth(form);
        return;
      }

      if (signup) {
        try {
          await createUserWithEmailAndPassword(firebaseAuth, String(form.email), String(form.password));
        } catch (err) {
          setError(firebaseErrorMessage(err));
          return;
        }
        window.location.assign("/signup/complete");
        return;
      }

      let idToken: string;
      try {
        const cred = await signInWithEmailAndPassword(firebaseAuth, String(form.email), String(form.password));
        idToken = await cred.user.getIdToken();
      } catch (err) {
        setError(firebaseErrorMessage(err));
        return;
      }
      await finishAuth({ idToken });
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitGoogle() {
    if (!firebaseAuth) return;
    setBusy(true);
    setError(null);
    try {
      const cred = await signInWithPopup(firebaseAuth, googleProvider);
      if (signup) {
        window.location.assign("/signup/complete");
        return;
      }
      const idToken = await cred.user.getIdToken();
      await finishAuth({ idToken });
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <div className="card auth-card">
        <p className="brand" style={{ padding: 0 }}>
          <Logo />
        </p>
        <h1>{signup ? "Create your account" : "Sign in"}</h1>
        <p className="muted small">
          {signup ? "Start accepting payments online." : "Welcome back."}
        </p>

        {error && <div className="alert alert-bad" role="alert">{error}</div>}

        <form onSubmit={submit}>
          {signup && !twoStepSignup && (
            <div className="field">
              <label htmlFor="name">Business name</label>
              <input id="name" name="name" type="text" required maxLength={100} autoComplete="organization" />
            </div>
          )}
          {signup && !twoStepSignup && (
            <div className="field">
              <label htmlFor="settlementWallet">Payout address</label>
              <input id="settlementWallet" name="settlementWallet" type="text" required spellCheck={false} autoComplete="off" placeholder="0x…" />
              <span className="hint">
                Where we&rsquo;ll send your money. Double-check it: payouts can&rsquo;t be reversed, and changing it
                later requires your password.
              </span>
            </div>
          )}
          {signup && !twoStepSignup && <input type="hidden" name="settlementToken" value="USDC" />}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required minLength={signup ? 10 : 1} autoComplete={signup ? "new-password" : "current-password"} />
            {signup && <span className="hint">At least 10 characters.</span>}
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Please wait…" : signup ? "Continue" : "Sign in"}
          </button>

          {firebaseReady && (
            <>
              <p className="small muted" style={{ textAlign: "center", margin: "14px 0" }}>or</p>
              <button type="button" className="btn btn-block" disabled={busy} onClick={() => void submitGoogle()}>
                <GoogleIcon /> Continue with Google
              </button>
            </>
          )}
        </form>

        <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>
          {signup ? (
            <>Already have an account? <Link href="/login">Sign in</Link></>
          ) : (
            <>New here? <Link href="/signup">Create an account</Link></>
          )}
        </p>
      </div>
    </div>
  );
}

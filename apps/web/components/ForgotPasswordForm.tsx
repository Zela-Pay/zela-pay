"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { firebaseAuth, firebaseReady } from "../lib/firebaseClient";
import { Logo } from "./Logo";
import { AuthLayout } from "./AuthLayout";

/**
 * Password reset is entirely Firebase-native: sendPasswordResetEmail
 * handles generating the reset token and sending the email, and
 * actionCodeSettings.url points the email's link back at our own
 * /reset-password page (see ResetPasswordForm.tsx) instead of Firebase's
 * generic hosted page, so the whole flow stays on-brand.
 *
 * No backend route needed here — this deployment has no email-sending
 * infrastructure of its own, and Firebase already provides this safely
 * (rate-limited, doesn't reveal whether an email is registered).
 */
export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!firebaseAuth) return;
    setBusy(true);
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();

    try {
      await sendPasswordResetEmail(firebaseAuth, email, {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: false,
      });
    } catch (err) {
      // Deliberately still shows the "check your email" state for
      // auth/user-not-found — never confirm/deny whether an email is
      // registered. Only a genuinely broken request (bad email format,
      // network) surfaces an error.
      const code = (err as { code?: string })?.code ?? "";
      if (code !== "auth/user-not-found") {
        setError(code === "auth/invalid-email" ? "Enter a valid email address." : "Something went wrong. Try again.");
        setBusy(false);
        return;
      }
    }
    setSent(true);
    setBusy(false);
  }

  if (!firebaseReady) {
    return (
      <AuthLayout>
        <div className="card auth-card" style={{ maxWidth: "none" }}>
          <p className="brand auth-card-brand" style={{ padding: 0 }}><Logo /></p>
          <h1>Password reset unavailable</h1>
          <p className="muted small">Contact support to reset your password.</p>
          <p className="small muted" style={{ marginTop: 16 }}><Link href="/login">Back to sign in</Link></p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="card auth-card" style={{ maxWidth: "none" }}>
        <p className="brand auth-card-brand" style={{ padding: 0 }}><Logo /></p>
        <h1>Reset your password</h1>

        {sent ? (
          <>
            <p className="muted small">
              If an account exists for that email, we&rsquo;ve sent a link to reset your password. Check your inbox
              (and spam folder).
            </p>
            <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>
              <Link href="/login">Back to sign in</Link>
            </p>
          </>
        ) : (
          <>
            <p className="muted small">Enter your email and we&rsquo;ll send you a link to reset your password.</p>
            {error && <div className="alert alert-bad" role="alert">{error}</div>}
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" required autoComplete="email" autoFocus />
              </div>
              <button className="btn btn-primary btn-block" disabled={busy}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>
              <Link href="/login">Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

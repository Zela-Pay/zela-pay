"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { firebaseAuth } from "../lib/firebaseClient";
import { Logo } from "./Logo";
import { AuthLayout } from "./AuthLayout";

function codeErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/expired-action-code":
      return "This reset link has expired. Request a new one.";
    case "auth/invalid-action-code":
      return "This reset link is invalid or has already been used.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    default:
      return "Something went wrong. Request a new reset link.";
  }
}

/** Landing point for the link in the password-reset email (see ForgotPasswordForm.tsx's actionCodeSettings.url) — reads Firebase's oobCode from the URL and completes the reset directly, without ever leaving this site. */
export function ResetPasswordForm() {
  const params = useSearchParams();
  const oobCode = params.get("oobCode");

  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!firebaseAuth || !oobCode) {
      setError("This reset link is missing or invalid.");
      setChecking(false);
      return;
    }
    verifyPasswordResetCode(firebaseAuth, oobCode)
      .then((addr) => setEmail(addr))
      .catch((err) => setError(codeErrorMessage(err)))
      .finally(() => setChecking(false));
  }, [oobCode]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!firebaseAuth || !oobCode) return;
    setBusy(true);
    setError(null);
    const newPassword = String(new FormData(e.currentTarget).get("password") ?? "");

    try {
      await confirmPasswordReset(firebaseAuth, oobCode, newPassword);
      setDone(true);
    } catch (err) {
      setError(codeErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="card auth-card" style={{ maxWidth: "none" }}>
        <p className="brand auth-card-brand" style={{ padding: 0 }}><Logo /></p>
        <h1>Set a new password</h1>

        {checking ? (
          <p className="muted small">Checking your link…</p>
        ) : done ? (
          <>
            <p className="muted small">Your password has been changed.</p>
            <Link href="/login" className="btn btn-primary btn-block" style={{ marginTop: 8 }}>
              Sign in
            </Link>
          </>
        ) : !email ? (
          <>
            {error && <div className="alert alert-bad" role="alert">{error}</div>}
            <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>
              <Link href="/forgot-password">Request a new link</Link>
            </p>
          </>
        ) : (
          <>
            <p className="muted small">Resetting the password for {email}.</p>
            {error && <div className="alert alert-bad" role="alert">{error}</div>}
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="password">New password</label>
                <input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" autoFocus />
                <span className="hint">At least 10 characters.</span>
              </div>
              <button className="btn btn-primary btn-block" disabled={busy}>
                {busy ? "Saving…" : "Save new password"}
              </button>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, sendEmailVerification, signOut, type User } from "firebase/auth";
import { firebaseAuth } from "../lib/firebaseClient";
import { Logo } from "./Logo";
import { AuthLayout } from "./AuthLayout";

const RESEND_COOLDOWN_S = 30;

/**
 * Shown instead of the dashboard right after signup/login when Firebase
 * reports the account's email isn't verified yet (see AuthForm.tsx and
 * SignupComplete.tsx — both redirect here rather than to /dashboard in
 * that case). Google accounts are already verified by Google itself, so
 * they never land here — only email/password signups do.
 */
export function VerifyEmail() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [checking, setChecking] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [notice, setNotice] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);

  useEffect(() => {
    if (!firebaseAuth) {
      setUser(null);
      return;
    }
    return onAuthStateChanged(firebaseAuth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.emailVerified) window.location.assign("/dashboard");
  }, [user]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function resend() {
    if (!user || resendCooldown > 0) return;
    try {
      await sendEmailVerification(user);
      setNotice({ kind: "ok", text: "Verification email sent." });
      setResendCooldown(RESEND_COOLDOWN_S);
    } catch {
      setNotice({ kind: "bad", text: "Couldn't send the email right now. Try again shortly." });
    }
  }

  async function checkVerified() {
    if (!user) return;
    setChecking(true);
    setNotice(null);
    await user.reload();
    if (user.emailVerified) {
      window.location.assign("/dashboard");
      return;
    }
    setChecking(false);
    setNotice({ kind: "bad", text: "Still not verified — check your inbox (and spam folder) for the link." });
  }

  if (user === undefined) return null; // Firebase auth-state not resolved yet

  if (!user) {
    // No signed-in Firebase user at all — nothing to verify here.
    if (typeof window !== "undefined") window.location.assign("/login");
    return null;
  }

  return (
    <AuthLayout>
      <div className="card auth-card" style={{ maxWidth: "none" }}>
        <p className="brand auth-card-brand" style={{ padding: 0 }}><Logo /></p>
        <h1>Verify your email</h1>
        <p className="muted small">
          We sent a verification link to <strong>{user.email}</strong>. Click it, then come back here.
        </p>

        {notice && <div className={`alert alert-${notice.kind}`} role={notice.kind === "bad" ? "alert" : "status"}>{notice.text}</div>}

        <button type="button" className="btn btn-primary btn-block" disabled={checking} onClick={checkVerified}>
          {checking ? "Checking…" : "I've verified — continue"}
        </button>
        <button
          type="button"
          className="btn btn-block"
          style={{ marginTop: 8 }}
          disabled={resendCooldown > 0}
          onClick={resend}
        >
          {resendCooldown > 0 ? `Resend email (${resendCooldown}s)` : "Resend email"}
        </button>

        <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>
          <button
            type="button"
            className="link-btn"
            style={{ padding: 0 }}
            onClick={() => {
              if (!firebaseAuth) return;
              signOut(firebaseAuth).then(() => window.location.assign("/login"));
            }}
          >
            Not you? Sign out
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}

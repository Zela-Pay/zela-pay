/**
 * Firebase Auth verification for merchant signup/login (email/password +
 * Google — see routes/auth.ts). Lazily initialized so a deployment/test
 * environment that never sets FIREBASE_SERVICE_ACCOUNT_JSON (the plain-
 * password auth path doesn't need it) never pays an import-time cost or
 * throws at boot for a feature it isn't using.
 */

import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env } from "../config/env.js";

let app: App | null = null;

function getFirebaseApp(): App {
  if (app) return app;
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured — Firebase sign-in is unavailable");
  }
  const existing = getApps()[0];
  app = existing ?? initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  return app;
}

export interface VerifiedFirebaseUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

/** Verifies a client-obtained Firebase ID token; throws if invalid/expired. */
export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
  const decoded = await getAuth(getFirebaseApp()).verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    emailVerified: decoded.email_verified ?? false,
    name: typeof decoded.name === "string" ? decoded.name : null,
  };
}

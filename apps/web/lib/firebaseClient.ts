import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

/**
 * Firebase client SDK for merchant sign-in (email/password + Google) — see
 * components/AuthForm.tsx. This config is a client identifier, not a
 * secret (same category as a Stripe publishable key); the server-side
 * Admin SDK credential that actually needs protecting lives in apps/api's
 * FIREBASE_SERVICE_ACCOUNT_JSON, verified there, never here.
 *
 * `firebaseReady` is false when these env vars are unset (e.g. a
 * deployment that hasn't configured Firebase yet) — AuthForm falls back to
 * password-only in that case rather than crashing.
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);

const firebaseApp = firebaseReady ? (getApps()[0] ?? initializeApp(firebaseConfig)) : null;

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const googleProvider = new GoogleAuthProvider();

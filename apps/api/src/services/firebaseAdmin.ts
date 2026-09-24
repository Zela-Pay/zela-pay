/**
 * Firebase Auth verification for merchant signup/login.
 */

import { initializeApp, cert, getApps, type App } from "firebase-admin/app";

import { getAuth } from "firebase-admin/auth";

import { env } from "../config/env.js";

let app: App | null = null;

function getFirebaseApp(): App {
  if (app) {
    return app;
  }

  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
  }

  const existing = getApps()[0];

  app =
    existing ??
    initializeApp({
      credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON)),
    });

  return app;
}

export interface VerifiedFirebaseUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<VerifiedFirebaseUser> {
  console.log("[Firebase] Starting token verification...");

  let firebaseApp: App;

  try {
    firebaseApp = getFirebaseApp();

    console.log("[Firebase] Admin initialized");
  } catch (error) {
    console.error("[Firebase] Admin initialization failed:", error);

    throw error;
  }

  try {
    console.log("[Firebase] Calling verifyIdToken...");

    const decoded = await getAuth(firebaseApp).verifyIdToken(idToken);

    console.log("[Firebase] Token verified:", decoded.uid);

    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      emailVerified: decoded.email_verified ?? false,
      name: typeof decoded.name === "string" ? decoded.name : null,
    };
  } catch (error) {
    console.error("[Firebase] Token verification failed:", error);

    throw error;
  }
}

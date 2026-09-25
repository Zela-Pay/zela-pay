import { Router } from "express";
import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { getAddress, isAddress } from "viem";
import { query } from "../db/postgres.js";
import { hashSecret } from "../services/apiKeys.js";
import { hashPassword, verifyPassword } from "../services/passwords.js";
import { verifyFirebaseIdToken } from "../services/firebaseAdmin.js";
import { logLoginAttempt, type LoginMethod } from "../services/loginAudit.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { requireDashboardSession } from "../middleware/dashboardAuth.js";
import type { AuthedRequest } from "../middleware/apiKeyAuth.js";
import type { Request } from "express";

export const authRouter = Router();

const SESSION_TTL_DAYS = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Checksum-normalizes an EVM address, or returns null if it isn't one. */
export function normalizeEvmAddress(v: unknown): `0x${string}` | null {
  if (typeof v !== "string" || !isAddress(v, { strict: false })) return null;
  return getAddress(v);
}

function requestMeta(req: Request): { ip: string | null; userAgent: string | null } {
  return {
    ip: req.ip ?? null,
    userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
  };
}

async function startSession(merchantId: string, meta: { ip: string | null; userAgent: string | null }): Promise<string> {
  const token = `dash_${crypto.randomBytes(32).toString("base64url")}`;
  await query(
    `INSERT INTO dashboard_sessions (token_hash, merchant_id, expires_at, ip, user_agent)
     VALUES ($1,$2, now() + ($3 || ' days')::interval, $4, $5)`,
    [hashSecret(token), merchantId, String(SESSION_TTL_DAYS), meta.ip, meta.userAgent],
  );
  return token;
}

const authLimiter = rateLimit({ windowMs: 60_000, max: 10 });

/**
 * Signup/login both accept EITHER `password` (the original path — a
 * merchant's own email + password, hashed with services/passwords.ts) OR
 * `idToken` (a Firebase ID token from apps/web's Firebase client sign-in —
 * email/password or Google, see lib/firebaseClient.ts there). Either path
 * converges on the same dashboard_sessions token via startSession(), so
 * nothing downstream of login/signup needs to know which one was used.
 */
async function resolveSignupIdentity(
  body: Record<string, unknown>,
): Promise<{ email: string; passwordHash: string | null; firebaseUid: string | null } | { error: string }> {
  if (typeof body.idToken === "string") {
    let user;
    try {
      user = await verifyFirebaseIdToken(body.idToken);
    } catch {
      return { error: "Your sign-in has expired. Try again." };
    }
    if (!user.email) return { error: "That sign-in method didn't provide an email address." };
    return { email: user.email, passwordHash: null, firebaseUid: user.uid };
  }

  const { email, password } = body;
  if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 254) {
    return { error: "Enter a valid email address" };
  }
  if (typeof password !== "string" || password.length < 10 || password.length > 200) {
    return { error: "Password must be at least 10 characters" };
  }
  return { email: email.trim(), passwordHash: hashPassword(password), firebaseUid: null };
}

authRouter.post("/signup", authLimiter, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { name, settlementWallet, settlementToken } = body;

  const identity = await resolveSignupIdentity(body);
  if ("error" in identity) {
    res.status(400).json({ error: identity.error });
    return;
  }
  if (typeof name !== "string" || !name.trim() || name.length > 100) {
    res.status(400).json({ error: "Enter your business name" });
    return;
  }
  const wallet = normalizeEvmAddress(settlementWallet);
  if (!wallet) {
    res.status(400).json({ error: "Settlement wallet must be a valid Arc (EVM) address" });
    return;
  }
  if (settlementToken !== "USDC") {
    res.status(400).json({ error: "Settlement token must be USDC" });
    return;
  }

  const id = `merch_${nanoid(16)}`;
  try {
    await query(
      `INSERT INTO merchants (id, name, settlement_wallet, settlement_token, email, password_hash, firebase_uid) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, name.trim(), wallet, settlementToken, identity.email, identity.passwordHash, identity.firebaseUid],
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "An account with this email already exists. Sign in instead." });
      return;
    }
    throw err;
  }
  const meta = requestMeta(req);
  await logLoginAttempt({
    merchantId: id,
    email: identity.email,
    method: identity.firebaseUid ? "email_link" : "password",
    success: true,
    ...meta,
  });
  res.status(201).json({ token: await startSession(id, meta), merchantId: id });
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const { email, password, idToken } = (req.body ?? {}) as Record<string, unknown>;
  const meta = requestMeta(req);

  if (typeof idToken === "string") {
    let user;
    try {
      user = await verifyFirebaseIdToken(idToken);
    } catch {
      res.status(401).json({ error: "Your sign-in has expired. Try again." });
      return;
    }
    const method: LoginMethod = user.provider === "google.com" ? "google" : "email_link";
    const { rows } = await query<{ id: string }>(`SELECT id FROM merchants WHERE firebase_uid = $1`, [user.uid]);
    let merchantId = rows[0]?.id;

    // First sign-in with this Firebase account on an email that already has
    // a merchant (e.g. originally created with a password): link it, rather
    // than failing — only when Firebase itself has verified the email, so a
    // spoofed/unverified address can't hijack an existing account.
    if (!merchantId && user.email && user.emailVerified) {
      const linked = await query<{ id: string }>(
        `UPDATE merchants SET firebase_uid = $1 WHERE lower(email) = lower($2) AND firebase_uid IS NULL RETURNING id`,
        [user.uid, user.email],
      );
      merchantId = linked.rows[0]?.id;
    }

    if (!merchantId) {
      await logLoginAttempt({ merchantId: null, email: user.email ?? "unknown", method, success: false, ...meta });
      res.status(404).json({ error: "No account found for this sign-in — create one first." });
      return;
    }
    await logLoginAttempt({ merchantId, email: user.email ?? "unknown", method, success: true, ...meta });
    res.json({ token: await startSession(merchantId, meta), merchantId });
    return;
  }

  const emailStr = typeof email === "string" ? email.trim() : "";
  const { rows } = await query<{ id: string; password_hash: string | null }>(
    `SELECT id, password_hash FROM merchants WHERE lower(email) = lower($1)`,
    [emailStr],
  );
  const ok = verifyPassword(typeof password === "string" ? password : "", rows[0]?.password_hash ?? null);
  if (!rows[0] || !ok) {
    await logLoginAttempt({ merchantId: rows[0]?.id ?? null, email: emailStr, method: "password", success: false, ...meta });
    res.status(401).json({ error: "Incorrect email or password" });
    return;
  }
  await logLoginAttempt({ merchantId: rows[0].id, email: emailStr, method: "password", success: true, ...meta });
  res.json({ token: await startSession(rows[0].id, meta), merchantId: rows[0].id });
});

authRouter.post("/logout", requireDashboardSession, async (req: AuthedRequest, res) => {
  const token = req.headers.authorization!.slice(7);
  await query(`DELETE FROM dashboard_sessions WHERE token_hash = $1`, [hashSecret(token)]);
  res.json({ ok: true });
});

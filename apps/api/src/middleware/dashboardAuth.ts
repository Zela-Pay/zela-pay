import type { NextFunction, Response } from "express";
import { query } from "../db/postgres.js";
import { hashSecret } from "../services/apiKeys.js";
import type { AuthedRequest } from "./apiKeyAuth.js";

/** Authenticates dashboard calls: `Authorization: Bearer dash_...`. */
export async function requireDashboardSession(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token?.startsWith("dash_")) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  const tokenHash = hashSecret(token);
  const { rows } = await query<{ merchant_id: string }>(
    `UPDATE dashboard_sessions SET last_seen_at = now() WHERE token_hash = $1 AND expires_at > now() RETURNING merchant_id`,
    [tokenHash],
  );
  if (!rows[0]) {
    res.status(401).json({ error: "Session expired" });
    return;
  }
  req.merchantId = rows[0].merchant_id;
  req.sessionTokenHash = tokenHash;
  next();
}

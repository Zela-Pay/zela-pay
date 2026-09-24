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
  const { rows } = await query<{ merchant_id: string }>(
    `SELECT merchant_id FROM dashboard_sessions WHERE token_hash = $1 AND expires_at > now()`,
    [hashSecret(token)],
  );
  if (!rows[0]) {
    res.status(401).json({ error: "Session expired" });
    return;
  }
  req.merchantId = rows[0].merchant_id;
  next();
}

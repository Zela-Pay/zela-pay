import { nanoid } from "nanoid";
import { query } from "../db/postgres.js";

export type LoginMethod = "password" | "google" | "email_link";

/** Records a login attempt — success or failure — for a merchant to review in Settings. Never throws: a logging failure must never block an actual login. */
export async function logLoginAttempt(params: {
  merchantId: string | null;
  email: string;
  method: LoginMethod;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO login_audit_log (id, merchant_id, email, method, success, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [`la_${nanoid(20)}`, params.merchantId, params.email, params.method, params.success, params.ip, params.userAgent],
    );
  } catch (err) {
    console.error("[loginAudit] failed to record login attempt:", err);
  }
}

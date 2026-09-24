import { cookies } from "next/headers";
import type { SettlementToken } from "@zela-checkout/shared";

export const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";
export const SESSION_COOKIE = "zc_session";

/** Server-side call to the checkout API, authenticated with the dashboard session cookie. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
}

export interface Me {
  id: string;
  name: string;
  email: string | null;
  settlementWallet: string;
  settlementToken: SettlementToken;
  webhookUrl: string | null;
  hasWebhookSecret: boolean;
}

export async function getMe(): Promise<Me | null> {
  try {
    const res = await apiFetch("/v1/dashboard/me");
    return res.ok ? ((await res.json()) as Me) : null;
  } catch {
    return null;
  }
}

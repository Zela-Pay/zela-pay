import { NextResponse, type NextRequest } from "next/server";
import { API_URL, SESSION_COOKIE } from "../../../../lib/api";

const MAX_AGE = 7 * 24 * 60 * 60;

/**
 * Login/signup/logout proxy. The API's session token is kept in an httpOnly
 * cookie on this origin, so it is never readable from browser JavaScript.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!["login", "signup", "logout"].includes(action)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (action === "logout") {
    if (token) {
      await fetch(`${API_URL}/v1/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${token}` } }).catch(() => {});
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/v1/auth/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the checkout API. Try again shortly." }, { status: 502 });
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) return NextResponse.json({ error: data.error ?? "Request failed" }, { status: upstream.status });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return res;
}

import { NextResponse, type NextRequest } from "next/server";
import { API_URL, SESSION_COOKIE } from "../../../../lib/api";

const SEGMENT = /^[A-Za-z0-9_-]+$/;

/** Authenticated pass-through from dashboard client components to /v1/dashboard/*. */
async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (!path.every((s) => SEGMENT.test(s))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const hasBody = !["GET", "HEAD"].includes(req.method);
  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/v1/dashboard/${path.join("/")}${req.nextUrl.search}`, {
      method: req.method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: hasBody ? await req.text() : undefined,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the checkout API" }, { status: 502 });
  }

  const res = new NextResponse(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } });
  if (upstream.status === 401) res.cookies.delete(SESSION_COOKIE);
  return res;
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };

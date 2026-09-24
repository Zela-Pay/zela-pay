import { NextResponse, type NextRequest } from "next/server";

// Cheap gate: the dashboard layout still verifies the session with the API.
export function middleware(req: NextRequest) {
  if (!req.cookies.get("zc_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] };

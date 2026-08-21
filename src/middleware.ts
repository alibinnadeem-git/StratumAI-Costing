import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "stratum_session";

export default function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/setup-admin") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/health");

  if (!isPublic && !req.cookies.get(SESSION_COOKIE)?.value) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

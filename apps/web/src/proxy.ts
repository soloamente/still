import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight gate: redirects to /sign-in when accessing an authenticated
 * route without a Better Auth session cookie. We don't validate the cookie
 * here (would require an upstream call); the server still checks every
 * request server-side. This is purely the UX shortcut so the SSR shell
 * doesn't render placeholder data for signed-out visitors.
 *
 * Next.js 16+ uses the `proxy` file convention (formerly `middleware`).
 */
const PROTECTED_PREFIXES = [
  "/home",
  "/diary",
  "/watchlist",
  "/chat",
  "/me",
  "/achievements",
  "/notifications",
];

const AUTH_ONLY_PREFIXES = ["/sign-in", "/sign-up", "/onboarding"];

const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));

  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  if (AUTH_ONLY_PREFIXES.some((p) => pathname.startsWith(p)) && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api routes (Better Auth handler)
     * - Next.js static (_next/static, _next/image)
     * - favicon
     * - Public files (have an extension)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)",
  ],
};

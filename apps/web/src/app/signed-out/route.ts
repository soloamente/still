import { type NextRequest, NextResponse } from "next/server";

import { clearSessionCookies } from "@/lib/session-cookie";

/**
 * Clears the Better Auth session cookies and redirects to `/sign-in`.
 *
 * Why this exists: when a session becomes invalid server-side (e.g. the user
 * is banned, or the session is revoked/expired) the cookie still lives in the
 * browser. Server Components — including the `(app)` layout that detects the
 * invalid session — cannot send `Set-Cookie` to the browser, and the proxy
 * gates purely on cookie *presence*. That mismatch produced an infinite
 * `/home` ⇄ `/sign-in` redirect loop. A Route Handler CAN clear cookies, so
 * the layout redirects here, we drop the stale cookies, and `/sign-in` then
 * renders normally (the proxy no longer sees a session cookie).
 */
export function GET(req: NextRequest): NextResponse {
	const url = req.nextUrl.clone();
	url.pathname = "/sign-in";
	url.search = "";
	const res = NextResponse.redirect(url);
	clearSessionCookies(res);
	return res;
}

import type { NextResponse } from "next/server";

/**
 * Better Auth session cookie names (with and without the `__Secure-` prefix
 * used in production). Shared by the proxy (presence gate) and the
 * `/signed-out` route handler (which clears them).
 */
export const SESSION_COOKIE_NAMES = [
	"better-auth.session_token",
	"__Secure-better-auth.session_token",
] as const;

/** Mirrors `@still/auth` `advanced.defaultCookieAttributes` so deletes match sets. */
const SESSION_COOKIE_CLEAR_OPTIONS = {
	path: "/",
	maxAge: 0,
	expires: new Date(0),
	httpOnly: true,
	secure: true,
	sameSite: "none" as const,
};

/**
 * Expire every known Better Auth session cookie on a Route Handler response.
 * `cookies.delete()` alone often leaves stale tokens when the original cookie
 * was set with `Secure` + `SameSite=None` (production Better Auth defaults).
 */
export function clearSessionCookies(res: NextResponse): void {
	for (const name of SESSION_COOKIE_NAMES) {
		res.cookies.set(name, "", SESSION_COOKIE_CLEAR_OPTIONS);
	}
}

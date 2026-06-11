import { type NextRequest, NextResponse } from "next/server";

import { retiredCatalogueRedirectUrl } from "@/lib/retired-catalogue-redirect";
import { SESSION_COOKIE_NAMES } from "@/lib/session-cookie";

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

export function proxy(req: NextRequest) {
	const { pathname } = req.nextUrl;
	const catalogueRedirect = retiredCatalogueRedirectUrl(
		pathname,
		req.nextUrl.search,
	);
	if (catalogueRedirect) {
		const url = req.nextUrl.clone();
		const target = new URL(catalogueRedirect, req.nextUrl.origin);
		url.pathname = target.pathname;
		url.search = target.search;
		return NextResponse.redirect(url);
	}

	const hasSession = SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));

	if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !hasSession) {
		const url = req.nextUrl.clone();
		url.pathname = "/sign-in";
		url.searchParams.set("from", pathname);
		return NextResponse.redirect(url);
	}
	// Do not redirect `/sign-in` → `/home` on cookie presence alone: after account
	// deletion (or ban/revoke) the token can remain in the browser while the
	// session is invalid server-side, which produced `/home` ⇄ `/sign-in` loops.
	// Auth routes use `AuthSessionRedirect` for valid sessions instead.
	const requestHeaders = new Headers(req.headers);
	requestHeaders.set("x-still-pathname", pathname);
	return NextResponse.next({
		request: { headers: requestHeaders },
	});
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

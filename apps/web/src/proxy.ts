import { type NextRequest, NextResponse } from "next/server";

import {
	isNextHandledApiPath,
	resolveApiRewriteOrigin,
} from "@/lib/next-handled-api-paths";
import { applyReferralCookieToResponse } from "@/lib/referral-cookie";
import { retiredCatalogueRedirectUrl } from "@/lib/retired-catalogue-redirect";
import { SESSION_COOKIE_NAMES } from "@/lib/session-cookie";

/** Persist `?ref=` on any page response — survives auth redirects before sign-up. */
function withReferralCapture(
	req: NextRequest,
	res: NextResponse,
): NextResponse {
	applyReferralCookieToResponse(res, req.nextUrl.searchParams.get("ref"));
	return res;
}

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
	"/quotes",
	"/chat",
	"/me",
	"/achievements",
	"/notifications",
];

export function proxy(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// `/api/*` rewrites run here so explicit Next route handlers win over Elysia.
	if (pathname.startsWith("/api/")) {
		if (isNextHandledApiPath(pathname)) {
			return NextResponse.next();
		}
		const upstream = new URL(
			`${pathname}${req.nextUrl.search}`,
			resolveApiRewriteOrigin(),
		);
		return NextResponse.rewrite(upstream);
	}

	const catalogueRedirect = retiredCatalogueRedirectUrl(
		pathname,
		req.nextUrl.search,
	);
	if (catalogueRedirect) {
		const url = req.nextUrl.clone();
		const target = new URL(catalogueRedirect, req.nextUrl.origin);
		url.pathname = target.pathname;
		url.search = target.search;
		return withReferralCapture(req, NextResponse.redirect(url));
	}

	const hasSession = SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));

	if (
		PROTECTED_PREFIXES.some((p) => {
			// `/me` must not match `/members` — use boundary after the prefix.
			if (p === "/me") {
				return pathname === "/me" || pathname.startsWith("/me/");
			}
			return pathname === p || pathname.startsWith(`${p}/`);
		}) &&
		!hasSession
	) {
		const url = req.nextUrl.clone();
		url.pathname = "/sign-in";
		url.searchParams.set("from", pathname);
		return withReferralCapture(req, NextResponse.redirect(url));
	}
	// Do not redirect `/sign-in` → `/home` on cookie presence alone: after account
	// deletion (or ban/revoke) the token can remain in the browser while the
	// session is invalid server-side, which produced `/home` ⇄ `/sign-in` loops.
	// Auth routes use `AuthSessionRedirect` for valid sessions instead.
	const requestHeaders = new Headers(req.headers);
	requestHeaders.set("x-still-pathname", pathname);
	return withReferralCapture(
		req,
		NextResponse.next({
			request: { headers: requestHeaders },
		}),
	);
}

export const config = {
	matcher: [
		"/api/:path*",
		/*
		 * App pages (exclude static assets). `/api` is matched above so taste-hero
		 * media routes can stay on Next instead of the catch-all Elysia rewrite.
		 */
		"/((?!_next/static|_next/image|favicon.ico|.*\\.).*)",
	],
};

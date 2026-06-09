/**
 * When calling better-auth `auth.api.*` from a custom Elysia route (not the
 * `/api/auth/*` pass-through), session-changing endpoints set cookies on an
 * internal `Headers` object. Forward those `Set-Cookie` values onto the
 * outgoing HTTP response so the browser actually receives the new session.
 */
/** Elysia `set.headers` allows numeric header values; we only write strings. */
type OutgoingHeaderBag = Record<string, string | string[] | undefined | number>;

export function forwardAuthSetCookies(
	set: { headers: OutgoingHeaderBag },
	authHeaders: Headers | undefined,
): void {
	if (!authHeaders) return;
	const cookies =
		typeof authHeaders.getSetCookie === "function"
			? authHeaders.getSetCookie()
			: [];
	if (cookies.length === 0) {
		const single = authHeaders.get("set-cookie");
		if (single) cookies.push(single);
	}
	if (cookies.length > 0) {
		set.headers["set-cookie"] = cookies;
	}
}

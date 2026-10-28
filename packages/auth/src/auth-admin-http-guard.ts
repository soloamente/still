/**
 * Sense staff mutations (ban / unban / set-role) live on `/api/staff` and
 * enforce `outranks`. Better Auth's admin plugin also mounts the same
 * mutations at `/api/auth/admin/*` with permission checks only — so an Admin
 * could ban an Owner via the native path. Block those HTTP endpoints; server
 * code still uses `auth.api.banUser` / `setRole` / `unbanUser` (not this HTTP
 * surface).
 */

/** Pathname suffixes under `/api/auth` that must not be reachable over HTTP. */
export const BLOCKED_AUTH_ADMIN_HTTP_PATHS = [
	"/admin/ban-user",
	"/admin/unban-user",
	"/admin/set-role",
] as const;

export type BlockedAuthAdminHttpPath =
	(typeof BLOCKED_AUTH_ADMIN_HTTP_PATHS)[number];

/**
 * Returns the blocked admin suffix when `pathname` is a Better Auth admin
 * mutation we refuse over HTTP; otherwise `null`.
 */
export function matchBlockedAuthAdminHttpPath(
	pathname: string,
): BlockedAuthAdminHttpPath | null {
	// Better Auth basePath is `/api/auth`; plugin routes are `/admin/...`.
	const authBase = "/api/auth";
	if (!pathname.startsWith(authBase)) return null;
	const rest = pathname.slice(authBase.length);
	// Normalize trailing slash so `/api/auth/admin/ban-user/` still matches.
	const normalized =
		rest.endsWith("/") && rest.length > 1 ? rest.slice(0, -1) : rest;
	for (const blocked of BLOCKED_AUTH_ADMIN_HTTP_PATHS) {
		if (normalized === blocked) return blocked;
	}
	return null;
}

/** JSON 403 used when a blocked admin HTTP path is hit. */
export function blockedAuthAdminHttpResponse(
	path: BlockedAuthAdminHttpPath,
): Response {
	return new Response(
		JSON.stringify({
			error: "FORBIDDEN",
			message:
				"Use Sense staff API (/api/staff) for ban, unban, and set-role — native Better Auth admin HTTP is disabled so outranks always applies.",
			path,
		}),
		{
			status: 403,
			headers: { "content-type": "application/json; charset=utf-8" },
		},
	);
}

/**
 * If the request targets a blocked admin mutation, return the 403 Response;
 * otherwise return `null` so the caller can pass through to `auth.handler`.
 */
export function maybeBlockAuthAdminHttp(request: Request): Response | null {
	if (request.method !== "POST") return null;
	const { pathname } = new URL(request.url);
	const blocked = matchBlockedAuthAdminHttpPath(pathname);
	if (!blocked) return null;
	return blockedAuthAdminHttpResponse(blocked);
}

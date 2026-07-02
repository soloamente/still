/**
 * Paths implemented as Next.js Route Handlers under `app/api/.../route.ts`.
 * Keep in sync when adding new explicit API routes on the web app.
 */
export function isNextHandledApiPath(pathname: string): boolean {
	if (
		pathname === "/api/import/anilist" ||
		pathname === "/api/import/letterboxd"
	) {
		return true;
	}
	if (/^\/api\/movies\/\d+\/(title-logo|trailer)$/.test(pathname)) {
		return true;
	}
	if (
		pathname === "/api/profiles/me/avatar" ||
		pathname === "/api/profiles/me/banner"
	) {
		return true;
	}
	if (
		pathname === "/api/realtime/dev-relay" ||
		pathname === "/api/realtime/stream"
	) {
		return true;
	}
	if (/^\/api\/reviews\/[^/]+\/audio$/.test(pathname)) {
		return true;
	}
	return false;
}

/** Elysia host for `/api/*` proxy — mirrors `next.config.ts` / `api-upstream-origin.ts`. */
export function resolveApiRewriteOrigin(): string {
	const explicit = process.env.API_REWRITE_ORIGIN?.trim();
	if (explicit) return explicit;

	const publicUrl = process.env.NEXT_PUBLIC_SERVER_URL?.trim();
	if (!publicUrl) return "http://localhost:3000";

	// Local dev: web :3001, Elysia :3000.
	if (process.env.NODE_ENV !== "production" && publicUrl.includes(":3001")) {
		return publicUrl.replace(":3001", ":3000");
	}
	return publicUrl;
}

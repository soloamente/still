import "server-only";

import { env } from "@still/env/web";

/**
 * Elysia host for server-side `/api/*` forwards from Next route handlers.
 * Mirrors `apiRewriteOrigin` in `next.config.ts` — must not loop back to the
 * web dev port when `NEXT_PUBLIC_SERVER_URL` is the browser origin (3001).
 */
export function apiUpstreamOrigin(): string {
	const explicit = process.env.API_REWRITE_ORIGIN?.trim();
	if (explicit) return explicit;

	const publicUrl = env.NEXT_PUBLIC_SERVER_URL;
	// Local dev: web is :3001, Elysia is :3000 — avoid looping when only the web URL is set.
	if (process.env.NODE_ENV !== "production" && publicUrl.includes(":3001")) {
		return publicUrl.replace(":3001", ":3000");
	}
	return publicUrl;
}

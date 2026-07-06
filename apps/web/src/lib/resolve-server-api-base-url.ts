import { env } from "@still/env/web";

import { apiUpstreamOrigin } from "@/lib/api-upstream-origin";
import { webAppOriginFromHeaders } from "@/lib/auth-request-origin";

/** Minimal header bag from `next/headers` `headers()`. */
type RequestHeaderBag = {
	get(name: string): string | null;
};

/**
 * Eden base URL for RSC — must match {@link authServer} cookie host in production
 * (`x-forwarded-host`), not a stale `NEXT_PUBLIC_SERVER_URL` alias (www vs apex).
 * Local split dev still hits Elysia on :3000 directly.
 */
export function resolveServerApiBaseUrl(
	requestHeaders: RequestHeaderBag,
): string {
	const publicUrl = env.NEXT_PUBLIC_SERVER_URL;
	const upstream = apiUpstreamOrigin();
	// Split dev: Next on :3001, Elysia on :3000 — direct upstream with forwarded cookies.
	if (
		process.env.NODE_ENV !== "production" &&
		publicUrl.includes(":3001") &&
		upstream !== publicUrl
	) {
		return upstream;
	}
	// Prod (and unified dev): same origin as the browser so session cookies apply.
	return webAppOriginFromHeaders(requestHeaders);
}

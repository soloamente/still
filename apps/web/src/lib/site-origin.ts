import { env } from "@still/env/web";

import {
	type RequestHeaderBag,
	webAppOriginFromHeaders,
} from "@/lib/web-app-origin-from-headers";

/**
 * Canonical web origin for sitemap, robots, and OG absolute URLs.
 *
 * Prefer the incoming request host in production so link previews stay on the
 * Next.js app even when `NEXT_PUBLIC_SERVER_URL` still points at the API host.
 */
export function getSiteOrigin(requestHeaders?: RequestHeaderBag): string {
	if (requestHeaders) {
		return webAppOriginFromHeaders(requestHeaders);
	}
	return new URL(env.NEXT_PUBLIC_SERVER_URL).origin;
}

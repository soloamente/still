import "server-only";

import { env } from "@still/env/web";

/** Minimal header bag from `next/headers` `headers()`. */
type RequestHeaderBag = {
	get(name: string): string | null;
};

/**
 * Canonical browser origin for the web app (e.g. `https://still.vercel.app`).
 * Better Auth session cookies must be read and set on this host — not on the
 * standalone API deployment — so RSC and `proxy.ts` see the same cookies.
 */
export function webAppOriginFromHeaders(h: RequestHeaderBag): string {
	const host = h.get("x-forwarded-host") ?? h.get("host");
	if (!host) {
		return env.NEXT_PUBLIC_SERVER_URL;
	}
	const proto =
		h.get("x-forwarded-proto") ??
		(host.startsWith("localhost") ? "http" : "https");
	return `${proto}://${host}`;
}

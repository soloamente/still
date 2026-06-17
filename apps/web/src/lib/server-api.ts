import "server-only";

import { createClient } from "@still/api-client";
import { cookies } from "next/headers";
import { apiUpstreamOrigin } from "@/lib/api-upstream-origin";

/**
 * RSC-safe factory. Forwards the visitor's Better Auth cookie so the
 * server route resolves the same session as the page. Always call inside
 * a Server Component or route handler — never from a client module.
 *
 * Uses `apiUpstreamOrigin()` (Elysia on :3000 in dev) — not the browser/web
 * origin — so server-side Eden calls do not loop through Next rewrites.
 */
export async function serverApi() {
	const store = await cookies();
	const cookieHeader = store
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");
	return createClient({
		baseURL: apiUpstreamOrigin(),
		headers: cookieHeader ? { cookie: cookieHeader } : undefined,
		// Next can cache GETs across origins by default; movie detail must reflect latest `tmdbJson` after enrichment.
		fetcher: ((input, init) =>
			fetch(input, { ...init, cache: "no-store" })) as typeof fetch,
	});
}

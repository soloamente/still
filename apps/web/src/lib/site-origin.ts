import { env } from "@still/env/web";

/** Canonical web origin for sitemap, robots, and OG absolute URLs. */
export function getSiteOrigin(): string {
	return new URL(env.NEXT_PUBLIC_SERVER_URL).origin;
}

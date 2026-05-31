import "server-only";

import { env } from "@still/env/web";

export type SitemapListEntry = {
	id: string;
	updatedAt: string;
};

/** Public lists eligible for SEO indexing (`GET /api/lists/sitemap`). */
export async function fetchSitemapLists(): Promise<SitemapListEntry[]> {
	const url = new URL("/api/lists/sitemap", env.NEXT_PUBLIC_SERVER_URL);
	url.searchParams.set("limit", "2000");

	const res = await fetch(url, {
		next: { revalidate: 3600 },
	});
	if (!res.ok) return [];

	const payload = (await res.json()) as { entries?: SitemapListEntry[] };
	return payload.entries ?? [];
}

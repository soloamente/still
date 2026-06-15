import type { MetadataRoute } from "next";

import { fetchJournalSitemapEntries } from "@/lib/fetch-journal";
import { fetchSitemapLists } from "@/lib/fetch-sitemap-lists";
import { getSiteOrigin } from "@/lib/site-origin";

/** Regenerate sitemap hourly — public list corpus changes slowly. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const origin = getSiteOrigin();
	const lists = await fetchSitemapLists();
	const journalPosts = await fetchJournalSitemapEntries();

	const staticRoutes: MetadataRoute.Sitemap = [
		{
			url: origin,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 1,
		},
		{
			url: `${origin}/sign-up`,
			changeFrequency: "monthly",
			priority: 0.5,
		},
		{
			url: `${origin}/journal`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.8,
		},
	];

	const listRoutes: MetadataRoute.Sitemap = lists.map((row) => ({
		url: `${origin}/l/${row.id}`,
		lastModified: new Date(row.updatedAt),
		changeFrequency: "weekly" as const,
		priority: 0.7,
	}));

	const journalRoutes: MetadataRoute.Sitemap = journalPosts.map((row) => ({
		url: `${origin}/journal/${row.slug}`,
		lastModified: new Date(row.updatedAt),
		changeFrequency: "monthly" as const,
		priority: 0.75,
	}));

	return [...staticRoutes, ...listRoutes, ...journalRoutes];
}

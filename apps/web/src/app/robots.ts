import type { MetadataRoute } from "next";

import { getSiteOrigin } from "@/lib/site-origin";

/**
 * Crawlers may index marketing home + public list pages (`/l/`).
 * Authenticated app shells stay out of the index.
 */
export default function robots(): MetadataRoute.Robots {
	const origin = getSiteOrigin();

	return {
		rules: {
			userAgent: "*",
			// Explicit allow for link-preview crawlers — they must fetch `/og/*` images
			// and shareable detail HTML even when those paths also appear in disallow.
			allow: [
				"/",
				"/l/",
				"/og/",
				"/movies/",
				"/tv/",
				"/profile/",
				"/people/",
				"/compare/",
			],
			disallow: [
				"/api/",
				"/home",
				"/diary",
				"/watchlist",
				"/lists/",
				"/movies/",
				"/tv/",
				"/profile/",
				"/achievements",
				"/notifications",
				"/chat",
				"/news",
				"/changelog",
				"/people/",
				"/me/",
				"/onboarding",
			],
		},
		sitemap: `${origin}/sitemap.xml`,
	};
}

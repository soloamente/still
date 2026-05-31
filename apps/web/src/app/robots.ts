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
			allow: ["/", "/l/"],
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
				"/people/",
				"/me/",
				"/onboarding",
				"/og/",
			],
		},
		sitemap: `${origin}/sitemap.xml`,
	};
}

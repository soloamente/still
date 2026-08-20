/** Popular-list row — only the poster fields the landing hero well reads. */
export interface LandingHeroPosterSource {
	poster_url?: string | null;
	title?: string | null;
}

export interface LandingHeroPoster {
	posterUrl: string;
	title: string;
}

/** Spiral cycles many slots — prefer a full popular page of distinct posters. */
const DEFAULT_HERO_POSTER_LIMIT = 20;

/** Up to `limit` posters with a non-empty URL. Never use backdrops. */
export function pickLandingHeroPosters(
	results:
		| readonly (LandingHeroPosterSource | null | undefined)[]
		| null
		| undefined,
	limit = DEFAULT_HERO_POSTER_LIMIT,
): LandingHeroPoster[] {
	if (!results?.length || limit <= 0) return [];
	const picked: LandingHeroPoster[] = [];
	for (const row of results) {
		const posterUrl = row?.poster_url?.trim();
		if (!posterUrl) continue;
		picked.push({
			posterUrl,
			title: row?.title?.trim() ?? "",
		});
		if (picked.length >= limit) break;
	}
	return picked;
}

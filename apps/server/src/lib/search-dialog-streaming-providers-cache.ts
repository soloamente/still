import { BoundedTtlCache } from "./bounded-ttl-cache";
import { tmdbApi, tmdbImg } from "./tmdb";

export type SearchDialogStreamingProviderRow = {
	id: number;
	name: string;
	logo_url: string | null;
};

/** TMDb flatrate catalogue for one territory — cached six hours. */
const providersCache = new BoundedTtlCache<SearchDialogStreamingProviderRow[]>(
	6 * 60 * 60 * 1000,
	64,
);

function cacheKey(region: string, language: string): string {
	return `${region.toUpperCase()}|${language}`;
}

/** `/watch/providers/movie` — subscription platforms available in `region`. */
export async function fetchSearchDialogStreamingProvidersCached(
	region: string,
	language = "en-US",
): Promise<SearchDialogStreamingProviderRow[]> {
	const code = region.trim().toUpperCase();
	if (!/^[A-Z]{2}$/.test(code)) return [];

	const key = cacheKey(code, language);
	const hit = providersCache.get(key);
	if (hit) return hit;

	const data = await tmdbApi.watchProvidersMovieList(code, { language });
	const rows = (data.results ?? [])
		.map((row) => {
			const id = Number(row.provider_id);
			const name = row.provider_name?.trim() ?? "";
			if (!Number.isFinite(id) || id < 1 || !name) return null;
			return {
				id: Math.trunc(id),
				name,
				logo_url: tmdbImg.logo(row.logo_path, "w92"),
			};
		})
		.filter((row): row is SearchDialogStreamingProviderRow => row !== null)
		.sort((a, b) => a.name.localeCompare(b.name));

	providersCache.set(key, rows);
	return rows;
}

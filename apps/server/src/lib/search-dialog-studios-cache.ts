import { BoundedTtlCache } from "./bounded-ttl-cache";
import { SEARCH_DIALOG_STUDIO_IDS } from "./search-dialog-studio-ids";
import { tmdbApi, tmdbImg } from "./tmdb";

export type SearchDialogStudioRow = {
	id: number;
	name: string;
	logo_url: string | null;
};

/** One cached payload for the whole rail — refreshed every six hours. */
const studiosCache = new BoundedTtlCache<SearchDialogStudioRow[]>(
	6 * 60 * 60 * 1000,
	2,
);

const CACHE_KEY = "search-dialog-studios:v1";

/** Hydrate curated studios from TMDb company endpoints (cached). */
export async function fetchSearchDialogStudiosCached(): Promise<
	SearchDialogStudioRow[]
> {
	const hit = studiosCache.get(CACHE_KEY);
	if (hit) return hit;

	const studios = await Promise.all(
		SEARCH_DIALOG_STUDIO_IDS.map(async (id) => {
			try {
				const row = await tmdbApi.company(id);
				return {
					id,
					name: row.name,
					logo_url: tmdbImg.logo(row.logo_path, "w92"),
				};
			} catch {
				return { id, name: String(id), logo_url: null as string | null };
			}
		}),
	);

	studiosCache.set(CACHE_KEY, studios);
	return studios;
}

import { serverApi } from "@/lib/server-api";

type PopularRow = { backdrop_url?: string | null; poster_url?: string | null };

type ListingRow = {
	backdrop_url?: string | null;
	poster_url?: string | null;
};

/** First popular film with usable backdrop (home / landing OG). */
export async function fetchOgHomeBackdropUrl(): Promise<string | null> {
	try {
		const api = await serverApi();
		const res = await api.api.movies.popular.get();
		const results = (res.data as { results?: PopularRow[] } | null)?.results;
		for (const row of results ?? []) {
			const url = row.backdrop_url ?? row.poster_url;
			if (url) return url;
		}
	} catch {
		// Fall through to branded default OG card.
	}
	return null;
}

/** Movie detail backdrop for title OG (poster when no backdrop). */
export async function fetchOgMovieBackdropUrl(
	id: string,
): Promise<string | null> {
	try {
		const api = await serverApi();
		const res = await api.api.movies({ id }).get();
		const data = res.data as ListingRow | null;
		return data?.backdrop_url ?? data?.poster_url ?? null;
	} catch {
		return null;
	}
}

/** TV detail backdrop for title OG (poster when no backdrop). */
export async function fetchOgTvBackdropUrl(id: string): Promise<string | null> {
	try {
		const api = await serverApi();
		const res = await api.api.tv({ id }).get();
		const data = res.data as ListingRow | null;
		return data?.backdrop_url ?? data?.poster_url ?? null;
	} catch {
		return null;
	}
}

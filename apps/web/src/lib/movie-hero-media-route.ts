import "server-only";

import { serverApi } from "@/lib/server-api";

/**
 * Load cached TMDb JSON via `GET /api/movies/:id` — works on production even when
 * the lightweight `/title-logo` and `/trailer` sub-routes are missing on the API deploy.
 */
export async function fetchMovieDetailTmdbJson(
	movieId: string,
): Promise<Record<string, unknown> | null | undefined> {
	const id = movieId.trim();
	if (!/^\d+$/.test(id)) return null;

	try {
		const api = await serverApi();
		const res = await api.api.movies({ id }).get();
		const data = res.data;
		// Eden types include an adult-blocked stub without `tmdbJson`.
		if (!data || !("tmdbJson" in data)) return null;
		const tmdbJson = data.tmdbJson;
		if (!tmdbJson || typeof tmdbJson !== "object") return null;
		return tmdbJson as Record<string, unknown>;
	} catch {
		return null;
	}
}

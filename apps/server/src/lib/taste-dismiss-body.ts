export type TasteDismissTarget =
	| { media: "movie"; tmdbId: number }
	| { media: "tv"; tmdbId: number };

/** Positive integer TMDb ids only — zero and floats are invalid. */
function positiveId(value: unknown): number | null {
	return typeof value === "number" && Number.isInteger(value) && value > 0
		? value
		: null;
}

/**
 * Dismiss body accepts exactly one of movieTmdbId or tvTmdbId.
 * Both, neither, or a non-positive id is invalid.
 */
export function parseTasteDismissBody(body: {
	movieTmdbId?: unknown;
	tvTmdbId?: unknown;
}): TasteDismissTarget | null {
	const movieTmdbId = positiveId(body.movieTmdbId);
	const tvTmdbId = positiveId(body.tvTmdbId);
	if (movieTmdbId != null && tvTmdbId != null) return null;
	if (movieTmdbId != null) return { media: "movie", tmdbId: movieTmdbId };
	if (tvTmdbId != null) return { media: "tv", tmdbId: tvTmdbId };
	return null;
}

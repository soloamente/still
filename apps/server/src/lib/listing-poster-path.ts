/**
 * Resolve a TMDb poster path from the flattened column or cached detail JSON.
 * Profile filmography joins `movie`/`tv` without hitting TMDb — rows logged via
 * import or minimal cache can have `posterPath = null` while `tmdb_json` still
 * carries `poster_path`, or detail pages refresh the column on first visit.
 */
export function resolveListingPosterPath(
	posterPath: string | null | undefined,
	tmdbJson: unknown,
): string | null {
	if (posterPath?.length) return posterPath;
	const json = tmdbJson as { poster_path?: string | null } | null | undefined;
	const fromJson = json?.poster_path;
	return fromJson?.length ? fromJson : null;
}

/** Movie or TV listing for a diary row — used to bust the community score cache. */
export function listingCommunityStatsRefFromLog(row: {
	movieId: number | null;
	tvId: number | null;
}): { movieId: number } | { tvId: number } | null {
	if (row.movieId != null) return { movieId: row.movieId };
	if (row.tvId != null) return { tvId: row.tvId };
	return null;
}

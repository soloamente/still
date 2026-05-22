/**
 * Ordered movie ids for list cover strips — pinned `coverMovieId` first when set.
 */
export function listDisplayCoverMovieIds(row: {
	coverMovieIds: number[];
	coverMovieId?: number | null;
}): number[] {
	const pinned = row.coverMovieId;
	if (pinned == null) return row.coverMovieIds;
	const rest = row.coverMovieIds.filter((id) => id !== pinned);
	return [pinned, ...rest].slice(0, 4);
}

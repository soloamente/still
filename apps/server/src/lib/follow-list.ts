/**
 * Annotates follower/following rows with whether the viewer already follows
 * each listed user, given the set of ids the viewer follows. Pure so the
 * drawer's per-row button state is unit-testable without a DB.
 */
export function annotateViewerFollows<T extends { userId: string }>(
	rows: T[],
	followingIds: Set<string>,
): (T & { viewerFollows: boolean })[] {
	return rows.map((row) => ({
		...row,
		viewerFollows: followingIds.has(row.userId),
	}));
}

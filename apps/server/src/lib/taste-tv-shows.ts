export const TV_TASTE_MIN_SHOWS = 10;

export function distinctTvShowIds(
	rows: readonly { tvId: number | null }[],
): number[] {
	const ids = new Set<number>();
	for (const row of rows) {
		if (row.tvId != null) ids.add(row.tvId);
	}
	return [...ids];
}

export function newestTvLogPerShow<
	T extends { tvId: number | null; watchedAt: Date | string },
>(rows: readonly T[]): T[] {
	const best = new Map<number, T>();
	for (const row of rows) {
		if (row.tvId == null) continue;
		const prev = best.get(row.tvId);
		if (!prev) {
			best.set(row.tvId, row);
			continue;
		}
		const prevAt = new Date(prev.watchedAt).getTime();
		const nextAt = new Date(row.watchedAt).getTime();
		if (nextAt >= prevAt) best.set(row.tvId, row);
	}
	return [...best.values()];
}

export function tvTasteIsColdStart(distinctShowCount: number): boolean {
	return distinctShowCount < TV_TASTE_MIN_SHOWS;
}

/**
 * Logged show ids for taste exclusion.
 * `loggedShowIds` is every distinct diary show. `recentWindowShowIds` is only
 * the latest profile window (the newest 400 TV logs). A show that is logged
 * but absent from that window stays in the result — the window must not
 * shrink the exclude set.
 */
export function loggedShowIdsForTasteExclude(input: {
	loggedShowIds: readonly number[];
	recentWindowShowIds: readonly number[];
}): number[] {
	return [...new Set([...input.loggedShowIds, ...input.recentWindowShowIds])];
}

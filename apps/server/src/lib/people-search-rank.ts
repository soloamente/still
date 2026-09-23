/** Rank key for TMDb person rows — Sense search hits beat TMDb popularity. */
export type PersonSearchRankable = {
	id: number;
	popularity?: number;
};

/**
 * Sort people so the most-searched on Sense lead. TMDb popularity is only a
 * tie-breaker (and the whole order when nobody has been searched yet).
 */
export function rankPeopleBySearchTraffic<T extends PersonSearchRankable>(
	rows: readonly T[],
	trafficById: ReadonlyMap<number, number>,
): T[] {
	return [...rows].sort((a, b) => {
		const hitDelta =
			(trafficById.get(b.id) ?? 0) - (trafficById.get(a.id) ?? 0);
		if (hitDelta !== 0) return hitDelta;
		return (b.popularity ?? 0) - (a.popularity ?? 0);
	});
}

/**
 * Viewer favorites float above everyone else; within each band, `thenRank`
 * (usually traffic) decides order. Empty favorites → just `thenRank(rows)`.
 */
export function rankPeopleFavoritesFirst<T extends { id: number }>(
	rows: readonly T[],
	favoritedIds: ReadonlySet<number>,
	thenRank: (rows: readonly T[]) => T[],
): T[] {
	if (favoritedIds.size === 0) return thenRank(rows);
	const favorites: T[] = [];
	const others: T[] = [];
	for (const row of rows) {
		if (favoritedIds.has(row.id)) favorites.push(row);
		else others.push(row);
	}
	return [...thenRank(favorites), ...thenRank(others)];
}

/** Empty-search rail: Sense traffic leaders first, then unique TMDb popular. */
export function mergeTrafficLedPeople<T extends { id: number }>(
	trafficLeaders: readonly T[],
	tmdbFallback: readonly T[],
	limit: number,
): T[] {
	const seen = new Set<number>();
	const out: T[] = [];
	for (const row of [...trafficLeaders, ...tmdbFallback]) {
		if (seen.has(row.id)) continue;
		seen.add(row.id);
		out.push(row);
		if (out.length >= limit) break;
	}
	return out;
}

/**
 * Client-side parsing for `?providers=` on `/watchlist` — mirrors the server
 * AND-filter contract (`apps/server/src/lib/watchlist-provider-filter.ts`).
 */

/** Parse `?providers=8,350` — positive TMDb ids, deduped, sorted ascending. */
export function parseWatchlistProviderIds(
	raw: string | null | undefined,
): number[] {
	if (raw == null || raw.trim() === "") return [];
	const ids = new Set<number>();
	for (const part of raw.split(",")) {
		const trimmed = part.trim();
		if (!trimmed) continue;
		const n = Number(trimmed);
		if (!Number.isFinite(n) || n < 1) continue;
		ids.add(Math.trunc(n));
	}
	return [...ids].sort((a, b) => a - b);
}

/** Stable comma list for query strings (sorted ascending). */
export function formatWatchlistProviderQuery(ids: readonly number[]): string {
	return [...ids].sort((a, b) => a - b).join(",");
}

/** Optimistic provider chip state — sorted id lists compared element-wise. */
export function watchlistProviderIdsEqual(
	a: readonly number[],
	b: readonly number[],
): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i += 1) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

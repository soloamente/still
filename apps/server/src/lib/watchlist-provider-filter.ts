import {
	flatrateProvidersForRegion,
	watchProvidersFromTmdbJson,
} from "./watchlist-streaming-alerts";

/**
 * Parse `?providers=8,350` — positive TMDb provider ids, deduped, sorted ascending.
 * Invalid tokens are dropped; empty input → no filter.
 */
export function parseWatchlistProviderIds(
	raw: string | undefined | null,
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

/**
 * True when the listing flatrates on **every** requested provider in the patron region.
 * Used for the composite streaming pill (AND semantics).
 */
export function titleFlatrateIncludesAllProviders(
	tmdbJson: unknown,
	region: string,
	providerIds: readonly number[],
): boolean {
	if (providerIds.length === 0) return true;
	const available = new Set(
		flatrateProvidersForRegion(
			watchProvidersFromTmdbJson(tmdbJson),
			region,
		).map((ref) => ref.providerId),
	);
	for (const id of providerIds) {
		if (!available.has(id)) return false;
	}
	return true;
}

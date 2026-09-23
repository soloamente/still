import { db, movie, tv, watchlistItem } from "@still/db";
import { desc, eq, type SQL } from "drizzle-orm";

import { BoundedTtlCache } from "./bounded-ttl-cache";
import { watchlistProvidersTmdbJsonForRegion } from "./watchlist-lobby-tmdb-json";
import {
	type TmdbWatchProviderRow,
	watchProvidersFromTmdbJson,
} from "./watchlist-streaming-alerts";

/** One entry in the platform logo row — sorted by `titleCount` descending. */
export type WatchlistProviderCatalogueEntry = {
	providerId: number;
	providerName: string;
	logoPath: string | null;
	titleCount: number;
};

/** Same pool cap as decision-engine ranking — catalogue is an approximate scan. */
const CATALOGUE_POOL_LIMIT = 500;

const CATALOGUE_CACHE_TTL_MS = 60_000;
const CATALOGUE_CACHE_MAX_ENTRIES = 500;

const catalogueCache = new BoundedTtlCache<WatchlistProviderCatalogueEntry[]>(
	CATALOGUE_CACHE_TTL_MS,
	CATALOGUE_CACHE_MAX_ENTRIES,
);

export function watchlistProviderCatalogueCacheKey(args: {
	userId: string;
	region: string;
	showAdultContent: boolean;
}): string {
	return `${args.userId}|${args.region}|${args.showAdultContent ? 1 : 0}`;
}

/** Drop cached provider rows after watchlist mutations. */
export function invalidateWatchlistProviderCatalogue(userId: string): void {
	catalogueCache.deletePrefix(`${userId}|`);
}

/** Flatrate rows for one region — keeps `logo_path` for the platform row UI. */
function flatrateRowsForRegion(
	tmdbJson: unknown,
	region: string,
): readonly TmdbWatchProviderRow[] {
	const country =
		watchProvidersFromTmdbJson(tmdbJson)?.[region.trim().toUpperCase()];
	return country?.flatrate ?? [];
}

/**
 * Pure aggregate: how many visible watchlist titles include each flatrate
 * provider in the patron region (at most one count per provider per title).
 */
export function aggregateWatchlistProviderCatalogue(
	rows: readonly { tmdbJson: unknown }[],
	region: string,
): WatchlistProviderCatalogueEntry[] {
	const tallies = new Map<
		number,
		{ providerName: string; logoPath: string | null; titleCount: number }
	>();

	for (const row of rows) {
		const seenOnTitle = new Set<number>();
		for (const providerRow of flatrateRowsForRegion(row.tmdbJson, region)) {
			if (!Number.isFinite(providerRow.provider_id)) continue;
			const providerId = Math.trunc(providerRow.provider_id);
			if (seenOnTitle.has(providerId)) continue;
			seenOnTitle.add(providerId);

			const providerName = providerRow.provider_name?.trim();
			if (!providerName) continue;

			const logoPath =
				typeof providerRow.logo_path === "string" &&
				providerRow.logo_path.trim() !== ""
					? providerRow.logo_path.trim()
					: null;

			const existing = tallies.get(providerId);
			if (existing) {
				existing.titleCount += 1;
				if (!existing.logoPath && logoPath) existing.logoPath = logoPath;
			} else {
				tallies.set(providerId, {
					providerName,
					logoPath,
					titleCount: 1,
				});
			}
		}
	}

	return [...tallies.entries()]
		.map(([providerId, meta]) => ({
			providerId,
			providerName: meta.providerName,
			logoPath: meta.logoPath,
			titleCount: meta.titleCount,
		}))
		.sort(
			(a, b) =>
				b.titleCount - a.titleCount ||
				a.providerName.localeCompare(b.providerName),
		);
}

/**
 * Load distinct streaming providers for the patron's saves (recent pool),
 * cached 60s per user + region + adult-content flag.
 */
export async function loadWatchlistProviderCatalogue(args: {
	userId: string;
	region: string;
	showAdultContent: boolean;
	whereClause: SQL | undefined;
}): Promise<WatchlistProviderCatalogueEntry[]> {
	const key = watchlistProviderCatalogueCacheKey({
		userId: args.userId,
		region: args.region,
		showAdultContent: args.showAdultContent,
	});
	const cached = catalogueCache.get(key);
	if (cached) return cached;

	const pool = await db
		.select({
			tmdbJson: watchlistProvidersTmdbJsonForRegion(args.region),
		})
		.from(watchlistItem)
		.leftJoin(movie, eq(watchlistItem.movieId, movie.tmdbId))
		.leftJoin(tv, eq(watchlistItem.tvId, tv.tmdbId))
		.where(args.whereClause)
		.orderBy(desc(watchlistItem.addedAt))
		.limit(CATALOGUE_POOL_LIMIT);

	const providers = aggregateWatchlistProviderCatalogue(pool, args.region);
	catalogueCache.set(key, providers);
	return providers;
}

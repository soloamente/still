import { fetchPublicDiaryCommunityStats } from "./fetch-public-diary-community-stats";
import type { ListingEngagementListingRef } from "./listing-community-stats";
import { fetchListingCommunityEngagementStats } from "./listing-community-stats";
import { getRealtimeRedis } from "./realtime-redis";

const TTL_SECONDS = 300; // 5 minutes

function communityStatsKey(
	ref: { movieId: number } | { tvId: number },
): string {
	return "tvId" in ref
		? `sense:community:tv:${ref.tvId}`
		: `sense:community:movie:${ref.movieId}`;
}

export async function fetchCachedListingCommunityStats(
	ref: ListingEngagementListingRef,
) {
	const redis = getRealtimeRedis();

	if (redis) {
		const key = communityStatsKey(ref);
		try {
			const cached = await redis.get<Record<string, unknown>>(key);
			if (cached) {
				return {
					averageRating: (cached.averageRating as number | null) ?? null,
					ratingsCount: (cached.ratingsCount as number) ?? 0,
					watchesCount: (cached.watchesCount as number) ?? 0,
					listsCount: (cached.listsCount as number) ?? 0,
					favoritesCount: (cached.favoritesCount as number) ?? 0,
					watchlistCount: (cached.watchlistCount as number) ?? 0,
				};
			}
		} catch {
			// Redis unavailable — fall through to DB
		}
	}

	const [ratings, engagement] = await Promise.all([
		fetchPublicDiaryCommunityStats(ref),
		fetchListingCommunityEngagementStats(ref),
	]);

	const result = { ...ratings, ...engagement };

	if (redis) {
		const key = communityStatsKey(ref);
		try {
			await redis.set(key, result, { ex: TTL_SECONDS });
		} catch {
			// best-effort
		}
	}

	return result;
}

/** Invalidate cached community stats when a user logs/rates/watchlists a title. */
export async function invalidateListingCommunityStatsCache(
	ref: ListingEngagementListingRef,
) {
	const redis = getRealtimeRedis();
	if (!redis) return;
	try {
		await redis.del(communityStatsKey(ref));
	} catch {
		// best-effort
	}
}

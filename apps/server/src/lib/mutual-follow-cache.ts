import { db, follow } from "@still/db";
import { and, eq } from "drizzle-orm";

import { cachedRead, cacheRedis, invalidateCache } from "./redis-cache";

/** TTL for a viewer's mutual-following set — short; also invalidated on follow change. */
export const MUTUAL_FOLLOW_CACHE_TTL_SEC = 60;

/** Redis key for a viewer's full set of mutual-following user ids. */
export function mutualFollowCacheKey(viewerId: string): string {
	return `cache:follow:mutual:${viewerId}`;
}

/**
 * All user ids the viewer mutually follows. Cached in Redis (read-through) so
 * the presence poll stops hitting Neon every ~20s. Callers filter this set
 * against the candidate ids they care about in memory.
 */
export async function fetchMutualFollowingIds(
	viewerId: string,
): Promise<string[]> {
	return cachedRead(
		await cacheRedis(),
		mutualFollowCacheKey(viewerId),
		MUTUAL_FOLLOW_CACHE_TTL_SEC,
		async () => {
			const rows = await db
				.select({ userId: follow.followingId })
				.from(follow)
				.where(and(eq(follow.followerId, viewerId), eq(follow.isMutual, true)));
			return rows.map((row) => row.userId);
		},
	);
}

/** Drop cached mutual sets for the affected users after a follow/unfollow. */
export async function invalidateMutualFollowCache(
	...userIds: string[]
): Promise<void> {
	await invalidateCache(
		await cacheRedis(),
		...userIds.map(mutualFollowCacheKey),
	);
}

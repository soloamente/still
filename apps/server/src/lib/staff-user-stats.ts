import { db, follow, list, log, review } from "@still/db";
import { and, count, eq, isNotNull, isNull, sql } from "drizzle-orm";

export type StaffUserActivityStats = {
	filmsLogged: number;
	reviewsCount: number;
	listsCount: number;
	followers: number;
	following: number;
};

/**
 * Live patron activity for staff user detail.
 * `profile.stats_cache` is not kept warm in v1 — staff needs accurate counts.
 */
export async function fetchStaffUserActivityStats(
	userId: string,
): Promise<StaffUserActivityStats> {
	const [[filmsRow], [reviewsRow], [listsRow], [followersRow], [followingRow]] =
		await Promise.all([
			db
				.select({
					c: sql<number>`count(distinct ${log.movieId})::int`,
				})
				.from(log)
				.where(
					and(
						eq(log.userId, userId),
						isNull(log.removedAt),
						isNotNull(log.movieId),
					),
				),
			db
				.select({ c: count(review.id) })
				.from(review)
				.where(and(eq(review.userId, userId), isNull(review.removedAt))),
			db
				.select({ c: count(list.id) })
				.from(list)
				.where(and(eq(list.userId, userId), isNull(list.removedAt))),
			db
				.select({ c: count(follow.followerId) })
				.from(follow)
				.where(eq(follow.followingId, userId)),
			db
				.select({ c: count(follow.followingId) })
				.from(follow)
				.where(eq(follow.followerId, userId)),
		]);

	return {
		filmsLogged: Number(filmsRow?.c ?? 0),
		reviewsCount: Number(reviewsRow?.c ?? 0),
		listsCount: Number(listsRow?.c ?? 0),
		followers: Number(followersRow?.c ?? 0),
		following: Number(followingRow?.c ?? 0),
	};
}

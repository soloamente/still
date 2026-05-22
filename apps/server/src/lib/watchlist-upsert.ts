import { db, watchlistItem } from "@still/db";
import { and, eq, isNotNull } from "drizzle-orm";

import { ensureMovieCached } from "./ensure-movie-cached";
import { ensureTvCached } from "./tv-cache";

type WatchlistFields = {
	note: string | null;
	priority: number;
};

/**
 * Partial unique indexes (`watchlist_user_movie_uk` / `watchlist_user_tv_uk`) cannot
 * be targeted by Drizzle `onConflictDoUpdate` — use select → update | insert instead.
 */
export async function upsertMovieWatchlistItem(
	userId: string,
	movieId: number,
	fields: WatchlistFields,
) {
	await ensureMovieCached(movieId);

	const [existing] = await db
		.select({ userId: watchlistItem.userId })
		.from(watchlistItem)
		.where(
			and(
				eq(watchlistItem.userId, userId),
				eq(watchlistItem.movieId, movieId),
				isNotNull(watchlistItem.movieId),
			),
		)
		.limit(1);

	if (existing) {
		const [row] = await db
			.update(watchlistItem)
			.set(fields)
			.where(
				and(
					eq(watchlistItem.userId, userId),
					eq(watchlistItem.movieId, movieId),
				),
			)
			.returning();
		return row;
	}

	const [row] = await db
		.insert(watchlistItem)
		.values({
			userId,
			movieId,
			tvId: null,
			...fields,
		})
		.returning();
	return row;
}

export async function upsertTvWatchlistItem(
	userId: string,
	tvId: number,
	fields: WatchlistFields,
) {
	await ensureTvCached(tvId);

	const [existing] = await db
		.select({ userId: watchlistItem.userId })
		.from(watchlistItem)
		.where(
			and(
				eq(watchlistItem.userId, userId),
				eq(watchlistItem.tvId, tvId),
				isNotNull(watchlistItem.tvId),
			),
		)
		.limit(1);

	if (existing) {
		const [row] = await db
			.update(watchlistItem)
			.set(fields)
			.where(
				and(eq(watchlistItem.userId, userId), eq(watchlistItem.tvId, tvId)),
			)
			.returning();
		return row;
	}

	const [row] = await db
		.insert(watchlistItem)
		.values({
			userId,
			movieId: null,
			tvId,
			...fields,
		})
		.returning();
	return row;
}

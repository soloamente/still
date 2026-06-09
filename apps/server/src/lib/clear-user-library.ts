import {
	db,
	eventLog,
	LIST_SYSTEM_KIND_FAVORITES,
	list,
	listItem,
	log,
	profile,
	tasteDismissedMovie,
	tvWatch,
	userAchievement,
	userBadge,
	userCompletionistChallenge,
	userStreak,
	watchlistItem,
} from "@still/db";
import { and, eq } from "drizzle-orm";

export interface ClearLibraryCounts {
	logs: number;
	watchlist: number;
	tvProgress: number;
	favorites: number;
	badges: number;
	achievements: number;
	challenges: number;
}

/**
 * Wipe the patron's watch library:
 * diary logs (film + TV), watchlist, TV progress, streak, taste dismissals,
 * and all diary-derived gamification (badges, achievement progress, challenge
 * enrollments, unprocessed event-log rows). The system Favorites list is
 * emptied (membership derives from `log.liked`) but the list row stays.
 *
 * Kept: reviews (their `log_id` FK is `set null`), comments, lists + items,
 * list likes, follows, profile, settings, notifications, product events.
 *
 * Runs as ordered sequential deletes — `@still/db` uses the Neon HTTP driver,
 * which does not support `db.transaction()`.
 */
export async function clearUserLibrary(
	userId: string,
): Promise<ClearLibraryCounts> {
	// Favorites first — membership derives from log.liked hearts.
	const [favoritesList] = await db
		.select({ id: list.id })
		.from(list)
		.where(
			and(
				eq(list.userId, userId),
				eq(list.systemKind, LIST_SYSTEM_KIND_FAVORITES),
			),
		);
	let favorites = 0;
	if (favoritesList) {
		const removed = await db
			.delete(listItem)
			.where(eq(listItem.listId, favoritesList.id))
			.returning({ id: listItem.id });
		favorites = removed.length;
		await db
			.update(list)
			.set({
				itemsCount: 0,
				movieItemsCount: 0,
				tvItemsCount: 0,
				coverMovieIds: [],
				coverTvIds: [],
				coverMovieId: null,
				coverTvId: null,
			})
			.where(eq(list.id, favoritesList.id));
	}

	// Diary logs — film and all TV scopes. `review.log_id` is ON DELETE SET
	// NULL, so published reviews keep their mirrored rating.
	const logs = await db
		.delete(log)
		.where(eq(log.userId, userId))
		.returning({ id: log.id });

	const watchlist = await db
		.delete(watchlistItem)
		.where(eq(watchlistItem.userId, userId))
		.returning({ addedAt: watchlistItem.addedAt });

	// tv_watch_episode cascades from tv_watch.
	const tvProgress = await db
		.delete(tvWatch)
		.where(eq(tvWatch.userId, userId))
		.returning({ id: tvWatch.id });

	await db.delete(userStreak).where(eq(userStreak.userId, userId));
	await db
		.delete(tasteDismissedMovie)
		.where(eq(tasteDismissedMovie.userId, userId));

	const badges = await db
		.delete(userBadge)
		.where(eq(userBadge.userId, userId))
		.returning({ badgeId: userBadge.badgeId });
	const achievements = await db
		.delete(userAchievement)
		.where(eq(userAchievement.userId, userId))
		.returning({ achievementId: userAchievement.achievementId });
	const challenges = await db
		.delete(userCompletionistChallenge)
		.where(eq(userCompletionistChallenge.userId, userId))
		.returning({ challengeId: userCompletionistChallenge.challengeId });
	await db.delete(eventLog).where(eq(eventLog.userId, userId));

	// Reset diary-derived profile caches so heroes/stats don't show ghosts.
	await db
		.update(profile)
		.set({
			statsCache: {},
			tasteSignature: null,
			tasteSignatureComputedAt: null,
		})
		.where(eq(profile.userId, userId));

	return {
		logs: logs.length,
		watchlist: watchlist.length,
		tvProgress: tvProgress.length,
		favorites,
		badges: badges.length,
		achievements: achievements.length,
		challenges: challenges.length,
	};
}

import { badge, db, log, userCompletionistChallenge } from "@still/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { awardBadgeToUser } from "../jobs/badge-evaluator";
import {
	COMPLETIONIST_CHALLENGES,
	computeChallengeProgress,
	getCompletionistChallengeById,
} from "./completionist-challenges";
import { deliverNotification } from "./notification-delivery";

/** Distinct TMDB ids the patron has logged as films. */
export async function fetchWatchedMovieIds(
	userId: string,
): Promise<Set<number>> {
	const rows = await db
		.select({ movieId: log.movieId })
		.from(log)
		.where(and(eq(log.userId, userId), isNull(log.tvId)));
	const ids = new Set<number>();
	for (const row of rows) {
		if (row.movieId != null) ids.add(row.movieId);
	}
	return ids;
}

/**
 * After a new log or enroll — mark challenges complete and award prestige badges.
 */
export async function syncCompletionistChallengesForUser(
	userId: string,
): Promise<void> {
	const rows = await db
		.select()
		.from(userCompletionistChallenge)
		.where(
			and(
				eq(userCompletionistChallenge.userId, userId),
				isNull(userCompletionistChallenge.completedAt),
			),
		);
	if (rows.length === 0) return;

	const watched = await fetchWatchedMovieIds(userId);

	for (const row of rows) {
		const def = getCompletionistChallengeById(row.challengeId);
		if (!def) continue;

		const progress = computeChallengeProgress(def.movieIds, watched);
		if (!progress.completed) continue;

		const now = new Date();
		await db
			.update(userCompletionistChallenge)
			.set({ completedAt: now })
			.where(
				and(
					eq(userCompletionistChallenge.userId, userId),
					eq(userCompletionistChallenge.challengeId, def.id),
				),
			);

		const [badgeRow] = await db
			.select()
			.from(badge)
			.where(eq(badge.id, def.badgeId))
			.limit(1);
		if (badgeRow) {
			await awardBadgeToUser(userId, badgeRow, {
				challengeId: def.id,
				watched: progress.watched,
			});
		}

		await deliverNotification({
			userId,
			kind: "challenge.completed",
			title: `Challenge complete: ${def.title}`,
			body: `You finished the ${def.subtitle} set — badge unlocked.`,
			payload: {
				challengeId: def.id,
				badgeId: def.badgeId,
				href: "/achievements?tab=challenges",
			},
		});
	}
}

export function listCompletionistChallengeDefinitions() {
	return COMPLETIONIST_CHALLENGES;
}

import { db, movie, userCompletionistChallenge } from "@still/db";
import { and, eq, inArray } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import {
	fetchWatchedMovieIds,
	listCompletionistChallengeDefinitions,
	syncCompletionistChallengesForUser,
} from "../lib/completionist-challenge-sync";
import {
	computeChallengeProgress,
	getCompletionistChallengeById,
	toChallengeListItem,
} from "../lib/completionist-challenges";
import { loadPatronEntitlements } from "../lib/patron-entitlements";
import {
	patronHasPlanFeature,
	planFeatureRequiredBody,
} from "../lib/plan-feature-access";
import { hit } from "../lib/rate-limit";

/** Static catalog + optional enrollment — always returns rows even if migration lags. */
async function listChallengesForViewer(user: { id: string } | null) {
	const defs = listCompletionistChallengeDefinitions();
	const watched = user
		? await fetchWatchedMovieIds(user.id)
		: new Set<number>();

	let enrollments = new Map<
		string,
		{ enrolledAt: Date; completedAt: Date | null }
	>();
	if (user) {
		try {
			const rows = await db
				.select()
				.from(userCompletionistChallenge)
				.where(eq(userCompletionistChallenge.userId, user.id));
			enrollments = new Map(
				rows.map((r) => [
					r.challengeId,
					{ enrolledAt: r.enrolledAt, completedAt: r.completedAt },
				]),
			);
		} catch (err) {
			// Missing table / DB blip — still show the catalog; enrollment syncs on next log.
			console.error("[challenges] enrollment lookup failed", err);
		}
	}

	return {
		challenges: defs.map((def) =>
			toChallengeListItem(def, watched, enrollments.get(def.id) ?? null),
		),
	};
}

export const challengesRoute = new Elysia({
	prefix: "/api/challenges",
	tags: ["challenges"],
})
	.use(context)
	// `/catalog` matches badges/achievements Eden paths; keep `/` for direct fetches.
	.get("/catalog", ({ user }) => listChallengesForViewer(user))
	.get("/", ({ user }) => listChallengesForViewer(user))
	.get(
		"/:id",
		async ({ params, user, status }) => {
			const def = getCompletionistChallengeById(params.id);
			if (!def) return status(404, "Challenge not found");

			const watched = user
				? await fetchWatchedMovieIds(user.id)
				: new Set<number>();

			let enrollment: { enrolledAt: Date; completedAt: Date | null } | null =
				null;
			if (user) {
				const [row] = await db
					.select()
					.from(userCompletionistChallenge)
					.where(
						and(
							eq(userCompletionistChallenge.userId, user.id),
							eq(userCompletionistChallenge.challengeId, def.id),
						),
					)
					.limit(1);
				if (row) {
					enrollment = {
						enrolledAt: row.enrolledAt,
						completedAt: row.completedAt,
					};
				}
			}

			const progress = computeChallengeProgress(def.movieIds, watched);
			const movies =
				def.movieIds.length > 0
					? await db
							.select({
								tmdbId: movie.tmdbId,
								title: movie.title,
								posterPath: movie.posterPath,
								year: movie.year,
							})
							.from(movie)
							.where(inArray(movie.tmdbId, [...def.movieIds]))
					: [];

			const byId = new Map(movies.map((m) => [m.tmdbId, m] as const));
			const films = def.movieIds.map((id) => {
				const row = byId.get(id);
				return {
					movieId: id,
					title: row?.title ?? `Film ${id}`,
					posterPath: row?.posterPath ?? null,
					year: row?.year ?? null,
					watched: watched.has(id),
				};
			});

			return {
				challenge: toChallengeListItem(def, watched, enrollment),
				films,
				progress,
			};
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.post(
		"/:id/enroll",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in to join a challenge");
			const entitlements = await loadPatronEntitlements(user.id);
			if (!patronHasPlanFeature(entitlements, "challenges")) {
				return status(
					403,
					planFeatureRequiredBody(
						"challenges",
						"Completionist challenges require Immersed",
					),
				);
			}
			if (
				!hit(`challenge-enroll:${user.id}`, { limit: 30, windowMs: 60_000 }).ok
			) {
				return status(429, "Slow down");
			}

			const def = getCompletionistChallengeById(params.id);
			if (!def) return status(404, "Challenge not found");

			try {
				await db
					.insert(userCompletionistChallenge)
					.values({
						userId: user.id,
						challengeId: def.id,
					})
					.onConflictDoNothing();

				await syncCompletionistChallengesForUser(user.id);

				const watched = await fetchWatchedMovieIds(user.id);
				const [row] = await db
					.select()
					.from(userCompletionistChallenge)
					.where(
						and(
							eq(userCompletionistChallenge.userId, user.id),
							eq(userCompletionistChallenge.challengeId, def.id),
						),
					)
					.limit(1);

				return {
					challenge: toChallengeListItem(
						def,
						watched,
						row
							? { enrolledAt: row.enrolledAt, completedAt: row.completedAt }
							: { enrolledAt: new Date(), completedAt: null },
					),
				};
			} catch (err) {
				console.error("[challenges] enroll failed", err);
				return status(
					503,
					"Challenges are not ready yet — run database migrations and try again.",
				);
			}
		},
		{ params: t.Object({ id: t.String() }) },
	);

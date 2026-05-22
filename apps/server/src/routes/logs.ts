import {
	db,
	eventLog,
	log,
	movie,
	normalizeTvLogScopeForInsert,
	profile,
	tv,
	user,
	validateTvLogScope,
} from "@still/db";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import { makeId } from "../lib/cuid";
import { syncFavoritesListForUserTitle } from "../lib/favorites-list-sync";
import { hit } from "../lib/rate-limit";
import { tmdbApi } from "../lib/tmdb";
import { ensureTvCached } from "../lib/tv-cache";

async function ensureMovieCached(tmdbId: number) {
	const [exists] = await db
		.select({ id: movie.tmdbId })
		.from(movie)
		.where(eq(movie.tmdbId, tmdbId))
		.limit(1);
	if (exists) return;
	try {
		const detail = await tmdbApi.movieDetail(tmdbId);
		const releaseDate = detail.release_date ?? null;
		await db
			.insert(movie)
			.values({
				tmdbId: detail.id,
				title: detail.title,
				overview: detail.overview,
				posterPath: detail.poster_path,
				backdropPath: detail.backdrop_path,
				releaseDate: releaseDate ? new Date(releaseDate) : null,
				year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
				runtime: detail.runtime ?? null,
				genreIds: (detail.genres ?? []).map((g) => g.id),
				spokenLanguages: (detail.spoken_languages ?? []).map(
					(l) => l.iso_639_1,
				),
				originalLanguage: detail.original_language ?? null,
				popularity: detail.popularity ?? null,
				voteAverage: detail.vote_average ?? null,
				voteCount: detail.vote_count ?? null,
				tmdbJson: detail as unknown as Record<string, unknown>,
				lastSyncedAt: new Date(),
			})
			.onConflictDoNothing();
	} catch (err) {
		console.error("[logs] failed to cache movie from TMDb", err);
	}
}

const logCreateFields = {
	/** Film path — mutually exclusive with `tvId`. */
	movieId: t.Optional(t.Number()),
	/** TV path — mutually exclusive with `movieId`. */
	tvId: t.Optional(t.Number()),
	/** Tenths of a 0–10 score (`72` → 7.2); legacy rows may still be `1..10`. */
	rating: t.Optional(t.Integer({ minimum: 0, maximum: 100 })),
	liked: t.Optional(t.Boolean()),
	rewatch: t.Optional(t.Boolean()),
	watchedAt: t.Optional(t.String()),
	note: t.Optional(t.String({ maxLength: 500 })),
	containsSpoilers: t.Optional(t.Boolean()),
	/** In-cinema vs at-home — matches `/diary?venue=`; default **streaming**. */
	watchVenue: t.Optional(
		t.Union([t.Literal("theaters"), t.Literal("streaming")]),
	),
	logScope: t.Optional(
		t.Union([t.Literal("show"), t.Literal("season"), t.Literal("episode")]),
	),
	seasonNumber: t.Optional(t.Integer({ minimum: 1 })),
	episodeNumber: t.Optional(t.Integer({ minimum: 1 })),
};

export const logsRoute = new Elysia({ prefix: "/api/logs", tags: ["logs"] })
	.use(context)
	.post(
		"/",
		async ({ body, user, status }) => {
			if (!user) return status(401, "Sign in to log a film");
			if (!hit(`logs:create:${user.id}`, { limit: 30, windowMs: 60_000 }).ok) {
				return status(429, "Slow down");
			}
			const movieId = body.movieId;
			const tvId = body.tvId;
			if (movieId != null && tvId != null) {
				return status(400, "Send exactly one of movieId or tvId");
			}
			if (movieId == null && tvId == null) {
				return status(400, "Send exactly one of movieId or tvId");
			}
			if (movieId != null && tvId == null) {
				await ensureMovieCached(movieId);
			} else if (tvId != null && movieId == null) {
				await ensureTvCached(tvId);
				const scopeCheck = validateTvLogScope({
					logScope: body.logScope,
					seasonNumber: body.seasonNumber,
					episodeNumber: body.episodeNumber,
				});
				if (!scopeCheck.ok) return status(400, scopeCheck.message);
			} else {
				return status(400, "Send exactly one of movieId or tvId");
			}

			const scopeFields = normalizeTvLogScopeForInsert(tvId ?? null, {
				logScope: body.logScope,
				seasonNumber: body.seasonNumber,
				episodeNumber: body.episodeNumber,
			});

			const id = makeId("log");
			const watchedAt = body.watchedAt ? new Date(body.watchedAt) : new Date();
			const watchVenue =
				body.watchVenue === "theaters" || body.watchVenue === "streaming"
					? body.watchVenue
					: "streaming";

			const [row] = await db
				.insert(log)
				.values({
					id,
					userId: user.id,
					movieId: movieId ?? null,
					tvId: tvId ?? null,
					watchedAt,
					rating: body.rating ?? null,
					liked: body.liked ?? false,
					rewatch: body.rewatch ?? false,
					note: body.note ?? null,
					containsSpoilers: body.containsSpoilers ?? false,
					watchVenue,
					logScope: scopeFields.logScope,
					seasonNumber: scopeFields.seasonNumber,
					episodeNumber: scopeFields.episodeNumber,
				})
				.returning();

			await db.insert(eventLog).values({
				id: makeId("evt"),
				userId: user.id,
				kind: "log.created",
				payload: {
					logId: id,
					movieId: movieId ?? undefined,
					tvId: tvId ?? undefined,
					rating: body.rating,
					liked: body.liked,
				},
			});

			if (row?.liked) {
				await syncFavoritesListForUserTitle({
					userId: user.id,
					movieId: row.movieId,
					tvId: row.tvId,
					liked: true,
				});
			}

			return row;
		},
		{
			body: t.Object(logCreateFields),
		},
	)
	.patch(
		"/:id",
		async ({ params, body, user, status }) => {
			if (!user) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(log)
				.where(eq(log.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id)
				return status(404, "Log not found");

			if (existing.tvId != null) {
				const scopeCheck = validateTvLogScope({
					logScope: body.logScope ?? existing.logScope,
					seasonNumber:
						body.seasonNumber === undefined
							? existing.seasonNumber
							: body.seasonNumber,
					episodeNumber:
						body.episodeNumber === undefined
							? existing.episodeNumber
							: body.episodeNumber,
				});
				if (!scopeCheck.ok) return status(400, scopeCheck.message);
			}

			const scopeFields =
				existing.tvId != null
					? normalizeTvLogScopeForInsert(existing.tvId, {
							logScope: body.logScope ?? existing.logScope,
							seasonNumber:
								body.seasonNumber === undefined
									? existing.seasonNumber
									: body.seasonNumber,
							episodeNumber:
								body.episodeNumber === undefined
									? existing.episodeNumber
									: body.episodeNumber,
						})
					: {
							logScope: "show" as const,
							seasonNumber: null,
							episodeNumber: null,
						};

			const [updated] = await db
				.update(log)
				.set({
					// Use `=== undefined` so explicit `null` can clear nullable columns (half-stars / note).
					rating: body.rating === undefined ? existing.rating : body.rating,
					liked: body.liked === undefined ? existing.liked : body.liked,
					rewatch: body.rewatch === undefined ? existing.rewatch : body.rewatch,
					note: body.note === undefined ? existing.note : body.note,
					watchedAt:
						body.watchedAt !== undefined
							? new Date(body.watchedAt)
							: existing.watchedAt,
					containsSpoilers:
						body.containsSpoilers === undefined
							? existing.containsSpoilers
							: body.containsSpoilers,
					watchVenue:
						body.watchVenue === undefined
							? existing.watchVenue
							: body.watchVenue === "theaters" ||
									body.watchVenue === "streaming"
								? body.watchVenue
								: existing.watchVenue,
					logScope: scopeFields.logScope,
					seasonNumber: scopeFields.seasonNumber,
					episodeNumber: scopeFields.episodeNumber,
				})
				.where(eq(log.id, params.id))
				.returning();

			if (updated && body.liked !== undefined) {
				await syncFavoritesListForUserTitle({
					userId: user.id,
					movieId: updated.movieId,
					tvId: updated.tvId,
					liked: updated.liked,
				});
			}

			return updated;
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				rating: t.Optional(
					t.Union([t.Integer({ minimum: 0, maximum: 100 }), t.Null()]),
				),
				liked: t.Optional(t.Boolean()),
				rewatch: t.Optional(t.Boolean()),
				watchedAt: t.Optional(t.String()),
				note: t.Optional(t.Union([t.String({ maxLength: 500 }), t.Null()])),
				containsSpoilers: t.Optional(t.Boolean()),
				watchVenue: t.Optional(
					t.Union([t.Literal("theaters"), t.Literal("streaming")]),
				),
				logScope: t.Optional(
					t.Union([
						t.Literal("show"),
						t.Literal("season"),
						t.Literal("episode"),
					]),
				),
				seasonNumber: t.Optional(
					t.Union([t.Integer({ minimum: 1 }), t.Null()]),
				),
				episodeNumber: t.Optional(
					t.Union([t.Integer({ minimum: 1 }), t.Null()]),
				),
			}),
		},
	)
	.delete(
		"/:id",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(log)
				.where(eq(log.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id)
				return status(404, "Log not found");
			if (existing.liked) {
				await syncFavoritesListForUserTitle({
					userId: user.id,
					movieId: existing.movieId,
					tvId: existing.tvId,
					liked: false,
				});
			}
			await db.delete(log).where(eq(log.id, params.id));
			return { ok: true };
		},
		{ params: t.Object({ id: t.String() }) },
	)
	// Public diary discover — recent logs from patrons with public profiles (community lobby).
	.get(
		"/recent",
		async ({ query }) => {
			const limit = Math.min(Number(query.limit ?? 30), 60);
			const rows = await db
				.select({ log, movie, tv, user, profile })
				.from(log)
				.innerJoin(profile, eq(log.userId, profile.userId))
				.leftJoin(user, eq(log.userId, user.id))
				.leftJoin(movie, eq(log.movieId, movie.tmdbId))
				.leftJoin(tv, eq(log.tvId, tv.tmdbId))
				.where(eq(profile.isPrivate, false))
				.orderBy(desc(log.watchedAt))
				.limit(limit);
			return rows;
		},
		{ query: t.Object({ limit: t.Optional(t.String()) }) },
	)
	// My diary — convenience endpoint for the signed-in user.
	.get(
		"/me",
		async ({ user, status, query }) => {
			if (!user) return status(401, "Sign in");
			const limit = Math.min(Number(query.limit ?? 60), 200);
			const rows = await db
				.select({ log, movie, tv })
				.from(log)
				.leftJoin(movie, eq(log.movieId, movie.tmdbId))
				.leftJoin(tv, eq(log.tvId, tv.tmdbId))
				.where(eq(log.userId, user.id))
				.orderBy(desc(log.watchedAt))
				.limit(limit);
			return rows;
		},
		{ query: t.Object({ limit: t.Optional(t.String()) }) },
	)
	// Diary endpoint: a user's chronologically-ordered logs.
	.get(
		"/by-user/:userId",
		async ({ params, query }) => {
			const limit = Math.min(Number(query.limit ?? 30), 100);
			const rows = await db
				.select({
					log,
					movie,
					tv,
				})
				.from(log)
				.leftJoin(movie, eq(log.movieId, movie.tmdbId))
				.leftJoin(tv, eq(log.tvId, tv.tmdbId))
				.where(eq(log.userId, params.userId))
				.orderBy(desc(log.watchedAt))
				.limit(limit);
			return rows;
		},
		{
			params: t.Object({ userId: t.String() }),
			query: t.Object({ limit: t.Optional(t.String()) }),
		},
	)
	// Has-the-current-user-already-logged-this-movie? Used by the rating widget.
	.get(
		"/me/by-movie/:movieId",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const rows = await db
				.select()
				.from(log)
				.where(
					and(
						eq(log.userId, user.id),
						eq(log.movieId, Number(params.movieId)),
						isNotNull(log.movieId),
					),
				)
				.orderBy(desc(log.watchedAt));
			return rows;
		},
		{ params: t.Object({ movieId: t.String() }) },
	)
	.get(
		"/me/by-tv/:tvId",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const rows = await db
				.select()
				.from(log)
				.where(
					and(
						eq(log.userId, user.id),
						eq(log.tvId, Number(params.tvId)),
						isNotNull(log.tvId),
					),
				)
				.orderBy(desc(log.watchedAt));
			return rows;
		},
		{ params: t.Object({ tvId: t.String() }) },
	);

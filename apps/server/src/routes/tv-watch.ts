import {
	db,
	type TvProgressMode,
	type TvWatchStatus,
	tv,
	tvWatch,
	tvWatchEpisode,
} from "@still/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import { makeId } from "../lib/cuid";
import { hit } from "../lib/rate-limit";
import { tmdbApi } from "../lib/tmdb";
import { getTmdbLanguageForUser } from "../lib/tmdb-poster-language";
import { ensureTvCached } from "../lib/tv-cache";
import { defaultProgressModeForTv } from "../lib/tv-progress-defaults";
import {
	computeNextEpisode,
	getTvSeasonDetailCached,
	getTvSeasonsCached,
} from "../lib/tv-season-cache";

const TV_WATCH_STATUSES = [
	"watching",
	"paused",
	"abandoned",
	"finished",
	"rewatching",
] as const satisfies readonly TvWatchStatus[];

const TV_PROGRESS_MODES = [
	"season",
	"episode",
] as const satisfies readonly TvProgressMode[];

async function loadWatchedEpisodes(tvWatchId: string) {
	return db
		.select({
			seasonNumber: tvWatchEpisode.seasonNumber,
			episodeNumber: tvWatchEpisode.episodeNumber,
			watchedAt: tvWatchEpisode.watchedAt,
		})
		.from(tvWatchEpisode)
		.where(eq(tvWatchEpisode.tvWatchId, tvWatchId))
		.orderBy(
			asc(tvWatchEpisode.seasonNumber),
			asc(tvWatchEpisode.episodeNumber),
		);
}

async function buildWatchDto(
	watchRow: typeof tvWatch.$inferSelect,
	language: string,
) {
	const watched = await loadWatchedEpisodes(watchRow.id);
	const nextEpisode = await computeNextEpisode(
		watchRow.tvId,
		watched.map((w) => ({
			seasonNumber: w.seasonNumber,
			episodeNumber: w.episodeNumber,
		})),
		language,
	);

	const [show] = await db
		.select({
			tmdbId: tv.tmdbId,
			title: tv.title,
			posterPath: tv.posterPath,
		})
		.from(tv)
		.where(eq(tv.tmdbId, watchRow.tvId))
		.limit(1);

	return {
		watch: watchRow,
		show: show ?? null,
		watchedEpisodes: watched,
		nextEpisode,
	};
}

export const tvWatchRoute = new Elysia({
	prefix: "/api/tv-watch",
	tags: ["tv-watch"],
})
	.use(context)
	.get(
		"/me",
		async ({ user, status, query }) => {
			if (!user) return status(401, "Sign in");
			const limit = Math.min(Number(query.limit ?? 24), 60);
			const statusFilter = query.status
				?.split(",")
				.map((s) => s.trim())
				.filter((s): s is TvWatchStatus =>
					(TV_WATCH_STATUSES as readonly string[]).includes(s),
				);
			const language = await getTmdbLanguageForUser(user.id);

			const conditions = [eq(tvWatch.userId, user.id)];
			if (statusFilter && statusFilter.length > 0) {
				conditions.push(inArray(tvWatch.status, statusFilter));
			}

			const rows = await db
				.select()
				.from(tvWatch)
				.where(and(...conditions))
				.orderBy(desc(tvWatch.updatedAt))
				.limit(limit);

			const enriched = await Promise.all(
				rows.map((row) => buildWatchDto(row, language)),
			);
			return enriched;
		},
		{
			query: t.Object({
				limit: t.Optional(t.String()),
				status: t.Optional(t.String()),
			}),
		},
	)
	.get(
		"/me/by-tv/:tvId",
		async ({ user, status, params }) => {
			if (!user) return status(401, "Sign in");
			const tvId = Number(params.tvId);
			if (!Number.isFinite(tvId)) return status(400, "Invalid tv id");
			const language = await getTmdbLanguageForUser(user.id);

			const [row] = await db
				.select()
				.from(tvWatch)
				.where(and(eq(tvWatch.userId, user.id), eq(tvWatch.tvId, tvId)))
				.limit(1);

			if (!row)
				return {
					watch: null,
					show: null,
					watchedEpisodes: [],
					nextEpisode: null,
				};

			return buildWatchDto(row, language);
		},
		{ params: t.Object({ tvId: t.String() }) },
	)
	.post(
		"/",
		async ({ user, status, body }) => {
			if (!user) return status(401, "Sign in");
			if (
				!hit(`tv-watch:create:${user.id}`, { limit: 40, windowMs: 60_000 }).ok
			) {
				return status(429, "Slow down");
			}
			const tvId = body.tvId;
			if (!Number.isFinite(tvId)) return status(400, "Invalid tvId");

			await ensureTvCached(tvId);

			const language = await getTmdbLanguageForUser(user.id);
			const [existing] = await db
				.select()
				.from(tvWatch)
				.where(and(eq(tvWatch.userId, user.id), eq(tvWatch.tvId, tvId)))
				.limit(1);

			if (existing) {
				const [updated] = await db
					.update(tvWatch)
					.set({
						status: "watching",
						statusChangedAt: new Date(),
						notifyNewEpisodes: true,
					})
					.where(eq(tvWatch.id, existing.id))
					.returning();
				return buildWatchDto(updated, language);
			}

			let progressMode: TvProgressMode =
				body.progressMode === "season" || body.progressMode === "episode"
					? body.progressMode
					: "season";

			if (body.progressMode == null) {
				try {
					const detail = await tmdbApi.tvDetail(tvId, { language });
					progressMode = defaultProgressModeForTv({
						genreIds: (detail.genres ?? []).map((g) => g.id),
						numberOfSeasons: detail.number_of_seasons ?? null,
						inProduction: detail.status === "Returning Series",
					});
				} catch {
					progressMode = "season";
				}
			}

			const id = makeId("tvw");
			const [row] = await db
				.insert(tvWatch)
				.values({
					id,
					userId: user.id,
					tvId,
					status: "watching",
					progressMode,
					notifyNewEpisodes: true,
				})
				.returning();

			return buildWatchDto(row, language);
		},
		{
			body: t.Object({
				tvId: t.Number(),
				progressMode: t.Optional(
					t.Union([t.Literal("season"), t.Literal("episode")]),
				),
			}),
		},
	)
	.patch(
		"/:id",
		async ({ user, status, params, body }) => {
			if (!user) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(tvWatch)
				.where(eq(tvWatch.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id) {
				return status(404, "Watch not found");
			}

			const nextStatus =
				body.status &&
				(TV_WATCH_STATUSES as readonly string[]).includes(body.status)
					? body.status
					: existing.status;
			const nextMode =
				body.progressMode &&
				(TV_PROGRESS_MODES as readonly string[]).includes(body.progressMode)
					? body.progressMode
					: existing.progressMode;

			const [updated] = await db
				.update(tvWatch)
				.set({
					status: nextStatus,
					progressMode: nextMode,
					notifyNewEpisodes:
						body.notifyNewEpisodes === undefined
							? existing.notifyNewEpisodes
							: body.notifyNewEpisodes,
					statusChangedAt:
						nextStatus !== existing.status
							? new Date()
							: existing.statusChangedAt,
					lastSeason:
						body.lastSeason === undefined
							? existing.lastSeason
							: body.lastSeason,
					lastEpisode:
						body.lastEpisode === undefined
							? existing.lastEpisode
							: body.lastEpisode,
				})
				.where(eq(tvWatch.id, params.id))
				.returning();

			const language = await getTmdbLanguageForUser(user.id);
			return buildWatchDto(updated, language);
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				status: t.Optional(
					t.Union([
						t.Literal("watching"),
						t.Literal("paused"),
						t.Literal("abandoned"),
						t.Literal("finished"),
						t.Literal("rewatching"),
					]),
				),
				progressMode: t.Optional(
					t.Union([t.Literal("season"), t.Literal("episode")]),
				),
				notifyNewEpisodes: t.Optional(t.Boolean()),
				lastSeason: t.Optional(t.Union([t.Integer({ minimum: 0 }), t.Null()])),
				lastEpisode: t.Optional(t.Union([t.Integer({ minimum: 0 }), t.Null()])),
			}),
		},
	)
	.post(
		"/:id/episodes",
		async ({ user, status, params, body }) => {
			if (!user) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(tvWatch)
				.where(eq(tvWatch.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id) {
				return status(404, "Watch not found");
			}

			const seasonNumber = body.seasonNumber;
			const episodeNumber = body.episodeNumber;
			if (!Number.isFinite(seasonNumber) || !Number.isFinite(episodeNumber)) {
				return status(400, "seasonNumber and episodeNumber are required");
			}

			await db
				.insert(tvWatchEpisode)
				.values({
					tvWatchId: existing.id,
					seasonNumber,
					episodeNumber,
				})
				.onConflictDoNothing();

			const [updated] = await db
				.update(tvWatch)
				.set({
					lastSeason: seasonNumber,
					lastEpisode: episodeNumber,
				})
				.where(eq(tvWatch.id, existing.id))
				.returning();

			const language = await getTmdbLanguageForUser(user.id);
			return buildWatchDto(updated, language);
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				seasonNumber: t.Integer({ minimum: 1 }),
				episodeNumber: t.Integer({ minimum: 1 }),
			}),
		},
	)
	.delete(
		"/:id/episodes",
		async ({ user, status, params, body }) => {
			if (!user) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(tvWatch)
				.where(eq(tvWatch.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id) {
				return status(404, "Watch not found");
			}

			await db
				.delete(tvWatchEpisode)
				.where(
					and(
						eq(tvWatchEpisode.tvWatchId, existing.id),
						eq(tvWatchEpisode.seasonNumber, body.seasonNumber),
						eq(tvWatchEpisode.episodeNumber, body.episodeNumber),
					),
				);

			const language = await getTmdbLanguageForUser(user.id);
			return buildWatchDto(existing, language);
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				seasonNumber: t.Integer({ minimum: 1 }),
				episodeNumber: t.Integer({ minimum: 1 }),
			}),
		},
	)
	.post(
		"/:id/seasons/:seasonNumber/complete",
		async ({ user, status, params }) => {
			if (!user) return status(401, "Sign in");
			const seasonNumber = Number(params.seasonNumber);
			if (!Number.isFinite(seasonNumber)) {
				return status(400, "Invalid season");
			}
			const [existing] = await db
				.select()
				.from(tvWatch)
				.where(eq(tvWatch.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id) {
				return status(404, "Watch not found");
			}

			const language = await getTmdbLanguageForUser(user.id);
			await ensureTvCached(existing.tvId);
			const season = await getTvSeasonDetailCached(
				existing.tvId,
				seasonNumber,
				language,
			);
			const episodes = season.episodes ?? [];
			if (episodes.length === 0) {
				return status(400, "No episodes in this season");
			}

			// One round-trip: insert every episode in the season (skip duplicates).
			await db
				.insert(tvWatchEpisode)
				.values(
					episodes.map((ep) => ({
						tvWatchId: existing.id,
						seasonNumber: ep.season_number,
						episodeNumber: ep.episode_number,
					})),
				)
				.onConflictDoNothing();

			const last = episodes[episodes.length - 1];
			const [updated] = await db
				.update(tvWatch)
				.set({
					lastSeason: last.season_number,
					lastEpisode: last.episode_number,
				})
				.where(eq(tvWatch.id, existing.id))
				.returning();

			return buildWatchDto(updated, language);
		},
		{
			params: t.Object({
				id: t.String(),
				seasonNumber: t.String(),
			}),
		},
	)
	.post(
		"/:id/mark-next",
		async ({ user, status, params }) => {
			if (!user) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(tvWatch)
				.where(eq(tvWatch.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id) {
				return status(404, "Watch not found");
			}

			const language = await getTmdbLanguageForUser(user.id);
			const watched = await loadWatchedEpisodes(existing.id);
			const next = await computeNextEpisode(
				existing.tvId,
				watched.map((w) => ({
					seasonNumber: w.seasonNumber,
					episodeNumber: w.episodeNumber,
				})),
				language,
			);
			if (!next) return status(400, "No unwatched episodes remain");

			await db
				.insert(tvWatchEpisode)
				.values({
					tvWatchId: existing.id,
					seasonNumber: next.seasonNumber,
					episodeNumber: next.episodeNumber,
				})
				.onConflictDoNothing();

			const [updated] = await db
				.update(tvWatch)
				.set({
					lastSeason: next.seasonNumber,
					lastEpisode: next.episodeNumber,
				})
				.where(eq(tvWatch.id, existing.id))
				.returning();

			return buildWatchDto(updated, language);
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.get(
		"/:id/seasons",
		async ({ user, status, params }) => {
			if (!user) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(tvWatch)
				.where(eq(tvWatch.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id) {
				return status(404, "Watch not found");
			}
			const language = await getTmdbLanguageForUser(user.id);
			await ensureTvCached(existing.tvId);
			const seasons = await getTvSeasonsCached(existing.tvId, language);
			return { seasons };
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.get(
		"/:id/season/:seasonNumber",
		async ({ user, status, params }) => {
			if (!user) return status(401, "Sign in");
			const seasonNumber = Number(params.seasonNumber);
			if (!Number.isFinite(seasonNumber)) return status(400, "Invalid season");
			const [existing] = await db
				.select()
				.from(tvWatch)
				.where(eq(tvWatch.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id) {
				return status(404, "Watch not found");
			}
			const language = await getTmdbLanguageForUser(user.id);
			await ensureTvCached(existing.tvId);
			const season = await getTvSeasonDetailCached(
				existing.tvId,
				seasonNumber,
				language,
			);
			return { season };
		},
		{
			params: t.Object({
				id: t.String(),
				seasonNumber: t.String(),
			}),
		},
	);

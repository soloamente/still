import { db, log, movie, profile, tv, watchlistItem } from "@still/db";
import {
	and,
	asc,
	desc,
	eq,
	isNotNull,
	isNull,
	notExists,
	or,
	sql,
} from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import { readShowAdultContentPref } from "../lib/adult-content-policy";
import { joinedTitleItemNotAdultSql } from "../lib/adult-content-sql";
import { hit } from "../lib/rate-limit";
import { routeBody } from "../lib/route-body";
import { traceTiming } from "../lib/trace-timing";
import { WATCHLIST_PROVIDERS_TMDB_JSON_PROJECTION } from "../lib/watchlist-lobby-tmdb-json";
import {
	parseWatchlistLimit,
	parseWatchlistOrder,
	parseWatchlistPage,
	watchlistLookaheadPageMeta,
	watchlistOffset,
} from "../lib/watchlist-query-args";
import {
	primaryFlatrateProviderName,
	readCatalogWatchRegionPref,
} from "../lib/watchlist-streaming-alerts";

type WatchlistUpsertBody = {
	movieId?: number;
	tvId?: number;
	priority?: number;
	note?: string;
};

import { invalidateListingCommunityStatsCache } from "../lib/listing-community-stats-cache";
import {
	upsertMovieWatchlistItem,
	upsertTvWatchlistItem,
} from "../lib/watchlist-upsert";

export const watchlistRoute = new Elysia({
	prefix: "/api/watchlist",
	tags: ["watchlist"],
})
	.use(context)
	.get(
		"/",
		async ({ user, status, query }) => {
			if (!user) return status(401, "Sign in");
			const page = parseWatchlistPage(query.page);
			const limit = parseWatchlistLimit(query.limit);
			const order = parseWatchlistOrder(query.order);
			const offset = watchlistOffset(page, limit);

			const [prefRow] = await db
				.select({ preferences: profile.preferences })
				.from(profile)
				.where(eq(profile.userId, user.id))
				.limit(1);
			const prefs =
				(prefRow?.preferences as Record<string, unknown> | null) ?? null;
			const showAdultContent = readShowAdultContentPref(prefs);
			const watchRegion = readCatalogWatchRegionPref(prefs);

			// Hide-watched (Letterbox-shaped): drop any saved title with a diary log.
			// As a SQL clause so LIMIT/OFFSET apply *after* filtering.
			const notWatched = notExists(
				db
					.select({ one: sql`1` })
					.from(log)
					.where(
						and(
							eq(log.userId, user.id),
							isNull(log.removedAt),
							or(
								and(
									isNotNull(watchlistItem.movieId),
									eq(log.movieId, watchlistItem.movieId),
								),
								and(
									isNotNull(watchlistItem.tvId),
									eq(log.tvId, watchlistItem.tvId),
								),
							),
						),
					),
			);

			const whereClause = and(
				eq(watchlistItem.userId, user.id),
				notWatched,
				joinedTitleItemNotAdultSql(showAdultContent, {
					movieId: watchlistItem.movieId,
					tvId: watchlistItem.tvId,
				}),
			);

			// Deterministic tiebreaker so pages never overlap or skip.
			const tiebreak = sql`coalesce(${watchlistItem.movieId}, ${watchlistItem.tvId})`;
			const titleExpr = sql`coalesce(${movie.title}, ${tv.title})`;
			const orderBy =
				order === "earliest_added"
					? [asc(watchlistItem.addedAt), tiebreak]
					: order === "title_az"
						? [asc(titleExpr), desc(watchlistItem.addedAt), tiebreak]
						: [desc(watchlistItem.addedAt), tiebreak];

			const fetched = await traceTiming("db", "watchlist.list", () =>
				db
					.select({
						item: watchlistItem,
						movieTmdbId: movie.tmdbId,
						movieTitle: movie.title,
						moviePosterPath: movie.posterPath,
						tvTmdbId: tv.tmdbId,
						tvTitle: tv.title,
						tvPosterPath: tv.posterPath,
						tmdbJson: WATCHLIST_PROVIDERS_TMDB_JSON_PROJECTION,
					})
					.from(watchlistItem)
					.leftJoin(movie, eq(watchlistItem.movieId, movie.tmdbId))
					.leftJoin(tv, eq(watchlistItem.tvId, tv.tmdbId))
					.where(whereClause)
					.orderBy(...orderBy)
					.limit(limit + 1)
					.offset(offset),
			);

			const { visibleCount, totalPages } = watchlistLookaheadPageMeta({
				page,
				limit,
				fetchedCount: fetched.length,
			});
			const rows = fetched.slice(0, visibleCount);
			return {
				results: rows.map((row) => ({
					item: row.item,
					movie:
						row.movieTmdbId != null
							? {
									tmdbId: row.movieTmdbId,
									title: row.movieTitle ?? "",
									posterPath: row.moviePosterPath,
								}
							: null,
					tv:
						row.tvTmdbId != null
							? {
									tmdbId: row.tvTmdbId,
									title: row.tvTitle ?? "",
									posterPath: row.tvPosterPath,
								}
							: null,
					streaming_provider_name: primaryFlatrateProviderName(
						row.tmdbJson,
						watchRegion,
					),
				})),
				total_pages: totalPages,
				total_results: offset + rows.length,
			};
		},
		{
			query: t.Object({
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
				order: t.Optional(t.String()),
			}),
		},
	)
	.post(
		"/",
		async ({ body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			if (!hit(`wl:add:${user.id}`, { limit: 60, windowMs: 60_000 }).ok)
				return status(429, "Slow down");
			const body = routeBody<WatchlistUpsertBody>(rawBody);
			const movieId = body.movieId;
			const tvId = body.tvId;
			if (movieId != null && tvId != null) {
				return status(400, "Send exactly one of movieId or tvId");
			}
			if (movieId == null && tvId == null) {
				return status(400, "Send exactly one of movieId or tvId");
			}
			if (movieId != null && tvId == null) {
				const row = await upsertMovieWatchlistItem(user.id, movieId, {
					note: body.note ?? null,
					priority: body.priority ?? 50,
				});
				void invalidateListingCommunityStatsCache({ movieId }).catch(() => {});
				return row;
			}
			if (tvId != null && movieId == null) {
				const row = await upsertTvWatchlistItem(user.id, tvId, {
					note: body.note ?? null,
					priority: body.priority ?? 50,
				});
				void invalidateListingCommunityStatsCache({ tvId }).catch(() => {});
				return row;
			}
			return status(400, "Send exactly one of movieId or tvId");
		},
		{
			body: t.Object({
				movieId: t.Optional(t.Number()),
				tvId: t.Optional(t.Number()),
				priority: t.Optional(t.Integer({ minimum: 0, maximum: 100 })),
				note: t.Optional(t.String({ maxLength: 500 })),
			}),
		},
	)
	.delete(
		"/:movieId",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const movieId = Number(params.movieId);
			await db
				.delete(watchlistItem)
				.where(
					and(
						eq(watchlistItem.userId, user.id),
						eq(watchlistItem.movieId, movieId),
						isNotNull(watchlistItem.movieId),
					),
				);
			void invalidateListingCommunityStatsCache({ movieId }).catch(() => {});
			return { ok: true };
		},
		{ params: t.Object({ movieId: t.String() }) },
	)
	/** TV ids share the integer namespace with films on TMDb — use an explicit `/tv/` path. */
	.delete(
		"/tv/:tvId",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const tvId = Number(params.tvId);
			await db
				.delete(watchlistItem)
				.where(
					and(
						eq(watchlistItem.userId, user.id),
						eq(watchlistItem.tvId, tvId),
						isNotNull(watchlistItem.tvId),
					),
				);
			void invalidateListingCommunityStatsCache({ tvId }).catch(() => {});
			return { ok: true };
		},
		{ params: t.Object({ tvId: t.String() }) },
	)
	.get(
		"/check/:movieId",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const [row] = await db
				.select()
				.from(watchlistItem)
				.where(
					and(
						eq(watchlistItem.userId, user.id),
						eq(watchlistItem.movieId, Number(params.movieId)),
						isNotNull(watchlistItem.movieId),
					),
				)
				.limit(1);
			return { inWatchlist: Boolean(row) };
		},
		{ params: t.Object({ movieId: t.String() }) },
	)
	.get(
		"/check/tv/:tvId",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const [row] = await db
				.select()
				.from(watchlistItem)
				.where(
					and(
						eq(watchlistItem.userId, user.id),
						eq(watchlistItem.tvId, Number(params.tvId)),
						isNotNull(watchlistItem.tvId),
					),
				)
				.limit(1);
			return { inWatchlist: Boolean(row) };
		},
		{ params: t.Object({ tvId: t.String() }) },
	);

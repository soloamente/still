import { db, log, movie, tv, watchlistItem } from "@still/db";
import {
	and,
	asc,
	count,
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
import { joinedTitleItemNotAdultSql } from "../lib/adult-content-sql";
import { getShowAdultContentForUser } from "../lib/adult-content-user-pref";
import { hit } from "../lib/rate-limit";
import { routeBody } from "../lib/route-body";
import {
	parseWatchlistLimit,
	parseWatchlistOrder,
	parseWatchlistPage,
	watchlistOffset,
	watchlistTotalPages,
} from "../lib/watchlist-query-args";

type WatchlistUpsertBody = {
	movieId?: number;
	tvId?: number;
	priority?: number;
	note?: string;
};

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
			const showAdultContent = await getShowAdultContentForUser(user.id);
			const page = parseWatchlistPage(query.page);
			const limit = parseWatchlistLimit(query.limit);
			const order = parseWatchlistOrder(query.order);
			const offset = watchlistOffset(page, limit);

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

			const [rows, totals] = await Promise.all([
				db
					.select({ item: watchlistItem, movie, tv })
					.from(watchlistItem)
					.leftJoin(movie, eq(watchlistItem.movieId, movie.tmdbId))
					.leftJoin(tv, eq(watchlistItem.tvId, tv.tmdbId))
					.where(whereClause)
					.orderBy(...orderBy)
					.limit(limit)
					.offset(offset),
				db
					.select({ total: count() })
					.from(watchlistItem)
					.leftJoin(movie, eq(watchlistItem.movieId, movie.tmdbId))
					.leftJoin(tv, eq(watchlistItem.tvId, tv.tmdbId))
					.where(whereClause),
			]);

			const total = Number(totals[0]?.total ?? 0);
			return {
				results: rows,
				total_pages: watchlistTotalPages(total, limit),
				total_results: total,
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
				return row;
			}
			if (tvId != null && movieId == null) {
				const row = await upsertTvWatchlistItem(user.id, tvId, {
					note: body.note ?? null,
					priority: body.priority ?? 50,
				});
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
			await db
				.delete(watchlistItem)
				.where(
					and(
						eq(watchlistItem.userId, user.id),
						eq(watchlistItem.movieId, Number(params.movieId)),
						isNotNull(watchlistItem.movieId),
					),
				);
			return { ok: true };
		},
		{ params: t.Object({ movieId: t.String() }) },
	)
	/** TV ids share the integer namespace with films on TMDb — use an explicit `/tv/` path. */
	.delete(
		"/tv/:tvId",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			await db
				.delete(watchlistItem)
				.where(
					and(
						eq(watchlistItem.userId, user.id),
						eq(watchlistItem.tvId, Number(params.tvId)),
						isNotNull(watchlistItem.tvId),
					),
				);
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

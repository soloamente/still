import { db, movie, tv, watchlistItem } from "@still/db";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import Elysia, { t } from "elysia";

import { context } from "../context";
import { hit } from "../lib/rate-limit";
import { tmdbApi } from "../lib/tmdb";
import { ensureTvCached } from "../lib/tv-cache";

async function ensureMovie(tmdbId: number) {
	const [exists] = await db
		.select({ id: movie.tmdbId })
		.from(movie)
		.where(eq(movie.tmdbId, tmdbId))
		.limit(1);
	if (exists) return;
	try {
		const detail = await tmdbApi.movieDetail(tmdbId);
		await db
			.insert(movie)
			.values({
				tmdbId: detail.id,
				title: detail.title,
				overview: detail.overview,
				posterPath: detail.poster_path,
				backdropPath: detail.backdrop_path,
				releaseDate: detail.release_date ? new Date(detail.release_date) : null,
				year: detail.release_date
					? Number(detail.release_date.slice(0, 4))
					: null,
				runtime: detail.runtime ?? null,
				tmdbJson: detail as unknown as Record<string, unknown>,
				lastSyncedAt: new Date(),
			})
			.onConflictDoNothing();
	} catch {}
}

export const watchlistRoute = new Elysia({
	prefix: "/api/watchlist",
	tags: ["watchlist"],
})
	.use(context)
	.get(
		"/",
		async ({ user, status, query }) => {
			if (!user) return status(401, "Sign in");
			const limit = Math.min(Number(query.limit ?? 60), 200);
			const rows = await db
				.select({ item: watchlistItem, movie, tv })
				.from(watchlistItem)
				.leftJoin(movie, eq(watchlistItem.movieId, movie.tmdbId))
				.leftJoin(tv, eq(watchlistItem.tvId, tv.tmdbId))
				.where(eq(watchlistItem.userId, user.id))
				.orderBy(desc(watchlistItem.addedAt))
				.limit(limit);
			return rows;
		},
		{ query: t.Object({ limit: t.Optional(t.String()) }) },
	)
	.post(
		"/",
		async ({ body, user, status }) => {
			if (!user) return status(401, "Sign in");
			if (!hit(`wl:add:${user.id}`, { limit: 60, windowMs: 60_000 }).ok)
				return status(429, "Slow down");
			const movieId = body.movieId;
			const tvId = body.tvId;
			if (movieId != null && tvId != null) {
				return status(400, "Send exactly one of movieId or tvId");
			}
			if (movieId == null && tvId == null) {
				return status(400, "Send exactly one of movieId or tvId");
			}
			if (movieId != null && tvId == null) {
				await ensureMovie(movieId);
				const [row] = await db
					.insert(watchlistItem)
					.values({
						userId: user.id,
						movieId,
						tvId: null,
						note: body.note ?? null,
						priority: body.priority ?? 50,
					})
					.onConflictDoUpdate({
						target: [watchlistItem.userId, watchlistItem.movieId],
						set: { note: body.note ?? null, priority: body.priority ?? 50 },
					})
					.returning();
				return row;
			}
			if (tvId != null && movieId == null) {
				await ensureTvCached(tvId);
				const [row] = await db
					.insert(watchlistItem)
					.values({
						userId: user.id,
						movieId: null,
						tvId,
						note: body.note ?? null,
						priority: body.priority ?? 50,
					})
					.onConflictDoUpdate({
						target: [watchlistItem.userId, watchlistItem.tvId],
						set: { note: body.note ?? null, priority: body.priority ?? 50 },
					})
					.returning();
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

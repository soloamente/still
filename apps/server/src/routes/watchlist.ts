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
	type SQL,
	sql,
} from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import { readShowAdultContentPref } from "../lib/adult-content-policy";
import { joinedTitleItemNotAdultSql } from "../lib/adult-content-sql";
import { invalidateListingCommunityStatsCache } from "../lib/listing-community-stats-cache";
import { loadPatronEntitlements } from "../lib/patron-entitlements";
import {
	patronHasPlanFeature,
	planFeatureRequiredBody,
} from "../lib/plan-feature-access";
import { hit } from "../lib/rate-limit";
import { recordProductEvent } from "../lib/record-product-event";
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
	readCatalogWatchRegionPrefOrNull,
} from "../lib/watchlist-streaming-alerts";
import { rankWatchlistTonight } from "../lib/watchlist-tonight-score";
import {
	invalidateWatchlistTonightSocial,
	listingKey,
	loadWatchlistTonightSocial,
	normalizedGenreAffinity,
} from "../lib/watchlist-tonight-signals";
import {
	upsertMovieWatchlistItem,
	upsertTvWatchlistItem,
} from "../lib/watchlist-upsert";

type WatchlistUpsertBody = {
	movieId?: number;
	tvId?: number;
	priority?: number;
	note?: string;
};

/** Upper bound on titles ranked in TS for `tonight` / `available`. */
const WATCHLIST_DECISION_POOL_LIMIT = 500;

/** Shared column set for the legacy paged query and the decision pool query. */
const watchlistSelectShape = {
	item: watchlistItem,
	movieTmdbId: movie.tmdbId,
	movieTitle: movie.title,
	moviePosterPath: movie.posterPath,
	movieGenreIds: movie.genreIds,
	tvTmdbId: tv.tmdbId,
	tvTitle: tv.title,
	tvPosterPath: tv.posterPath,
	tvGenreIds: tv.genreIds,
	tmdbJson: WATCHLIST_PROVIDERS_TMDB_JSON_PROJECTION,
	streamingAlert: watchlistItem.streamingAlert,
};

type WatchlistSelectRow = {
	item: typeof watchlistItem.$inferSelect;
	movieTmdbId: number | null;
	movieTitle: string | null;
	moviePosterPath: string | null;
	tvTmdbId: number | null;
	tvTitle: string | null;
	tvPosterPath: string | null;
	streamingAlert: boolean;
};

/** Lobby row shape shared by every `?order=` mode. */
function toWatchlistRow(
	row: WatchlistSelectRow,
	providerName: string | null,
	reason: string | null,
) {
	return {
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
		streaming_provider_name: providerName,
		tonight_reason: reason,
		streaming_alert: row.streamingAlert,
	};
}

/** Patron `profile.preferences` blob (null when the profile row is missing). */
async function loadPatronPreferences(
	userId: string,
): Promise<Record<string, unknown> | null> {
	const [prefRow] = await db
		.select({ preferences: profile.preferences })
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);
	return (prefRow?.preferences as Record<string, unknown> | null) ?? null;
}

/**
 * Lobby-visible watchlist rows: the patron's saves, minus anything with a diary
 * log (hide-watched, Letterbox-shaped) and adult titles unless opted in.
 * As a SQL clause so LIMIT/OFFSET apply *after* filtering.
 */
function watchlistVisibleWhere(userId: string, showAdultContent: boolean) {
	const notWatched = notExists(
		db
			.select({ one: sql`1` })
			.from(log)
			.where(
				and(
					eq(log.userId, userId),
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

	return and(
		eq(watchlistItem.userId, userId),
		notWatched,
		joinedTitleItemNotAdultSql(showAdultContent, {
			movieId: watchlistItem.movieId,
			tvId: watchlistItem.tvId,
		}),
	);
}

/** Rows scanned for the Attuned upsell preview (not a full-watchlist count). */
const WATCHLIST_ALERT_PREVIEW_POOL_LIMIT = 200;

/**
 * 403 upsell payload for `PATCH /alert` — how many visible saves are not on a
 * subscription service in the patron's region (US fallback), plus 3 samples.
 */
type WatchlistAlertPreviewSample = {
	listingKind: "movie" | "tv";
	tmdbId: number;
	title: string;
	posterPath: string | null;
};

async function loadWatchlistAlertPreview(userId: string): Promise<{
	notStreamingCount: number;
	sample: WatchlistAlertPreviewSample[];
}> {
	const prefs = await loadPatronPreferences(userId);
	const region = readCatalogWatchRegionPref(prefs);
	const rows = await db
		.select({
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
		.where(watchlistVisibleWhere(userId, readShowAdultContentPref(prefs)))
		.orderBy(desc(watchlistItem.addedAt))
		.limit(WATCHLIST_ALERT_PREVIEW_POOL_LIMIT);

	const notStreaming = rows.filter(
		(row) => primaryFlatrateProviderName(row.tmdbJson, region) == null,
	);
	const sample = notStreaming
		.slice(0, 3)
		.flatMap((row): WatchlistAlertPreviewSample[] => {
			if (row.movieTmdbId != null) {
				return [
					{
						listingKind: "movie",
						tmdbId: row.movieTmdbId,
						title: row.movieTitle ?? "",
						posterPath: row.moviePosterPath,
					},
				];
			}
			if (row.tvTmdbId != null) {
				return [
					{
						listingKind: "tv",
						tmdbId: row.tvTmdbId,
						title: row.tvTitle ?? "",
						posterPath: row.tvPosterPath,
					},
				];
			}
			return [];
		});
	return { notStreamingCount: notStreaming.length, sample };
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
			const page = parseWatchlistPage(query.page);
			const limit = parseWatchlistLimit(query.limit);
			const order = parseWatchlistOrder(query.order);
			const offset = watchlistOffset(page, limit);

			const prefs = await loadPatronPreferences(user.id);
			const showAdultContent = readShowAdultContentPref(prefs);
			const watchRegion = readCatalogWatchRegionPref(prefs);
			// Decision modes need an explicit region — the US fallback would mislead.
			const chosenRegion = readCatalogWatchRegionPrefOrNull(prefs);

			// Hide-watched (Letterbox-shaped): drop any saved title with a diary log.
			const whereClause = watchlistVisibleWhere(user.id, showAdultContent);

			// Deterministic tiebreaker so pages never overlap or skip.
			const tiebreak = sql`coalesce(${watchlistItem.movieId}, ${watchlistItem.tvId})`;
			const titleExpr = sql`coalesce(${movie.title}, ${tv.title})`;

			if (order === "available" && chosenRegion == null) {
				return {
					results: [],
					total_pages: 0,
					total_results: 0,
					needs_region: true as const,
				};
			}
			if (order === "available" || order === "tonight") {
				// Bounded candidate pool — rank/filter in TS, then page.
				const pool = await traceTiming("db", `watchlist.${order}.pool`, () =>
					db
						.select(watchlistSelectShape)
						.from(watchlistItem)
						.leftJoin(movie, eq(watchlistItem.movieId, movie.tmdbId))
						.leftJoin(tv, eq(watchlistItem.tvId, tv.tmdbId))
						.where(whereClause)
						.orderBy(desc(watchlistItem.addedAt), tiebreak)
						.limit(WATCHLIST_DECISION_POOL_LIMIT),
				);
				// No chosen region → availability contributes nothing to `tonight`.
				const withProvider = pool.map((row) => ({
					row,
					providerName: chosenRegion
						? primaryFlatrateProviderName(row.tmdbJson, chosenRegion)
						: null,
				}));
				let ordered: {
					row: (typeof pool)[number];
					providerName: string | null;
					reason: string | null;
				}[];
				if (order === "available") {
					ordered = withProvider
						.filter((r) => r.providerName != null)
						.map((r) => ({ ...r, reason: `Now on ${r.providerName}` }));
				} else {
					const social = await traceTiming(
						"db",
						"watchlist.tonight.social",
						() => loadWatchlistTonightSocial(user.id),
					);
					const now = new Date();
					ordered = rankWatchlistTonight(
						withProvider.map((r) => {
							const key = listingKey(r.row.item.movieId, r.row.item.tvId);
							return {
								key,
								r,
								signals: {
									providerName: r.providerName,
									recommenders: social.recommenders.get(key) ?? [],
									ownListTitle: social.ownListTitles.get(key) ?? null,
									tasteAffinity: normalizedGenreAffinity(
										r.row.movieGenreIds ?? r.row.tvGenreIds ?? [],
										social.genreWeights,
									),
									addedAt: new Date(r.row.item.addedAt),
									now,
								},
							};
						}),
					).map((ranked) => ({
						...ranked.r,
						reason: ranked.reason?.label ?? null,
					}));
				}
				const pageRows = ordered.slice(offset, offset + limit + 1);
				const meta = watchlistLookaheadPageMeta({
					page,
					limit,
					fetchedCount: pageRows.length,
				});
				return {
					results: pageRows
						.slice(0, meta.visibleCount)
						.map((r) => toWatchlistRow(r.row, r.providerName, r.reason)),
					total_pages: meta.totalPages,
					total_results: offset + meta.visibleCount,
				};
			}

			let orderBy: SQL[];
			switch (order) {
				case "earliest_added":
					orderBy = [asc(watchlistItem.addedAt), tiebreak];
					break;
				case "title_az":
					orderBy = [asc(titleExpr), desc(watchlistItem.addedAt), tiebreak];
					break;
				// `tonight` / `available` return above, so `order` is already narrowed here.
				case "latest_added":
					orderBy = [desc(watchlistItem.addedAt), tiebreak];
					break;
				default: {
					const unhandled: never = order;
					throw new Error(`Unhandled watchlist order: ${String(unhandled)}`);
				}
			}

			const fetched = await traceTiming("db", "watchlist.list", () =>
				db
					.select(watchlistSelectShape)
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
				results: rows.map((row) =>
					toWatchlistRow(
						row,
						primaryFlatrateProviderName(row.tmdbJson, watchRegion),
						null,
					),
				),
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
			invalidateWatchlistTonightSocial(user.id);
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
	/** Per-title streaming alert toggle — enabling needs Attuned (`watchlist_alerts`). */
	.patch(
		"/alert",
		async ({ body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			if (!hit(`wl:alert:${user.id}`, { limit: 30, windowMs: 60_000 }).ok)
				return status(429, "Slow down");
			const body = routeBody<{
				movieId?: number;
				tvId?: number;
				enabled: boolean;
			}>(rawBody);
			if ((body.movieId == null) === (body.tvId == null)) {
				return status(400, "Send exactly one of movieId or tvId");
			}
			// Owner-scoped: a missing row (not on this patron's watchlist) → 404 below.
			const itemWhere = and(
				eq(watchlistItem.userId, user.id),
				body.movieId != null
					? eq(watchlistItem.movieId, body.movieId)
					: eq(watchlistItem.tvId, body.tvId as number),
			);
			// Turning alerts off is always allowed (e.g. after a downgrade).
			if (body.enabled) {
				const entitlements = await loadPatronEntitlements(user.id);
				if (!patronHasPlanFeature(entitlements, "watchlist_alerts")) {
					return status(403, {
						...planFeatureRequiredBody(
							"watchlist_alerts",
							"Streaming alerts are part of Attuned",
						),
						preview: await loadWatchlistAlertPreview(user.id),
					});
				}
			}
			const updated = await db
				.update(watchlistItem)
				.set({ streamingAlert: body.enabled })
				.where(itemWhere)
				.returning({ movieId: watchlistItem.movieId });
			if (updated.length === 0) return status(404, "Not on your watchlist");
			await recordProductEvent(user.id, "watchlist.alert_requested", {
				enabled: body.enabled,
				listingKind: body.movieId != null ? "movie" : "tv",
			});
			return { ok: true as const, enabled: body.enabled };
		},
		{
			body: t.Object({
				movieId: t.Optional(t.Number()),
				tvId: t.Optional(t.Number()),
				enabled: t.Boolean(),
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
			invalidateWatchlistTonightSocial(user.id);
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
			invalidateWatchlistTonightSocial(user.id);
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

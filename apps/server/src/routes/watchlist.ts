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
import { patronHasPlanFeature } from "../lib/plan-feature-access";
import { hit } from "../lib/rate-limit";
import { recordProductEvent } from "../lib/record-product-event";
import { routeBody } from "../lib/route-body";
import { traceTiming } from "../lib/trace-timing";
import { handleWatchlistAlertPatch } from "../lib/watchlist-alert-patch";
import {
	WATCHLIST_NO_PROVIDERS_TMDB_JSON,
	watchlistProvidersTmdbJsonForRegion,
} from "../lib/watchlist-lobby-tmdb-json";
import {
	parseWatchlistProviderIds,
	titleFlatrateIncludesAllProviders,
} from "../lib/watchlist-provider-filter";
import {
	parseWatchlistLimit,
	parseWatchlistOrder,
	parseWatchlistPage,
	watchlistLookaheadPageMeta,
	watchlistOffset,
} from "../lib/watchlist-query-args";
import {
	readWatchlistRanked,
	sliceWatchlistRankedPage,
	watchlistRankedCacheKey,
	writeWatchlistRanked,
} from "../lib/watchlist-ranked-cache";
import {
	primaryFlatrateProviderName,
	readCatalogWatchRegionPref,
	readCatalogWatchRegionPrefOrNull,
	readCatalogWatchRegionSignal,
} from "../lib/watchlist-streaming-alerts";
import {
	rankWatchlistTonight,
	type WatchlistTonightReasonKind,
} from "../lib/watchlist-tonight-score";
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

/**
 * Shared column set for the legacy paged query and the decision pool query.
 * `tmdbJson` is the region-scoped provider projection for the one region the
 * caller evaluates (or a null literal when there is none).
 */
function watchlistSelectShape(tmdbJson: SQL<Record<string, unknown> | null>) {
	return {
		item: watchlistItem,
		movieTmdbId: movie.tmdbId,
		movieTitle: movie.title,
		moviePosterPath: movie.posterPath,
		movieGenreIds: movie.genreIds,
		tvTmdbId: tv.tmdbId,
		tvTitle: tv.title,
		tvPosterPath: tv.posterPath,
		tvGenreIds: tv.genreIds,
		tmdbJson,
		streamingAlert: watchlistItem.streamingAlert,
	};
}

/** One ranked tonight/available entry — cached, so no `tmdbJson` is kept. */
type WatchlistRankedEntry = {
	row: WatchlistSelectRow;
	providerName: string | null;
	reason: string | null;
	/** Analytics-safe reason bucket — never the label (it carries names/list titles). */
	reasonKind: WatchlistTonightReasonKind | null;
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

/**
 * Lobby row shape shared by every `?order=` mode.
 * `providerName` is the pill provider (legacy modes keep the US fallback);
 * `chosenRegion` / `streamingInRegion` are the patron's own region only, so
 * the alert affordance never promises an alert the job can't deliver.
 */
function toWatchlistRow(
	row: WatchlistSelectRow,
	opts: {
		providerName: string | null;
		reason: string | null;
		reasonKind: WatchlistTonightReasonKind | null;
		chosenRegion: string | null;
		/** Streams on a flatrate service in `chosenRegion`; null without one. */
		streamingInRegion: boolean | null;
	},
) {
	const { providerName, reason } = opts;
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
		tonight_reason_kind: opts.reasonKind,
		streaming_alert: row.streamingAlert,
		streaming_region: opts.chosenRegion,
		streaming_in_region: opts.chosenRegion ? opts.streamingInRegion : null,
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
 * subscription service in the patron's chosen region, plus 3 samples. Only
 * reachable with a chosen region (the PATCH answers `NEEDS_REGION` first).
 */
type WatchlistAlertPreviewSample = {
	listingKind: "movie" | "tv";
	tmdbId: number;
	title: string;
	posterPath: string | null;
};

async function loadWatchlistAlertPreview(
	userId: string,
	region: string,
	prefs: Record<string, unknown> | null,
): Promise<{
	notStreamingCount: number;
	sample: WatchlistAlertPreviewSample[];
}> {
	const rows = await db
		.select({
			movieTmdbId: movie.tmdbId,
			movieTitle: movie.title,
			moviePosterPath: movie.posterPath,
			tvTmdbId: tv.tmdbId,
			tvTitle: tv.title,
			tvPosterPath: tv.posterPath,
			tmdbJson: watchlistProvidersTmdbJsonForRegion(region),
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

/**
 * Bounded candidate pool for `tonight` / `available` — filter/score in TS.
 * Only the chosen region's providers are projected; with no chosen region
 * availability contributes nothing (no guess), so no JSON is read at all.
 */
async function rankWatchlistDecisionPool(args: {
	userId: string;
	order: "tonight" | "available";
	chosenRegion: string | null;
	whereClause: SQL | undefined;
	tiebreak: SQL;
}): Promise<WatchlistRankedEntry[]> {
	const { userId, order, chosenRegion } = args;
	const pool = await traceTiming("db", `watchlist.${order}.pool`, () =>
		db
			.select(
				watchlistSelectShape(
					chosenRegion
						? watchlistProvidersTmdbJsonForRegion(chosenRegion)
						: WATCHLIST_NO_PROVIDERS_TMDB_JSON,
				),
			)
			.from(watchlistItem)
			.leftJoin(movie, eq(watchlistItem.movieId, movie.tmdbId))
			.leftJoin(tv, eq(watchlistItem.tvId, tv.tmdbId))
			.where(args.whereClause)
			.orderBy(desc(watchlistItem.addedAt), args.tiebreak)
			.limit(WATCHLIST_DECISION_POOL_LIMIT),
	);
	// Drop `tmdbJson` once the provider is read — ranked entries are cached.
	const withProvider = pool.map(({ tmdbJson, ...row }) => ({
		row,
		providerName: chosenRegion
			? primaryFlatrateProviderName(tmdbJson, chosenRegion)
			: null,
	}));

	if (order === "available") {
		return withProvider
			.filter((r) => r.providerName != null)
			.map((r) => ({
				...r,
				reason: `Now on ${r.providerName}`,
				reasonKind: "available" as const,
			}));
	}

	const social = await traceTiming("db", "watchlist.tonight.social", () =>
		loadWatchlistTonightSocial(userId),
	);
	const now = new Date();
	return rankWatchlistTonight(
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
		reasonKind: ranked.reason?.kind ?? null,
	}));
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
			const providerIds = parseWatchlistProviderIds(query.providers);
			const offset = watchlistOffset(page, limit);

			const prefs = await loadPatronPreferences(user.id);
			const showAdultContent = readShowAdultContentPref(prefs);
			const watchRegion = readCatalogWatchRegionPref(prefs);
			// Decision modes need an explicit region — the US fallback would mislead.
			const chosenRegion = readCatalogWatchRegionPrefOrNull(prefs);
			/** Lobby guidance only: ISO code, `"ALL"` (all countries), or null (unset). */
			const region = readCatalogWatchRegionSignal(prefs);

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
					region,
				};
			}
			if (order === "available" || order === "tonight") {
				const cacheKey = watchlistRankedCacheKey({
					userId: user.id,
					order,
					region: chosenRegion,
					showAdultContent,
				});
				// Page 1 always re-ranks (fresh after a log / refresh); later pages
				// slice the ranking page 1 cached so the scroll session stays stable.
				let ranked =
					page > 1
						? readWatchlistRanked<WatchlistRankedEntry>(cacheKey)
						: undefined;
				if (!ranked) {
					ranked = await rankWatchlistDecisionPool({
						userId: user.id,
						order,
						chosenRegion,
						whereClause,
						tiebreak,
					});
					writeWatchlistRanked(cacheKey, ranked);
				}
				const slice = sliceWatchlistRankedPage(ranked, page, limit);
				return {
					results: slice.rows.map((r) =>
						toWatchlistRow(r.row, {
							providerName: r.providerName,
							reason: r.reason,
							reasonKind: r.reasonKind,
							chosenRegion,
							// Pool providers are evaluated in `chosenRegion` only.
							streamingInRegion: r.providerName != null,
						}),
					),
					total_pages: slice.totalPages,
					total_results: slice.totalResults,
					region,
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

			// Platform morph filter — AND flatrate match in the patron's chosen region.
			if (providerIds.length > 0) {
				if (chosenRegion == null) {
					return {
						results: [],
						total_pages: 0,
						total_results: 0,
						needs_region: true as const,
						region,
					};
				}
				const pool = await traceTiming("db", "watchlist.providers.pool", () =>
					db
						.select(
							watchlistSelectShape(
								watchlistProvidersTmdbJsonForRegion(chosenRegion),
							),
						)
						.from(watchlistItem)
						.leftJoin(movie, eq(watchlistItem.movieId, movie.tmdbId))
						.leftJoin(tv, eq(watchlistItem.tvId, tv.tmdbId))
						.where(whereClause)
						.orderBy(...orderBy)
						.limit(WATCHLIST_DECISION_POOL_LIMIT),
				);
				const filtered = pool.filter((row) =>
					titleFlatrateIncludesAllProviders(
						row.tmdbJson,
						chosenRegion,
						providerIds,
					),
				);
				const slice = sliceWatchlistRankedPage(filtered, page, limit);
				return {
					results: slice.rows.map((row) => {
						const providerName = primaryFlatrateProviderName(
							row.tmdbJson,
							chosenRegion,
						);
						return toWatchlistRow(row, {
							providerName,
							reason: null,
							reasonKind: null,
							chosenRegion,
							streamingInRegion: providerName != null,
						});
					}),
					total_pages: slice.totalPages,
					total_results: slice.totalResults,
					region,
				};
			}

			const fetched = await traceTiming("db", "watchlist.list", () =>
				db
					.select(
						watchlistSelectShape(
							watchlistProvidersTmdbJsonForRegion(watchRegion),
						),
					)
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
				results: rows.map((row) => {
					// `watchRegion` === `chosenRegion` whenever one is chosen, so the
					// same projection answers both the pill and "streams in region".
					const providerName = primaryFlatrateProviderName(
						row.tmdbJson,
						watchRegion,
					);
					return toWatchlistRow(row, {
						providerName,
						reason: null,
						reasonKind: null,
						chosenRegion,
						streamingInRegion: providerName != null,
					});
				}),
				total_pages: totalPages,
				total_results: offset + rows.length,
				region,
			};
		},
		{
			query: t.Object({
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
				order: t.Optional(t.String()),
				/** Comma-separated TMDb provider ids — AND flatrate filter in chosen region. */
				providers: t.Optional(t.String()),
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
			// One prefs read per request, shared by the region gate and preview.
			let prefsPromise: Promise<Record<string, unknown> | null> | null = null;
			const prefs = () => {
				prefsPromise ??= loadPatronPreferences(user.id);
				return prefsPromise;
			};
			const result = await handleWatchlistAlertPatch(
				{ userId: user.id, body },
				{
					loadChosenRegion: async () =>
						readCatalogWatchRegionPrefOrNull(await prefs()),
					hasAlertsFeature: async (userId) =>
						patronHasPlanFeature(
							await loadPatronEntitlements(userId),
							"watchlist_alerts",
						),
					loadPreview: async (userId, region) =>
						loadWatchlistAlertPreview(userId, region, await prefs()),
					setAlert: async (userId, target, enabled) => {
						// Owner-scoped: a title not on this patron's watchlist updates nothing.
						const updated = await db
							.update(watchlistItem)
							.set({ streamingAlert: enabled })
							.where(
								and(
									eq(watchlistItem.userId, userId),
									target.listingKind === "movie"
										? eq(watchlistItem.movieId, target.tmdbId)
										: eq(watchlistItem.tvId, target.tmdbId),
								),
							)
							.returning({ movieId: watchlistItem.movieId });
						return updated.length > 0;
					},
					onUpdated: async (userId, target, enabled) => {
						// Cached ranked rows carry `streaming_alert` — drop them.
						invalidateWatchlistTonightSocial(userId);
						await recordProductEvent(userId, "watchlist.alert_requested", {
							enabled,
							listingKind: target.listingKind,
						});
					},
				},
			);
			switch (result.status) {
				case 200:
					return result.body;
				case 400:
					return status(400, result.body);
				case 401:
					return status(401, result.body);
				case 403:
					return status(403, result.body);
				case 404:
					return status(404, result.body);
				case 409:
					return status(409, result.body);
				default: {
					const unhandled: never = result;
					throw new Error(`Unhandled alert result: ${String(unhandled)}`);
				}
			}
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

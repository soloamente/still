import type { ContentVisibility } from "@still/db";
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
import {
	and,
	asc,
	count,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	or,
	sql,
} from "drizzle-orm";
import { Elysia, t } from "elysia";
import { context } from "../context";
import { movieNotAdultSql, tvNotAdultSql } from "../lib/adult-content-sql";
import { getShowAdultContentForUser } from "../lib/adult-content-user-pref";
import { syncCompletionistChallengesForUser } from "../lib/completionist-challenge-sync";
import {
	contentVisibilityWhere,
	visibilitySchema,
} from "../lib/content-visibility";
import { makeId } from "../lib/cuid";
import {
	diaryOffset,
	diaryTotalPages,
	diaryWatchedAtInPeriodCondition,
	parseDiaryLimit,
	parseDiaryMedia,
	parseDiaryOrder,
	parseDiaryPage,
	parseDiaryVenue,
	parseDiaryWatchDecade,
	parseDiaryWatchYear,
} from "../lib/diary-log-query";
import { fetchDiaryWatchPeriods } from "../lib/diary-watch-periods";
import { ensureMovieCached } from "../lib/ensure-movie-cached";
import { syncFavoritesListForUserTitle } from "../lib/favorites-list-sync";
import { hit } from "../lib/rate-limit";
import { recomputeUserTasteSignature } from "../lib/recompute-user-taste-signature";
import { recordProductEvent } from "../lib/record-product-event";
import {
	assertEmailVerified,
	EmailVerificationRequiredError,
	emailVerificationRequiredBody,
	isPublicContentVisibility,
} from "../lib/require-verified-email";
import { routeBody } from "../lib/route-body";
import { syncLinkedReviewRatingFromLog } from "../lib/sync-linked-review-rating";
import { ensureTvCached } from "../lib/tv-cache";
import { clearTvWatchIfNoDiaryLogsForShow } from "../lib/tv-watch-log-sync";
import {
	backfillWatchStreakFromLogs,
	syncWatchStreakForUser,
} from "../lib/watch-streak-sync";
import { clearWatchlistItemForUserTitle } from "../lib/watchlist-upsert";

/** `inArray` wrapper that no-ops to a false predicate on an empty list. */
function inArrayTvIds(col: typeof log.tvId, ids: number[]) {
	return ids.length ? inArray(col, ids) : sql`false`;
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
	/** Who can see this diary entry. Defaults to the account default. */
	visibility: t.Optional(visibilitySchema),
};

type LogCreateBody = {
	movieId?: number;
	tvId?: number;
	rating?: number;
	liked?: boolean;
	rewatch?: boolean;
	watchedAt?: string;
	note?: string;
	containsSpoilers?: boolean;
	watchVenue?: "theaters" | "streaming";
	logScope?: "show" | "season" | "episode";
	seasonNumber?: number;
	episodeNumber?: number;
	visibility?: ContentVisibility;
};

type LogPatchBody = {
	rating?: number | null;
	liked?: boolean;
	rewatch?: boolean;
	watchedAt?: string;
	note?: string | null;
	containsSpoilers?: boolean;
	watchVenue?: "theaters" | "streaming";
	logScope?: "show" | "season" | "episode";
	seasonNumber?: number | null;
	episodeNumber?: number | null;
	visibility?: ContentVisibility;
};

export const logsRoute = new Elysia({ prefix: "/api/logs", tags: ["logs"] })
	.use(context)
	.post(
		"/",
		async ({ body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in to log a film");
			if (!hit(`logs:create:${user.id}`, { limit: 30, windowMs: 60_000 }).ok) {
				return status(429, "Slow down");
			}
			const body = routeBody<LogCreateBody>(rawBody);
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
				if (scopeCheck.ok === false) {
					return status(400, scopeCheck.message);
				}
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

			const [{ priorLogCount }] = await db
				.select({ priorLogCount: count() })
				.from(log)
				.where(eq(log.userId, user.id));

			let visibility = body.visibility ?? null;
			if (!visibility) {
				const [own] = await db
					.select({ d: profile.defaultVisibility })
					.from(profile)
					.where(eq(profile.userId, user.id))
					.limit(1);
				visibility = own?.d ?? "public";
			}

			if (isPublicContentVisibility(visibility)) {
				try {
					assertEmailVerified(user);
				} catch (e) {
					if (e instanceof EmailVerificationRequiredError) {
						return status(403, emailVerificationRequiredBody());
					}
					throw e;
				}
			}

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
					visibility,
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

			// Watched titles leave the personal watchlist (lobby + engagement chip parity).
			if (movieId != null) {
				await clearWatchlistItemForUserTitle(user.id, { movieId });
			} else if (tvId != null) {
				await clearWatchlistItemForUserTitle(user.id, { tvId });
			}

			void recomputeUserTasteSignature(user.id).catch((err) => {
				console.error("[logs] taste recompute failed", err);
			});

			if (row?.watchedAt) {
				void syncWatchStreakForUser(user.id, row.watchedAt).catch((err) => {
					console.error("[logs] watch streak sync failed", err);
				});
			}

			if (movieId != null) {
				void syncCompletionistChallengesForUser(user.id).catch((err) => {
					console.error("[logs] completionist challenge sync failed", err);
				});
			}

			if (priorLogCount === 0) {
				void recordProductEvent(user.id, "log.first_created", {
					movieId: movieId ?? undefined,
					tvId: tvId ?? undefined,
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
		async ({ params, body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			const body = routeBody<LogPatchBody>(rawBody);
			const [existing] = await db
				.select()
				.from(log)
				.where(eq(log.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id)
				return status(404, "Log not found");

			const effectiveVisibility = body.visibility ?? existing.visibility;
			if (isPublicContentVisibility(effectiveVisibility)) {
				try {
					assertEmailVerified(user);
				} catch (e) {
					if (e instanceof EmailVerificationRequiredError) {
						return status(403, emailVerificationRequiredBody());
					}
					throw e;
				}
			}

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
				if (scopeCheck.ok === false) {
					return status(400, scopeCheck.message);
				}
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
					...(body.visibility ? { visibility: body.visibility } : {}),
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

			if (updated && body.watchedAt !== undefined) {
				void backfillWatchStreakFromLogs(user.id).catch((err) => {
					console.error("[logs] watch streak backfill (patch) failed", err);
				});
			}

			if (updated && body.rating !== undefined) {
				await syncLinkedReviewRatingFromLog(updated.id, updated.rating ?? null);
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
				visibility: t.Optional(visibilitySchema),
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
			if (existing.tvId != null) {
				await clearTvWatchIfNoDiaryLogsForShow(user.id, existing.tvId);
			}
			void backfillWatchStreakFromLogs(user.id).catch((err) => {
				console.error("[logs] watch streak backfill (delete) failed", err);
			});
			return { ok: true };
		},
		{ params: t.Object({ id: t.String() }) },
	)
	// Public diary discover — recent logs from patrons with public profiles (community lobby).
	.get(
		"/recent",
		async ({ query, user: viewer }) => {
			const limit = Math.min(Number(query.limit ?? 30), 60);
			const rows = await db
				.select({ log, movie, tv, user, profile })
				.from(log)
				.innerJoin(profile, eq(log.userId, profile.userId))
				.leftJoin(user, eq(log.userId, user.id))
				.leftJoin(movie, eq(log.movieId, movie.tmdbId))
				.leftJoin(tv, eq(log.tvId, tv.tmdbId))
				.where(
					and(
						eq(profile.isPrivate, false),
						isNull(log.removedAt),
						contentVisibilityWhere(
							viewer?.id ?? null,
							log.userId,
							log.visibility,
						),
					),
				)
				.orderBy(desc(log.watchedAt), desc(log.createdAt), desc(log.id))
				.limit(limit);
			return rows;
		},
		{ query: t.Object({ limit: t.Optional(t.String()) }) },
	)
	// My diary — paginated, grid-shaped feed for `/diary`. Movies are one row per
	// log (rewatches stay separate); TV is deduped to the newest log per show with
	// a logCount + primaryScope for the flip-card caption.
	.get(
		"/me/diary",
		async ({ user, status, query }) => {
			if (!user) return status(401, "Sign in");

			const showAdultContent = await getShowAdultContentForUser(user.id);

			const media = parseDiaryMedia(query.media);
			const order = parseDiaryOrder(query.order);
			const venue = parseDiaryVenue(query.venue);
			const page = parseDiaryPage(query.page);
			const limit = parseDiaryLimit(query.limit);
			const offset = diaryOffset(page, limit);
			const watchYear = parseDiaryWatchYear(query.year);
			const watchDecade =
				watchYear != null ? null : parseDiaryWatchDecade(query.decade);
			const periodWhere = diaryWatchedAtInPeriodCondition(
				log.watchedAt,
				watchYear,
				watchDecade,
			);

			// Venue filter: legacy/unset venue matches both slices (mirrors the web
			// `diaryLogMatchesDiaryLobbyVenue` rule).
			const venueWhere = venue
				? or(
						eq(log.watchVenue, venue),
						sql`${log.watchVenue} not in ('theaters','streaming')`,
					)
				: undefined;

			// Tab counts are venue-independent so tab defaults + empty states are stable.
			const [movieCountRow, tvCountRow] = await Promise.all([
				db
					.select({ total: count() })
					.from(log)
					.where(
						and(
							eq(log.userId, user.id),
							isNull(log.removedAt),
							isNotNull(log.movieId),
						),
					),
				db
					.select({ total: sql<number>`count(distinct ${log.tvId})` })
					.from(log)
					.where(
						and(
							eq(log.userId, user.id),
							isNull(log.removedAt),
							isNotNull(log.tvId),
						),
					),
			]);
			const tabCounts = {
				movies: Number(movieCountRow[0]?.total ?? 0),
				tv: Number(tvCountRow[0]?.total ?? 0),
			};

			const watchPeriodsPromise = fetchDiaryWatchPeriods(
				user.id,
				media,
				showAdultContent,
			);

			if (media === "movie") {
				const where = and(
					eq(log.userId, user.id),
					isNull(log.removedAt),
					isNotNull(log.movieId),
					venueWhere,
					periodWhere,
					movieNotAdultSql(showAdultContent),
				);
				const orderBy =
					order === "earliest"
						? [asc(log.watchedAt), asc(log.createdAt), asc(log.id)]
						: order === "title"
							? [asc(movie.title), desc(log.watchedAt), desc(log.id)]
							: [desc(log.watchedAt), desc(log.createdAt), desc(log.id)];

				const [rows, totalRow, watchPeriods] = await Promise.all([
					db
						.select({
							id: log.id,
							watchedAt: log.watchedAt,
							createdAt: log.createdAt,
							rating: log.rating,
							liked: log.liked,
							rewatch: log.rewatch,
							watchVenue: log.watchVenue,
							tmdbId: movie.tmdbId,
							title: movie.title,
							posterPath: movie.posterPath,
						})
						.from(log)
						.innerJoin(movie, eq(log.movieId, movie.tmdbId))
						.where(where)
						.orderBy(...orderBy)
						.limit(limit)
						.offset(offset),
					db
						.select({ total: count() })
						.from(log)
						.innerJoin(movie, eq(log.movieId, movie.tmdbId))
						.where(where),
					watchPeriodsPromise,
				]);

				const total = Number(totalRow[0]?.total ?? 0);
				return {
					results: rows.map((r) => ({
						kind: "movie" as const,
						log: {
							id: r.id,
							watchedAt: r.watchedAt,
							createdAt: r.createdAt,
							rating: r.rating,
							liked: r.liked,
							rewatch: r.rewatch,
							watchVenue: r.watchVenue,
						},
						movie: {
							tmdbId: r.tmdbId,
							title: r.title,
							posterPath: r.posterPath,
						},
					})),
					total_pages: diaryTotalPages(total, limit),
					total_results: total,
					tabCounts,
					watchPeriods,
				};
			}

			// TV: dedupe to newest log per show, then order/paginate the deduped set.
			const deduped = db
				.selectDistinctOn([log.tvId], {
					tvId: log.tvId,
					watchedAt: log.watchedAt,
					createdAt: log.createdAt,
					watchVenue: log.watchVenue,
					tmdbId: tv.tmdbId,
					title: tv.title,
					posterPath: tv.posterPath,
				})
				.from(log)
				.innerJoin(tv, eq(log.tvId, tv.tmdbId))
				.where(
					and(
						eq(log.userId, user.id),
						isNull(log.removedAt),
						isNotNull(log.tvId),
						periodWhere,
						tvNotAdultSql(showAdultContent),
					),
				)
				.orderBy(
					log.tvId,
					desc(log.watchedAt),
					desc(log.createdAt),
					desc(log.id),
				)
				.as("dedup");

			const outerVenueWhere = venue
				? or(
						eq(deduped.watchVenue, venue),
						sql`${deduped.watchVenue} not in ('theaters','streaming')`,
					)
				: undefined;
			const orderBy =
				order === "earliest"
					? [asc(deduped.watchedAt), asc(deduped.tmdbId)]
					: order === "title"
						? [asc(deduped.title), asc(deduped.tmdbId)]
						: [desc(deduped.watchedAt), desc(deduped.tmdbId)];

			const [rows, totalRow, watchPeriods] = await Promise.all([
				db
					.select({
						tmdbId: deduped.tmdbId,
						title: deduped.title,
						posterPath: deduped.posterPath,
						watchedAt: deduped.watchedAt,
					})
					.from(deduped)
					.where(outerVenueWhere)
					.orderBy(...orderBy)
					.limit(limit)
					.offset(offset),
				db.select({ total: count() }).from(deduped).where(outerVenueWhere),
				watchPeriodsPromise,
			]);

			// Per-show log count + most-specific scope, scoped to the page's shows.
			const pageTvIds = rows
				.map((r) => r.tmdbId)
				.filter((id): id is number => id != null);
			const [countsByShow, scopeByShow] = await Promise.all([
				pageTvIds.length
					? db
							.select({ tvId: log.tvId, total: count() })
							.from(log)
							.where(
								and(
									eq(log.userId, user.id),
									isNull(log.removedAt),
									isNotNull(log.tvId),
									inArrayTvIds(log.tvId, pageTvIds),
								),
							)
							.groupBy(log.tvId)
					: Promise.resolve([] as { tvId: number | null; total: number }[]),
				pageTvIds.length
					? db
							// Representative most-specific log per show: episode > season > show,
							// newest within the chosen tier — drives the front-face caption.
							.selectDistinctOn([log.tvId], {
								tvId: log.tvId,
								logScope: log.logScope,
								seasonNumber: log.seasonNumber,
								episodeNumber: log.episodeNumber,
							})
							.from(log)
							.where(
								and(
									eq(log.userId, user.id),
									isNull(log.removedAt),
									isNotNull(log.tvId),
									inArrayTvIds(log.tvId, pageTvIds),
								),
							)
							.orderBy(
								log.tvId,
								sql`case ${log.logScope} when 'episode' then 3 when 'season' then 2 else 1 end desc`,
								desc(log.watchedAt),
								desc(log.id),
							)
					: Promise.resolve(
							[] as {
								tvId: number | null;
								logScope: string;
								seasonNumber: number | null;
								episodeNumber: number | null;
							}[],
						),
			]);

			const countMap = new Map(
				countsByShow.map((r) => [r.tvId, Number(r.total)]),
			);
			const scopeMap = new Map(scopeByShow.map((r) => [r.tvId, r]));

			const total = Number(totalRow[0]?.total ?? 0);
			return {
				results: rows.map((r) => {
					const scope = scopeMap.get(r.tmdbId);
					return {
						kind: "tvGroup" as const,
						tv: {
							tmdbId: r.tmdbId,
							title: r.title,
							posterPath: r.posterPath,
						},
						logCount: countMap.get(r.tmdbId) ?? 1,
						primaryScope: {
							logScope: (scope?.logScope ?? "show") as
								| "show"
								| "season"
								| "episode",
							seasonNumber: scope?.seasonNumber ?? null,
							episodeNumber: scope?.episodeNumber ?? null,
						},
						newestWatchedAt: r.watchedAt,
					};
				}),
				total_pages: diaryTotalPages(total, limit),
				total_results: total,
				tabCounts,
				watchPeriods,
			};
		},
		{
			query: t.Object({
				media: t.Optional(t.String()),
				order: t.Optional(t.String()),
				venue: t.Optional(t.String()),
				year: t.Optional(t.String()),
				decade: t.Optional(t.String()),
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
		},
	)
	// Diary endpoint: a user's chronologically-ordered logs.
	.get(
		"/by-user/:userId",
		async ({ params, query, user }) => {
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
				.where(
					and(
						eq(log.userId, params.userId),
						isNull(log.removedAt),
						contentVisibilityWhere(
							user?.id ?? null,
							log.userId,
							log.visibility,
						),
					),
				)
				.orderBy(desc(log.watchedAt), desc(log.createdAt), desc(log.id))
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
						isNull(log.removedAt),
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
						isNull(log.removedAt),
						eq(log.tvId, Number(params.tvId)),
						isNotNull(log.tvId),
					),
				)
				.orderBy(desc(log.watchedAt));
			return rows;
		},
		{ params: t.Object({ tvId: t.String() }) },
	);

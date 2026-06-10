import {
	db,
	follow,
	list,
	listItem,
	log,
	movie,
	profile,
	review,
	tv,
	user,
} from "@still/db";
import {
	and,
	desc,
	eq,
	exists,
	inArray,
	isNull,
	lt,
	lte,
	max,
	or,
	sql,
} from "drizzle-orm";
import { Elysia, t } from "elysia";
import { context } from "../context";
import {
	communityPeriodQuery,
	resolveCommunityPeriodQuery,
	withinCommunityPeriod,
} from "../lib/community-period";
import { contentVisibilityWhere } from "../lib/content-visibility";
import { reviewEngagementOrderSql } from "../lib/creator-recognition";
import { fetchDiaryLogCountsForUserIds } from "../lib/diary-metal-tier";
import {
	enrichFeedActivityPayload,
	enrichFeedListRows,
	type FeedActivityKind,
	type FeedSortRow,
	feedAtMs,
	isFeedRowOlderThanCursor,
	listActivityAt,
	readFeedActorUserId,
	serializeFeedAt,
	sortFeedRows,
} from "../lib/feed-items";
import {
	type FeedRatingDivergencePayload,
	findFeedRatingDivergence,
} from "../lib/feed-rating-divergence";

/** Timeline rows returned from `GET /api/feed` before serialization. */
type FeedMergedTimelineItem = {
	kind: FeedActivityKind;
	at: Date;
	payload: unknown;
};

function parseFeedCursor(query: {
	before?: string;
	beforeKind?: string;
	beforeId?: string;
}): FeedSortRow | null {
	if (typeof query.before !== "string" || query.before.length === 0)
		return null;
	const at = new Date(query.before);
	if (Number.isNaN(at.getTime())) return null;
	const kind = query.beforeKind as FeedActivityKind | undefined;
	if (kind && typeof query.beforeId === "string" && query.beforeId.length > 0) {
		return { kind, at, id: query.beforeId };
	}
	return null;
}

function feedRowIdFromMerged(row: FeedMergedTimelineItem): string {
	if (row.kind === "divergence") {
		const payload = row.payload as FeedRatingDivergencePayload;
		return payload.movieId != null
			? `m:${payload.movieId}`
			: `t:${payload.tvId ?? "unknown"}`;
	}
	const pl = row.payload as {
		log?: { id: string };
		review?: { id: string };
		list?: { id: string };
	};
	if (row.kind === "log") return pl.log?.id ?? "";
	if (row.kind === "review") return pl.review?.id ?? "";
	return pl.list?.id ?? "";
}

/**
 * Personalized activity feed: logs + reviews + new lists from people the
 * viewer follows (plus themselves), interleaved by time. v1 fetches each
 * stream separately and merges in-app so the SQL stays understandable.
 */
export const feedRoute = new Elysia({ prefix: "/api/feed", tags: ["feed"] })
	.use(context)
	.get(
		"/",
		async ({ user: viewer, status, query }) => {
			if (!viewer) return status(401, "Sign in");
			const limit = Math.min(Number(query.limit ?? 40), 80);
			const fetchLimit = limit + 24;
			const { start, end } = resolveCommunityPeriodQuery(query);

			const compositeCursor = parseFeedCursor(query);
			const legacyBeforeDate =
				!compositeCursor &&
				typeof query.before === "string" &&
				query.before.length > 0
					? new Date(query.before)
					: null;
			const beforeDateRaw = compositeCursor?.at ?? legacyBeforeDate;
			const beforeCursor =
				beforeDateRaw instanceof Date
					? beforeDateRaw
					: beforeDateRaw != null
						? new Date(beforeDateRaw)
						: null;
			const beforeValid =
				beforeCursor != null && !Number.isNaN(beforeCursor.getTime());

			// Diary rows surface by when the patron logged — not backdated watchedAt.
			const logBefore = beforeValid
				? compositeCursor
					? lte(log.createdAt, beforeCursor)
					: lt(log.createdAt, beforeCursor)
				: undefined;
			const reviewBefore = beforeValid
				? compositeCursor
					? lte(review.publishedAt, beforeCursor)
					: lt(review.publishedAt, beforeCursor)
				: undefined;

			const following = await db
				.select({ id: follow.followingId })
				.from(follow)
				.where(eq(follow.followerId, viewer.id));
			const ids = [viewer.id, ...following.map((f) => f.id)];

			// Latest title add per list — drives list activity time (not metadata edits).
			const latestListAdded = db
				.select({
					listId: listItem.listId,
					latestAddedAt: max(listItem.addedAt).as("latestAddedAt"),
				})
				.from(listItem)
				.groupBy(listItem.listId)
				.as("latestListAdded");

			const listActivityAtSql = sql<Date>`GREATEST(${list.createdAt}, COALESCE(${latestListAdded.latestAddedAt}, ${list.createdAt}))`;
			const listBefore = beforeValid
				? compositeCursor
					? lte(listActivityAtSql, beforeCursor)
					: lt(listActivityAtSql, beforeCursor)
				: undefined;

			const listPeriodWhere = or(
				withinCommunityPeriod(list.createdAt, start, end),
				exists(
					db
						.select({ one: sql`1` })
						.from(listItem)
						.where(
							and(
								eq(listItem.listId, list.id),
								withinCommunityPeriod(listItem.addedAt, start, end),
							),
						),
				),
			);

			const [logs, reviews, lists] = await Promise.all([
				db
					.select({ log, movie, tv, user, profile })
					.from(log)
					.leftJoin(movie, eq(log.movieId, movie.tmdbId))
					.leftJoin(tv, eq(log.tvId, tv.tmdbId))
					.leftJoin(user, eq(log.userId, user.id))
					.leftJoin(profile, eq(profile.userId, user.id))
					.where(
						and(
							inArray(log.userId, ids),
							isNull(log.removedAt),
							contentVisibilityWhere(viewer.id, log.userId, log.visibility),
							withinCommunityPeriod(log.createdAt, start, end),
							logBefore,
						),
					)
					.orderBy(desc(log.createdAt))
					.limit(fetchLimit),
				db
					.select({ review, movie, user, profile })
					.from(review)
					.leftJoin(movie, eq(review.movieId, movie.tmdbId))
					.leftJoin(user, eq(review.userId, user.id))
					.leftJoin(profile, eq(profile.userId, user.id))
					.where(
						and(
							contentVisibilityWhere(
								viewer.id,
								review.userId,
								review.visibility,
							),
							isNull(review.removedAt),
							inArray(review.userId, ids),
							withinCommunityPeriod(review.publishedAt, start, end),
							reviewBefore,
						),
					)
					.orderBy(desc(review.publishedAt))
					.limit(fetchLimit),
				db
					.select({
						list,
						user,
						profile,
						latestItemAddedAt: latestListAdded.latestAddedAt,
					})
					.from(list)
					.leftJoin(latestListAdded, eq(list.id, latestListAdded.listId))
					.leftJoin(user, eq(list.userId, user.id))
					.leftJoin(profile, eq(profile.userId, user.id))
					.where(
						and(
							inArray(list.userId, ids),
							isNull(list.removedAt),
							listPeriodWhere,
							listBefore,
						),
					)
					.orderBy(desc(listActivityAtSql))
					.limit(fetchLimit),
			]);

			const listsEnriched = await enrichFeedListRows(lists);

			const mergedRows: FeedMergedTimelineItem[] = [
				...logs.map((row) => ({
					kind: "log" as const,
					at: row.log.createdAt,
					payload: row,
				})),
				...reviews
					.filter((r) => ids.includes(r.review.userId))
					.map((row) => ({
						kind: "review" as const,
						at: row.review.publishedAt,
						payload: row,
					})),
				...listsEnriched.map((row) => ({
					kind: "list" as const,
					at: listActivityAt(row.list, row.latestItemAddedAt),
					payload: row,
				})),
			];

			const sortable = mergedRows.map((row) => ({
				kind: row.kind,
				at: row.at,
				id: feedRowIdFromMerged(row),
				payload: row.payload,
			}));

			let filtered = sortable;
			if (compositeCursor) {
				filtered = sortable.filter((row) =>
					isFeedRowOlderThanCursor(row, compositeCursor),
				);
			}

			const merged = sortFeedRows(filtered).map((row) => ({
				kind: row.kind,
				at: row.at,
				payload: row.payload,
			}));

			const followingOnly = following.map((f) => f.id);
			const divergence =
				!beforeValid && followingOnly.length >= 2
					? await findFeedRatingDivergence({
							viewerId: viewer.id,
							followingUserIds: followingOnly,
							periodStart: start,
							periodEnd: end,
						})
					: null;

			if (divergence) {
				const divergenceRow: FeedMergedTimelineItem = {
					kind: "divergence",
					at: divergence.at,
					payload: divergence.payload satisfies FeedRatingDivergencePayload,
				};
				merged.splice(Math.min(3, merged.length), 0, divergenceRow);
			}

			const pageRows = merged.slice(0, limit);
			const actorIds = pageRows.flatMap((row) => {
				if (row.kind === "divergence") {
					const payload = row.payload as FeedRatingDivergencePayload;
					return [payload.lowPatron.userId, payload.highPatron.userId];
				}
				const id = readFeedActorUserId(row.payload);
				return id ? [id] : [];
			});
			const logCounts = await fetchDiaryLogCountsForUserIds(actorIds);

			const items = pageRows.map((row) => ({
				kind: row.kind,
				at: serializeFeedAt(row.at),
				payload:
					row.kind === "divergence"
						? row.payload
						: enrichFeedActivityPayload(row.payload, logCounts),
			}));

			return { items };
		},
		{
			query: t.Composite([
				t.Object({
					limit: t.Optional(t.String()),
					before: t.Optional(t.String()),
					beforeKind: t.Optional(
						t.Union([
							t.Literal("log"),
							t.Literal("review"),
							t.Literal("list"),
							t.Literal("divergence"),
						]),
					),
					beforeId: t.Optional(t.String()),
				}),
				communityPeriodQuery,
			]),
		},
	)
	// Public discovery feed for the logged-out home page: trending reviews
	// and lists across the platform.
	.get(
		"/discover",
		async ({ query }) => {
			const { start, end } = resolveCommunityPeriodQuery(query);
			const [topReviews, topLists] = await Promise.all([
				db
					.select({ review, movie, user, profile })
					.from(review)
					.leftJoin(movie, eq(review.movieId, movie.tmdbId))
					.leftJoin(user, eq(review.userId, user.id))
					.leftJoin(profile, eq(profile.userId, user.id))
					.where(
						and(
							contentVisibilityWhere(null, review.userId, review.visibility),
							isNull(review.removedAt),
							withinCommunityPeriod(review.publishedAt, start, end),
						),
					)
					.orderBy(desc(reviewEngagementOrderSql()), desc(review.publishedAt))
					.limit(20),
				db
					.select({ list, user, profile })
					.from(list)
					.leftJoin(user, eq(list.userId, user.id))
					.leftJoin(profile, eq(profile.userId, user.id))
					.where(
						and(
							eq(list.isPublic, true),
							isNull(list.removedAt),
							withinCommunityPeriod(list.updatedAt, start, end),
						),
					)
					.orderBy(desc(list.likesCount), desc(list.updatedAt))
					.limit(12),
			]);
			const topListsEnriched = await enrichFeedListRows(topLists);

			const items = [
				...topReviews.map((row) => ({
					kind: "review" as const,
					at: row.review.publishedAt,
					payload: row,
				})),
				...topListsEnriched.map((row) => ({
					kind: "list" as const,
					at: row.list.updatedAt,
					payload: row,
				})),
			].sort((a, b) => feedAtMs(b.at) - feedAtMs(a.at));

			const discoverActorIds = items.flatMap((row) => {
				const id = readFeedActorUserId(row.payload);
				return id ? [id] : [];
			});
			const discoverLogCounts =
				await fetchDiaryLogCountsForUserIds(discoverActorIds);

			return {
				items: items.map((row) => ({
					kind: row.kind,
					at: serializeFeedAt(row.at),
					payload: enrichFeedActivityPayload(row.payload, discoverLogCounts),
				})),
			};
		},
		{ query: communityPeriodQuery },
	);

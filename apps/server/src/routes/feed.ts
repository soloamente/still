import {
	db,
	follow,
	list,
	log,
	movie,
	profile,
	review,
	tv,
	user,
} from "@still/db";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { context } from "../context";
import {
	communityPeriodQuery,
	resolveCommunityPeriodQuery,
	withinCommunityPeriod,
} from "../lib/community-period";
import { contentVisibilityWhere } from "../lib/content-visibility";
import { reviewEngagementOrderSql } from "../lib/creator-recognition";
import {
	enrichFeedListRows,
	feedAtMs,
	serializeFeedAt,
} from "../lib/feed-items";
import {
	type FeedRatingDivergencePayload,
	findFeedRatingDivergence,
} from "../lib/feed-rating-divergence";

/** Timeline rows returned from `GET /api/feed` before serialization. */
type FeedMergedTimelineItem = {
	kind: "log" | "review" | "list" | "divergence";
	at: Date;
	payload: unknown;
};

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
			const { start, end } = resolveCommunityPeriodQuery(query);

			const beforeDate =
				typeof query.before === "string" && query.before.length > 0
					? new Date(query.before)
					: null;
			const beforeValid =
				beforeDate != null && !Number.isNaN(beforeDate.getTime());
			const logBefore =
				beforeDate != null && !Number.isNaN(beforeDate.getTime())
					? lt(log.watchedAt, beforeDate)
					: undefined;
			const reviewBefore =
				beforeDate != null && !Number.isNaN(beforeDate.getTime())
					? lt(review.publishedAt, beforeDate)
					: undefined;
			const listBefore =
				beforeDate != null && !Number.isNaN(beforeDate.getTime())
					? lt(list.updatedAt, beforeDate)
					: undefined;

			const following = await db
				.select({ id: follow.followingId })
				.from(follow)
				.where(eq(follow.followerId, viewer.id));
			const ids = [viewer.id, ...following.map((f) => f.id)];

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
							contentVisibilityWhere(viewer.id, log.userId, log.visibility),
							withinCommunityPeriod(log.watchedAt, start, end),
							logBefore,
						),
					)
					.orderBy(desc(log.watchedAt))
					.limit(limit),
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
							inArray(review.userId, ids),
							withinCommunityPeriod(review.publishedAt, start, end),
							reviewBefore,
						),
					)
					.orderBy(desc(review.publishedAt))
					.limit(limit),
				db
					.select({ list, user, profile })
					.from(list)
					.leftJoin(user, eq(list.userId, user.id))
					.leftJoin(profile, eq(profile.userId, user.id))
					.where(
						and(
							inArray(list.userId, ids),
							withinCommunityPeriod(list.updatedAt, start, end),
							listBefore,
						),
					)
					.orderBy(desc(list.updatedAt))
					.limit(limit),
			]);

			const listsEnriched = await enrichFeedListRows(lists);

			const merged: FeedMergedTimelineItem[] = [
				...logs.map((row) => ({
					kind: "log" as const,
					at: row.log.watchedAt,
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
					at: row.list.updatedAt,
					payload: row,
				})),
			].sort((a, b) => feedAtMs(b.at) - feedAtMs(a.at));

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

			const items = merged.slice(0, limit).map((row) => ({
				kind: row.kind,
				at: serializeFeedAt(row.at),
				payload: row.payload,
			}));

			return { items };
		},
		{
			query: t.Composite([
				t.Object({
					limit: t.Optional(t.String()),
					before: t.Optional(t.String()),
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
			]
				.sort((a, b) => feedAtMs(b.at) - feedAtMs(a.at))
				.map((row) => ({
					kind: row.kind,
					at: serializeFeedAt(row.at),
					payload: row.payload,
				}));
			return { items };
		},
		{ query: communityPeriodQuery },
	);

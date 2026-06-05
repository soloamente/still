import { db, list, profile, review, user } from "@still/db";
import { and, eq, inArray, sql } from "drizzle-orm";

import { creatorRecognitionThresholds } from "./creator-recognition-config";
import { LIST_DESCRIPTION_DISCOVERABILITY_MIN_CHARS } from "./list-quality";

/** Review Community ranking — engagement, not body length (SN.11). */
export const REVIEW_ENGAGEMENT_LIKE_WEIGHT = 2;
export const REVIEW_ENGAGEMENT_COMMENT_WEIGHT = 3;

export interface CuratorContributionStats {
	publicListsCount: number;
	describedPublicListsCount: number;
	totalListLikes: number;
	publicReviewsCount: number;
	totalReviewLikes: number;
}

export interface CuratorSpotlightPatron {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	headline: string;
	spotlightScore: number;
}

export function reviewEngagementScore(
	likesCount: number,
	commentsCount: number,
): number {
	return (
		likesCount * REVIEW_ENGAGEMENT_LIKE_WEIGHT +
		commentsCount * REVIEW_ENGAGEMENT_COMMENT_WEIGHT
	);
}

/** SQL fragment for ordering public reviews by engagement within a period filter. */
export function reviewEngagementOrderSql() {
	return sql`(${review.likesCount} * ${REVIEW_ENGAGEMENT_LIKE_WEIGHT} + ${review.commentsCount} * ${REVIEW_ENGAGEMENT_COMMENT_WEIGHT})`;
}

const listDescribedSql = sql`CASE WHEN length(trim(coalesce(${list.description}, ''))) >= ${LIST_DESCRIPTION_DISCOVERABILITY_MIN_CHARS} THEN 1 ELSE 0 END`;

/**
 * v1 curator designation — quality lists and/or review reach, not raw volume alone.
 */
export function qualifiesAsCurator(stats: CuratorContributionStats): boolean {
	const t = creatorRecognitionThresholds();
	if (
		stats.publicListsCount >= t.minPublicLists &&
		stats.describedPublicListsCount >= t.minDescribedPublicLists
	) {
		return true;
	}
	if (stats.totalListLikes >= t.minTotalListLikes) {
		return true;
	}
	if (
		stats.publicReviewsCount >= t.minPublicReviews &&
		stats.totalReviewLikes >= t.minTotalReviewLikes
	) {
		return true;
	}
	return false;
}

export function buildCuratorHeadline(stats: CuratorContributionStats): string {
	if (stats.publicListsCount > 0 && stats.totalListLikes > 0) {
		return `${stats.publicListsCount} public lists · ${stats.totalListLikes} list likes`;
	}
	if (stats.publicListsCount > 0) {
		return `${stats.publicListsCount} public list${stats.publicListsCount === 1 ? "" : "s"}`;
	}
	if (stats.publicReviewsCount > 0) {
		return `${stats.publicReviewsCount} reviews · ${stats.totalReviewLikes} likes`;
	}
	return "Curator on Sense";
}

export function curatorSpotlightScore(stats: CuratorContributionStats): number {
	const describedBoost = stats.describedPublicListsCount * 12;
	const listBoost = stats.publicListsCount * 4 + stats.totalListLikes;
	const reviewBoost = stats.publicReviewsCount * 3 + stats.totalReviewLikes * 2;
	return describedBoost + listBoost + reviewBoost;
}

export async function fetchCuratorStatsForUser(
	userId: string,
): Promise<CuratorContributionStats> {
	const [listRow] = await db
		.select({
			publicListsCount: sql<number>`count(*)::int`,
			describedPublicListsCount: sql<number>`coalesce(sum(${listDescribedSql}), 0)::int`,
			totalListLikes: sql<number>`coalesce(sum(${list.likesCount}), 0)::int`,
		})
		.from(list)
		.where(and(eq(list.userId, userId), eq(list.isPublic, true)));

	const [reviewRow] = await db
		.select({
			publicReviewsCount: sql<number>`count(*)::int`,
			totalReviewLikes: sql<number>`coalesce(sum(${review.likesCount}), 0)::int`,
		})
		.from(review)
		.where(and(eq(review.userId, userId), eq(review.visibility, "public")));

	return {
		publicListsCount: Number(listRow?.publicListsCount ?? 0),
		describedPublicListsCount: Number(listRow?.describedPublicListsCount ?? 0),
		totalListLikes: Number(listRow?.totalListLikes ?? 0),
		publicReviewsCount: Number(reviewRow?.publicReviewsCount ?? 0),
		totalReviewLikes: Number(reviewRow?.totalReviewLikes ?? 0),
	};
}

export async function resolveCuratorRecognition(userId: string): Promise<{
	isCurator: boolean;
	headline: string | null;
}> {
	const stats = await fetchCuratorStatsForUser(userId);
	const isCurator = qualifiesAsCurator(stats);
	return {
		isCurator,
		headline: isCurator ? buildCuratorHeadline(stats) : null,
	};
}

/**
 * Top patrons by list + review contribution — powers Community curator spotlights.
 */
export async function fetchCuratorSpotlightPatrons(
	limit = 6,
): Promise<CuratorSpotlightPatron[]> {
	const capped = Math.min(Math.max(limit, 1), 12);
	const { minPublicListsForSpotlightAgg } = creatorRecognitionThresholds();

	const listAgg = await db
		.select({
			userId: list.userId,
			publicListsCount: sql<number>`count(*)::int`,
			describedPublicListsCount: sql<number>`coalesce(sum(${listDescribedSql}), 0)::int`,
			totalListLikes: sql<number>`coalesce(sum(${list.likesCount}), 0)::int`,
		})
		.from(list)
		.where(eq(list.isPublic, true))
		.groupBy(list.userId)
		.having(sql`count(*) >= ${minPublicListsForSpotlightAgg}`);

	const reviewAgg = await db
		.select({
			userId: review.userId,
			publicReviewsCount: sql<number>`count(*)::int`,
			totalReviewLikes: sql<number>`coalesce(sum(${review.likesCount}), 0)::int`,
		})
		.from(review)
		.where(eq(review.visibility, "public"))
		.groupBy(review.userId);

	const statsByUser = new Map<string, CuratorContributionStats>();

	for (const row of listAgg) {
		statsByUser.set(row.userId, {
			publicListsCount: Number(row.publicListsCount ?? 0),
			describedPublicListsCount: Number(row.describedPublicListsCount ?? 0),
			totalListLikes: Number(row.totalListLikes ?? 0),
			publicReviewsCount: 0,
			totalReviewLikes: 0,
		});
	}

	for (const row of reviewAgg) {
		const existing = statsByUser.get(row.userId) ?? {
			publicListsCount: 0,
			describedPublicListsCount: 0,
			totalListLikes: 0,
			publicReviewsCount: 0,
			totalReviewLikes: 0,
		};
		existing.publicReviewsCount = Number(row.publicReviewsCount ?? 0);
		existing.totalReviewLikes = Number(row.totalReviewLikes ?? 0);
		statsByUser.set(row.userId, existing);
	}

	const ranked = [...statsByUser.entries()]
		.map(([userId, stats]) => ({
			userId,
			stats,
			score: curatorSpotlightScore(stats),
		}))
		.filter((row) => qualifiesAsCurator(row.stats))
		.sort((a, b) => b.score - a.score)
		.slice(0, capped);

	if (ranked.length === 0) return [];

	const userIds = ranked.map((row) => row.userId);
	const profiles = await db
		.select({
			userId: profile.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			image: user.image,
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.where(and(eq(profile.isPrivate, false), inArray(profile.userId, userIds)));

	const profileByUser = new Map(profiles.map((row) => [row.userId, row]));

	return ranked
		.map((row) => {
			const patron = profileByUser.get(row.userId);
			if (!patron) return null;
			return {
				userId: row.userId,
				handle: patron.handle,
				displayName: patron.displayName,
				image: patron.image,
				headline: buildCuratorHeadline(row.stats),
				spotlightScore: row.score,
			} satisfies CuratorSpotlightPatron;
		})
		.filter((row): row is CuratorSpotlightPatron => row != null);
}

import type { StaffRole } from "@still/auth/permissions";
import {
	block,
	db,
	LIST_SYSTEM_KIND_FAVORITES,
	list,
	log,
	profile,
	reaction,
	review,
	user,
} from "@still/db";
import type { PlanTierId } from "@still/plans";
import { and, asc, desc, eq, gte, isNull, lt, ne, or, sql } from "drizzle-orm";

import { communityOffset } from "./community-page-args";
import { withinCommunityPeriod } from "./community-period";
import type { DiaryMetalTier } from "./diary-metal-tier";
import { annotateViewerFollows, fetchViewerFollowingIds } from "./follow-list";
import type { LeaderboardPeriod } from "./leaderboard-period";
import { resolveLeaderboardWindow } from "./leaderboard-period";
import {
	isEligibleLeaderboardProfile,
	leaderboardPublicProfileConditions,
} from "./leaderboard-profile-eligibility";
import {
	fetchPatronAvatarBadgeMaps,
	patronAvatarBadgeFields,
} from "./patron-avatar-badge";
import { readAvatarIsAnimatedPref } from "./profile-media";

export type MembersLeaderboardSort = "popular" | "reviews" | "lists" | "likes";

export const MEMBERS_LEADERBOARD_DEFAULT_LIMIT = 25;
export const MEMBERS_LEADERBOARD_MAX_LIMIT = 50;

export type MembersLeaderboardEntry = {
	rank: number;
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	avatarIsAnimated: boolean;
	diaryMetalTier: DiaryMetalTier | null;
	planTier: PlanTierId;
	staffRole: StaffRole | null;
	count: number;
	viewerFollows: boolean;
};

export type MembersLeaderboardResult = {
	sort: MembersLeaderboardSort;
	period: LeaderboardPeriod;
	window: { start: string; end: string };
	page: number;
	limit: number;
	nextPage: number | null;
	items: MembersLeaderboardEntry[];
};

type AggregatedRow = {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	preferences: unknown;
	count: number;
	tieAt: Date | null;
};

/** Parse `sort` query — defaults to **popular** (diary volume). */
export function parseMembersLeaderboardSort(
	raw: string | undefined,
): MembersLeaderboardSort {
	const s = raw?.trim().toLowerCase() ?? "";
	if (s === "reviews" || s === "lists" || s === "likes" || s === "popular") {
		return s;
	}
	return "popular";
}

export function parseMembersLeaderboardLimit(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return MEMBERS_LEADERBOARD_DEFAULT_LIMIT;
	return Math.min(Math.floor(n), MEMBERS_LEADERBOARD_MAX_LIMIT);
}

/** Public directory rows only — private profiles never appear on `/members`. */
export function isEligibleMembersLeaderboardProfile(
	isPrivate: boolean,
): boolean {
	return isEligibleLeaderboardProfile(isPrivate);
}

/** Stable ordering for equal counts — higher `count`, earlier `tieAt`, then handle. */
export function rankMembersLeaderboardRows<T extends AggregatedRow>(
	rows: T[],
): (T & { rank: number })[] {
	const sorted = rows.slice().sort((a, b) => {
		if (b.count !== a.count) return b.count - a.count;
		const aTie = a.tieAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
		const bTie = b.tieAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
		if (aTie !== bTie) return aTie - bTie;
		return a.handle.localeCompare(b.handle);
	});
	return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

async function blockedUserIdsForViewer(viewerId: string): Promise<string[]> {
	const rows = await db
		.select({
			blockerId: block.blockerId,
			blockedId: block.blockedId,
		})
		.from(block)
		.where(or(eq(block.blockerId, viewerId), eq(block.blockedId, viewerId)));
	const ids = new Set<string>();
	for (const row of rows) {
		if (row.blockerId === viewerId) ids.add(row.blockedId);
		else ids.add(row.blockerId);
	}
	return [...ids];
}

function publicProfileConditions(blockedIds: string[]) {
	return leaderboardPublicProfileConditions(blockedIds);
}

async function fetchPopularRows(
	start: Date,
	end: Date,
	blockedIds: string[],
	limit: number,
	offset: number,
): Promise<AggregatedRow[]> {
	// Aggregate diary activity per patron, then left-join every public profile so
	// zero-log patrons still appear in the directory (count 0 at the tail).
	const activity = db
		.select({
			userId: log.userId,
			count: sql<number>`count(*)::int`.as("count"),
			tieAt: sql<Date>`max(${log.watchedAt})`.as("tie_at"),
		})
		.from(log)
		.where(
			and(
				isNull(log.removedAt),
				eq(log.visibility, "public"),
				gte(log.watchedAt, start),
				lt(log.watchedAt, end),
			),
		)
		.groupBy(log.userId)
		.as("activity");

	const rows = await db
		.select({
			userId: profile.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			image: user.image,
			preferences: profile.preferences,
			count: sql<number>`coalesce(${activity.count}, 0)::int`.as("count"),
			tieAt: activity.tieAt,
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.leftJoin(activity, eq(profile.userId, activity.userId))
		.where(and(...publicProfileConditions(blockedIds)))
		.orderBy(
			desc(sql`coalesce(${activity.count}, 0)`),
			asc(sql`coalesce(${activity.tieAt}, to_timestamp(0))`),
			asc(profile.handle),
		)
		.limit(limit)
		.offset(offset);

	return rows.map((row) => ({
		userId: row.userId,
		handle: row.handle,
		displayName: row.displayName,
		image: row.image ?? null,
		preferences: row.preferences,
		count: Number(row.count),
		tieAt: row.tieAt ?? null,
	}));
}

async function fetchReviewRows(
	start: Date,
	end: Date,
	blockedIds: string[],
	limit: number,
	offset: number,
): Promise<AggregatedRow[]> {
	const activity = db
		.select({
			userId: review.userId,
			count: sql<number>`count(*)::int`.as("count"),
			tieAt: sql<Date>`max(${review.publishedAt})`.as("tie_at"),
		})
		.from(review)
		.where(
			and(
				isNull(review.removedAt),
				eq(review.visibility, "public"),
				withinCommunityPeriod(review.publishedAt, start, end),
			),
		)
		.groupBy(review.userId)
		.as("activity");

	const rows = await db
		.select({
			userId: profile.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			image: user.image,
			preferences: profile.preferences,
			count: sql<number>`coalesce(${activity.count}, 0)::int`.as("count"),
			tieAt: activity.tieAt,
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.leftJoin(activity, eq(profile.userId, activity.userId))
		.where(and(...publicProfileConditions(blockedIds)))
		.orderBy(
			desc(sql`coalesce(${activity.count}, 0)`),
			asc(sql`coalesce(${activity.tieAt}, to_timestamp(0))`),
			asc(profile.handle),
		)
		.limit(limit)
		.offset(offset);

	return rows.map((row) => ({
		userId: row.userId,
		handle: row.handle,
		displayName: row.displayName,
		image: row.image ?? null,
		preferences: row.preferences,
		count: Number(row.count),
		tieAt: row.tieAt ?? null,
	}));
}

async function fetchListRows(
	start: Date,
	end: Date,
	blockedIds: string[],
	limit: number,
	offset: number,
): Promise<AggregatedRow[]> {
	const activity = db
		.select({
			userId: list.userId,
			count: sql<number>`count(*)::int`.as("count"),
			tieAt: sql<Date>`max(${list.createdAt})`.as("tie_at"),
		})
		.from(list)
		.where(
			and(
				eq(list.isPublic, true),
				isNull(list.removedAt),
				or(
					isNull(list.systemKind),
					ne(list.systemKind, LIST_SYSTEM_KIND_FAVORITES),
				),
				withinCommunityPeriod(list.createdAt, start, end),
			),
		)
		.groupBy(list.userId)
		.as("activity");

	const rows = await db
		.select({
			userId: profile.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			image: user.image,
			preferences: profile.preferences,
			count: sql<number>`coalesce(${activity.count}, 0)::int`.as("count"),
			tieAt: activity.tieAt,
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.leftJoin(activity, eq(profile.userId, activity.userId))
		.where(and(...publicProfileConditions(blockedIds)))
		.orderBy(
			desc(sql`coalesce(${activity.count}, 0)`),
			asc(sql`coalesce(${activity.tieAt}, to_timestamp(0))`),
			asc(profile.handle),
		)
		.limit(limit)
		.offset(offset);

	return rows.map((row) => ({
		userId: row.userId,
		handle: row.handle,
		displayName: row.displayName,
		image: row.image ?? null,
		preferences: row.preferences,
		count: Number(row.count),
		tieAt: row.tieAt ?? null,
	}));
}

async function fetchLikeRows(
	start: Date,
	end: Date,
	blockedIds: string[],
	limit: number,
	offset: number,
): Promise<AggregatedRow[]> {
	const activity = db
		.select({
			userId: review.userId,
			count: sql<number>`count(*)::int`.as("count"),
			tieAt: sql<Date>`max(${reaction.createdAt})`.as("tie_at"),
		})
		.from(reaction)
		.innerJoin(
			review,
			and(eq(reaction.parentType, "review"), eq(reaction.parentId, review.id)),
		)
		.where(
			and(
				eq(reaction.kind, "like"),
				withinCommunityPeriod(reaction.createdAt, start, end),
				isNull(review.removedAt),
				eq(review.visibility, "public"),
			),
		)
		.groupBy(review.userId)
		.as("activity");

	const rows = await db
		.select({
			userId: profile.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			image: user.image,
			preferences: profile.preferences,
			count: sql<number>`coalesce(${activity.count}, 0)::int`.as("count"),
			tieAt: activity.tieAt,
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.leftJoin(activity, eq(profile.userId, activity.userId))
		.where(and(...publicProfileConditions(blockedIds)))
		.orderBy(
			desc(sql`coalesce(${activity.count}, 0)`),
			asc(sql`coalesce(${activity.tieAt}, to_timestamp(0))`),
			asc(profile.handle),
		)
		.limit(limit)
		.offset(offset);

	return rows.map((row) => ({
		userId: row.userId,
		handle: row.handle,
		displayName: row.displayName,
		image: row.image ?? null,
		preferences: row.preferences,
		count: Number(row.count),
		tieAt: row.tieAt ?? null,
	}));
}

async function fetchSortRows(
	sort: MembersLeaderboardSort,
	start: Date,
	end: Date,
	blockedIds: string[],
	limit: number,
	offset: number,
): Promise<AggregatedRow[]> {
	switch (sort) {
		case "popular":
			return fetchPopularRows(start, end, blockedIds, limit, offset);
		case "reviews":
			return fetchReviewRows(start, end, blockedIds, limit, offset);
		case "lists":
			return fetchListRows(start, end, blockedIds, limit, offset);
		case "likes":
			return fetchLikeRows(start, end, blockedIds, limit, offset);
		default: {
			const never: never = sort;
			throw new Error(`Unhandled members leaderboard sort: ${never}`);
		}
	}
}

/**
 * Patron directory leaderboard — ranks public profiles by activity in the window.
 */
export async function fetchMembersLeaderboard(opts: {
	sort: MembersLeaderboardSort;
	period: LeaderboardPeriod;
	tz: string | undefined;
	viewerId: string | null;
	page?: number;
	limit?: number;
	now?: Date;
	/** When set, skips `resolveLeaderboardWindow` (month-recap, backfills). */
	window?: { start: Date; end: Date };
}): Promise<MembersLeaderboardResult> {
	const page = opts.page ?? 1;
	const limit = opts.limit ?? MEMBERS_LEADERBOARD_DEFAULT_LIMIT;
	const offset = communityOffset(page, limit);
	const { start, end } =
		opts.window ?? resolveLeaderboardWindow(opts.period, opts.tz, opts.now);
	const blockedIds = opts.viewerId
		? await blockedUserIdsForViewer(opts.viewerId)
		: [];

	const slice = await fetchSortRows(
		opts.sort,
		start,
		end,
		blockedIds,
		limit + 1,
		offset,
	);
	const hasMore = slice.length > limit;
	const pageRows = hasMore ? slice.slice(0, limit) : slice;

	const userIds = pageRows.map((row) => row.userId);
	const badgeMaps = await fetchPatronAvatarBadgeMaps(userIds);
	// SQL already ordered the page — preserve global rank across pagination offsets.
	const ranked = pageRows.map((row, index) => ({
		...row,
		rank: offset + index + 1,
	}));

	const followingIds = opts.viewerId
		? await fetchViewerFollowingIds(
				opts.viewerId,
				ranked.map((row) => row.userId),
			)
		: new Set<string>();

	const annotated = annotateViewerFollows(
		ranked.map((row) => ({
			rank: row.rank,
			userId: row.userId,
			handle: row.handle,
			displayName: row.displayName,
			image: row.image,
			avatarIsAnimated: readAvatarIsAnimatedPref(
				row.preferences as Record<string, unknown> | null,
			),
			...patronAvatarBadgeFields(row.userId, badgeMaps),
			count: row.count,
		})),
		followingIds,
	);

	return {
		sort: opts.sort,
		period: opts.period,
		window: { start: start.toISOString(), end: end.toISOString() },
		page,
		limit,
		nextPage: hasMore ? page + 1 : null,
		items: annotated,
	};
}

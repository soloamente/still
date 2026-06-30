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
import {
	and,
	asc,
	desc,
	eq,
	gte,
	isNull,
	lt,
	ne,
	notInArray,
	or,
	sql,
} from "drizzle-orm";

import { communityOffset } from "./community-page-args";
import { withinCommunityPeriod } from "./community-period";
import {
	type DiaryMetalTier,
	fetchDiaryLogCountsForUserIds,
	resolveDiaryMetalTier,
} from "./diary-metal-tier";
import { annotateViewerFollows, fetchViewerFollowingIds } from "./follow-list";
import type { LeaderboardPeriod } from "./leaderboard-period";
import { resolveLeaderboardWindow } from "./leaderboard-period";
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
	return !isPrivate;
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
	const conditions = [eq(profile.isPrivate, false)];
	if (blockedIds.length > 0) {
		conditions.push(notInArray(profile.userId, blockedIds));
	}
	return conditions;
}

async function fetchPopularRows(
	start: Date,
	end: Date,
	blockedIds: string[],
	limit: number,
	offset: number,
): Promise<AggregatedRow[]> {
	const rows = await db
		.select({
			userId: log.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			image: sql<string | null>`max(${user.image})`.as("image"),
			preferences: profile.preferences,
			count: sql<number>`count(*)::int`.as("count"),
			tieAt: sql<Date>`max(${log.watchedAt})`.as("tie_at"),
		})
		.from(log)
		.innerJoin(profile, eq(log.userId, profile.userId))
		.innerJoin(user, eq(log.userId, user.id))
		.where(
			and(
				isNull(log.removedAt),
				gte(log.watchedAt, start),
				lt(log.watchedAt, end),
				...publicProfileConditions(blockedIds),
			),
		)
		.groupBy(
			log.userId,
			profile.handle,
			profile.displayName,
			profile.preferences,
		)
		.orderBy(
			desc(sql`count(*)`),
			asc(sql`max(${log.watchedAt})`),
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
	const rows = await db
		.select({
			userId: review.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			image: sql<string | null>`max(${user.image})`.as("image"),
			preferences: profile.preferences,
			count: sql<number>`count(*)::int`.as("count"),
			tieAt: sql<Date>`max(${review.publishedAt})`.as("tie_at"),
		})
		.from(review)
		.innerJoin(profile, eq(review.userId, profile.userId))
		.innerJoin(user, eq(review.userId, user.id))
		.where(
			and(
				isNull(review.removedAt),
				eq(review.visibility, "public"),
				withinCommunityPeriod(review.publishedAt, start, end),
				...publicProfileConditions(blockedIds),
			),
		)
		.groupBy(
			review.userId,
			profile.handle,
			profile.displayName,
			profile.preferences,
		)
		.orderBy(
			desc(sql`count(*)`),
			asc(sql`max(${review.publishedAt})`),
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
	const rows = await db
		.select({
			userId: list.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			image: sql<string | null>`max(${user.image})`.as("image"),
			preferences: profile.preferences,
			count: sql<number>`count(*)::int`.as("count"),
			tieAt: sql<Date>`max(${list.createdAt})`.as("tie_at"),
		})
		.from(list)
		.innerJoin(profile, eq(list.userId, profile.userId))
		.innerJoin(user, eq(list.userId, user.id))
		.where(
			and(
				eq(list.isPublic, true),
				isNull(list.removedAt),
				or(
					isNull(list.systemKind),
					ne(list.systemKind, LIST_SYSTEM_KIND_FAVORITES),
				),
				withinCommunityPeriod(list.createdAt, start, end),
				...publicProfileConditions(blockedIds),
			),
		)
		.groupBy(
			list.userId,
			profile.handle,
			profile.displayName,
			profile.preferences,
		)
		.orderBy(
			desc(sql`count(*)`),
			asc(sql`max(${list.createdAt})`),
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
	const rows = await db
		.select({
			userId: review.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			image: sql<string | null>`max(${user.image})`.as("image"),
			preferences: profile.preferences,
			count: sql<number>`count(*)::int`.as("count"),
			tieAt: sql<Date>`max(${reaction.createdAt})`.as("tie_at"),
		})
		.from(reaction)
		.innerJoin(
			review,
			and(eq(reaction.parentType, "review"), eq(reaction.parentId, review.id)),
		)
		.innerJoin(profile, eq(review.userId, profile.userId))
		.innerJoin(user, eq(review.userId, user.id))
		.where(
			and(
				eq(reaction.kind, "like"),
				withinCommunityPeriod(reaction.createdAt, start, end),
				isNull(review.removedAt),
				eq(review.visibility, "public"),
				...publicProfileConditions(blockedIds),
			),
		)
		.groupBy(
			review.userId,
			profile.handle,
			profile.displayName,
			profile.preferences,
		)
		.orderBy(
			desc(sql`count(*)`),
			asc(sql`max(${reaction.createdAt})`),
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

	const logCounts = await fetchDiaryLogCountsForUserIds(
		pageRows.map((row) => row.userId),
	);
	const ranked = rankMembersLeaderboardRows(pageRows);

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
			diaryMetalTier: resolveDiaryMetalTier(logCounts.get(row.userId) ?? 0),
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

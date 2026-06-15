import {
	block,
	db,
	LIST_SYSTEM_KIND_FAVORITES,
	list,
	log,
	movie,
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
	isNotNull,
	isNull,
	lt,
	ne,
	or,
	sql,
} from "drizzle-orm";
import { withinCommunityPeriod } from "./community-period";
import { contentVisibilityWhere } from "./content-visibility";
import {
	type DiaryMetalTier,
	fetchDiaryLogCountsForUserIds,
	resolveDiaryMetalTier,
} from "./diary-metal-tier";
import type { LeaderboardPeriod } from "./leaderboard-period";
import { resolveLeaderboardWindow } from "./leaderboard-period";
import { withCoverPosterPaths } from "./list-cover-posters";
import type { MembersLeaderboardSort } from "./members-leaderboard-query";
import { readAvatarIsAnimatedPref } from "./profile-media";

/** One row in the patron contribution ledger drawer — poster opens review or list. */
export type MembersLeaderboardLedgerReviewItem = {
	itemKind: "review";
	itemKey: string;
	sortAt: string;
	reviewId: string;
	movieId: number;
	listingTitle: string;
	posterPath: string | null;
	reviewTitle: string | null;
	reviewBody: string;
	rating: number | null;
	likesCount: number;
	commentsCount: number;
	publishedAt: string;
	containsSpoilers: boolean;
	userId: string;
};

/** Diary log row for **Popular** — opens review when linked, otherwise the film page. */
export type MembersLeaderboardLedgerLogItem = {
	itemKind: "log";
	itemKey: string;
	sortAt: string;
	logId: string;
	movieId: number;
	listingTitle: string;
	posterPath: string | null;
	reviewId: string | null;
	reviewTitle: string | null;
	reviewBody: string | null;
	rating: number | null;
	likesCount: number | null;
	commentsCount: number | null;
	publishedAt: string | null;
	containsSpoilers: boolean;
	userId: string;
};

export type MembersLeaderboardLedgerListItem = {
	itemKind: "list";
	itemKey: string;
	sortAt: string;
	listId: string;
	title: string;
	posterPath: string | null;
	coverImageUrl: string | null;
	createdAt: string;
};

export type MembersLeaderboardLedgerItem =
	| MembersLeaderboardLedgerReviewItem
	| MembersLeaderboardLedgerLogItem
	| MembersLeaderboardLedgerListItem;

export type MembersLeaderboardItemsPayload = {
	sort: MembersLeaderboardSort;
	period: LeaderboardPeriod;
	window: { start: string; end: string };
	user: {
		handle: string;
		displayName: string;
		image: string | null;
		avatarIsAnimated: boolean;
		diaryMetalTier: DiaryMetalTier | null;
	};
	items: MembersLeaderboardLedgerItem[];
};

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

function isBlocked(blockedIds: string[], userId: string): boolean {
	return blockedIds.includes(userId);
}

async function loadPatronLedgerUser(userId: string): Promise<{
	handle: string;
	displayName: string;
	image: string | null;
	avatarIsAnimated: boolean;
	diaryMetalTier: DiaryMetalTier | null;
	isPrivate: boolean;
} | null> {
	const [row] = await db
		.select({
			handle: profile.handle,
			displayName: profile.displayName,
			isPrivate: profile.isPrivate,
			image: user.image,
			preferences: profile.preferences,
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.where(eq(profile.userId, userId))
		.limit(1);

	if (!row) return null;

	const counts = await fetchDiaryLogCountsForUserIds([userId]);
	const diaryMetalTier = resolveDiaryMetalTier(counts.get(userId) ?? 0);

	return {
		handle: row.handle,
		displayName: row.displayName,
		image: row.image ?? null,
		avatarIsAnimated: readAvatarIsAnimatedPref(
			row.preferences as Record<string, unknown> | null,
		),
		diaryMetalTier,
		isPrivate: row.isPrivate,
	};
}

async function fetchReviewLedgerItems(args: {
	userId: string;
	viewerId: string | null;
	start: Date;
	end: Date;
	byLikesReceived?: boolean;
}): Promise<MembersLeaderboardLedgerReviewItem[]> {
	const visibility = contentVisibilityWhere(
		args.viewerId,
		review.userId,
		review.visibility,
	);

	if (args.byLikesReceived) {
		const rows = await db
			.select({
				reviewId: review.id,
				userId: review.userId,
				movieId: review.movieId,
				reviewTitle: review.title,
				reviewBody: review.body,
				rating: review.rating,
				likesCount: review.likesCount,
				commentsCount: review.commentsCount,
				publishedAt: review.publishedAt,
				containsSpoilers: review.containsSpoilers,
				listingTitle: movie.title,
				posterPath: movie.posterPath,
				sortAt: sql<Date>`max(${reaction.createdAt})`.as("sort_at"),
			})
			.from(reaction)
			.innerJoin(
				review,
				and(
					eq(reaction.parentType, "review"),
					eq(reaction.parentId, review.id),
				),
			)
			.innerJoin(movie, eq(review.movieId, movie.tmdbId))
			.where(
				and(
					eq(review.userId, args.userId),
					eq(reaction.kind, "like"),
					withinCommunityPeriod(reaction.createdAt, args.start, args.end),
					isNull(review.removedAt),
					visibility,
				),
			)
			.groupBy(
				review.id,
				review.userId,
				review.movieId,
				review.title,
				review.body,
				review.rating,
				review.likesCount,
				review.commentsCount,
				review.publishedAt,
				review.containsSpoilers,
				movie.title,
				movie.posterPath,
			)
			.orderBy(desc(sql`max(${reaction.createdAt})`), asc(review.id));

		return rows.map((row) => ({
			itemKind: "review" as const,
			itemKey: row.reviewId,
			sortAt: row.sortAt.toISOString(),
			reviewId: row.reviewId,
			userId: row.userId,
			movieId: row.movieId,
			listingTitle: row.listingTitle,
			posterPath: row.posterPath,
			reviewTitle: row.reviewTitle,
			reviewBody: row.reviewBody,
			rating: row.rating,
			likesCount: row.likesCount,
			commentsCount: row.commentsCount,
			publishedAt: row.publishedAt.toISOString(),
			containsSpoilers: row.containsSpoilers,
		}));
	}

	const rows = await db
		.select({
			reviewId: review.id,
			userId: review.userId,
			movieId: review.movieId,
			reviewTitle: review.title,
			reviewBody: review.body,
			rating: review.rating,
			likesCount: review.likesCount,
			commentsCount: review.commentsCount,
			publishedAt: review.publishedAt,
			containsSpoilers: review.containsSpoilers,
			listingTitle: movie.title,
			posterPath: movie.posterPath,
		})
		.from(review)
		.innerJoin(movie, eq(review.movieId, movie.tmdbId))
		.where(
			and(
				eq(review.userId, args.userId),
				isNull(review.removedAt),
				withinCommunityPeriod(review.publishedAt, args.start, args.end),
				visibility,
			),
		)
		.orderBy(desc(review.publishedAt), asc(review.id));

	return rows.map((row) => ({
		itemKind: "review" as const,
		itemKey: row.reviewId,
		sortAt: row.publishedAt.toISOString(),
		reviewId: row.reviewId,
		userId: row.userId,
		movieId: row.movieId,
		listingTitle: row.listingTitle,
		posterPath: row.posterPath,
		reviewTitle: row.reviewTitle,
		reviewBody: row.reviewBody,
		rating: row.rating,
		likesCount: row.likesCount,
		commentsCount: row.commentsCount,
		publishedAt: row.publishedAt.toISOString(),
		containsSpoilers: row.containsSpoilers,
	}));
}

async function fetchPopularLedgerItems(args: {
	userId: string;
	viewerId: string | null;
	start: Date;
	end: Date;
}): Promise<MembersLeaderboardLedgerLogItem[]> {
	const logVisibility = contentVisibilityWhere(
		args.viewerId,
		log.userId,
		log.visibility,
	);
	const reviewVisibility = contentVisibilityWhere(
		args.viewerId,
		review.userId,
		review.visibility,
	);

	const movieLogs = await db
		.select({
			logId: log.id,
			watchedAt: log.watchedAt,
			reviewId: review.id,
			userId: log.userId,
			movieId: log.movieId,
			reviewTitle: review.title,
			reviewBody: review.body,
			rating: review.rating,
			likesCount: review.likesCount,
			commentsCount: review.commentsCount,
			publishedAt: review.publishedAt,
			containsSpoilers: review.containsSpoilers,
			listingTitle: movie.title,
			posterPath: movie.posterPath,
		})
		.from(log)
		.innerJoin(movie, eq(log.movieId, movie.tmdbId))
		.leftJoin(
			review,
			and(eq(review.logId, log.id), isNull(review.removedAt), reviewVisibility),
		)
		.where(
			and(
				eq(log.userId, args.userId),
				isNull(log.removedAt),
				isNotNull(log.movieId),
				gte(log.watchedAt, args.start),
				lt(log.watchedAt, args.end),
				logVisibility,
			),
		)
		.orderBy(desc(log.watchedAt), asc(log.id));

	return movieLogs.map((row) => ({
		itemKind: "log" as const,
		itemKey: row.logId,
		sortAt: row.watchedAt.toISOString(),
		logId: row.logId,
		userId: row.userId,
		movieId: row.movieId ?? 0,
		listingTitle: row.listingTitle,
		posterPath: row.posterPath,
		reviewId: row.reviewId,
		reviewTitle: row.reviewTitle,
		reviewBody: row.reviewBody,
		rating: row.rating,
		likesCount: row.likesCount,
		commentsCount: row.commentsCount,
		publishedAt: row.publishedAt?.toISOString() ?? null,
		containsSpoilers: row.containsSpoilers ?? false,
	}));
}

async function fetchListLedgerItems(args: {
	userId: string;
	start: Date;
	end: Date;
}): Promise<MembersLeaderboardLedgerListItem[]> {
	const rows = await db
		.select({
			id: list.id,
			title: list.title,
			createdAt: list.createdAt,
			coverMovieIds: list.coverMovieIds,
			coverTvIds: list.coverTvIds,
			coverMovieId: list.coverMovieId,
			coverImageUrl: list.coverImageUrl,
		})
		.from(list)
		.where(
			and(
				eq(list.userId, args.userId),
				eq(list.isPublic, true),
				isNull(list.removedAt),
				or(
					isNull(list.systemKind),
					ne(list.systemKind, LIST_SYSTEM_KIND_FAVORITES),
				),
				withinCommunityPeriod(list.createdAt, args.start, args.end),
			),
		)
		.orderBy(desc(list.createdAt), asc(list.id));

	const withCovers = await withCoverPosterPaths(rows);

	return withCovers.map((row) => ({
		itemKind: "list" as const,
		itemKey: row.id,
		sortAt: row.createdAt.toISOString(),
		listId: row.id,
		title: row.title,
		posterPath: row.coverPosterPaths[0] ?? null,
		coverImageUrl: row.coverImageUrl?.trim() || null,
		createdAt: row.createdAt.toISOString(),
	}));
}

/**
 * Drawer payload — qualifying reviews or lists for one patron in the window.
 */
export async function fetchMembersLeaderboardItems(opts: {
	sort: MembersLeaderboardSort;
	userId: string;
	period: LeaderboardPeriod;
	tz: string | undefined;
	viewerId?: string | null;
	now?: Date;
}): Promise<MembersLeaderboardItemsPayload | null> {
	const patron = await loadPatronLedgerUser(opts.userId);
	if (!patron || patron.isPrivate) return null;

	const blockedIds = opts.viewerId
		? await blockedUserIdsForViewer(opts.viewerId)
		: [];
	if (isBlocked(blockedIds, opts.userId)) return null;

	const { start, end } = resolveLeaderboardWindow(
		opts.period,
		opts.tz,
		opts.now,
	);

	let items: MembersLeaderboardLedgerItem[];
	switch (opts.sort) {
		case "reviews":
			items = await fetchReviewLedgerItems({
				userId: opts.userId,
				viewerId: opts.viewerId ?? null,
				start,
				end,
			});
			break;
		case "likes":
			items = await fetchReviewLedgerItems({
				userId: opts.userId,
				viewerId: opts.viewerId ?? null,
				start,
				end,
				byLikesReceived: true,
			});
			break;
		case "popular":
			items = await fetchPopularLedgerItems({
				userId: opts.userId,
				viewerId: opts.viewerId ?? null,
				start,
				end,
			});
			break;
		case "lists":
			items = await fetchListLedgerItems({
				userId: opts.userId,
				start,
				end,
			});
			break;
		default: {
			const never: never = opts.sort;
			throw new Error(`Unhandled members ledger sort: ${never}`);
		}
	}

	return {
		sort: opts.sort,
		period: opts.period,
		window: { start: start.toISOString(), end: end.toISOString() },
		user: {
			handle: patron.handle,
			displayName: patron.displayName,
			image: patron.image,
			avatarIsAnimated: patron.avatarIsAnimated,
			diaryMetalTier: patron.diaryMetalTier,
		},
		items,
	};
}

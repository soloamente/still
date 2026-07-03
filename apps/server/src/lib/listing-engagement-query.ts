import {
	block,
	db,
	list,
	listCollaborator,
	listItem,
	log,
	profile,
	review,
	user,
	watchlistItem,
} from "@still/db";
import {
	and,
	count,
	countDistinct,
	desc,
	eq,
	exists,
	isNull,
	notInArray,
	or,
	type SQL,
	sql,
} from "drizzle-orm";

import { communityOffset, parseCommunityPage } from "./community-page-args";
import { contentVisibilityWhere } from "./content-visibility";
import {
	type DiaryMetalTier,
	fetchDiaryLogCountsForUserIds,
	resolveDiaryMetalTier,
} from "./diary-metal-tier";
import { withCoverPosterPaths } from "./list-cover-posters";
import {
	type ListingCommunityEngagementStats,
	watchlistPatronHasNotWatchedTitle,
} from "./listing-community-stats";
import { fetchCachedListingCommunityStats } from "./listing-community-stats-cache";
import { readAvatarIsAnimatedPref } from "./profile-media";

export type ListingEngagementKind =
	| "watches"
	| "lists"
	| "favorites"
	| "watchlist";

export const LISTING_ENGAGEMENT_DEFAULT_LIMIT = 20;
export const LISTING_ENGAGEMENT_MAX_LIMIT = 50;

export type ListingEngagementListingRef =
	| { movieId: number }
	| { tvId: number };

export type ListingEngagementWatchReview = {
	id: string;
	headline: string | null;
	body: string;
	rating: number | null;
	likesCount: number;
	publishedAt: string;
	containsSpoilers: boolean;
};

export type ListingEngagementWatchItem = {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	avatarIsAnimated: boolean;
	diaryMetalTier: DiaryMetalTier | null;
	rating: number | null;
	liked: boolean;
	watchedAt: string;
	review: ListingEngagementWatchReview | null;
};

export type ListingEngagementListItem = {
	id: string;
	title: string;
	description: string | null;
	itemsCount: number;
	updatedAt: string;
	likesCount: number;
	ownerHandle: string;
	isPublic: boolean;
	coverPosterPaths: (string | null)[];
	coverImageUrl: string | null;
};

export type ListingEngagementPatronItem = {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	avatarIsAnimated: boolean;
	diaryMetalTier: DiaryMetalTier | null;
	rating: number | null;
	liked: boolean;
	sortAt: string;
};

export type ListingEngagementPage<TItem> = {
	items: TItem[];
	page: number;
	hasMore: boolean;
	totalVisible: number;
	totalGlobal: number;
};

/** Normalize drawer page size — default 20, cap at 50. */
export function parseListingEngagementLimit(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return LISTING_ENGAGEMENT_DEFAULT_LIMIT;
	return Math.min(Math.floor(n), LISTING_ENGAGEMENT_MAX_LIMIT);
}

export function parseListingEngagementPage(raw: string | undefined): number {
	return parseCommunityPage(raw);
}

/** True when the query returned one extra row beyond the requested page size. */
export function listingEngagementHasMore(
	fetchedCount: number,
	limit: number,
): boolean {
	return fetchedCount > limit;
}

/** Footer copy when chip aggregate exceeds viewer-visible rows (no private names). */
export function formatListingEngagementPrivateGapFooter(input: {
	kind: ListingEngagementKind;
	totalVisible: number;
	totalGlobal: number;
}): string | null {
	const delta = Math.max(0, input.totalGlobal - input.totalVisible);
	if (delta <= 0) return null;

	switch (input.kind) {
		case "watches":
		case "favorites":
			return `${input.totalVisible.toLocaleString("en-US")} patrons you can see · ${delta.toLocaleString("en-US")} more with private activity`;
		case "watchlist":
			return `${input.totalVisible.toLocaleString("en-US")} watchlists you can see · ${delta.toLocaleString("en-US")} more with private activity`;
		case "lists":
			return `${input.totalVisible.toLocaleString("en-US")} lists you can see · ${delta.toLocaleString("en-US")} more with private activity`;
		default: {
			const _exhaustive: never = input.kind;
			return _exhaustive;
		}
	}
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

function listingLogWhere(listing: ListingEngagementListingRef): SQL {
	const isTv = "tvId" in listing;
	return and(
		isTv ? eq(log.tvId, listing.tvId) : eq(log.movieId, listing.movieId),
		isNull(log.removedAt),
	) as SQL;
}

function listingListItemWhere(listing: ListingEngagementListingRef): SQL {
	const isTv = "tvId" in listing;
	return and(
		isTv
			? eq(listItem.tvId, listing.tvId)
			: eq(listItem.movieId, listing.movieId),
		isNull(list.removedAt),
	) as SQL;
}

function listingWatchlistWhere(listing: ListingEngagementListingRef): SQL {
	const isTv = "tvId" in listing;
	return isTv
		? eq(watchlistItem.tvId, listing.tvId)
		: eq(watchlistItem.movieId, listing.movieId);
}

function publicPatronProfileWhere(blockedIds: string[]): SQL[] {
	const conditions: SQL[] = [
		eq(profile.isPrivate, false),
		sql`length(trim(coalesce(${profile.handle}, ''))) > 0`,
	];
	if (blockedIds.length > 0) {
		conditions.push(notInArray(profile.userId, blockedIds));
	}
	return conditions;
}

function listViewerAccessWhere(viewerId: string): SQL {
	return or(
		eq(list.isPublic, true),
		eq(list.userId, viewerId),
		exists(
			db
				.select({ one: sql`1` })
				.from(listCollaborator)
				.where(
					and(
						eq(listCollaborator.listId, list.id),
						eq(listCollaborator.userId, viewerId),
					),
				),
		),
	) as SQL;
}

async function mapWatchRows(
	rows: {
		userId: string;
		handle: string;
		displayName: string;
		image: string | null;
		preferences: Record<string, unknown> | null | undefined;
		logRating: number | null;
		liked: boolean;
		watchedAt: Date;
		reviewId: string | null;
		reviewTitle: string | null;
		reviewBody: string | null;
		reviewRating: number | null;
		reviewLikesCount: number | null;
		reviewPublishedAt: Date | null;
		reviewContainsSpoilers: boolean | null;
	}[],
): Promise<ListingEngagementWatchItem[]> {
	const logCounts = await fetchDiaryLogCountsForUserIds(
		rows.map((row) => row.userId),
	);
	return rows.map((row) => ({
		userId: row.userId,
		handle: row.handle,
		displayName: row.displayName,
		image: row.image,
		avatarIsAnimated: readAvatarIsAnimatedPref(row.preferences),
		diaryMetalTier: resolveDiaryMetalTier(logCounts.get(row.userId) ?? 0),
		rating: row.logRating,
		liked: row.liked,
		watchedAt: row.watchedAt.toISOString(),
		review:
			row.reviewId && row.reviewBody && row.reviewPublishedAt
				? {
						id: row.reviewId,
						headline: row.reviewTitle,
						body: row.reviewBody,
						rating: row.reviewRating,
						likesCount: row.reviewLikesCount ?? 0,
						publishedAt: row.reviewPublishedAt.toISOString(),
						containsSpoilers: row.reviewContainsSpoilers ?? false,
					}
				: null,
	}));
}

async function mapPatronRows(
	rows: {
		userId: string;
		handle: string;
		displayName: string;
		image: string | null;
		preferences: Record<string, unknown> | null | undefined;
		rating: number | null;
		liked: boolean;
		sortAt: Date;
	}[],
): Promise<ListingEngagementPatronItem[]> {
	const logCounts = await fetchDiaryLogCountsForUserIds(
		rows.map((row) => row.userId),
	);
	return rows.map((row) => ({
		userId: row.userId,
		handle: row.handle,
		displayName: row.displayName,
		image: row.image,
		avatarIsAnimated: readAvatarIsAnimatedPref(row.preferences),
		diaryMetalTier: resolveDiaryMetalTier(logCounts.get(row.userId) ?? 0),
		rating: row.rating,
		liked: row.liked,
		sortAt: row.sortAt.toISOString(),
	}));
}

async function fetchVisibleWatchCount(
	listing: ListingEngagementListingRef,
	viewerId: string,
	blockedIds: string[],
	likedOnly: boolean,
): Promise<number> {
	const deduped = db
		.selectDistinctOn([log.userId], { userId: log.userId })
		.from(log)
		.innerJoin(profile, eq(log.userId, profile.userId))
		.where(
			and(
				listingLogWhere(listing),
				likedOnly ? eq(log.liked, true) : undefined,
				contentVisibilityWhere(viewerId, log.userId, log.visibility),
				...publicPatronProfileWhere(blockedIds),
			),
		)
		.orderBy(log.userId, desc(log.watchedAt), desc(log.id))
		.as("deduped_watches");

	const [row] = await db
		.select({ total: sql<number>`count(*)::int` })
		.from(deduped);
	return Number(row?.total ?? 0);
}

async function fetchEngagementWatchesPage(args: {
	listing: ListingEngagementListingRef;
	viewerId: string;
	page: number;
	limit: number;
	likedOnly: boolean;
}): Promise<ListingEngagementPage<ListingEngagementWatchItem>> {
	const blockedIds = await blockedUserIdsForViewer(args.viewerId);
	const offset = communityOffset(args.page, args.limit);

	const deduped = db
		.selectDistinctOn([log.userId], {
			userId: log.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			image: user.image,
			preferences: profile.preferences,
			// Alias diary vs review ratings so the outer select is not ambiguous.
			logRating: sql<number | null>`${log.rating}`.as("log_rating"),
			liked: log.liked,
			watchedAt: log.watchedAt,
			reviewId: review.id,
			reviewTitle: review.title,
			reviewBody: review.body,
			reviewRating: sql<number | null>`${review.rating}`.as("review_rating"),
			reviewLikesCount: review.likesCount,
			reviewPublishedAt: review.publishedAt,
			reviewContainsSpoilers: review.containsSpoilers,
		})
		.from(log)
		.innerJoin(user, eq(log.userId, user.id))
		.innerJoin(profile, eq(log.userId, profile.userId))
		.leftJoin(
			review,
			and(
				eq(review.logId, log.id),
				isNull(review.removedAt),
				contentVisibilityWhere(args.viewerId, review.userId, review.visibility),
			),
		)
		.where(
			and(
				listingLogWhere(args.listing),
				args.likedOnly ? eq(log.liked, true) : undefined,
				contentVisibilityWhere(args.viewerId, log.userId, log.visibility),
				...publicPatronProfileWhere(blockedIds),
			),
		)
		.orderBy(log.userId, desc(log.watchedAt), desc(log.id))
		.as("deduped_watches");

	const rawRows = await db
		.select({
			userId: deduped.userId,
			handle: deduped.handle,
			displayName: deduped.displayName,
			image: deduped.image,
			preferences: deduped.preferences,
			logRating: deduped.logRating,
			liked: deduped.liked,
			watchedAt: deduped.watchedAt,
			reviewId: deduped.reviewId,
			reviewTitle: deduped.reviewTitle,
			reviewBody: deduped.reviewBody,
			reviewRating: deduped.reviewRating,
			reviewLikesCount: deduped.reviewLikesCount,
			reviewPublishedAt: deduped.reviewPublishedAt,
			reviewContainsSpoilers: deduped.reviewContainsSpoilers,
		})
		.from(deduped)
		.orderBy(desc(deduped.watchedAt))
		.limit(args.limit + 1)
		.offset(offset);

	const hasMore = listingEngagementHasMore(rawRows.length, args.limit);
	const pageRows = rawRows.slice(0, args.limit);
	const items = await mapWatchRows(pageRows);

	const [totalVisible, globalStats] = await Promise.all([
		fetchVisibleWatchCount(
			args.listing,
			args.viewerId,
			blockedIds,
			args.likedOnly,
		),
		fetchCachedListingCommunityStats(args.listing),
	]);

	return {
		items,
		page: args.page,
		hasMore,
		totalVisible,
		totalGlobal: args.likedOnly
			? globalStats.favoritesCount
			: globalStats.watchesCount,
	};
}

async function fetchVisibleListCount(
	listing: ListingEngagementListingRef,
	viewerId: string,
): Promise<number> {
	const [row] = await db
		.select({ total: countDistinct(list.id) })
		.from(listItem)
		.innerJoin(list, eq(listItem.listId, list.id))
		.where(and(listingListItemWhere(listing), listViewerAccessWhere(viewerId)));
	return Number(row?.total ?? 0);
}

async function fetchEngagementListsPage(args: {
	listing: ListingEngagementListingRef;
	viewerId: string;
	page: number;
	limit: number;
}): Promise<ListingEngagementPage<ListingEngagementListItem>> {
	const offset = communityOffset(args.page, args.limit);

	const distinctLists = db
		.selectDistinctOn([list.id], {
			id: list.id,
			userId: list.userId,
			title: list.title,
			description: list.description,
			itemsCount: list.itemsCount,
			updatedAt: list.updatedAt,
			likesCount: list.likesCount,
			isPublic: list.isPublic,
			coverImageUrl: list.coverImageUrl,
			coverMovieIds: list.coverMovieIds,
			coverTvIds: list.coverTvIds,
			ownerHandle: profile.handle,
		})
		.from(listItem)
		.innerJoin(list, eq(listItem.listId, list.id))
		.innerJoin(profile, eq(list.userId, profile.userId))
		.where(
			and(
				listingListItemWhere(args.listing),
				listViewerAccessWhere(args.viewerId),
				sql`length(trim(coalesce(${profile.handle}, ''))) > 0`,
			),
		)
		.orderBy(list.id, desc(list.likesCount), desc(list.updatedAt))
		.as("distinct_lists");

	const rows = await db
		.select()
		.from(distinctLists)
		.orderBy(desc(distinctLists.likesCount), desc(distinctLists.updatedAt))
		.limit(args.limit + 1)
		.offset(offset);

	const hasMore = listingEngagementHasMore(rows.length, args.limit);
	const pageRows = rows.slice(0, args.limit);
	const withCovers = await withCoverPosterPaths(
		pageRows.map((row) => ({
			id: row.id,
			userId: row.userId,
			title: row.title,
			description: row.description,
			itemsCount: row.itemsCount,
			updatedAt: row.updatedAt,
			likesCount: row.likesCount,
			isPublic: row.isPublic,
			coverImageUrl: row.coverImageUrl,
			coverMovieIds: row.coverMovieIds,
			coverTvIds: row.coverTvIds,
			ownerHandle: row.ownerHandle,
		})),
	);

	const items: ListingEngagementListItem[] = withCovers.map((row) => ({
		id: row.id,
		title: row.title,
		description: row.description,
		itemsCount: row.itemsCount,
		updatedAt: row.updatedAt.toISOString(),
		likesCount: row.likesCount,
		ownerHandle: row.ownerHandle ?? "",
		isPublic: row.isPublic,
		coverPosterPaths: row.coverPosterPaths ?? [],
		coverImageUrl: row.coverImageUrl?.trim() || null,
	}));

	const [totalVisible, globalStats] = await Promise.all([
		fetchVisibleListCount(args.listing, args.viewerId),
		fetchCachedListingCommunityStats(args.listing),
	]);

	return {
		items,
		page: args.page,
		hasMore,
		totalVisible,
		totalGlobal: globalStats.listsCount,
	};
}

async function fetchVisibleWatchlistCount(
	listing: ListingEngagementListingRef,
	blockedIds: string[],
): Promise<number> {
	const [row] = await db
		.select({ total: count() })
		.from(watchlistItem)
		.innerJoin(profile, eq(watchlistItem.userId, profile.userId))
		.where(
			and(
				listingWatchlistWhere(listing),
				watchlistPatronHasNotWatchedTitle(listing),
				...publicPatronProfileWhere(blockedIds),
			),
		);
	return Number(row?.total ?? 0);
}

async function fetchEngagementWatchlistPage(args: {
	listing: ListingEngagementListingRef;
	viewerId: string;
	page: number;
	limit: number;
}): Promise<ListingEngagementPage<ListingEngagementPatronItem>> {
	const blockedIds = await blockedUserIdsForViewer(args.viewerId);
	const offset = communityOffset(args.page, args.limit);

	const rows = await db
		.select({
			userId: watchlistItem.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			image: user.image,
			preferences: profile.preferences,
			sortAt: watchlistItem.addedAt,
		})
		.from(watchlistItem)
		.innerJoin(user, eq(watchlistItem.userId, user.id))
		.innerJoin(profile, eq(watchlistItem.userId, profile.userId))
		.where(
			and(
				listingWatchlistWhere(args.listing),
				watchlistPatronHasNotWatchedTitle(args.listing),
				...publicPatronProfileWhere(blockedIds),
			),
		)
		.orderBy(desc(watchlistItem.addedAt))
		.limit(args.limit + 1)
		.offset(offset);

	const hasMore = listingEngagementHasMore(rows.length, args.limit);
	const pageRows = rows.slice(0, args.limit);
	const items = await mapPatronRows(
		pageRows.map((row) => ({
			userId: row.userId,
			handle: row.handle,
			displayName: row.displayName,
			image: row.image,
			preferences: row.preferences as Record<string, unknown> | null,
			rating: null,
			liked: false,
			sortAt: row.sortAt,
		})),
	);

	const [totalVisible, globalStats] = await Promise.all([
		fetchVisibleWatchlistCount(args.listing, blockedIds),
		fetchCachedListingCommunityStats(args.listing),
	]);

	return {
		items,
		page: args.page,
		hasMore,
		totalVisible,
		totalGlobal: globalStats.watchlistCount,
	};
}

export async function fetchListingEngagementWatches(args: {
	listing: ListingEngagementListingRef;
	viewerId: string;
	page?: string;
	limit?: string;
}): Promise<ListingEngagementPage<ListingEngagementWatchItem>> {
	return fetchEngagementWatchesPage({
		listing: args.listing,
		viewerId: args.viewerId,
		page: parseListingEngagementPage(args.page),
		limit: parseListingEngagementLimit(args.limit),
		likedOnly: false,
	});
}

export async function fetchListingEngagementFavorites(args: {
	listing: ListingEngagementListingRef;
	viewerId: string;
	page?: string;
	limit?: string;
}): Promise<ListingEngagementPage<ListingEngagementWatchItem>> {
	return fetchEngagementWatchesPage({
		listing: args.listing,
		viewerId: args.viewerId,
		page: parseListingEngagementPage(args.page),
		limit: parseListingEngagementLimit(args.limit),
		likedOnly: true,
	});
}

export async function fetchListingEngagementLists(args: {
	listing: ListingEngagementListingRef;
	viewerId: string;
	page?: string;
	limit?: string;
}): Promise<ListingEngagementPage<ListingEngagementListItem>> {
	return fetchEngagementListsPage({
		listing: args.listing,
		viewerId: args.viewerId,
		page: parseListingEngagementPage(args.page),
		limit: parseListingEngagementLimit(args.limit),
	});
}

export async function fetchListingEngagementWatchlist(args: {
	listing: ListingEngagementListingRef;
	viewerId: string;
	page?: string;
	limit?: string;
}): Promise<ListingEngagementPage<ListingEngagementPatronItem>> {
	return fetchEngagementWatchlistPage({
		listing: args.listing,
		viewerId: args.viewerId,
		page: parseListingEngagementPage(args.page),
		limit: parseListingEngagementLimit(args.limit),
	});
}

/** Resolve global chip totals without running a drawer query. */
export async function fetchListingEngagementGlobalStats(
	listing: ListingEngagementListingRef,
): Promise<ListingCommunityEngagementStats> {
	return fetchCachedListingCommunityStats(listing);
}

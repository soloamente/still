import type { ListingEngagementChipKind } from "@/lib/listing-engagement-chip-copy";
import { stillApiOrigin } from "@/lib/still-api-origin";

export type ListingEngagementWatchReview = {
	id: string;
	headline: string | null;
	body: string;
	rating: number | null;
	likesCount: number;
	publishedAt: string;
};

export type ListingEngagementWatchItem = {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	avatarIsAnimated: boolean;
	diaryMetalTier: import("@/lib/diary-metal-tier").DiaryMetalTier | null;
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
	diaryMetalTier: import("@/lib/diary-metal-tier").DiaryMetalTier | null;
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

const KIND_TO_SEGMENT: Record<ListingEngagementChipKind, string> = {
	watched: "watches",
	lists: "lists",
	favorited: "favorites",
	watchlist: "watchlist",
};

function engagementPath(
	listingKind: "movie" | "tv",
	listingId: number,
	kind: ListingEngagementChipKind,
): string {
	const root = listingKind === "movie" ? "movies" : "tv";
	return `/api/${root}/${listingId}/engagement/${KIND_TO_SEGMENT[kind]}`;
}

async function fetchEngagementPage<TItem>(input: {
	listingKind: "movie" | "tv";
	listingId: number;
	kind: ListingEngagementChipKind;
	page: number;
	limit?: number;
	signal?: AbortSignal;
}): Promise<ListingEngagementPage<TItem> | null> {
	const url = new URL(
		engagementPath(input.listingKind, input.listingId, input.kind),
		stillApiOrigin(),
	);
	url.searchParams.set("page", String(Math.max(1, input.page)));
	if (input.limit != null) {
		url.searchParams.set("limit", String(input.limit));
	}

	const res = await fetch(url.toString(), {
		credentials: "include",
		cache: "no-store",
		signal: input.signal,
	});
	if (!res.ok) return null;
	return (await res.json()) as ListingEngagementPage<TItem>;
}

export function fetchListingEngagementWatches(input: {
	listingKind: "movie" | "tv";
	listingId: number;
	page: number;
	signal?: AbortSignal;
}) {
	return fetchEngagementPage<ListingEngagementWatchItem>({
		...input,
		kind: "watched",
	});
}

export function fetchListingEngagementLists(input: {
	listingKind: "movie" | "tv";
	listingId: number;
	page: number;
	signal?: AbortSignal;
}) {
	return fetchEngagementPage<ListingEngagementListItem>({
		...input,
		kind: "lists",
	});
}

export function fetchListingEngagementFavorites(input: {
	listingKind: "movie" | "tv";
	listingId: number;
	page: number;
	signal?: AbortSignal;
}) {
	return fetchEngagementPage<ListingEngagementWatchItem>({
		...input,
		kind: "favorited",
	});
}

export function fetchListingEngagementWatchlist(input: {
	listingKind: "movie" | "tv";
	listingId: number;
	page: number;
	signal?: AbortSignal;
}) {
	return fetchEngagementPage<ListingEngagementPatronItem>({
		...input,
		kind: "watchlist",
	});
}

export type ListingEngagementSummary = {
	watchesCount: number;
	listsCount: number;
	favoritesCount: number;
	watchlistCount: number;
};

/** Lightweight chip totals — used after diary/watchlist mutations on detail pages. */
export async function fetchListingEngagementSummary(input: {
	listingKind: "movie" | "tv";
	listingId: number;
	signal?: AbortSignal;
}): Promise<ListingEngagementSummary | null> {
	const root = input.listingKind === "movie" ? "movies" : "tv";
	const url = new URL(
		`/api/${root}/${input.listingId}/engagement/summary`,
		stillApiOrigin(),
	);

	const res = await fetch(url.toString(), {
		credentials: "include",
		cache: "no-store",
		signal: input.signal,
	});
	if (!res.ok) return null;
	return (await res.json()) as ListingEngagementSummary;
}

export function fetchListingEngagementByKind(input: {
	listingKind: "movie" | "tv";
	listingId: number;
	kind: ListingEngagementChipKind;
	page: number;
	signal?: AbortSignal;
}) {
	switch (input.kind) {
		case "watched":
			return fetchListingEngagementWatches(input);
		case "lists":
			return fetchListingEngagementLists(input);
		case "favorited":
			return fetchListingEngagementFavorites(input);
		case "watchlist":
			return fetchListingEngagementWatchlist(input);
		default: {
			const _exhaustive: never = input.kind;
			return _exhaustive;
		}
	}
}

/** Footer when chip aggregate exceeds viewer-visible rows. */
export function formatListingEngagementPrivateGapFooter(input: {
	kind: ListingEngagementChipKind;
	totalVisible: number;
	totalGlobal: number;
}): string | null {
	const delta = Math.max(0, input.totalGlobal - input.totalVisible);
	if (delta <= 0) return null;

	switch (input.kind) {
		case "watched":
		case "favorited":
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

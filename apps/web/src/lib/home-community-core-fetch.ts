import type { CuratorSpotlightPatron } from "@/lib/creator-recognition";
import {
	type ActivityFeedCursor,
	activityFeedCursorFromItem,
	coerceActivityTimestamp,
	type HomeCommunityActivityItem,
	parseFeedApiActivityItems,
} from "@/lib/home-community-activity";
import type { HomeCommunityFeed } from "@/lib/home-community-feed";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { toListBoardRow } from "@/lib/list-board-row";
import {
	type ListLobbySeed,
	listBoardRowToLobbySeed,
} from "@/lib/lists-lobby-order";
import type { serverApi } from "@/lib/server-api";
import {
	COMMUNITY_ACTIVITY_LIMIT,
	COMMUNITY_LISTS_LIMIT,
	COMMUNITY_REVIEWS_LIMIT,
} from "@/lib/still-api-fetch";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";

export type HomeCommunityReviewRow = {
	id: string;
	userId: string;
	movieId: number;
	title: string | null;
	body: string;
	rating: number | null;
	likesCount: number;
	commentsCount: number;
	publishedAt: string;
	audioUrl?: string | null;
	audioDurationMs?: number | null;
	listing?: {
		title: string;
		posterUrl: string | null;
		href: string;
		listingKind: "movie";
	};
};

/** One `/api/reviews/recent` raw row → community review card row (shared RSC + client). */
export function mapCommunityReviewRow(
	raw: unknown,
): HomeCommunityReviewRow | null {
	const row = raw as {
		review: {
			id: string;
			userId: string;
			movieId: number;
			title: string | null;
			body: string;
			rating: number | null;
			likesCount: number;
			commentsCount: number;
			publishedAt: string | Date;
			audioUrl?: string | null;
			audioDurationMs?: number | null;
		};
		movie: { tmdbId: number; title: string; posterPath: string | null } | null;
	};
	const r = row.review;
	if (!r?.id) return null;
	const movie = row.movie;
	return {
		id: r.id,
		userId: r.userId,
		movieId: r.movieId,
		title: r.title,
		body: r.body,
		rating: r.rating,
		likesCount: r.likesCount ?? 0,
		commentsCount: r.commentsCount ?? 0,
		publishedAt: coerceActivityTimestamp(r.publishedAt),
		audioUrl: r.audioUrl ?? null,
		audioDurationMs: r.audioDurationMs ?? null,
		listing: movie
			? {
					title: movie.title,
					posterUrl: tmdbPosterUrlFromPath(movie.posterPath, "w185"),
					href: `/movies/${movie.tmdbId}`,
					listingKind: "movie" as const,
				}
			: undefined,
	};
}

type HomeApi = Awaited<ReturnType<typeof serverApi>>;

type HomeSession = {
	user?: { id: string } | null;
} | null;

export type CommunityFeedSeed = {
	listSeeds: ListLobbySeed[];
	/** Total public lists in the active community period (likes-ordered lobby). */
	listTotalCount: number;
	reviews: HomeCommunityReviewRow[];
	viralReviews: HomeCommunityReviewRow[];
	activityItems: HomeCommunityActivityItem[];
	curatorSpotlights: CuratorSpotlightPatron[];
	/** Page 2 for offset feeds (lists/reviews); null when seed is the whole set. */
	initialListCursor: number | null;
	initialReviewCursor: number | null;
	/** Composite cursor for activity infinite scroll; null when no more. */
	initialActivityCursor: ActivityFeedCursor | null;
};

const EMPTY_COMMUNITY_SEED: CommunityFeedSeed = {
	listSeeds: [],
	listTotalCount: 0,
	reviews: [],
	viralReviews: [],
	activityItems: [],
	curatorSpotlights: [],
	initialListCursor: null,
	initialReviewCursor: null,
	initialActivityCursor: null,
};

/**
 * Community critical path — fetches ONLY the active feed (active period). Feeds the
 * infinite components their page-1 seed + the cursor that fetches page 2. Leaderboard
 * feeds return the empty seed (client-deferred).
 */
export async function fetchHomeCommunityFeedSeed(input: {
	api: HomeApi;
	session: HomeSession;
	feed: HomeCommunityFeed;
	period: HomeLeaderboardPeriod;
}): Promise<CommunityFeedSeed> {
	const periodQuery = { period: input.period, tz: "UTC" as const };

	if (input.feed === "lists") {
		const [listsRes, curatorsRes] = await Promise.all([
			input.api.api.lists
				.get({
					query: { limit: String(COMMUNITY_LISTS_LIMIT), ...periodQuery },
				})
				.catch(() => ({ data: [] })),
			input.api.api.profiles.curators.spotlight
				.get({ query: { limit: "6" } })
				.catch(() => ({ data: { patrons: [] } })),
		]);
		const listsPayload = listsRes.data as
			| { items?: unknown[]; total?: number }
			| null
			| undefined;
		const rawLists = listsPayload?.items ?? [];
		const listSeeds = rawLists.map(toListBoardRow).map(listBoardRowToLobbySeed);
		const listTotalCount =
			typeof listsPayload?.total === "number" &&
			Number.isFinite(listsPayload.total)
				? listsPayload.total
				: listSeeds.length;
		const curatorPayload = curatorsRes.data as
			| { patrons?: CuratorSpotlightPatron[] }
			| null
			| undefined;
		return {
			...EMPTY_COMMUNITY_SEED,
			listSeeds,
			listTotalCount,
			curatorSpotlights: curatorPayload?.patrons ?? [],
			initialListCursor: listSeeds.length >= COMMUNITY_LISTS_LIMIT ? 2 : null,
		};
	}

	if (input.feed === "reviews") {
		const [reviewsRes, viralRes] = await Promise.all([
			input.api.api.reviews.recent
				.get({
					query: { limit: String(COMMUNITY_REVIEWS_LIMIT), ...periodQuery },
				})
				.catch(() => ({ data: [] })),
			input.api.api.reviews.viral
				.get({
					query: { limit: "6", ...periodQuery },
				})
				.catch(() => ({ data: [] })),
		]);
		const rawReviews = (reviewsRes.data as unknown[]) ?? [];
		const reviews = rawReviews
			.map(mapCommunityReviewRow)
			.filter((r): r is HomeCommunityReviewRow => r != null);
		const viralReviews = ((viralRes.data as unknown[]) ?? [])
			.map(mapCommunityReviewRow)
			.filter((r): r is HomeCommunityReviewRow => r != null);
		return {
			...EMPTY_COMMUNITY_SEED,
			reviews,
			viralReviews,
			initialReviewCursor:
				rawReviews.length >= COMMUNITY_REVIEWS_LIMIT ? 2 : null,
		};
	}

	if (input.feed === "activity") {
		const activityRes = input.session
			? await input.api.api.feed
					.get({
						query: { limit: String(COMMUNITY_ACTIVITY_LIMIT), ...periodQuery },
					})
					.catch(() => ({ data: { items: [] } }))
			: await input.api.api.feed.discover
					.get({ query: periodQuery })
					.catch(() => ({ data: { items: [] } }));
		const activityItems = parseFeedApiActivityItems(
			activityRes.data as {
				items?: { kind: string; at: string | Date; payload: unknown }[];
			},
		);
		const last = activityItems[activityItems.length - 1];
		// Discover (logged-out) is a bounded snapshot — never paginates.
		const initialActivityCursor =
			input.session && activityItems.length >= COMMUNITY_ACTIVITY_LIMIT && last
				? activityFeedCursorFromItem(last)
				: null;
		return { ...EMPTY_COMMUNITY_SEED, activityItems, initialActivityCursor };
	}

	// film-ranks / tv-ranks — leaderboards are client-deferred.
	return EMPTY_COMMUNITY_SEED;
}

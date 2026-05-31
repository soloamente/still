import type { CuratorSpotlightPatron } from "@/lib/creator-recognition";
import {
	coerceActivityTimestamp,
	type HomeCommunityActivityItem,
	parseFeedApiActivityItems,
} from "@/lib/home-community-activity";
import { toListBoardRow } from "@/lib/list-board-row";
import {
	type ListLobbySeed,
	listBoardRowToLobbySeed,
} from "@/lib/lists-lobby-order";
import type { serverApi } from "@/lib/server-api";
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
	listing?: {
		title: string;
		posterUrl: string | null;
		href: string;
		listingKind: "movie";
	};
};

export interface HomeCommunityCoreData {
	listSeedsAll: ListLobbySeed[];
	reviewsAll: HomeCommunityReviewRow[];
	activityItemsAll: HomeCommunityActivityItem[];
	curatorSpotlights: CuratorSpotlightPatron[];
}

const communityPeriodAllQuery = {
	period: "all" as const,
	tz: "UTC" as const,
};

type HomeApi = Awaited<ReturnType<typeof serverApi>>;

type HomeSession = {
	user?: { id: string } | null;
} | null;

/**
 * Community lobby critical path — lists, reviews, and activity only (no leaderboards).
 */
export async function fetchHomeCommunityCore(input: {
	api: HomeApi;
	session: HomeSession;
}): Promise<HomeCommunityCoreData> {
	const [listsRes, reviewsRes, activityRes, curatorsRes] = await Promise.all([
		input.api.api.lists
			.get({
				query: { limit: "24", ...communityPeriodAllQuery },
			})
			.catch(() => ({ data: [] })),
		input.api.api.reviews.recent
			.get({
				query: { limit: "20", ...communityPeriodAllQuery },
			})
			.catch(() => ({ data: [] })),
		input.session
			? input.api.api.feed
					.get({
						query: { limit: "40", ...communityPeriodAllQuery },
					})
					.catch(() => ({
						data: { items: [] },
					}))
			: input.api.api.feed.discover
					.get({ query: communityPeriodAllQuery })
					.catch(() => ({
						data: { items: [] },
					})),
		input.api.api.profiles.curators.spotlight
			.get({ query: { limit: "6" } })
			.catch(() => ({ data: { patrons: [] } })),
	]);

	const listRows = ((listsRes.data as unknown[]) ?? []).map(toListBoardRow);
	const listSeedsAll = listRows.map(listBoardRowToLobbySeed);

	const reviewRows = (reviewsRes.data as unknown[]) ?? [];
	const reviewsAll = reviewRows
		.map((raw) => {
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
				};
				movie: {
					tmdbId: number;
					title: string;
					posterPath: string | null;
				} | null;
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
				listing: movie
					? {
							title: movie.title,
							posterUrl: tmdbPosterUrlFromPath(movie.posterPath, "w185"),
							href: `/movies/${movie.tmdbId}`,
							listingKind: "movie" as const,
						}
					: undefined,
			};
		})
		.filter((r) => r != null) as HomeCommunityReviewRow[];

	const activityItemsAll = parseFeedApiActivityItems(
		activityRes.data as {
			items?: { kind: string; at: string | Date; payload: unknown }[];
		},
	);

	const curatorPayload = curatorsRes.data as
		| { patrons?: CuratorSpotlightPatron[] }
		| null
		| undefined;
	const curatorSpotlights = curatorPayload?.patrons ?? [];

	return { listSeedsAll, reviewsAll, activityItemsAll, curatorSpotlights };
}

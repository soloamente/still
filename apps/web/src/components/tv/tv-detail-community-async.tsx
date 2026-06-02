import { MovieDetailExploreTabs } from "@/components/movie/movie-detail-explore-tabs";
import type { TmdbMovieSummary } from "@/lib/movie-detail-tmdb";
import { serverApi } from "@/lib/server-api";

type TvListRow = {
	id: string;
	title: string;
	description: string | null;
	itemsCount: number;
	updatedAt: string;
	likesCount: number;
	ownerHandle?: string;
};

type FollowingRatingsPayload = {
	entries: {
		userId: string;
		handle: string;
		displayName: string;
		image: string | null;
		rating: number | null;
		liked: boolean;
		watchedAt: string;
	}[];
	moreCount: number;
};

/** Streams community lists + followed-patron ratings for TV detail (reviews are movie-only today). */
export async function TvDetailCommunityAsync({
	tvId,
	tvTitle,
	tvPosterUrl,
	moreLikeThis,
}: {
	tvId: string;
	tvTitle: string;
	tvPosterUrl: string | null;
	moreLikeThis: TmdbMovieSummary[];
}) {
	const api = await serverApi();

	const [listsRes, followingRatingsRes] = await Promise.all([
		api.api
			.tv({ id: tvId })
			.lists.get()
			.catch(() => ({ data: [] })),
		api.api
			.tv({ id: tvId })
			["following-ratings"].get()
			.catch(() => ({ data: { entries: [], moreCount: 0 } })),
	]);

	const tvLists = (listsRes.data as unknown as TvListRow[]) ?? [];
	const followingRatingsPayload =
		(followingRatingsRes.data as unknown as FollowingRatingsPayload) ?? {
			entries: [],
			moreCount: 0,
		};

	return (
		<MovieDetailExploreTabs
			layout="stacked"
			lists={tvLists}
			followingRatings={followingRatingsPayload.entries}
			followingRatingsMoreCount={followingRatingsPayload.moreCount}
			featuredReviews={[]}
			reviewsAfterFeatured={[]}
			reviews={[]}
			moreLikeThis={moreLikeThis}
			relatedListingKind="tv"
			listCountLabel="titles"
			movieTitle={tvTitle}
			moviePosterUrl={tvPosterUrl}
			listingTmdbId={Number(tvId)}
		/>
	);
}

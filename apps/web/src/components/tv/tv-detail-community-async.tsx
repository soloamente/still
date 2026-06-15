import { MovieDetailExploreTabs } from "@/components/movie/movie-detail-explore-tabs";
import type { MovieDetailFollowingRating } from "@/components/movie/movie-detail-following-ratings";
import { MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME } from "@/lib/movie-detail-sections";
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
	entries: MovieDetailFollowingRating[];
	moreCount: number;
};

/** Streams community lists + followed-patron ratings for TV detail (reviews are movie-only today). */
export async function TvDetailCommunityAsync({
	tvId,
	tvTitle,
	tvPosterUrl: _tvPosterUrl,
}: {
	tvId: string;
	tvTitle: string;
	tvPosterUrl: string | null;
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
		<div className={MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME}>
			<MovieDetailExploreTabs
				layout="stacked"
				showRelated={false}
				lists={tvLists}
				followingRatings={followingRatingsPayload.entries}
				followingRatingsMoreCount={followingRatingsPayload.moreCount}
				reviews={[]}
				moreLikeThis={[]}
				relatedListingKind="tv"
				listCountLabel="titles"
				movieTitle={tvTitle}
				listingTmdbId={Number(tvId)}
			/>
		</div>
	);
}

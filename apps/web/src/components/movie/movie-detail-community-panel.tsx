import { MovieDetailExploreTabs } from "@/components/movie/movie-detail-explore-tabs";
import type { MovieDetailFollowingRating } from "@/components/movie/movie-detail-following-ratings";
import { MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME } from "@/lib/movie-detail-sections";
import { serverApi } from "@/lib/server-api";

type ReviewRow = {
	id: string;
	userId: string;
	movieId: number;
	title: string | null;
	body: string;
	rating: number | null;
	likesCount: number;
	commentsCount: number;
	containsSpoilers?: boolean;
	publishedAt: string | Date;
	audioUrl?: string | null;
	audioDurationMs?: number | null;
	author?: {
		handle: string;
		displayName: string;
		image: string | null;
	} | null;
};

function normalizeReviewRow(raw: ReviewRow) {
	return {
		id: raw.id,
		userId: raw.userId,
		movieId: raw.movieId,
		title: raw.title,
		body: raw.body,
		rating: raw.rating,
		likesCount: raw.likesCount ?? 0,
		commentsCount: raw.commentsCount ?? 0,
		containsSpoilers: raw.containsSpoilers ?? false,
		audioUrl: raw.audioUrl ?? null,
		audioDurationMs: raw.audioDurationMs ?? null,
		publishedAt:
			raw.publishedAt instanceof Date
				? raw.publishedAt.toISOString()
				: raw.publishedAt,
		author: raw.author ?? null,
	};
}

type MovieListRow = {
	id: string;
	title: string;
	description: string | null;
	itemsCount: number;
	updatedAt: string;
	likesCount: number;
	ownerHandle?: string;
	coverMovieIds?: number[];
	coverPosterPaths?: (string | null)[];
	coverImageUrl?: string | null;
	coverMovieId?: number | null;
};

type FollowingRatingsPayload = {
	entries: MovieDetailFollowingRating[];
	moreCount: number;
};

/** Community tab body — reviews, lists, and following ratings (related stays on About). */
export async function MovieDetailCommunityPanel({
	id,
	tmdbId,
	numericId,
	title,
}: {
	id: string;
	tmdbId: number;
	numericId: number;
	title: string;
}) {
	const api = await serverApi();

	const [reviewsRes, listsRes, followingRatingsRes] = await Promise.all([
		api.api
			.movies({ id })
			.reviews.get()
			.catch(() => ({ data: [] })),
		api.api
			.movies({ id })
			.lists.get()
			.catch(() => ({ data: [] })),
		api.api
			.movies({ id })
			["following-ratings"].get()
			.catch(() => ({ data: { entries: [], moreCount: 0 } })),
	]);

	const reviews = ((reviewsRes.data as unknown as ReviewRow[]) ?? []).map(
		normalizeReviewRow,
	);
	const movieLists = (listsRes.data as unknown as MovieListRow[]) ?? [];
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
				followingRatings={followingRatingsPayload.entries}
				followingRatingsMoreCount={followingRatingsPayload.moreCount}
				lists={movieLists}
				reviews={reviews}
				moreLikeThis={[]}
				movieId={numericId}
				movieTitle={title}
				listingTmdbId={tmdbId}
			/>
		</div>
	);
}

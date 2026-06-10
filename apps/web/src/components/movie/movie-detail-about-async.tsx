import { cn } from "@still/ui/lib/utils";

import { CreditsCrawl } from "@/components/cinema/credits-crawl";
import { CreditsFooter } from "@/components/cinema/credits-footer";
import { MovieCastCrewArc } from "@/components/movie/movie-cast-crew-arc";
import { MovieDetailBodySection } from "@/components/movie/movie-detail-body-section";
import { MovieDetailExploreTabs } from "@/components/movie/movie-detail-explore-tabs";
import type { MovieDetailFollowingRating } from "@/components/movie/movie-detail-following-ratings";
import type { MovieDetailHeroSlide } from "@/components/movie/movie-detail-hero-media";
import { MovieDetailStillsSection } from "@/components/movie/movie-detail-stills-carousel";
import { MoviePremieresFestivals } from "@/components/movie/movie-premieres-festivals";
import type { ArcCreditCard } from "@/lib/movie-cast-crew-arc";
import {
	MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME,
	MOVIE_DETAIL_SECTION,
} from "@/lib/movie-detail-sections";
import type {
	buildCrewRows,
	CreditsCrawlLineSeed,
	PremiereRow,
	TmdbMovieSummary,
} from "@/lib/movie-detail-tmdb";
import { buildMovieRecognitionEntries } from "@/lib/movie-festival-recognition";
import { serverApi } from "@/lib/server-api";
import { fetchWikidataMovieAwards } from "@/lib/wikidata-movie-awards";

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

export interface MovieDetailAboutAsyncProps {
	id: string;
	tmdbId: number;
	numericId: number;
	title: string;
	year: number | null;
	directors: { name: string }[];
	arcCast: ArcCreditCard[];
	arcCrew: ArcCreditCard[];
	fullCast: {
		id: number;
		name: string;
		character?: string;
		profile_path: string | null;
	}[];
	creditsCrewRows: ReturnType<typeof buildCrewRows>;
	crewCrawlLines: CreditsCrawlLineSeed[];
	moreLikeThis: TmdbMovieSummary[];
	moviePosterUrl: string | null;
	imdbId: string | null;
	festivalKeywords: string[];
	premiereRows: PremiereRow[];
	screenshots?: MovieDetailHeroSlide[];
}

/** Streams reviews, lists, and Wikidata awards while hero + tabs stay interactive. */
export async function MovieDetailAboutAsync(props: MovieDetailAboutAsyncProps) {
	const {
		id,
		tmdbId,
		numericId,
		title,
		year,
		directors,
		arcCast,
		arcCrew,
		fullCast,
		creditsCrewRows,
		crewCrawlLines,
		moreLikeThis,
		moviePosterUrl: _moviePosterUrl,
		imdbId,
		festivalKeywords,
		premiereRows,
		screenshots = [],
	} = props;

	const api = await serverApi();

	const [reviewsRes, listsRes, followingRatingsRes, wikidataAwards] =
		await Promise.all([
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
			fetchWikidataMovieAwards({ tmdbId, imdbId }),
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

	const recognitionEntries = buildMovieRecognitionEntries(
		festivalKeywords,
		premiereRows,
		year,
		wikidataAwards,
	);
	const recognitionPresent = recognitionEntries.length > 0;

	return (
		<div className={MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME}>
			{arcCast.length || arcCrew.length || recognitionPresent ? (
				<div
					className={cn(
						(arcCast.length || arcCrew.length) &&
							recognitionPresent &&
							"flex flex-col gap-10 sm:gap-12",
					)}
				>
					{arcCast.length || arcCrew.length ? (
						<MovieCastCrewArc
							movieId={tmdbId}
							cast={arcCast}
							crew={arcCrew}
							creditsCatalog={{
								title,
								cast: fullCast,
								crewRows: creditsCrewRows,
							}}
						/>
					) : null}

					{recognitionPresent ? (
						<MoviePremieresFestivals entries={recognitionEntries} />
					) : null}
				</div>
			) : null}

			<MovieDetailStillsSection screenshots={screenshots} title={title} />

			<MovieDetailExploreTabs
				layout="stacked"
				followingRatings={followingRatingsPayload.entries}
				followingRatingsMoreCount={followingRatingsPayload.moreCount}
				lists={movieLists}
				reviews={reviews}
				moreLikeThis={moreLikeThis}
				movieId={numericId}
				movieTitle={title}
				listingTmdbId={tmdbId}
			/>

			{crewCrawlLines.length ? (
				<MovieDetailBodySection
					id={MOVIE_DETAIL_SECTION.credits}
					title=""
					showHeader={false}
					className="pt-2 pb-2"
				>
					<CreditsCrawl
						lines={crewCrawlLines}
						durationSec={Math.min(
							420,
							Math.max(160, crewCrawlLines.length * 22),
						)}
					/>
				</MovieDetailBodySection>
			) : null}

			<CreditsFooter
				lines={[
					title,
					year ? `Released ${year}` : "Year TBD",
					directors.length
						? `Directed by ${directors.map((d) => d.name).join(" & ")}`
						: "Director TBD",
					`Title page #${tmdbId}`,
				]}
			/>
		</div>
	);
}

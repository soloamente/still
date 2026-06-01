import { cn } from "@still/ui/lib/utils";

import { CreditsCrawl } from "@/components/cinema/credits-crawl";
import { CreditsFooter } from "@/components/cinema/credits-footer";
import { MovieCastCrewArc } from "@/components/movie/movie-cast-crew-arc";
import { MovieDetailBodySection } from "@/components/movie/movie-detail-body-section";
import { MovieDetailExploreTabs } from "@/components/movie/movie-detail-explore-tabs";
import { MoviePremieresFestivals } from "@/components/movie/movie-premieres-festivals";
import { APP_NAME } from "@/lib/app-brand";
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
	publishedAt: string;
};

type MovieListRow = {
	id: string;
	title: string;
	description: string | null;
	itemsCount: number;
	updatedAt: string;
	likesCount: number;
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
	communityAverage: number | null;
	communityReviewsCount: number;
	imdbId: string | null;
	festivalKeywords: string[];
	premiereRows: PremiereRow[];
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
		communityAverage,
		communityReviewsCount,
		imdbId,
		festivalKeywords,
		premiereRows,
	} = props;

	const api = await serverApi();

	const [reviewsRes, listsRes, wikidataAwards] = await Promise.all([
		api.api
			.movies({ id })
			.reviews.get()
			.catch(() => ({ data: [] })),
		api.api
			.movies({ id })
			.lists.get()
			.catch(() => ({ data: [] })),
		fetchWikidataMovieAwards({ tmdbId, imdbId }),
	]);

	const reviews = (reviewsRes.data as unknown as ReviewRow[]) ?? [];
	const movieLists = (listsRes.data as unknown as MovieListRow[]) ?? [];

	const recognitionEntries = buildMovieRecognitionEntries(
		festivalKeywords,
		premiereRows,
		year,
		wikidataAwards,
	);
	const recognitionPresent = recognitionEntries.length > 0;

	const featuredReviews = [...reviews]
		.filter((r) => r.body.trim().length >= 100)
		.sort(
			(a, b) => b.likesCount - a.likesCount || b.body.length - a.body.length,
		)
		.slice(0, 2);
	const featuredIds = new Set(featuredReviews.map((r) => r.id));
	const reviewsAfterFeatured = reviews.filter((r) => !featuredIds.has(r.id));

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

			<MovieDetailExploreTabs
				layout="stacked"
				communityAverage={communityAverage}
				communityReviewsCount={communityReviewsCount}
				lists={movieLists}
				featuredReviews={featuredReviews}
				reviewsAfterFeatured={reviewsAfterFeatured}
				reviews={reviews}
				moreLikeThis={moreLikeThis}
				movieId={numericId}
				movieTitle={title}
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
					`${APP_NAME} showpage #${tmdbId}`,
				]}
			/>
		</div>
	);
}

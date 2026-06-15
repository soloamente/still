import { cn } from "@still/ui/lib/utils";

import { CreditsCrawl } from "@/components/cinema/credits-crawl";
import { CreditsFooter } from "@/components/cinema/credits-footer";
import { MovieCastCrewArc } from "@/components/movie/movie-cast-crew-arc";
import { MovieDetailBodySection } from "@/components/movie/movie-detail-body-section";
import { MovieDetailRelatedCatalogue } from "@/components/movie/movie-detail-explore-tabs";
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
import { fetchWikidataMovieAwards } from "@/lib/wikidata-movie-awards";

export interface MovieDetailAboutAsyncProps {
	tmdbId: number;
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
	imdbId: string | null;
	festivalKeywords: string[];
	premiereRows: PremiereRow[];
	screenshots?: MovieDetailHeroSlide[];
	moreLikeThis: TmdbMovieSummary[];
}

/** About tab — cast, awards, stills, credits (community lives on its own tab). */
export async function MovieDetailAboutAsync(props: MovieDetailAboutAsyncProps) {
	const {
		tmdbId,
		title,
		year,
		directors,
		arcCast,
		arcCrew,
		fullCast,
		creditsCrewRows,
		crewCrawlLines,
		imdbId,
		festivalKeywords,
		premiereRows,
		screenshots = [],
		moreLikeThis,
	} = props;

	const wikidataAwards = await fetchWikidataMovieAwards({ tmdbId, imdbId });

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

			<MovieDetailRelatedCatalogue movies={moreLikeThis} listingKind="movie" />

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

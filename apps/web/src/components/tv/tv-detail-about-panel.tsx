import { cn } from "@still/ui/lib/utils";

import { CreditsCrawl } from "@/components/cinema/credits-crawl";
import { CreditsFooter } from "@/components/cinema/credits-footer";
import { MovieCastCrewArc } from "@/components/movie/movie-cast-crew-arc";
import { MovieDetailBodySection } from "@/components/movie/movie-detail-body-section";
import { MovieDetailExploreTabs } from "@/components/movie/movie-detail-explore-tabs";
import { MoviePremieresFestivals } from "@/components/movie/movie-premieres-festivals";
import { TvDetailMalMeta } from "@/components/tv/tv-detail-mal-meta";
import { TvDetailProgressPanel } from "@/components/tv/tv-detail-progress-panel";
import { APP_NAME } from "@/lib/app-brand";
import type { ArcCreditCard } from "@/lib/movie-cast-crew-arc";
import {
	MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME,
	MOVIE_DETAIL_SECTION,
} from "@/lib/movie-detail-sections";
import type {
	buildCrewRows,
	CreditsCrawlLineSeed,
	TmdbMovieSummary,
} from "@/lib/movie-detail-tmdb";
import type { FestivalRecognitionEntry } from "@/lib/movie-festival-recognition";
import type { TvMalEnrichment } from "@/lib/tv-mal-enrichment";

/** TV About tab body — no extra API round-trip (explore tabs are TMDb-only for now). */
export function TvDetailAboutPanel({
	tvId,
	title,
	year,
	numberOfSeasons,
	numberOfEpisodes,
	arcCast,
	arcCrew,
	fullCast,
	creditsCrewRows,
	crewCrawlLines,
	recognitionEntries,
	recognitionPresent,
	moreLikeThis,
	malEnrichment,
}: {
	tvId: number;
	title: string;
	year: number | null;
	numberOfSeasons: number | null;
	numberOfEpisodes: number | null;
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
	recognitionEntries: FestivalRecognitionEntry[];
	recognitionPresent: boolean;
	moreLikeThis: TmdbMovieSummary[];
	malEnrichment?: TvMalEnrichment | null;
}) {
	return (
		<div className={MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME}>
			<TvDetailMalMeta malEnrichment={malEnrichment} />

			{numberOfSeasons != null && numberOfSeasons > 0 ? (
				<TvDetailProgressPanel tvId={tvId} />
			) : null}

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
							movieId={tvId}
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
				lists={[]}
				featuredReviews={[]}
				reviewsAfterFeatured={[]}
				reviews={[]}
				moreLikeThis={moreLikeThis}
				relatedListingKind="tv"
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
					year ? `First aired ${year}` : "Year TBD",
					numberOfEpisodes
						? `${numberOfEpisodes} episodes`
						: "Episode count TBD",
					`${APP_NAME} TV showpage #${tvId}`,
				]}
			/>
		</div>
	);
}

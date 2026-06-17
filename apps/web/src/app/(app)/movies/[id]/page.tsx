import { cn } from "@still/ui/lib/utils";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdultContentBlockedState } from "@/components/detail/adult-content-blocked-state";
import { ListingDetailHeroSynopsis } from "@/components/detail/listing-detail-hero-synopsis";
import { MovieDetailAboutAsync } from "@/components/movie/movie-detail-about-async";
import { MovieDetailAboutFallback } from "@/components/movie/movie-detail-about-fallback";
import { MovieDetailCommunityFallback } from "@/components/movie/movie-detail-community-fallback";
import { MovieDetailCommunityPanel } from "@/components/movie/movie-detail-community-panel";
import { MovieDetailCommunityRatingHero } from "@/components/movie/movie-detail-community-rating-hero";
import { MovieDetailHeroMedia } from "@/components/movie/movie-detail-hero-media";
import { MovieDetailPrimaryActions } from "@/components/movie/movie-detail-primary-actions";
import { MovieDetailQuotesPanel } from "@/components/movie/movie-detail-quotes-panel";
import { MovieDetailViewShell } from "@/components/movie/movie-detail-view-shell";
import { MovieThemeProvider } from "@/components/movie/movie-theme-provider";
import { accentFromGenres } from "@/lib/cinema-accents";
import { requireListingDetailApiData } from "@/lib/eden-api-error";
import { formatRuntime } from "@/lib/format";
import { listingDetailHeroSynopsisBlurb } from "@/lib/listing-detail-hero-synopsis";
import {
	mapCastToArcCards,
	mapCrewToArcCards,
} from "@/lib/movie-cast-crew-arc";
import {
	buildMovieDetailSectionNavItems,
	MOVIE_DETAIL_SECTION,
	MOVIE_DETAIL_SECTION_SCROLL_MARGIN_CLASS,
	movieDetailCreditsCrawlNavItem,
} from "@/lib/movie-detail-sections";
import {
	buildCrewRows,
	crewRowsToCreditsCrawlLines,
	extractPremiereRows,
	festivalAndAwardKeywordNames,
	mergeMoreLikeThis,
} from "@/lib/movie-detail-tmdb";
import { parseMovieDetailViewFromSearchParams } from "@/lib/movie-detail-view";
import { buildMovieRecognitionEntries } from "@/lib/movie-festival-recognition";
import { buildMovieWatchProvidersViewModel } from "@/lib/movie-watch-providers";
import {
	ogImageMetadataFields,
	ogTitleMoviePath,
} from "@/lib/og/og-image-metadata";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function generateMetadata({
	params,
}: {
	params: Promise<Params>;
}) {
	const { id } = await params;
	const api = await serverApi();
	const res = await api.api
		.movies({ id })
		?.get?.()
		.catch(() => ({ data: null }));
	const data = res?.data as {
		title?: string;
		tagline?: string | null;
		overview?: string | null;
	} | null;
	return {
		title: data?.title ?? "Film",
		description:
			listingDetailHeroSynopsisBlurb(data?.overview) ??
			data?.tagline ??
			undefined,
		...ogImageMetadataFields(ogTitleMoviePath(id), data?.title ?? "Film"),
	};
}

type CommunityShape = {
	averageRating: number | null;
	ratingsCount: number;
	watchesCount?: number;
	listsCount?: number;
	favoritesCount?: number;
	watchlistCount?: number;
};

/** SQL aggregates may deserialize as strings — normalize before display. */
function toFiniteNumber(value: unknown): number {
	if (value == null) return 0;
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function toNullableFiniteNumber(value: unknown): number | null {
	if (value == null) return null;
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? n : null;
}

type TmdbJsonShape = {
	genres?: { id: number; name: string }[];
	credits?: {
		cast?: {
			id: number;
			name: string;
			character?: string;
			profile_path: string | null;
		}[];
		crew?: {
			id: number;
			name: string;
			job?: string;
			department?: string;
			profile_path: string | null;
		}[];
	};
	similar?: {
		results?: { id: number; title: string; poster_path: string | null }[];
	};
	recommendations?: {
		results?: { id: number; title: string; poster_path: string | null }[];
	};
	keywords?: { keywords?: { id: number; name: string }[] };
	release_dates?: {
		results: {
			iso_3166_1: string;
			release_dates: {
				certification: string;
				note?: string;
				release_date: string;
				type: number;
			}[];
		}[];
	};
	"watch/providers"?: {
		results?: Record<
			string,
			{
				link?: string;
				flatrate?: {
					provider_id: number;
					provider_name: string;
					logo_path: string;
					display_priority?: number;
				}[];
				rent?: {
					provider_id: number;
					provider_name: string;
					logo_path: string;
					display_priority?: number;
				}[];
				buy?: {
					provider_id: number;
					provider_name: string;
					logo_path: string;
					display_priority?: number;
				}[];
			}
		>;
	};
} | null;

type Detail = {
	tmdbId: number;
	imdbId: string | null;
	title: string;
	originalTitle: string | null;
	overview: string | null;
	tagline: string | null;
	year: number | null;
	runtime: number | null;
	releaseDate: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	backdrop_url: string | null;
	poster_url: string | null;
	genreIds: number[];
	voteAverage: number | null;
	voteCount: number | null;
	/** Poster-derived palette rows; null until a detail API sync persisted them. */
	paletteAccent: string | null;
	paletteMuted: string | null;
	paletteForeground: string | null;
	community: CommunityShape;
	screenshots?: { key: string; src: string; label: string }[];
	tmdbJson: TmdbJsonShape;
};

export default async function MoviePage({
	params,
	searchParams,
}: {
	params: Promise<Params>;
	searchParams: Promise<{
		view?: string;
		tab?: string;
		season?: string;
		episode?: string;
	}>;
}) {
	const { id } = await params;
	const sp = await searchParams;
	const view = parseMovieDetailViewFromSearchParams(sp);
	const numericId = Number(id);
	if (!Number.isFinite(numericId)) notFound();

	const api = await serverApi();
	const res = await api.api.movies({ id }).get();
	const data = requireListingDetailApiData(
		res as {
			data: (Detail & { adultBlocked?: boolean }) | null;
			error: unknown;
		},
	);

	if (data.adultBlocked) {
		const { accent: blockedAccent } = accentFromGenres(null);
		return (
			<MovieThemeProvider
				genreAccent={blockedAccent}
				paletteAccent={null}
				paletteMuted={null}
				paletteForeground={null}
			>
				<div className="bg-card">
					<AdultContentBlockedState />
				</div>
			</MovieThemeProvider>
		);
	}

	const j = data.tmdbJson;
	const directors =
		j?.credits?.crew?.filter((c) => c.job === "Director").slice(0, 2) ?? [];
	const arcCast = mapCastToArcCards(j?.credits?.cast);
	const arcCrew = mapCrewToArcCards(j?.credits?.crew);
	const fullCast = j?.credits?.cast ?? [];
	const creditsCrewRows = buildCrewRows(
		j?.credits?.crew as Parameters<typeof buildCrewRows>[0],
		80,
	);
	/** The crawl can surface more departmental roles behind the marquee. */
	const crewRowsForCrawl = creditsCrewRows;
	const crewCrawlLines = crewRowsToCreditsCrawlLines(crewRowsForCrawl, {
		maxNamesPerRole: 8,
		maxRoles: 48,
	});
	const moreLikeThis = mergeMoreLikeThis(j?.recommendations, j?.similar);
	const watchProviders = buildMovieWatchProvidersViewModel(
		j?.["watch/providers"]?.results,
	);
	const premiereRows = extractPremiereRows(j?.release_dates);
	const festivalKeywords = festivalAndAwardKeywordNames(j?.keywords?.keywords);
	const recognitionPresent =
		buildMovieRecognitionEntries(festivalKeywords, premiereRows, data.year, [])
			.length > 0;

	const { accent: movieAccent } = accentFromGenres(j?.genres);
	const tmdbAvg = toFiniteNumber(data.voteAverage);
	const communityAverage = toNullableFiniteNumber(
		data.community?.averageRating,
	);
	const communityRatingsCount = toFiniteNumber(data.community?.ratingsCount);
	const engagementCounts = {
		watchesCount: toFiniteNumber(data.community?.watchesCount),
		listsCount: toFiniteNumber(data.community?.listsCount),
		favoritesCount: toFiniteNumber(data.community?.favoritesCount),
		watchlistCount: toFiniteNumber(data.community?.watchlistCount),
	};

	const primaryGenre = j?.genres?.[0]?.name ?? null;
	const heroMetaBits: string[] = [];
	if (primaryGenre) heroMetaBits.push(primaryGenre);
	if (data.year != null) heroMetaBits.push(String(data.year));
	const runtimeLabel = formatRuntime(data.runtime);
	if (runtimeLabel) heroMetaBits.push(runtimeLabel);
	const heroMetaLine =
		heroMetaBits.length > 0 ? heroMetaBits.join("\u00a0\u00a0") : null;

	const hasCast = arcCast.length > 0 || arcCrew.length > 0;
	const sectionNavItems = [
		...buildMovieDetailSectionNavItems({
			hasCast,
			hasAwards: recognitionPresent,
		}),
		...(crewCrawlLines.length ? [movieDetailCreditsCrawlNavItem()] : []),
	];
	const detailBasePath = `/movies/${data.tmdbId}`;

	const hero = (
		<div
			id={MOVIE_DETAIL_SECTION.about}
			className={cn(
				MOVIE_DETAIL_SECTION_SCROLL_MARGIN_CLASS,
				"mx-auto flex w-full max-w-lg flex-col items-center px-2.5 pt-12 pb-6 text-center sm:max-w-xl sm:px-3 sm:pt-14 sm:pb-8 md:pt-16 md:pb-10 lg:max-w-2xl lg:pt-20",
			)}
		>
			{heroMetaLine ? (
				<p className="mb-5 text-muted-foreground text-xs tracking-wide">
					{heroMetaLine}
				</p>
			) : null}
			<MovieDetailHeroMedia
				title={data.title}
				posterUrl={data.poster_url}
				backdropUrl={data.backdrop_url}
				artworkSlides={
					(
						data as {
							hero_artwork?: {
								key: string;
								src: string;
								label: string;
							}[];
						}
					).hero_artwork
				}
			/>
			<h1 className="mt-7 text-balance font-sans font-semibold text-3xl leading-[1.05] tracking-[-0.02em] sm:text-4xl">
				{data.title}
			</h1>
			<ListingDetailHeroSynopsis title={data.title} overview={data.overview} />
			<MovieDetailCommunityRatingHero
				variant="compact"
				communityAverage={communityAverage}
				communityRatingsCount={communityRatingsCount}
				engagementCounts={engagementCounts}
				listingKind="movie"
				listingId={data.tmdbId}
				movieId={data.tmdbId}
			/>
			<div className="mt-8 flex w-full justify-center">
				<MovieDetailPrimaryActions
					movieId={data.tmdbId}
					title={data.title}
					posterUrl={
						data.poster_url ??
						(data.posterPath
							? `https://image.tmdb.org/t/p/w342${data.posterPath}`
							: null)
					}
					averageRating={communityAverage ?? tmdbAvg ?? null}
				/>
			</div>
		</div>
	);

	return (
		<MovieThemeProvider
			genreAccent={movieAccent}
			paletteAccent={data.paletteAccent}
			paletteMuted={data.paletteMuted}
			paletteForeground={data.paletteForeground}
		>
			<MovieDetailViewShell
				initialView={view}
				basePath={detailBasePath}
				movieId={data.tmdbId}
				title={data.title}
				sectionNavItems={sectionNavItems}
				hero={hero}
				watchProviders={watchProviders}
				about={
					<Suspense fallback={<MovieDetailAboutFallback />}>
						<MovieDetailAboutAsync
							tmdbId={data.tmdbId}
							title={data.title}
							year={data.year}
							directors={directors}
							arcCast={arcCast}
							arcCrew={arcCrew}
							fullCast={fullCast}
							creditsCrewRows={creditsCrewRows}
							crewCrawlLines={crewCrawlLines}
							imdbId={data.imdbId}
							festivalKeywords={festivalKeywords}
							premiereRows={premiereRows}
							screenshots={data.screenshots ?? []}
							moreLikeThis={moreLikeThis}
						/>
					</Suspense>
				}
				community={
					<Suspense fallback={<MovieDetailCommunityFallback />}>
						<MovieDetailCommunityPanel
							id={id}
							tmdbId={data.tmdbId}
							numericId={numericId}
							title={data.title}
						/>
					</Suspense>
				}
				quotes={
					<MovieDetailQuotesPanel
						listingKind="movie"
						listingId={id}
						tmdbId={data.tmdbId}
						basePath={detailBasePath}
					/>
				}
			/>
		</MovieThemeProvider>
	);
}

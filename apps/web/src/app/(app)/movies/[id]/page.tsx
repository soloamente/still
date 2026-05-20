import { cn } from "@still/ui/lib/utils";
import { notFound } from "next/navigation";

import { CreditsCrawl } from "@/components/cinema/credits-crawl";
import { CreditsFooter } from "@/components/cinema/credits-footer";
import { MovieCastCrewArc } from "@/components/movie/movie-cast-crew-arc";
import { MovieDetailBodySection } from "@/components/movie/movie-detail-body-section";
import { MovieDetailExploreTabs } from "@/components/movie/movie-detail-explore-tabs";
import { MovieDetailHeroMedia } from "@/components/movie/movie-detail-hero-media";
import { MovieDetailPrimaryActions } from "@/components/movie/movie-detail-primary-actions";
import { MovieDetailSectionNav } from "@/components/movie/movie-detail-section-nav";
import { MovieDetailStreaming } from "@/components/movie/movie-detail-streaming";
import { MovieDetailTopBar } from "@/components/movie/movie-detail-top-bar";
import { MoviePremieresFestivals } from "@/components/movie/movie-premieres-festivals";
import { MovieThemeProvider } from "@/components/movie/movie-theme-provider";
import { accentFromGenres } from "@/lib/cinema-accents";
import { formatRuntime } from "@/lib/format";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import { formatLogRatingDisplay } from "@/lib/log-rating";
import {
	mapCastToArcCards,
	mapCrewToArcCards,
} from "@/lib/movie-cast-crew-arc";
import {
	buildMovieDetailSectionNavItems,
	MOVIE_DETAIL_SECTION,
	MOVIE_DETAIL_SECTION_NAV_GUTTER_CLASS,
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
import { buildMovieRecognitionEntries } from "@/lib/movie-festival-recognition";
import { buildMovieWatchProvidersViewModel } from "@/lib/movie-watch-providers";
import { serverApi } from "@/lib/server-api";
import { fetchWikidataMovieAwards } from "@/lib/wikidata-movie-awards";

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
	const data = res?.data as { title?: string; tagline?: string | null } | null;
	return {
		title: data?.title ?? "Film",
		description: data?.tagline ?? undefined,
	};
}

type CommunityShape = {
	averageRating: number | null;
	reviewsCount: number;
};

/** SQL aggregates may deserialize as strings — normalize before `.toFixed` / `Math.round`. */
function toFiniteNumber(value: unknown): number | null {
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
	tmdbJson: TmdbJsonShape;
};

export default async function MoviePage({
	params,
	searchParams,
}: {
	params: Promise<Params>;
	searchParams: Promise<{ view?: string }>;
}) {
	const { id } = await params;
	const sp = await searchParams;
	const view: "about" | "streaming" =
		sp.view === "streaming" ? "streaming" : "about";
	const numericId = Number(id);
	if (!Number.isFinite(numericId)) notFound();

	const api = await serverApi();
	const res = await api.api.movies({ id }).get();
	const data = (res.data as Detail | null) ?? null;
	if (!data) notFound();

	const reviewsRes = await api.api
		.movies({ id })
		.reviews.get()
		.catch(() => ({ data: [] }));
	const reviews = (reviewsRes.data as unknown as ReviewRow[]) ?? [];

	const listsRes = await api.api
		.movies({ id })
		.lists.get()
		.catch(() => ({ data: [] }));
	const movieLists = (listsRes.data as unknown as MovieListRow[]) ?? [];

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
	const wikidataAwards = await fetchWikidataMovieAwards({
		tmdbId: data.tmdbId,
		imdbId: data.imdbId,
	});
	const recognitionEntries = buildMovieRecognitionEntries(
		festivalKeywords,
		premiereRows,
		data.year,
		wikidataAwards,
	);
	const recognitionPresent = recognitionEntries.length > 0;

	const { accent: movieAccent } = accentFromGenres(j?.genres);
	const tmdbAvg = toFiniteNumber(data.voteAverage);
	const communityAverage = toFiniteNumber(data.community?.averageRating);
	const communityReviewsCount = Math.max(
		0,
		Math.floor(toFiniteNumber(data.community?.reviewsCount) ?? 0),
	);

	/** Highlight the most engaged write-ups as stand-ins for “critic pull quotes”. */
	const featuredReviews = [...reviews]
		.filter((r) => r.body.trim().length >= 100)
		.sort(
			(a, b) => b.likesCount - a.likesCount || b.body.length - a.body.length,
		)
		.slice(0, 2);
	const featuredIds = new Set(featuredReviews.map((r) => r.id));
	const reviewsAfterFeatured = reviews.filter((r) => !featuredIds.has(r.id));

	const primaryGenre = j?.genres?.[0]?.name ?? null;
	const heroMetaBits: string[] = [];
	if (primaryGenre) heroMetaBits.push(primaryGenre);
	if (data.year != null) heroMetaBits.push(String(data.year));
	const runtimeLabel = formatRuntime(data.runtime);
	if (runtimeLabel) heroMetaBits.push(runtimeLabel);
	const heroMetaLine =
		heroMetaBits.length > 0 ? heroMetaBits.join("\u00a0\u00a0") : null;
	const heroBlurb =
		data.tagline?.trim() ||
		(data.overview
			? data.overview.length > 280
				? `${data.overview.slice(0, 277)}…`
				: data.overview
			: null);

	const hasCast = arcCast.length > 0 || arcCrew.length > 0;
	const sectionNavItems = [
		...buildMovieDetailSectionNavItems({
			hasCast,
			hasAwards: recognitionPresent,
		}),
		...(crewCrawlLines.length ? [movieDetailCreditsCrawlNavItem()] : []),
	];
	const showSectionNav = view === "about" && sectionNavItems.length >= 2;

	return (
		<MovieThemeProvider
			genreAccent={movieAccent}
			paletteAccent={data.paletteAccent}
			paletteMuted={data.paletteMuted}
			paletteForeground={data.paletteForeground}
		>
			<div className="flex min-h-0 flex-1 flex-col overflow-visible bg-background">
				<MovieDetailTopBar
					movieId={data.tmdbId}
					title={data.title}
					view={view}
				/>
				{showSectionNav ? (
					<MovieDetailSectionNav sections={sectionNavItems} />
				) : null}

				{/*
				 * Same rounded `bg-card` shell as `/home` + `/diary` catalogue (`HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME`).
				 * Sticky chrome stays on `bg-background` above the card so we do not double-wrap `.movie-themed`.
				 */}
				<section
					className={cn(
						HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
						"min-h-0 flex-1 overflow-visible",
					)}
				>
					<article
						className={cn(
							"flex min-h-0 flex-1 flex-col",
							showSectionNav && MOVIE_DETAIL_SECTION_NAV_GUTTER_CLASS,
						)}
					>
						{/* Centered hero column — matches `/home` + `/diary` lobby rhythm: soft canvas, generous spacing, pill chrome. */}
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
							/>
							{/* Hero title: SF Pro Rounded (`font-sans`) — Mobbin comp uses UI sans, not Fraunces display. */}
							<h1 className="mt-7 text-balance font-sans font-semibold text-3xl leading-[1.05] tracking-[-0.02em] sm:text-4xl">
								{data.title}
							</h1>
							{heroBlurb ? (
								<p className="mt-4 w-full max-w-2xl text-balance font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
									{heroBlurb}
								</p>
							) : null}
							{communityAverage != null ? (
								<div className="mt-4 flex flex-wrap items-center justify-center gap-2">
									<span className="font-serif text-2xl tabular-nums">
										{formatLogRatingDisplay(communityAverage)}
										<span className="text-base text-muted-foreground">/10</span>
									</span>
									<span className="text-muted-foreground text-xs">
										· {communityReviewsCount} reviews on Still
									</span>
								</div>
							) : null}
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

						{view === "streaming" ? (
							<section className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-2.5 pt-6 pb-8 sm:px-3 sm:pt-8 sm:pb-10">
								<MovieDetailStreaming watchProviders={watchProviders} />
							</section>
						) : null}

						{view === "about" ? (
							<div className="mx-auto max-w-7xl space-y-12 px-2.5 pt-8 pb-10 sm:px-4 sm:pt-10 md:px-5 md:pt-12">
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
												movieId={data.tmdbId}
												cast={arcCast}
												crew={arcCrew}
												creditsCatalog={{
													title: data.title,
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
									movieTitle={data.title}
								/>

								{crewCrawlLines.length ? (
									<MovieDetailBodySection
										id={MOVIE_DETAIL_SECTION.credits}
										title=""
										showHeader={false}
										className="pt-2 pb-2"
									>
										{/* Client-only crawl — no section chrome; right-rail legend uses “Credits”. */}
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
										data.title,
										data.year ? `Released ${data.year}` : "Year TBD",
										directors.length
											? `Directed by ${directors.map((d) => d.name).join(" & ")}`
											: "Director TBD",
										`Still showpage #${data.tmdbId}`,
									]}
								/>
							</div>
						) : null}
					</article>
				</section>
			</div>
		</MovieThemeProvider>
	);
}

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

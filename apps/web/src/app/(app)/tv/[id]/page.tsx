import { cn } from "@still/ui/lib/utils";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { MovieDetailHeroMedia } from "@/components/movie/movie-detail-hero-media";
import { MovieDetailViewShell } from "@/components/movie/movie-detail-view-shell";
import { MovieThemeProvider } from "@/components/movie/movie-theme-provider";
import { StarRating } from "@/components/rating/star-rating";
import { TvDetailAboutPanel } from "@/components/tv/tv-detail-about-panel";
import { TvDetailClientRoot } from "@/components/tv/tv-detail-client-root";
import { TvDetailCommunityAsync } from "@/components/tv/tv-detail-community-async";
import { TvDetailCommunityFallback } from "@/components/tv/tv-detail-community-fallback";
import { TvDetailPrimaryActions } from "@/components/tv/tv-detail-primary-actions";
import { APP_NAME } from "@/lib/app-brand";
import { accentFromGenres } from "@/lib/cinema-accents";
import { formatRuntime } from "@/lib/format";
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
	festivalAndAwardKeywordNames,
	mergeMoreLikeThis,
	tvDetailKeywordList,
	tvNameRowsToMovieSummaries,
} from "@/lib/movie-detail-tmdb";
import { parseMovieDetailView } from "@/lib/movie-detail-view";
import { buildMovieRecognitionEntries } from "@/lib/movie-festival-recognition";
import { buildMovieWatchProvidersViewModel } from "@/lib/movie-watch-providers";
import { serverApi } from "@/lib/server-api";
import { TV_DETAIL_SECTION } from "@/lib/tv-detail-sections";

export const dynamic = "force-dynamic";

type Params = { id: string };

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
		results?: { id: number; name: string; poster_path: string | null }[];
	};
	recommendations?: {
		results?: { id: number; name: string; poster_path: string | null }[];
	};
	keywords?: {
		results?: { id: number; name: string }[];
		keywords?: { id: number; name: string }[];
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

type CommunityShape = {
	averageRating: number | null;
	reviewsCount: number;
};

type TvDetail = {
	tmdbId: number;
	title: string;
	originalTitle: string | null;
	overview: string | null;
	tagline: string | null;
	year: number | null;
	firstAirDate: string | null;
	lastAirDate: string | null;
	numberOfSeasons: number | null;
	numberOfEpisodes: number | null;
	episodeRuntime: number | null;
	posterPath: string | null;
	backdropPath: string | null;
	backdrop_url: string | null;
	poster_url: string | null;
	genreIds: number[];
	voteAverage: number | null;
	voteCount: number | null;
	paletteAccent: string | null;
	paletteMuted: string | null;
	paletteForeground: string | null;
	community: CommunityShape;
	malEnrichment?: {
		malId: number;
		score: number | null;
		rank: number | null;
		popularity: number | null;
		status: string | null;
	} | null;
	tmdbJson: TmdbJsonShape;
};

export async function generateMetadata({
	params,
}: {
	params: Promise<Params>;
}) {
	const { id } = await params;
	const api = await serverApi();
	const res = await api.api
		.tv({ id })
		?.get?.()
		.catch(() => ({ data: null }));
	const data = res?.data as { title?: string; tagline?: string | null } | null;
	return {
		title: data?.title ?? "TV show",
		description: data?.tagline ?? undefined,
	};
}

export default async function TvShowPage({
	params,
	searchParams,
}: {
	params: Promise<Params>;
	searchParams: Promise<{ view?: string }>;
}) {
	const { id } = await params;
	const sp = await searchParams;
	const view = parseMovieDetailView(sp.view);
	const numericId = Number(id);
	if (!Number.isFinite(numericId)) notFound();

	const api = await serverApi();
	const res = await api.api.tv({ id }).get();
	const data = (res.data as TvDetail | null) ?? null;
	if (!data) notFound();
	if (
		(data as { code?: string }).code === "TMDB_UNCONFIGURED" &&
		typeof (data as { hint?: string }).hint === "string"
	) {
		const hint = (data as unknown as { hint: string }).hint;
		return (
			<div className="mx-auto max-w-lg p-8 text-center text-muted-foreground text-sm leading-relaxed">
				{hint}
			</div>
		);
	}
	if (!data.title?.trim()) notFound();

	const j = data.tmdbJson;
	const arcCast = mapCastToArcCards(j?.credits?.cast);
	const arcCrew = mapCrewToArcCards(j?.credits?.crew);
	const fullCast = j?.credits?.cast ?? [];
	const creditsCrewRows = buildCrewRows(
		j?.credits?.crew as Parameters<typeof buildCrewRows>[0],
		80,
	);
	const crewRowsForCrawl = creditsCrewRows;
	const crewCrawlLines = crewRowsToCreditsCrawlLines(crewRowsForCrawl, {
		maxNamesPerRole: 8,
		maxRoles: 48,
	});
	const recSummaries = tvNameRowsToMovieSummaries(j?.recommendations?.results);
	const simSummaries = tvNameRowsToMovieSummaries(j?.similar?.results);
	const moreLikeThis = mergeMoreLikeThis(
		{ results: recSummaries },
		{ results: simSummaries },
	);
	const watchProviders = buildMovieWatchProvidersViewModel(
		j?.["watch/providers"]?.results,
	);
	const keywordNames = festivalAndAwardKeywordNames(
		tvDetailKeywordList(j?.keywords),
	);
	const recognitionEntries = buildMovieRecognitionEntries(
		keywordNames,
		[],
		data.year,
		[],
	);
	const recognitionPresent = recognitionEntries.length > 0;

	const { accent: genreAccent } = accentFromGenres(j?.genres);

	const primaryGenre = j?.genres?.[0]?.name ?? null;
	const heroMetaBits: string[] = [];
	if (primaryGenre) heroMetaBits.push(primaryGenre);
	if (data.year != null) heroMetaBits.push(String(data.year));
	if (data.numberOfSeasons != null && data.numberOfSeasons > 0) {
		heroMetaBits.push(
			`${data.numberOfSeasons} season${data.numberOfSeasons === 1 ? "" : "s"}`,
		);
	}
	const runtimeLabel = formatRuntime(data.episodeRuntime ?? undefined);
	if (runtimeLabel) heroMetaBits.push(`${runtimeLabel} / ep`);
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
	if (data.numberOfSeasons != null && data.numberOfSeasons > 0) {
		sectionNavItems.splice(1, 0, {
			id: TV_DETAIL_SECTION.progress,
			label: "Progress",
		});
	}
	const detailBasePath = `/tv/${data.tmdbId}`;

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
			{heroBlurb ? (
				<p className="mt-4 w-full max-w-2xl text-balance font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
					{heroBlurb}
				</p>
			) : null}
			{data.community?.averageRating ? (
				<div className="mt-4 flex flex-wrap items-center justify-center gap-3">
					<StarRating
						value={Math.round(data.community.averageRating)}
						readOnly
						variant="marquee"
					/>
					<span className="text-muted-foreground text-xs">
						{data.community.reviewsCount} reviews on {APP_NAME}
					</span>
				</div>
			) : null}
			<div className="mt-8 flex w-full justify-center">
				<TvDetailPrimaryActions />
			</div>
		</div>
	);

	return (
		<MovieThemeProvider
			genreAccent={genreAccent}
			paletteAccent={data.paletteAccent}
			paletteMuted={data.paletteMuted}
			paletteForeground={data.paletteForeground}
		>
			<TvDetailClientRoot
				tvId={data.tmdbId}
				title={data.title}
				posterUrl={data.poster_url}
				averageRating={data.community?.averageRating ?? null}
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
						<TvDetailAboutPanel
							tvId={data.tmdbId}
							title={data.title}
							year={data.year}
							numberOfSeasons={data.numberOfSeasons}
							numberOfEpisodes={data.numberOfEpisodes}
							arcCast={arcCast}
							arcCrew={arcCrew}
							fullCast={fullCast}
							creditsCrewRows={creditsCrewRows}
							crewCrawlLines={crewCrawlLines}
							recognitionEntries={recognitionEntries}
							recognitionPresent={recognitionPresent}
							malEnrichment={data.malEnrichment ?? null}
							community={
								<Suspense fallback={<TvDetailCommunityFallback />}>
									<TvDetailCommunityAsync
										tvId={id}
										moreLikeThis={moreLikeThis}
									/>
								</Suspense>
							}
						/>
					}
				/>
			</TvDetailClientRoot>
		</MovieThemeProvider>
	);
}

import { Calendar, Clock, Star, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CreditsCrawl } from "@/components/cinema/credits-crawl";
import { CreditsFooter } from "@/components/cinema/credits-footer";
import { EndCreditsChecklist } from "@/components/cinema/end-credits-checklist";
import { FrameStamp } from "@/components/cinema/frame-stamp";
import { Letterbox } from "@/components/cinema/letterbox";
import { MovieProjectionHum } from "@/components/cinema/movie-projection-hum";
import { MovieShareStub } from "@/components/cinema/movie-share-stub";
import { MovieActions } from "@/components/movie/movie-actions";
import { MovieCrewTable } from "@/components/movie/movie-crew-table";
import { MovieDetailExploreTabs } from "@/components/movie/movie-detail-explore-tabs";
import { MoviePoster } from "@/components/movie/movie-poster";
import { MovieThemeProvider } from "@/components/movie/movie-theme-provider";
import { StarRating } from "@/components/rating/star-rating";
import { Section } from "@/components/ui/section";
import { accentFromGenres } from "@/lib/cinema-accents";
import { formatDate, formatRuntime } from "@/lib/format";
import {
	buildCrewRows,
	crewRowsToCreditsCrawlLines,
	extractPremiereRows,
	festivalAndAwardKeywordNames,
	mergeMoreLikeThis,
} from "@/lib/movie-detail-tmdb";
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
				flatrate?: { provider_name: string; logo_path: string }[];
			}
		>;
	};
} | null;

type Detail = {
	tmdbId: number;
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
}: {
	params: Promise<Params>;
}) {
	const { id } = await params;
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
	const topCast = j?.credits?.cast?.slice(0, 14) ?? [];
	const crewRows = buildCrewRows(
		j?.credits?.crew as Parameters<typeof buildCrewRows>[0],
	);
	/** The table stays terse; the crawl can surface more departmental roles behind the marquee. */
	const crewRowsForCrawl = buildCrewRows(
		j?.credits?.crew as Parameters<typeof buildCrewRows>[0],
		80,
	);
	const crewCrawlLines = crewRowsToCreditsCrawlLines(crewRowsForCrawl, {
		maxNamesPerRole: 8,
		maxRoles: 48,
	});
	const moreLikeThis = mergeMoreLikeThis(j?.recommendations, j?.similar);
	const providersUs =
		j?.["watch/providers"]?.results?.US?.flatrate?.slice(0, 6) ?? [];
	const premiereRows = extractPremiereRows(j?.release_dates);
	const festivalKeywords = festivalAndAwardKeywordNames(j?.keywords?.keywords);
	const recognitionPresent =
		premiereRows.length > 0 || festivalKeywords.length > 0;

	const { accent: movieAccent } = accentFromGenres(j?.genres);
	const doubleFeaturePick =
		moreLikeThis.find((m) => m.id !== data.tmdbId) ?? null;

	const tmdbAvg = data.voteAverage;
	const tmdbVotes = data.voteCount ?? 0;

	/** Highlight the most engaged write-ups as stand-ins for “critic pull quotes”. */
	const featuredReviews = [...reviews]
		.filter((r) => r.body.trim().length >= 100)
		.sort(
			(a, b) => b.likesCount - a.likesCount || b.body.length - a.body.length,
		)
		.slice(0, 2);
	const featuredIds = new Set(featuredReviews.map((r) => r.id));
	const reviewsAfterFeatured = reviews.filter((r) => !featuredIds.has(r.id));

	return (
		<MovieThemeProvider
			genreAccent={movieAccent}
			paletteAccent={data.paletteAccent}
			paletteMuted={data.paletteMuted}
			paletteForeground={data.paletteForeground}
		>
			<MovieProjectionHum />
			<article>
				{/* Full viewport width so backdrop + poster band aren’t trapped in the layout column.
          Backdrop sits in a Scope letterbox; title block overlaps the lower bar (~ Villeneuve overlap). */}
				<section className="cinema-hero-iris movie-hero-glow relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden">
					<FrameStamp label="4-PERF · SCOPE · 24FPS" />
					{/*
					 * No true-black mattes: the bottom matte was reading as dead space right where the portrait
					 * poster overlaps the hero—which felt like broken padding.
					 */}
					{/* Entire Scope frame is decorative; keep it off the hit-test map so taps
             always hit the overlapping poster / diary row above the backdrop wash. */}
					<Letterbox
						aspect="2.39"
						bars={false}
						className="pointer-events-none relative z-0 w-full"
					>
						{/*
						 * Hero imagery stacks under the overlapping title strip (`md:-mt-24`).
						 * Without `pointer-events-none`, the overlap reads clicks first and diary / watchlist
						 * buttons underneath never fire.
						 */}
						<div className="pointer-events-none absolute inset-0 [--cinema-hero-img-base-op:0.4]">
							{data.backdrop_url ? (
								<Image
									src={data.backdrop_url}
									alt=""
									fill
									priority
									sizes="100vw"
									className="cinema-hero-flicker object-cover opacity-40"
								/>
							) : null}
							<div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/85 to-background" />
						</div>
					</Letterbox>
					{/* Elevate + explicitly re-enable hits on the overlapping strip — hero chrome
             above the Scope frame stays reliably clickable at ultrawide sizes. */}
					<div className="pointer-events-auto relative isolate z-20 w-full px-3 pt-0 pb-12 sm:px-4 md:mx-auto md:-mt-24 md:max-w-7xl md:px-5 md:pt-5 md:pb-20">
						{/*
						 * Stacked hero: poster (cover) first, then title/actions centered beneath — reads cleaner on
						 * ultra-wide viewports than a wide empty wedge beside a fixed-width portrait.
						 */}
						<div className="flex flex-col items-center gap-8">
							<MoviePoster
								movieId={data.tmdbId}
								title={data.title}
								posterUrl={data.poster_url}
								size="hero"
								priority
							/>
							<div className="w-full max-w-3xl space-y-4 px-3 text-center sm:px-4 md:px-0">
								<p className="text-muted-foreground text-xs uppercase tracking-wider">
									{data.releaseDate
										? formatDate(new Date(data.releaseDate))
										: data.year}
								</p>
								<h1 className="font-display font-medium text-4xl leading-[1] tracking-[-0.02em] md:text-6xl">
									{data.title}
								</h1>
								{data.tagline ? (
									<p className="font-editorial text-base text-muted-foreground md:text-lg">
										{data.tagline}
									</p>
								) : null}
								<ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
									{data.year ? (
										<li className="inline-flex items-center gap-1">
											<Calendar className="size-3" /> {data.year}
										</li>
									) : null}
									{data.runtime ? (
										<li className="inline-flex items-center gap-1">
											<Clock className="size-3" /> {formatRuntime(data.runtime)}
										</li>
									) : null}
									{directors.length ? (
										<li className="inline-flex items-center gap-1">
											Directed by {directors.map((d) => d.name).join(", ")}
										</li>
									) : null}
									{j?.genres?.slice(0, 3).map((g) => (
										<li
											key={g.id}
											className="rounded-md border border-border px-1.5 py-0.5"
										>
											{g.name}
										</li>
									))}
								</ul>
								{data.community?.averageRating ? (
									<div className="flex items-center justify-center gap-3">
										<StarRating
											value={Math.round(data.community.averageRating)}
											readOnly
											variant="marquee"
										/>
										<span className="text-muted-foreground text-xs">
											{data.community.reviewsCount} reviews on Still
										</span>
									</div>
								) : null}
							</div>
						</div>
					</div>
				</section>

				{/* Track B.5.3 — single log/watchlist/like strip that stays above the bottom nav while scrolling. */}
				<div className="sticky bottom-[10px] z-40 -mx-3 border-border/80 border-y bg-background/90 px-3 py-3 backdrop-blur-md sm:-mx-4 md:-mx-5">
					<div className="mx-auto flex max-w-3xl justify-center">
						<MovieActions movieId={data.tmdbId} title={data.title} />
					</div>
				</div>

				<div className="mx-auto max-w-7xl space-y-12 px-3 py-12 sm:px-4 md:px-5">
					{data.overview ? (
						<Section title="Synopsis">
							<p className="max-w-3xl font-editorial text-foreground/85 text-lg">
								{data.overview}
							</p>
						</Section>
					) : null}

					{topCast.length || crewRows.length ? (
						<Section
							title="Cast & crew"
							subtitle="Headliners and key creative credits from TMDb."
						>
							{topCast.length ? (
								<div className="mb-8">
									<h3 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
										Cast
									</h3>
									<ul className="flex gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
										{topCast.map((c) => (
											<li
												key={`${c.id}-${c.character ?? ""}`}
												className="w-24 shrink-0 text-center"
											>
												<Link
													href={`/people/${c.id}`}
													aria-label={`${c.name}${c.character ? ` as ${c.character}` : ""}`}
													className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
												>
													<div className="relative aspect-square overflow-hidden rounded-md border border-border bg-card transition-[transform,border-color] duration-[var(--aker-duration)] ease-[var(--aker-ease)] group-hover:-translate-y-0.5 group-hover:border-desert-orange/40">
														{c.profile_path ? (
															<Image
																src={`https://image.tmdb.org/t/p/w185${c.profile_path}`}
																alt=""
																width={185}
																height={185}
																className="size-full object-cover"
																sizes="96px"
															/>
														) : (
															<div className="size-full bg-muted" />
														)}
													</div>
													<p className="mt-1.5 line-clamp-1 text-xs group-hover:underline group-hover:underline-offset-2">
														{c.name}
													</p>
													<p className="line-clamp-1 text-[10px] text-muted-foreground">
														{c.character}
													</p>
												</Link>
											</li>
										))}
									</ul>
								</div>
							) : null}
							{crewRows.length ? (
								<div>
									<h3 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
										Crew
									</h3>
									<MovieCrewTable rows={crewRows} />
								</div>
							) : null}
						</Section>
					) : null}

					{recognitionPresent ? (
						<Section
							title="Premieres & festivals"
							subtitle="Premiere windows from TMDb plus festival and award-flavored keywords."
						>
							{premiereRows.length ? (
								<div className="mb-6">
									<h3 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
										Premieres & limited runs
									</h3>
									<ul className="space-y-1.5 text-sm">
										{premiereRows.slice(0, 12).map((r) => (
											<li
												key={`${r.region}-${r.date}-${r.kind}`}
												className="flex flex-wrap gap-x-2 gap-y-0.5"
											>
												<span className="font-medium tabular-nums">
													{r.date}
												</span>
												<span className="text-muted-foreground">
													{r.region}
												</span>
												<span className="text-muted-foreground text-xs">
													({r.kind}
													{r.note ? ` · ${r.note}` : ""})
												</span>
											</li>
										))}
									</ul>
								</div>
							) : null}
							{festivalKeywords.length ? (
								<div>
									<h3 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
										Awards & festival tags
									</h3>
									<ul className="flex flex-wrap gap-2">
										{festivalKeywords.map((name) => (
											<li
												key={name}
												className="rounded-full border border-border bg-card/70 px-3 py-1 text-foreground text-xs"
											>
												{name}
											</li>
										))}
									</ul>
								</div>
							) : null}
						</Section>
					) : null}

					{providersUs.length ? (
						<Section title="Where to watch">
							<p className="mb-2 text-muted-foreground text-xs">
								Streaming in the US
							</p>
							<ul className="flex flex-wrap gap-3">
								{providersUs.map((p) => (
									<li
										key={p.provider_name}
										className="inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-2.5 py-2 text-xs"
									>
										<Image
											src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
											alt=""
											width={92}
											height={92}
											className="size-5 rounded-sm object-cover"
										/>
										{p.provider_name}
									</li>
								))}
							</ul>
						</Section>
					) : null}

					<Section
						title="Reception"
						subtitle="Global TMDb score beside averages from Still members."
					>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="rounded-2xl border border-border bg-card/50 p-5">
								<div className="flex items-center gap-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
									<Star className="size-3.5" aria-hidden />
									TMDb audience
								</div>
								{tmdbAvg != null && tmdbVotes > 0 ? (
									<>
										<p className="mt-3 font-serif text-3xl tabular-nums">
											{tmdbAvg.toFixed(1)}
											<span className="text-lg text-muted-foreground">/10</span>
										</p>
										<p className="mt-1 text-muted-foreground text-xs">
											{tmdbVotes.toLocaleString()} logged votes on The Movie
											Database
										</p>
									</>
								) : (
									<p className="mt-3 text-muted-foreground text-sm">
										No aggregate score yet.
									</p>
								)}
							</div>
							<div className="rounded-2xl border border-border bg-card/50 p-5">
								<div className="flex items-center gap-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
									<Users className="size-3.5" aria-hidden />
									Still members
								</div>
								{data.community.averageRating != null &&
								data.community.reviewsCount > 0 ? (
									<>
										<div className="mt-3 flex items-center gap-2">
											<StarRating
												value={Math.round(data.community.averageRating)}
												readOnly
												variant="marquee"
											/>
											<span className="font-serif text-3xl tabular-nums">
												{data.community.averageRating.toFixed(1)}
											</span>
										</div>
										<p className="mt-1 text-muted-foreground text-xs">
											Averaged from {data.community.reviewsCount} published
											reviews
										</p>
									</>
								) : (
									<p className="mt-3 text-muted-foreground text-sm">
										Be the first to rate this film on Still.
									</p>
								)}
							</div>
						</div>
					</Section>

					<MovieDetailExploreTabs
						lists={movieLists}
						featuredReviews={featuredReviews}
						reviewsAfterFeatured={reviewsAfterFeatured}
						reviews={reviews}
						moreLikeThis={moreLikeThis}
						doubleFeaturePick={doubleFeaturePick}
						currentTitle={data.title}
					/>

					<Section kicker="Ticket desk" title="Save this screening">
						<div className="grid gap-6 lg:grid-cols-2">
							<EndCreditsChecklist movieId={data.tmdbId} />
							<MovieShareStub movieId={data.tmdbId} title={data.title} />
						</div>
					</Section>

					{crewCrawlLines.length ? (
						<Section
							kicker="Projection booth"
							title="Closing credits crawl"
							subtitle="Slow scroll sourced from published crew metadata — linger with hover or focus to pause."
						>
							{/* Client-only crawl keeps SSR light; marquee duration scales with grouped roles so long films don’t feel rushed. */}
							<CreditsCrawl
								lines={crewCrawlLines}
								durationSec={Math.min(
									420,
									Math.max(160, crewCrawlLines.length * 22),
								)}
							/>
						</Section>
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
			</article>
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

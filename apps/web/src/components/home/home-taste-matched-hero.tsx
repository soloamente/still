"use client";

import { env } from "@still/env/web";
import { TooltipProvider } from "@still/ui/components/tooltip";
import IconPatronScoreLeafLeft from "@still/ui/icons/patron-score-leaf-left";
import IconPatronScoreLeafRight from "@still/ui/icons/patron-score-leaf-right";
import IconTrashXmarkFill from "@still/ui/icons/trash-xmark-fill";
import { cn } from "@still/ui/lib/utils";
import { Plus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { HomeTasteHeroMediaLayer } from "@/components/home/home-taste-hero-media-layer";
import { HomeTasteMatchedHeroSkeleton } from "@/components/home/home-taste-matched-hero-skeleton";
import { useQuickLog } from "@/components/log/quick-log-sheet";
import { DetailIconTooltip } from "@/components/movie/detail-icon-tooltip";
import { FestivalRecognitionIcon } from "@/components/movie/festival-recognition-icon";
import { MoviePoster } from "@/components/movie/movie-poster";
import { api } from "@/lib/api";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
	useDetailActionMotion,
} from "@/lib/detail-action-motion";
import {
	HOME_TASTE_HERO_BAND_CLASSNAME,
	HOME_TASTE_HERO_BAND_CONTENT_2K_NUDGE_CLASSNAME,
	HOME_TASTE_HERO_BAND_CONTENT_ALIGN_CLASSNAME,
	HOME_TASTE_HERO_BAND_CONTENT_INSET_CLASSNAME,
	HOME_TASTE_HERO_BOTTOM_GAP_CLASSNAME,
	HOME_TASTE_HERO_POSTER_RAIL_CLIP_CLASSNAME,
	HOME_TASTE_HERO_POSTER_RAIL_EDGE_FADE_WIDTH_PX,
	HOME_TASTE_HERO_POSTER_RAIL_MOBILE_BLEED_CLASSNAME,
	HOME_TASTE_HERO_POSTER_RAIL_SCROLL_CLASSNAME,
	HOME_TASTE_HERO_POSTER_TILE_ACTIVE_CLASSNAME,
	HOME_TASTE_HERO_POSTER_TILE_IDLE_CLASSNAME,
	HOME_TASTE_HERO_SECTION_2K_RESERVE_CLASSNAME,
} from "@/lib/home-taste-hero-layout";
import { buildTasteHeroTrailerBackgroundSrc } from "@/lib/home-taste-hero-trailer-src";
import {
	clampLogRatingDisplay,
	formatLogRatingDisplay,
} from "@/lib/log-rating";
import type { FestivalIconId } from "@/lib/movie-festival-recognition";
import {
	fetchMovieTitleLogoPath,
	fetchMovieTrailer,
	fetchMyLogsForMovie,
	postWatchlistAdd,
} from "@/lib/still-api-fetch";
import {
	reconcileTasteMatchMovies,
	TASTE_MATCH_MIN_RESULTS,
	type TasteMatchedDiscoveryPayload,
	type TasteMatchMovie,
	tasteMatchedRailTitle,
} from "@/lib/taste-matched-discovery";
import {
	TASTE_TITLE_CONSUMED_EVENT,
	type TasteTitleConsumedDetail,
} from "@/lib/taste-title-consumed-events";
import { tmdbBackdropUrlFromPath } from "@/lib/tmdb-backdrop-url";
import { tmdbLogoUrlFromPath } from "@/lib/tmdb-logo-url";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import {
	HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
	useHorizontalRailPosterEdgeOpacity,
} from "@/lib/use-horizontal-scroll-fades";

function moviesFromTastePayload(
	data: TasteMatchedDiscoveryPayload,
): TasteMatchMovie[] {
	if (data.coldStart) return [];
	return reconcileTasteMatchMovies(data.movies, data.consumedTmdbIds);
}

function tasteHeroIsEmpty(movies: TasteMatchMovie[]): boolean {
	return movies.length < TASTE_MATCH_MIN_RESULTS;
}

function formatHeroRatingsCountValue(count: number): string {
	return count.toLocaleString();
}

function formatHeroRatingsCountLabel(count: number): string {
	return count === 1 ? "Rating" : "Ratings";
}

export function HomeTasteMatchedHero({
	initial,
}: {
	initial?: TasteMatchedDiscoveryPayload | null;
}) {
	const reduceMotion = useReducedMotion();
	const motionProps = useDetailActionMotion();
	const openQuickLog = useQuickLog((s) => s.open);
	const [payload, setPayload] = useState<TasteMatchedDiscoveryPayload | null>(
		initial ?? null,
	);
	const [movies, setMovies] = useState<TasteMatchMovie[]>(() =>
		initial && !initial.coldStart ? moviesFromTastePayload(initial) : [],
	);
	const [genrePhrase, setGenrePhrase] = useState<string | null>(
		initial && !initial.coldStart ? (initial.genrePhrase ?? null) : null,
	);
	const [loading, setLoading] = useState(initial === undefined);
	const [activeIndex, setActiveIndex] = useState(0);
	const [watchlistBusy, setWatchlistBusy] = useState(false);
	const [priorLogCount, setPriorLogCount] = useState(0);
	const [spotlightLogoPath, setSpotlightLogoPath] = useState<string | null>(
		null,
	);
	const [resolvedTrailer, setResolvedTrailer] = useState<{
		trailerKey: string;
		trailerSite: string;
	} | null>(null);
	const posterRailRef = useRef<HTMLDivElement>(null);
	const posterRailContentKey = movies.map((film) => film.tmdbId).join(",");
	// Posters lose opacity at clipped edges — long left runway before wrapper clip.
	useHorizontalRailPosterEdgeOpacity(
		posterRailRef,
		movies.length > 1,
		posterRailContentKey,
		{
			fadeWidthPx: HOME_TASTE_HERO_POSTER_RAIL_EDGE_FADE_WIDTH_PX,
			minOpacity: 0,
		},
	);

	const safeActiveIndex = Math.min(activeIndex, Math.max(movies.length - 1, 0));
	const spotlight = movies[safeActiveIndex] ?? null;

	useEffect(() => {
		if (initial === undefined) return;
		setPayload(initial);
		setMovies(
			initial && !initial.coldStart ? moviesFromTastePayload(initial) : [],
		);
		setGenrePhrase(
			initial && !initial.coldStart ? (initial.genrePhrase ?? null) : null,
		);
		setLoading(false);
		setActiveIndex(0);
	}, [initial]);

	useEffect(() => {
		if (initial !== undefined) return;
		let cancelled = false;
		async function load() {
			try {
				const res = await api.api.taste["for-you"].get();
				if (cancelled) return;
				if (res.error || !res.data) {
					setPayload(null);
					setMovies([]);
					return;
				}
				const data = res.data as TasteMatchedDiscoveryPayload;
				setPayload(data);
				setMovies(moviesFromTastePayload(data));
				setGenrePhrase(data.coldStart ? null : (data.genrePhrase ?? null));
			} catch {
				if (!cancelled) {
					setPayload(null);
					setMovies([]);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		void load();
		return () => {
			cancelled = true;
		};
	}, [initial]);

	useEffect(() => {
		const rail = posterRailRef.current;
		if (!rail) return;
		const activePoster = rail.querySelector<HTMLElement>(
			`[data-taste-poster-index="${safeActiveIndex}"]`,
		);
		activePoster?.scrollIntoView({
			behavior: reduceMotion ? "auto" : "smooth",
			inline: "nearest",
			block: "nearest",
		});
	}, [reduceMotion, safeActiveIndex]);

	useEffect(() => {
		if (!spotlight) {
			setSpotlightLogoPath(null);
			return;
		}
		if (spotlight.logoPath) {
			setSpotlightLogoPath(spotlight.logoPath);
		} else {
			setSpotlightLogoPath(null);
		}
		let cancelled = false;
		void fetchMovieTitleLogoPath(spotlight.tmdbId).then((logoPath) => {
			if (cancelled || !logoPath) return;
			setSpotlightLogoPath(logoPath);
			setMovies((prev) =>
				prev.map((film) =>
					film.tmdbId === spotlight.tmdbId ? { ...film, logoPath } : film,
				),
			);
		});
		return () => {
			cancelled = true;
		};
	}, [spotlight]);

	useEffect(() => {
		if (!spotlight) {
			setResolvedTrailer(null);
			return;
		}
		if (spotlight.trailerKey) {
			setResolvedTrailer({
				trailerKey: spotlight.trailerKey,
				trailerSite: spotlight.trailerSite ?? "YouTube",
			});
		} else {
			setResolvedTrailer(null);
		}
		let cancelled = false;
		void fetchMovieTrailer(spotlight.tmdbId).then((row) => {
			if (cancelled || !row?.trailerKey) return;
			setResolvedTrailer(row);
			setMovies((prev) =>
				prev.map((film) =>
					film.tmdbId === spotlight.tmdbId
						? {
								...film,
								trailerKey: row.trailerKey,
								trailerSite: row.trailerSite,
							}
						: film,
				),
			);
		});
		return () => {
			cancelled = true;
		};
	}, [spotlight]);

	useEffect(() => {
		if (!spotlight) {
			setPriorLogCount(0);
			return;
		}
		let cancelled = false;
		void fetchMyLogsForMovie(spotlight.tmdbId)
			.then((res) => {
				if (cancelled) return;
				const rows = Array.isArray(res.data) ? res.data : [];
				setPriorLogCount(rows.length);
			})
			.catch(() => {
				if (!cancelled) setPriorLogCount(0);
			});
		return () => {
			cancelled = true;
		};
	}, [spotlight]);

	const handleNotInterested = useCallback(
		async (tmdbId: number) => {
			const snapshot = movies;
			const index = snapshot.findIndex((film) => film.tmdbId === tmdbId);
			if (index < 0) return;
			setMovies((prev) => prev.filter((film) => film.tmdbId !== tmdbId));
			if (index <= activeIndex && activeIndex > 0) {
				setActiveIndex((prev) => Math.max(0, prev - 1));
			}
			try {
				const res = await api.api.taste.dismiss.post({
					movieTmdbId: tmdbId,
					excludeTmdbIds: snapshot.map((film) => film.tmdbId),
				});
				if (res.error || !res.data) throw new Error("dismiss failed");
				const replacement = res.data.replacement as TasteMatchMovie | null;
				if (!replacement) return;
				setMovies((prev) => {
					if (prev.some((film) => film.tmdbId === replacement.tmdbId)) {
						return prev;
					}
					const next = [...prev];
					next.splice(Math.min(index, next.length), 0, replacement);
					return next;
				});
			} catch {
				setMovies(snapshot);
				toast.error("Couldn't update suggestions");
			}
		},
		[activeIndex, movies],
	);

	const handleTitleConsumed = useCallback(
		async (tmdbId: number) => {
			const snapshot = movies;
			const index = snapshot.findIndex((film) => film.tmdbId === tmdbId);
			if (index < 0) return;
			const remainingCount = snapshot.length - 1;
			setMovies((prev) => prev.filter((film) => film.tmdbId !== tmdbId));
			if (index < activeIndex) {
				setActiveIndex((prev) => Math.max(0, prev - 1));
			} else if (index === activeIndex) {
				setActiveIndex((prev) =>
					Math.min(prev, Math.max(0, remainingCount - 1)),
				);
			}
			if (remainingCount >= TASTE_MATCH_MIN_RESULTS) return;
			try {
				const res = await api.api.taste["for-you"].get();
				if (res.error || !res.data || res.data.coldStart) return;
				const onScreenIds = new Set(
					snapshot.map((film) => film.tmdbId).filter((id) => id !== tmdbId),
				);
				const candidates = reconcileTasteMatchMovies(
					res.data.movies,
					res.data.consumedTmdbIds,
				);
				const replacement = candidates.find(
					(film) => !onScreenIds.has(film.tmdbId),
				);
				if (!replacement) return;
				setMovies((prev) => {
					if (prev.some((film) => film.tmdbId === replacement.tmdbId)) {
						return prev;
					}
					return [...prev, replacement];
				});
			} catch {
				// silent
			}
		},
		[activeIndex, movies],
	);

	const handleAddToWatchlist = useCallback(async () => {
		if (!spotlight || watchlistBusy) return;
		setWatchlistBusy(true);
		try {
			const result = await postWatchlistAdd({ movieId: spotlight.tmdbId });
			if (!result.ok) throw new Error("watchlist failed");
			void handleTitleConsumed(spotlight.tmdbId);
		} catch {
			toast.error("Couldn't update watchlist");
		} finally {
			setWatchlistBusy(false);
		}
	}, [handleTitleConsumed, spotlight, watchlistBusy]);

	const handleOpenQuickLog = useCallback(() => {
		if (!spotlight) return;
		openQuickLog({
			movieId: spotlight.tmdbId,
			movieTitle: spotlight.title,
			posterUrl:
				tmdbPosterUrlFromPath(spotlight.posterPath, "w342") ?? undefined,
			averageRating: spotlight.communityAverage ?? undefined,
			priorLogCount,
			rewatch: priorLogCount > 0,
			onSuccess: () => {
				void handleTitleConsumed(spotlight.tmdbId);
			},
		});
	}, [handleTitleConsumed, openQuickLog, priorLogCount, spotlight]);

	const quickLogLabel = priorLogCount > 0 ? "Rewatch" : "Add to Watched";

	useEffect(() => {
		const onConsumed = (event: Event) => {
			const detail = (event as CustomEvent<TasteTitleConsumedDetail>).detail;
			if (detail?.tmdbId != null) void handleTitleConsumed(detail.tmdbId);
		};
		window.addEventListener(TASTE_TITLE_CONSUMED_EVENT, onConsumed);
		return () =>
			window.removeEventListener(TASTE_TITLE_CONSUMED_EVENT, onConsumed);
	}, [handleTitleConsumed]);

	if (loading) return <HomeTasteMatchedHeroSkeleton />;
	if (!payload || payload.coldStart || tasteHeroIsEmpty(movies) || !spotlight) {
		return null;
	}

	const backdropUrl =
		tmdbBackdropUrlFromPath(spotlight.backdropPath ?? null, "w1280") ??
		tmdbPosterUrlFromPath(spotlight.posterPath, "w780");
	const trailerKey =
		spotlight.trailerKey ?? resolvedTrailer?.trailerKey ?? null;
	const trailerSite =
		spotlight.trailerSite ?? resolvedTrailer?.trailerSite ?? null;
	// Stable SSR + client origin — avoids hydration mismatch on iframe `src`.
	const trailerSrc =
		trailerKey && !reduceMotion
			? buildTasteHeroTrailerBackgroundSrc(
					trailerSite,
					trailerKey,
					env.NEXT_PUBLIC_SERVER_URL,
				)
			: null;
	const titleLogoUrl = tmdbLogoUrlFromPath(
		spotlightLogoPath ?? spotlight.logoPath ?? null,
		"w500",
	);
	const hasAverage =
		spotlight.communityAverage != null &&
		(spotlight.communityRatingsCount ?? 0) > 0 &&
		Number.isFinite(spotlight.communityAverage);
	const displayAverage = hasAverage
		? clampLogRatingDisplay(spotlight.communityAverage ?? 0)
		: null;
	const festivalIcon = spotlight.festivalIcon as
		| FestivalIconId
		| null
		| undefined;

	return (
		<section
			aria-label="Films matched to your taste"
			className={cn(
				"relative isolate w-full min-w-0",
				HOME_TASTE_HERO_SECTION_2K_RESERVE_CLASSNAME,
				HOME_TASTE_HERO_BOTTOM_GAP_CLASSNAME,
			)}
		>
			<HomeTasteHeroMediaLayer
				tmdbId={spotlight.tmdbId}
				backdropUrl={backdropUrl}
				trailerSrc={trailerSrc}
			/>
			<div className="relative z-10 overflow-visible rounded-[2rem] bg-transparent">
				<div
					className={cn(
						"relative z-10 flex min-h-0 flex-col overflow-visible",
						HOME_TASTE_HERO_BAND_CLASSNAME,
						HOME_TASTE_HERO_BAND_CONTENT_ALIGN_CLASSNAME,
					)}
				>
					<div
						className={cn(
							"relative z-20 mt-auto flex min-h-0 w-full flex-col gap-2 overflow-visible px-3 pb-1 sm:mt-0",
							HOME_TASTE_HERO_BAND_CONTENT_INSET_CLASSNAME,
							HOME_TASTE_HERO_BAND_CONTENT_2K_NUDGE_CLASSNAME,
							"sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:px-6",
						)}
					>
						<div className="mx-auto min-w-0 max-w-[min(100%,34rem)] space-y-2 text-center sm:mx-0 sm:space-y-3 sm:text-left">
							<p className="inline-flex items-center gap-1.5 text-balance text-[0.6875rem] text-foreground/75 tracking-wide sm:text-sm">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 18 18"
									width="18"
									height="18"
									className="size-4 shrink-0 sm:size-5"
									aria-hidden
								>
									<title>Taste match</title>
									<path
										d="m16.6094,7.5176c-.001,0-.001-.0005-.001-.0005-.8115-1.4336-3.1787-4.7671-7.6084-4.7671S2.2031,6.0835,1.3906,7.5176c-.5244.9282-.5244,2.0366.001,2.9653.8125,1.4336,3.1797,4.7671,7.6084,4.7671s6.7959-3.3335,7.6094-4.7676c.5244-.9282.5244-2.0366,0-2.9648Z"
										fill="rgba(255, 255, 255, 0.4)"
									/>
									<path
										d="m11.9805,8.2861l-1.7139-.5527-.5527-1.7139c-.0996-.3096-.3887-.5195-.7139-.5195s-.6143.21-.7139.5195l-.5527,1.7139-1.7139.5527c-.3096.1001-.5195.3882-.5195.7139s.21.6138.5195.7139l1.7139.5527.5527,1.7139c.0996.3096.3887.5195.7139.5195s.6143-.21.7139-.5195l.5527-1.7139,1.7139-.5527c.3096-.1001.5195-.3882.5195-.7139s-.21-.6138-.5195-.7139Z"
										fill="rgba(255, 255, 255, 1)"
									/>
								</svg>
								{tasteMatchedRailTitle(genrePhrase)}
							</p>
							<Link
								href={`/movies/${spotlight.tmdbId}`}
								className="group mx-auto block min-w-0 sm:mx-0"
							>
								{titleLogoUrl ? (
									<div className="relative mx-auto h-[clamp(2.25rem,5.5vw,5.75rem)] w-full max-w-[min(100%,14rem)] sm:mx-0 sm:max-w-[min(100%,32rem)]">
										{/* biome-ignore lint/performance/noImgElement: TMDb wordmark — native img avoids Next optimizer edge cases on remote logos. */}
										<img
											src={titleLogoUrl}
											alt=""
											className="mx-auto size-full max-h-full max-w-full object-contain object-center drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)] sm:mx-0 sm:object-left"
										/>
										<span className="sr-only">{spotlight.title}</span>
									</div>
								) : (
									<h2 className="text-balance font-sans font-semibold text-[clamp(1.375rem,4.5vw,3.25rem)] text-foreground uppercase leading-[0.95] tracking-[-0.03em] [text-shadow:-1px_0_0_color-mix(in_oklab,var(--foreground)_0%,#ff4d4d_28%),1px_0_0_color-mix(in_oklab,var(--foreground)_0%,#4da3ff_28%)] sm:text-[clamp(1.75rem,5.5vw,3.25rem)]">
										{spotlight.title}
									</h2>
								)}
							</Link>
							<div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 sm:justify-start sm:gap-x-4 sm:gap-y-2">
								{hasAverage && displayAverage != null ? (
									<div className="flex items-center gap-0.5 sm:gap-1">
										<IconPatronScoreLeafLeft className="h-10 w-auto shrink-0 text-foreground/60 sm:h-11" />
										<div className="flex min-w-10 flex-col items-center gap-px text-center leading-none sm:min-w-11">
											<span className="sr-only">
												Community score {formatLogRatingDisplay(displayAverage)}{" "}
												out of 10,{" "}
												{formatHeroRatingsCountValue(
													spotlight.communityRatingsCount ?? 0,
												)}{" "}
												{formatHeroRatingsCountLabel(
													spotlight.communityRatingsCount ?? 0,
												).toLowerCase()}
											</span>
											<span className="font-sans font-semibold text-base text-foreground tabular-nums leading-none tracking-tight sm:text-lg">
												{formatLogRatingDisplay(displayAverage)}
											</span>
											<span className="font-sans text-[0.625rem] text-foreground/80 tabular-nums leading-none sm:text-xs">
												{formatHeroRatingsCountValue(
													spotlight.communityRatingsCount ?? 0,
												)}
											</span>
											<span className="font-sans text-[0.5625rem] text-foreground/55 leading-none sm:text-[0.625rem]">
												{formatHeroRatingsCountLabel(
													spotlight.communityRatingsCount ?? 0,
												)}
											</span>
										</div>
										<IconPatronScoreLeafRight className="h-10 w-auto shrink-0 text-foreground/60 sm:h-11" />
									</div>
								) : null}
								{festivalIcon ? (
									<div className="flex items-center gap-1.5 text-foreground/80 sm:gap-2">
										<FestivalRecognitionIcon
											icon={festivalIcon}
											className="h-7 w-16 sm:h-10 sm:w-24"
										/>
										<span className="text-xs sm:text-sm">
											Official selection
										</span>
									</div>
								) : null}
							</div>
							<TooltipProvider delay={0} closeDelay={80}>
								<div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5 sm:justify-start sm:gap-2 sm:pt-1">
									<DetailIconTooltip label={quickLogLabel}>
										<motion.button
											type="button"
											className={cn(
												"inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-foreground sm:size-12",
												DETAIL_MOTION_PRESSABLE_CLASS,
												"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
											)}
											style={motionProps.style}
											whileHover={motionProps.hover}
											whileTap={motionProps.tap}
											transition={motionProps.buttonTransition}
											aria-label={quickLogLabel}
											onClick={handleOpenQuickLog}
										>
											<Plus
												className="size-4 shrink-0 stroke-[2.25] sm:size-5"
												aria-hidden
											/>
										</motion.button>
									</DetailIconTooltip>
									<div className="flex items-center gap-1.5 sm:gap-2">
										<button
											type="button"
											className={cn(
												"inline-flex min-h-10 items-center justify-center rounded-full bg-foreground px-4 font-medium text-background text-xs transition-[transform,background-color,color] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none sm:min-h-11 sm:px-5 sm:text-sm",
												"disabled:pointer-events-none disabled:opacity-50",
											)}
											disabled={watchlistBusy}
											onClick={() => void handleAddToWatchlist()}
										>
											Add to watchlist
										</button>
										<DetailIconTooltip label="Not interested">
											<button
												type="button"
												className={cn(
													"inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-background/55 text-foreground backdrop-blur-sm transition-[transform,background-color] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none sm:hidden",
													DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
													"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
												)}
												aria-label="Not interested"
												onClick={() =>
													void handleNotInterested(spotlight.tmdbId)
												}
											>
												<IconTrashXmarkFill
													className="size-4 shrink-0 sm:size-5"
													aria-hidden
												/>
											</button>
										</DetailIconTooltip>
										<button
											type="button"
											className={cn(
												"hidden min-h-11 items-center justify-center rounded-full bg-background/55 px-5 font-medium text-foreground text-sm backdrop-blur-sm transition-[transform,background-color] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none sm:inline-flex",
												DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
											)}
											onClick={() => void handleNotInterested(spotlight.tmdbId)}
										>
											Not interested
										</button>
									</div>
								</div>
							</TooltipProvider>
						</div>

						{movies.length > 0 ? (
							<div
								className={cn(
									HOME_TASTE_HERO_POSTER_RAIL_CLIP_CLASSNAME,
									HOME_TASTE_HERO_POSTER_RAIL_MOBILE_BLEED_CLASSNAME,
								)}
							>
								<div
									ref={posterRailRef}
									data-lenis-prevent-wheel
									className={cn(
										HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
										HOME_TASTE_HERO_POSTER_RAIL_SCROLL_CLASSNAME,
									)}
									role="listbox"
									aria-label="Browse taste-matched films"
								>
									{movies.map((film, index) => {
										const isActive = index === safeActiveIndex;
										return (
											<button
												key={film.tmdbId}
												type="button"
												data-taste-poster-index={index}
												role="option"
												aria-selected={isActive}
												aria-label={`Show ${film.title}`}
												className={cn(
													"shrink-0 rounded-xl bg-background transition-[transform,opacity] duration-200 ease-out [--edge-opacity:1] motion-reduce:transition-none sm:rounded-2xl",
													isActive
														? cn(
																HOME_TASTE_HERO_POSTER_TILE_ACTIVE_CLASSNAME,
																"scale-[1.03] opacity-(--edge-opacity) ring-2 ring-foreground/85",
															)
														: cn(
																HOME_TASTE_HERO_POSTER_TILE_IDLE_CLASSNAME,
																"opacity-[calc(0.8*var(--edge-opacity))] [@media(hover:hover)]:opacity-(--edge-opacity) [@media(hover:hover)]:hover:scale-[1.02]",
															),
												)}
												onClick={() => setActiveIndex(index)}
											>
												<MoviePoster
													movieId={film.tmdbId}
													title={film.title}
													posterUrl={tmdbPosterUrlFromPath(
														film.posterPath,
														"w342",
													)}
													className="aspect-2/3 w-full overflow-hidden rounded-xl sm:rounded-2xl"
													frameClassName="rounded-xl border-0 sm:rounded-2xl"
													linkable={false}
												/>
											</button>
										);
									})}
								</div>
							</div>
						) : null}
					</div>
				</div>
			</div>
		</section>
	);
}

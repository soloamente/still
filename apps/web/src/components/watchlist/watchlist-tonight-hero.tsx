"use client";

import { env } from "@still/env/web";
import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { HomeTasteHeroMediaLayer } from "@/components/home/home-taste-hero-media-layer";
import { useQuickLog } from "@/components/log/quick-log-sheet";
import {
	WatchlistRegionAction,
	watchlistRegionGuidanceCopy,
	watchlistRegionNeedsGuidance,
} from "@/components/watchlist/watchlist-region-action";
import { authClient } from "@/lib/auth-client";
import { formatDayKey, pickDailySpotlight } from "@/lib/daily-pick";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
	useDetailActionMotion,
} from "@/lib/detail-action-motion";
import { readViewerTimeZone } from "@/lib/home-leaderboard-period";
import {
	HOME_TASTE_HERO_BAND_CLASSNAME,
	HOME_TASTE_HERO_BAND_CONTENT_2K_NUDGE_CLASSNAME,
	HOME_TASTE_HERO_BAND_CONTENT_ALIGN_CLASSNAME,
	HOME_TASTE_HERO_BAND_CONTENT_INSET_CLASSNAME,
	HOME_TASTE_HERO_BAND_CONTENT_MOBILE_DROP_CLASSNAME,
	HOME_TASTE_HERO_BAND_CONTENT_MOBILE_NUDGE_CLASSNAME,
	HOME_TASTE_HERO_BOTTOM_GAP_CLASSNAME,
	HOME_TASTE_HERO_SECTION_2K_RESERVE_CLASSNAME,
} from "@/lib/home-taste-hero-layout";
import { buildTasteHeroTrailerBackgroundSrc } from "@/lib/home-taste-hero-trailer-src";
import { runTextStateSwap } from "@/lib/run-text-state-swap";
import { trackSenseProductEvent } from "@/lib/sense-product-analytics";
import {
	fetchMovieTitleLogoPath,
	fetchMovieTrailer,
} from "@/lib/still-api-fetch";
import { tmdbLogoUrlFromPath } from "@/lib/tmdb-logo-url";
import { useTrackImpressionOnce } from "@/lib/use-track-impression-once";
import {
	readWatchTonightDayPin,
	writeWatchTonightDayPin,
} from "@/lib/watch-tonight-day-pin";
import {
	listingDetailHref,
	type WatchlistTonightHeroPayload,
	type WatchlistTonightHeroPick,
} from "@/lib/watchlist-tonight-hero-types";

type WatchlistHeroAction =
	| "pick_another"
	| "open_detail"
	| "quick_log"
	| "retry";

/** Stored skips plus taps that landed before `useSession` had a real user id. */
function mergeWatchTonightSkippedIds(
	stored: number[],
	pending: number[],
): number[] {
	const seen = new Set(stored);
	const merged = [...stored];
	for (const id of pending) {
		if (!seen.has(id)) {
			seen.add(id);
			merged.push(id);
		}
	}
	return merged;
}

function trackWatchlistHeroAction(
	action: WatchlistHeroAction,
	pick: WatchlistTonightHeroPick | null,
): void {
	trackSenseProductEvent("watchlist.hero_action", {
		action,
		listingKind: pick?.listingKind ?? null,
		tmdbId: pick?.tmdbId ?? null,
		reasonKind: pick?.tonightReasonKind ?? null,
	});
}

function WatchlistTonightHeroEmpty({
	failed,
	onRetry,
}: {
	failed: boolean;
	onRetry: () => void;
}) {
	return (
		<section
			aria-label="Watch tonight"
			className="mb-2 w-full min-w-0 rounded-[2rem] bg-background px-6 py-10 text-center sm:px-10"
		>
			{failed ? (
				<>
					<p className="font-semibold text-foreground text-lg tracking-tight">
						Couldn&apos;t load tonight&apos;s pick
					</p>
					<p className="mt-2 text-muted-foreground text-sm">
						Something went wrong on our side.
					</p>
					<button
						type="button"
						className={cn(
							buttonVariants({ variant: "secondary", size: "pill" }),
							"mt-5",
						)}
						onClick={onRetry}
					>
						Try again
					</button>
				</>
			) : (
				<>
					<p className="font-semibold text-foreground text-lg tracking-tight">
						Nothing lined up yet
					</p>
					<p className="mt-2 max-w-prose text-pretty text-muted-foreground text-sm leading-relaxed">
						Save a few titles and we&apos;ll line up tonight&apos;s pick here.
					</p>
					<Link
						href="/home"
						className={cn(
							buttonVariants({ variant: "secondary", size: "pill" }),
							"mt-5 inline-flex",
						)}
					>
						Browse films
					</Link>
				</>
			)}
		</section>
	);
}

/**
 * Tonight hero — ranked watchlist pick with **Pick another** over a pre-fetched pool.
 * Presentation follows the home taste hero (backdrop/trailer, logo, reason line).
 */
export function WatchlistTonightHero({
	initial,
}: {
	initial: WatchlistTonightHeroPayload;
}) {
	const router = useRouter();
	const reduceMotion = useReducedMotion();
	const motionProps = useDetailActionMotion();
	const openQuickLog = useQuickLog((s) => s.open);
	const userId = authClient.useSession().data?.user.id ?? "";
	/** Skips made before the session id hydrates — persist must merge these. */
	const pendingSkipsRef = useRef<number[]>([]);
	const [pool] = useState(initial.pool);
	const [activeIndex, setActiveIndex] = useState(() => {
		const dayKey = formatDayKey(readViewerTimeZone());
		const pin =
			typeof window === "undefined"
				? null
				: readWatchTonightDayPin(window.localStorage, dayKey);
		const heroId = pickDailySpotlight({
			rankedIds: initial.pool.map((row) => row.tmdbId),
			dayKey,
			userId,
			surface: "watchlist",
			skippedIds: pin?.skippedIds ?? [],
			pinnedId: pin?.tmdbId ?? null,
		});
		return Math.max(
			0,
			initial.pool.findIndex((row) => row.tmdbId === heroId),
		);
	});
	const [logoPath, setLogoPath] = useState<string | null>(null);
	const [trailer, setTrailer] = useState<{
		trailerKey: string;
		trailerSite: string;
	} | null>(null);

	const safeIndex = Math.min(activeIndex, Math.max(pool.length - 1, 0));
	const spotlight = pool[safeIndex] ?? null;
	const titleSwapRef = useRef<HTMLSpanElement>(null);
	const reasonSwapRef = useRef<HTMLSpanElement>(null);
	/** First paint already has the right copy — do not swap on mount. */
	const skipFirstTextSwapRef = useRef(true);
	/** useReducedMotion hydrates after mount; skip that rerun unless copy changed. */
	const prevSwapTitleRef = useRef(spotlight?.title ?? "");
	const prevSwapReasonRef = useRef(spotlight?.tonightReason ?? "");

	useEffect(() => {
		if (skipFirstTextSwapRef.current) {
			skipFirstTextSwapRef.current = false;
			return;
		}
		const nextTitle = spotlight?.title ?? "";
		const nextReason = spotlight?.tonightReason ?? "";
		if (
			prevSwapTitleRef.current === nextTitle &&
			prevSwapReasonRef.current === nextReason
		) {
			return;
		}
		prevSwapTitleRef.current = nextTitle;
		prevSwapReasonRef.current = nextReason;
		if (reduceMotion) {
			if (titleSwapRef.current) titleSwapRef.current.textContent = nextTitle;
			if (reasonSwapRef.current) reasonSwapRef.current.textContent = nextReason;
			return;
		}
		if (titleSwapRef.current) runTextStateSwap(titleSwapRef.current, nextTitle);
		if (reasonSwapRef.current) {
			runTextStateSwap(reasonSwapRef.current, nextReason);
		}
		// Title/reason come from the current spotlight; only the id should trigger a swap.
	}, [spotlight?.tmdbId, reduceMotion]);

	/** Persist the day's pick once the session id is real — an empty-id pin would stick. */
	useEffect(() => {
		if (userId === "") return;
		const dayKey = formatDayKey(readViewerTimeZone());
		const pin = readWatchTonightDayPin(window.localStorage, dayKey);
		const skippedIds = mergeWatchTonightSkippedIds(
			pin?.skippedIds ?? [],
			pendingSkipsRef.current,
		);
		const heroId = pickDailySpotlight({
			rankedIds: pool.map((row) => row.tmdbId),
			dayKey,
			userId,
			surface: "watchlist",
			skippedIds,
			pinnedId: pin?.tmdbId ?? null,
		});
		const nextIndex = Math.max(
			0,
			pool.findIndex((row) => row.tmdbId === heroId),
		);
		if (
			heroId != null &&
			(heroId !== pin?.tmdbId || pendingSkipsRef.current.length > 0)
		) {
			try {
				writeWatchTonightDayPin(window.localStorage, {
					dayKey,
					tmdbId: heroId,
					skippedIds,
				});
				const written = readWatchTonightDayPin(window.localStorage, dayKey);
				if (written) {
					pendingSkipsRef.current = pendingSkipsRef.current.filter(
						(id) => !written.skippedIds.includes(id),
					);
				}
			} catch {
				// Quota / blocked storage — the day's pick still shows this session.
			}
		}
		setActiveIndex(nextIndex);
	}, [pool, userId]);

	/** Skip the current title for the rest of the day without dropping prior skips. */
	const advancePastSpotlight = useCallback(
		(tmdbId: number) => {
			const dayKey = formatDayKey(readViewerTimeZone());
			const pin =
				typeof window === "undefined"
					? null
					: readWatchTonightDayPin(window.localStorage, dayKey);
			if (userId === "" && !pendingSkipsRef.current.includes(tmdbId)) {
				pendingSkipsRef.current = [...pendingSkipsRef.current, tmdbId];
			}
			const skippedIds = mergeWatchTonightSkippedIds(
				pin?.skippedIds.includes(tmdbId)
					? pin.skippedIds
					: [...(pin?.skippedIds ?? []), tmdbId],
				pendingSkipsRef.current,
			);
			const heroId = pickDailySpotlight({
				rankedIds: pool.map((row) => row.tmdbId),
				dayKey,
				userId,
				surface: "watchlist",
				skippedIds,
				pinnedId: null,
			});
			const nextIndex = Math.max(
				0,
				pool.findIndex((row) => row.tmdbId === heroId),
			);
			if (userId !== "") {
				try {
					writeWatchTonightDayPin(window.localStorage, {
						dayKey,
						tmdbId: heroId ?? tmdbId,
						skippedIds,
					});
					const written = readWatchTonightDayPin(window.localStorage, dayKey);
					if (written) {
						pendingSkipsRef.current = pendingSkipsRef.current.filter(
							(id) => !written.skippedIds.includes(id),
						);
					}
				} catch {
					// Quota / blocked storage — the day's pick still shows this session.
				}
			}
			setActiveIndex(nextIndex);
		},
		[pool, userId],
	);

	useEffect(() => {
		setLogoPath(null);
		setTrailer(null);
		if (!spotlight || spotlight.listingKind !== "movie") return;
		let cancelled = false;
		void (async () => {
			const [logo, trailerRow] = await Promise.all([
				fetchMovieTitleLogoPath(spotlight.tmdbId),
				fetchMovieTrailer(spotlight.tmdbId),
			]);
			if (cancelled) return;
			setLogoPath(logo);
			setTrailer(trailerRow);
		})();
		return () => {
			cancelled = true;
		};
	}, [spotlight]);

	const hasPick = spotlight != null;
	useTrackImpressionOnce(
		"watchlist.hero_viewed",
		{
			has_pick: hasPick,
			reason_kind: spotlight?.tonightReasonKind ?? null,
			pool_size: pool.length,
		},
		!initial.failed,
	);

	const handlePickAnother = useCallback(() => {
		if (pool.length <= 1 || !spotlight) return;
		trackWatchlistHeroAction("pick_another", spotlight);
		advancePastSpotlight(spotlight.tmdbId);
	}, [advancePastSpotlight, pool.length, spotlight]);

	const handleQuickLog = useCallback(() => {
		if (!spotlight) return;
		trackWatchlistHeroAction("quick_log", spotlight);
		const loggedTmdbId = spotlight.tmdbId;
		if (spotlight.listingKind === "movie") {
			openQuickLog({
				movieId: spotlight.tmdbId,
				onSuccess: () => {
					advancePastSpotlight(loggedTmdbId);
				},
			});
		} else {
			openQuickLog({
				tvId: spotlight.tmdbId,
				logScope: "show",
				onSuccess: () => {
					advancePastSpotlight(loggedTmdbId);
				},
			});
		}
	}, [advancePastSpotlight, openQuickLog, spotlight]);

	if (initial.failed) {
		return (
			<WatchlistTonightHeroEmpty
				failed
				onRetry={() => {
					trackWatchlistHeroAction("retry", null);
					router.refresh();
				}}
			/>
		);
	}

	if (!spotlight) {
		return <WatchlistTonightHeroEmpty failed={false} onRetry={() => {}} />;
	}

	const backdropUrl = spotlight.posterUrl;
	const trailerSrc =
		trailer?.trailerKey && !reduceMotion
			? buildTasteHeroTrailerBackgroundSrc(
					trailer.trailerSite,
					trailer.trailerKey,
					env.NEXT_PUBLIC_SERVER_URL,
				)
			: null;
	const titleLogoUrl = tmdbLogoUrlFromPath(logoPath, "w500");
	const showRegionNote = watchlistRegionNeedsGuidance(initial.region);

	return (
		<section
			aria-label="Watch tonight"
			className={cn(
				"relative isolate w-full min-w-0 pb-2",
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
							"relative z-20 mt-auto flex min-h-0 w-full flex-col gap-3 overflow-visible px-3 pb-1 sm:mt-0 sm:gap-2",
							HOME_TASTE_HERO_BAND_CONTENT_INSET_CLASSNAME,
							HOME_TASTE_HERO_BAND_CONTENT_MOBILE_DROP_CLASSNAME,
							HOME_TASTE_HERO_BAND_CONTENT_2K_NUDGE_CLASSNAME,
							"sm:px-6",
						)}
					>
						<div
							className={cn(
								"mx-auto flex min-w-0 max-w-[min(100%,34rem)] flex-col gap-2 text-center sm:mx-0 sm:gap-3 sm:text-left",
								HOME_TASTE_HERO_BAND_CONTENT_MOBILE_NUDGE_CLASSNAME,
							)}
						>
							<p className="font-semibold text-foreground/90 text-sm tracking-wide">
								Watch tonight
							</p>
							<Link
								href={listingDetailHref(spotlight)}
								className="group mx-auto block min-w-0 sm:mx-0"
								onClick={() =>
									trackWatchlistHeroAction("open_detail", spotlight)
								}
							>
								{titleLogoUrl ? (
									<div className="relative mx-auto h-[clamp(2.25rem,5.5vw,5.75rem)] w-full max-w-[min(100%,14rem)] sm:mx-0 sm:max-w-[min(100%,32rem)]">
										{/* biome-ignore lint/performance/noImgElement: TMDb wordmark */}
										<img
											src={titleLogoUrl}
											alt=""
											className="mx-auto size-full max-h-full max-w-full object-contain object-center drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)] sm:mx-0 sm:object-left"
										/>
										<span ref={titleSwapRef} className="t-text-swap sr-only">
											{spotlight.title}
										</span>
									</div>
								) : (
									<h2 className="text-balance font-semibold text-2xl text-foreground tracking-tight sm:text-3xl">
										<span ref={titleSwapRef} className="t-text-swap">
											{spotlight.title}
										</span>
									</h2>
								)}
							</Link>
							{spotlight.tonightReason ? (
								<p className="text-pretty text-foreground/85 text-sm sm:text-base">
									<span ref={reasonSwapRef} className="t-text-swap">
										{spotlight.tonightReason}
									</span>
								</p>
							) : null}
							{showRegionNote ? (
								<p className="text-pretty text-foreground/70 text-xs sm:text-sm">
									{watchlistRegionGuidanceCopy(initial.region ?? null)}{" "}
									<WatchlistRegionAction className="font-medium text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline">
										Choose region
									</WatchlistRegionAction>
								</p>
							) : null}
							<div className="flex flex-wrap items-center justify-center gap-2 pt-1 sm:justify-start">
								<Link
									href={listingDetailHref(spotlight)}
									className={cn(
										buttonVariants({ variant: "secondary", size: "pill" }),
										DETAIL_MOTION_PRESSABLE_CLASS,
										DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
										motionProps.className,
									)}
									style={motionProps.style}
									onClick={() =>
										trackWatchlistHeroAction("open_detail", spotlight)
									}
								>
									Open
								</Link>
								<button
									type="button"
									className={cn(
										buttonVariants({ variant: "secondary", size: "pill" }),
										DETAIL_MOTION_PRESSABLE_CLASS,
										DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
										motionProps.className,
									)}
									style={motionProps.style}
									onClick={handleQuickLog}
								>
									Quick log
								</button>
								{pool.length > 1 ? (
									<button
										type="button"
										className={cn(
											buttonVariants({ variant: "ghost", size: "pill" }),
											"border-transparent bg-background/80 text-foreground backdrop-blur-0",
											DETAIL_MOTION_PRESSABLE_CLASS,
											motionProps.className,
										)}
										style={motionProps.style}
										onClick={handlePickAnother}
									>
										Pick another
									</button>
								) : null}
								<span className="rounded-full bg-background/80 px-3 py-2 font-medium text-foreground/80 text-xs">
									Saved
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

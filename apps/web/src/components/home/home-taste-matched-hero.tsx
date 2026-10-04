"use client";

import { env } from "@still/env/web";
import { TooltipProvider } from "@still/ui/components/tooltip";
import IconPatronScoreLeafLeft from "@still/ui/icons/patron-score-leaf-left";
import IconPatronScoreLeafRight from "@still/ui/icons/patron-score-leaf-right";
import IconTrashXmarkFill from "@still/ui/icons/trash-xmark-fill";
import { cn } from "@still/ui/lib/utils";
import { Check, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import {
	useCallback,
	useEffect,
	useId,
	useReducer,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { HomeTasteHeroMediaLayer } from "@/components/home/home-taste-hero-media-layer";
import { HomeTasteMatchedHeroSkeleton } from "@/components/home/home-taste-matched-hero-skeleton";
import { TodayPickHowWasIt } from "@/components/home/today-pick-how-was-it";
import { useQuickLog } from "@/components/log/quick-log-sheet";
import { DetailIconTooltip } from "@/components/movie/detail-icon-tooltip";
import { FestivalRecognitionIcon } from "@/components/movie/festival-recognition-icon";
import { MoviePoster } from "@/components/movie/movie-poster";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { useCatalogSearchDialog } from "@/lib/catalog-search-dialog-store";
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
import { formatTodayYmd } from "@/lib/log-watched-date";
import type { FestivalIconId } from "@/lib/movie-festival-recognition";
import { runTextStateSwap } from "@/lib/run-text-state-swap";
import { trackSenseProductEvent } from "@/lib/sense-product-analytics";
import { isStillApiErrorPayload } from "@/lib/still-api-error-payload";
import {
	deleteLog,
	fetchMovieTitleLogoPath,
	fetchMovieTrailer,
	fetchMyLogsForMovie,
	fetchMyLogsForTv,
	postLog,
	postWatchlistAdd,
} from "@/lib/still-api-fetch";
import { stillApiOrigin } from "@/lib/still-api-origin";
import {
	activeIndexAfterRemoval,
	buildTasteQueueBackfillRunner,
	createTasteQueueBackfillScheduler,
} from "@/lib/taste-match-queue";
import {
	reconcileTasteMatchMovies,
	TASTE_MATCH_MIN_RESULTS,
	type TasteMatchedDiscoveryPayload,
	type TasteMatchMovie,
	tasteMatchedRailTitle,
} from "@/lib/taste-matched-discovery";
import {
	dispatchTasteTitleConsumed,
	TASTE_TITLE_CONSUMED_EVENT,
	type TasteTitleConsumedDetail,
} from "@/lib/taste-title-consumed-events";
import { tmdbBackdropUrlFromPath } from "@/lib/tmdb-backdrop-url";
import { tmdbLogoUrlFromPath } from "@/lib/tmdb-logo-url";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import {
	TODAY_CARD_ACTION_CLASSNAME,
	TODAY_CARD_HEADING_CLASSNAME,
	TODAY_SUPPORTING_CARD_CLASSNAME,
} from "@/lib/today-card-layout";
import { buildTodayInstantLogPayload } from "@/lib/today-instant-log";
import {
	readTodayPickContinuity,
	skipTodayPickContinuity,
	writeTodayPickContinuity,
} from "@/lib/today-pick-continuity";
import {
	INITIAL_TODAY_PICK_STATE,
	reduceTodayPick,
	todayPickCompletedTmdbId,
	todayPickStatusCopy,
} from "@/lib/today-pick-state";
import { dispatchTodayWeekRefresh } from "@/lib/today-week-pulse";
import { useHorizontalRailPointerDrag } from "@/lib/use-horizontal-rail-pointer-drag";
import {
	HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
	useHorizontalRailPosterEdgeOpacity,
} from "@/lib/use-horizontal-scroll-fades";
import { useTrackImpressionOnce } from "@/lib/use-track-impression-once";

function moviesFromTastePayload(
	data: TasteMatchedDiscoveryPayload,
): TasteMatchMovie[] {
	if (data.coldStart) return [];
	return reconcileTasteMatchMovies(data.movies, data.consumedTmdbIds);
}

function tasteHeroIsEmpty(movies: TasteMatchMovie[]): boolean {
	return movies.length < TASTE_MATCH_MIN_RESULTS;
}

type TodayPickAction =
	| "watched"
	| "watchlist"
	| "not_interested"
	| "pick_another"
	| "undo"
	| "open_detail";

/** Today pick funnel — fired once per completed action (after the server confirms). */
function trackTodayPickAction(
	action: TodayPickAction,
	tmdbId: number | null,
	extra: Record<string, unknown> = {},
	media: "movie" | "tv" = "movie",
): void {
	trackSenseProductEvent("today.pick.action", {
		action,
		tmdbId,
		// Movie payloads stay as they are. TV picks carry `media: "tv"`.
		...(media === "tv" ? { media: "tv" as const } : {}),
		...extra,
	});
}

type TodayHeroMedia = "movie" | "tv";

/** Wordmark fallback. TV uses the show route — never `/api/movies/:id/title-logo`. */
async function fetchSpotlightTitleLogoPath(
	media: TodayHeroMedia,
	tmdbId: number,
): Promise<string | null> {
	switch (media) {
		case "movie":
			return fetchMovieTitleLogoPath(tmdbId);
		case "tv": {
			const url = new URL(`/api/tv/${tmdbId}/title-logo`, stillApiOrigin());
			const response = await fetch(url, { credentials: "include" });
			if (!response.ok) return null;
			const data = (await response.json()) as unknown;
			if (isStillApiErrorPayload(data)) return null;
			const payload = data as { logoPath?: string | null };
			return typeof payload.logoPath === "string" && payload.logoPath.length > 0
				? payload.logoPath
				: null;
		}
		default: {
			const unhandled: never = media;
			return unhandled;
		}
	}
}

/** Trailer fallback. TV uses the show route — never `/api/movies/:id/trailer`. */
async function fetchSpotlightTrailer(
	media: TodayHeroMedia,
	tmdbId: number,
): Promise<{ trailerKey: string; trailerSite: string } | null> {
	switch (media) {
		case "movie":
			return fetchMovieTrailer(tmdbId);
		case "tv": {
			const url = new URL(`/api/tv/${tmdbId}/trailer`, stillApiOrigin());
			const response = await fetch(url, { credentials: "include" });
			if (!response.ok) return null;
			const data = (await response.json()) as unknown;
			if (isStillApiErrorPayload(data)) return null;
			const payload = data as {
				trailerKey?: string | null;
				trailerSite?: string | null;
			};
			if (
				typeof payload.trailerKey !== "string" ||
				payload.trailerKey.length === 0
			) {
				return null;
			}
			return {
				trailerKey: payload.trailerKey,
				trailerSite:
					typeof payload.trailerSite === "string" &&
					payload.trailerSite.length > 0
						? payload.trailerSite
						: "YouTube",
			};
		}
		default: {
			const unhandled: never = media;
			return unhandled;
		}
	}
}

function formatHeroRatingsCountValue(count: number): string {
	return count.toLocaleString();
}

function formatHeroRatingsCountLabel(count: number): string {
	return count === 1 ? "Rating" : "Ratings";
}

/**
 * `legacy-autoswap` — consumed titles leave the queue immediately (standalone hero).
 * `today-shell` — Today's Pick stays on `just_logged` until the rating step
 * settles; `complete` (rating settled, watchlisted, or consumed elsewhere)
 * skips that title and advances the day-seeded hero once.
 */
export type HomeTasteHeroCompletionMode = "legacy-autoswap" | "today-shell";

/** Honest pick empty / error tile — Today keeps rendering week + circle beside it. */
function TodayPickEmptyTile({
	failed,
	onRetry,
}: {
	failed: boolean;
	onRetry: () => void;
}) {
	const headingId = useId();
	const requestSearch = useCatalogSearchDialog((s) => s.requestOpen);
	return (
		<section
			aria-labelledby={headingId}
			className={cn(TODAY_SUPPORTING_CARD_CLASSNAME, "min-h-0")}
		>
			<h3 id={headingId} className={TODAY_CARD_HEADING_CLASSNAME}>
				Today’s pick
			</h3>
			{failed ? (
				<>
					<p className="text-muted-foreground text-sm">
						Couldn’t load today’s pick.
					</p>
					<button
						type="button"
						className={TODAY_CARD_ACTION_CLASSNAME}
						onClick={onRetry}
					>
						Try again
					</button>
				</>
			) : (
				<>
					<p className="max-w-prose text-balance font-semibold text-foreground text-lg leading-snug tracking-tight">
						Log a few more films and a pick matched to your taste will be
						waiting here.
					</p>
					<button
						type="button"
						className={TODAY_CARD_ACTION_CLASSNAME}
						onClick={() => requestSearch()}
					>
						Log a film
					</button>
				</>
			)}
		</section>
	);
}

export function HomeTasteMatchedHero({
	initial,
	completionMode = "legacy-autoswap",
	media = "movie",
}: {
	initial?: TasteMatchedDiscoveryPayload | null;
	completionMode?: HomeTasteHeroCompletionMode;
	/** Movie keeps film routes and instant Watched. TV is show-scoped. */
	media?: TodayHeroMedia;
}) {
	const isTodayShell = completionMode === "today-shell";
	/** Stable read for callbacks shared with the standalone hero (no dep churn). */
	const isTodayShellRef = useRef(isTodayShell);
	isTodayShellRef.current = isTodayShell;
	const sessionUserId = authClient.useSession().data?.user.id ?? "";
	const reduceMotion = useReducedMotion();
	const motionProps = useDetailActionMotion();
	const openQuickLog = useQuickLog((s) => s.open);
	const [pickState, dispatchPick] = useReducer(
		reduceTodayPick,
		INITIAL_TODAY_PICK_STATE,
	);
	const pickStateRef = useRef(pickState);
	const pickAnotherButtonRef = useRef<HTMLButtonElement>(null);
	/** Once the queue met the quality bar, a short backfill gap must not flash the empty tile. */
	const queueQualifiedRef = useRef(false);
	/** Auto-advance on `complete` once per title — the effect must not loop. */
	const advancedCompleteTmdbIdRef = useRef<number | null>(null);
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
	const [instantLogBusy, setInstantLogBusy] = useState(false);
	const [undoBusy, setUndoBusy] = useState(false);
	const watchedButtonRef = useRef<HTMLButtonElement>(null);
	const focusWatchedAfterUndoRef = useRef(false);
	const [priorLogCount, setPriorLogCount] = useState(0);
	const [spotlightLogoPath, setSpotlightLogoPath] = useState<string | null>(
		null,
	);
	const [resolvedTrailer, setResolvedTrailer] = useState<{
		trailerKey: string;
		trailerSite: string;
	} | null>(null);
	/** Tail poster ids that should play the enter animation after backfill. */
	const [enteringPosterIds, setEnteringPosterIds] = useState<Set<number>>(
		() => new Set(),
	);
	const posterRailRef = useRef<HTMLDivElement>(null);
	const moviesRef = useRef(movies);
	const activeIndexRef = useRef(activeIndex);
	const backfillSchedulerRef = useRef<ReturnType<
		typeof createTasteQueueBackfillScheduler
	> | null>(null);
	const posterRailContentKey = movies.map((film) => film.tmdbId).join(",");

	/** Day-seeded spotlight among the current for-you queue (Today shell only). */
	function resolveTodayHeroIndex(films: { tmdbId: number }[]): number {
		const dayKey = formatDayKey(readViewerTimeZone());
		const pin = readTodayPickContinuity({ media, dayKey });
		const heroId = pickDailySpotlight({
			rankedIds: films.map((film) => film.tmdbId),
			dayKey,
			userId: sessionUserId,
			surface: media,
			skippedIds: pin?.skippedIds ?? [],
			pinnedId: pin?.tmdbId ?? null,
		});
		if (heroId == null) return 0;
		const index = films.findIndex((film) => film.tmdbId === heroId);
		return index >= 0 ? index : 0;
	}

	/** Resolve the Today index and persist a new pin without dropping the day's skips. */
	function commitTodayHeroIndex(
		films: TasteMatchMovie[],
		reason: string,
	): number {
		const dayKey = formatDayKey(readViewerTimeZone());
		const pin = readTodayPickContinuity({ media, dayKey });
		const index = resolveTodayHeroIndex(films);
		const film = films[index];
		// An empty session id is pre-hydration — writing then would lock a guest pin.
		if (sessionUserId !== "" && film != null && film.tmdbId !== pin?.tmdbId) {
			writeTodayPickContinuity({
				film,
				reason,
				media,
				dayKey,
				skippedIds: pin?.skippedIds ?? [],
			});
		}
		return index;
	}

	useEffect(() => {
		moviesRef.current = movies;
		if (movies.length >= TASTE_MATCH_MIN_RESULTS) {
			queueQualifiedRef.current = true;
		}
	}, [movies]);

	useEffect(() => {
		activeIndexRef.current = activeIndex;
	}, [activeIndex]);

	useEffect(() => {
		pickStateRef.current = pickState;
	}, [pickState]);

	const fetchTasteForYou = useCallback(async () => {
		try {
			// Movie for-you stays parameter-free. TV retries the show catalogue.
			const res =
				media === "tv"
					? await api.api.taste["for-you"].get({ query: { media: "tv" } })
					: await api.api.taste["for-you"].get();
			if (res.error || !res.data) return null;
			return res.data as TasteMatchedDiscoveryPayload;
		} catch {
			return null;
		}
	}, [media]);

	/** Today empty-tile **Try again** — refetch for-you after a failed load. */
	const handleRetryPick = useCallback(async () => {
		setLoading(true);
		const data = await fetchTasteForYou();
		const films = data ? moviesFromTastePayload(data) : [];
		const nextGenrePhrase =
			data && !data.coldStart ? (data.genrePhrase ?? null) : null;
		setPayload(data);
		setMovies(films);
		setGenrePhrase(nextGenrePhrase);
		setActiveIndex(
			isTodayShell
				? commitTodayHeroIndex(films, tasteMatchedRailTitle(nextGenrePhrase))
				: 0,
		);
		setLoading(false);
	}, [fetchTasteForYou, isTodayShell, media, sessionUserId]);

	const applyMoviesFromBackfill = useCallback((next: TasteMatchMovie[]) => {
		const prev = moviesRef.current;
		const addedIds = next
			.filter((film) => !prev.some((row) => row.tmdbId === film.tmdbId))
			.map((film) => film.tmdbId);
		if (addedIds.length > 0) {
			setEnteringPosterIds((current) => {
				const merged = new Set(current);
				for (const id of addedIds) {
					merged.add(id);
				}
				return merged;
			});
		}
		setMovies(next);
	}, []);

	useEffect(() => {
		const scheduler = createTasteQueueBackfillScheduler({
			runBackfill: buildTasteQueueBackfillRunner({
				getMovies: () => moviesRef.current,
				setMovies: applyMoviesFromBackfill,
				fetchForYou: fetchTasteForYou,
			}),
		});
		backfillSchedulerRef.current = scheduler;
		return () => {
			scheduler.cancel();
			backfillSchedulerRef.current = null;
		};
	}, [applyMoviesFromBackfill, fetchTasteForYou]);

	const clearEnteringPosterId = useCallback((tmdbId: number) => {
		setEnteringPosterIds((current) => {
			if (!current.has(tmdbId)) return current;
			const next = new Set(current);
			next.delete(tmdbId);
			return next;
		});
	}, []);
	const { isDragging: isPosterRailDragging, shouldSuppressClick } =
		useHorizontalRailPointerDrag(posterRailRef, movies.length > 1);

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
	/**
	 * Enrichment effects below key off this id, never the `spotlight` object:
	 * they write the fetched logo/trailer back into `movies`, which rebuilds that
	 * object and would otherwise retrigger them in an endless fetch loop.
	 */
	const spotlightTmdbId = spotlight?.tmdbId ?? null;
	const spotlightTmdbIdRef = useRef(spotlightTmdbId);
	const titleSwapRef = useRef<HTMLSpanElement>(null);
	const reasonSwapRef = useRef<HTMLSpanElement>(null);
	/** First paint already has the right copy — do not swap on mount. */
	const skipFirstTextSwapRef = useRef(true);
	/** useReducedMotion hydrates after mount; skip that rerun unless copy changed. */
	const prevSwapTitleRef = useRef(spotlight?.title ?? "");
	const prevSwapReasonRef = useRef(tasteMatchedRailTitle(genrePhrase));

	useEffect(() => {
		spotlightTmdbIdRef.current = spotlightTmdbId;
	}, [spotlightTmdbId]);

	useEffect(() => {
		if (skipFirstTextSwapRef.current) {
			skipFirstTextSwapRef.current = false;
			return;
		}
		const nextTitle = spotlight?.title ?? "";
		const nextReason = tasteMatchedRailTitle(genrePhrase);
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
		// Spotlight copy is read from the current pick; only the id should trigger a swap.
	}, [spotlightTmdbId, reduceMotion]);

	const mediaBoundRef = useRef(media);
	useEffect(() => {
		if (initial === undefined) return;
		const fresh =
			initial && !initial.coldStart ? moviesFromTastePayload(initial) : [];
		// Same component instance serves both catalogues. A finished film pick
		// must not stay logged, or pin that film, when this hero becomes a show.
		const mediaChanged = mediaBoundRef.current !== media;
		if (mediaChanged) {
			mediaBoundRef.current = media;
			dispatchPick({ type: "pick_another" });
		}
		// A server refresh drops consumed titles — keep a completed Today pick
		// in the rail so the complete-phase advance can skip it once.
		const completedId = mediaChanged
			? null
			: todayPickCompletedTmdbId(pickStateRef.current);
		const completedFilm =
			completedId == null
				? undefined
				: moviesRef.current.find((film) => film.tmdbId === completedId);
		// Home remounts after a title-page visit: a pick finished there comes back
		// as done (snapshot, since the server already dropped it) — then the
		// complete-phase effect skips it and advances the day's next hero.
		const dayKey = formatDayKey(readViewerTimeZone());
		const continuity =
			isTodayShell && completedId == null
				? readTodayPickContinuity({ media, dayKey })
				: null;
		// A Watched pin waiting on How was it? is not complete — restore the rating step.
		const pendingLogId =
			continuity && continuity.completedVia == null && continuity.pendingLogId
				? continuity.pendingLogId
				: null;
		const pendingFilm =
			continuity && pendingLogId
				? (fresh.find((film) => film.tmdbId === continuity.tmdbId) ??
					continuity.film)
				: undefined;
		const restoredVia = continuity?.completedVia ?? null;
		const restoredFilm =
			continuity && restoredVia && pendingLogId == null
				? (fresh.find((film) => film.tmdbId === continuity.tmdbId) ??
					continuity.film)
				: undefined;
		const pinnedFilm = completedFilm ?? pendingFilm ?? restoredFilm;
		const nextFilms = pinnedFilm
			? [
					pinnedFilm,
					...fresh.filter((film) => film.tmdbId !== pinnedFilm.tmdbId),
				]
			: fresh;
		const nextGenrePhrase =
			initial && !initial.coldStart ? (initial.genrePhrase ?? null) : null;
		setPayload(initial);
		setMovies(nextFilms);
		if (pendingFilm && pendingLogId) {
			dispatchPick({
				type: "logged",
				tmdbId: pendingFilm.tmdbId,
				logId: pendingLogId,
			});
		} else if (restoredFilm && restoredVia) {
			dispatchPick({
				type: "restored_complete",
				tmdbId: restoredFilm.tmdbId,
				via: restoredVia,
			});
		}
		setGenrePhrase(nextGenrePhrase);
		setLoading(false);
		setActiveIndex(
			isTodayShell
				? commitTodayHeroIndex(
						nextFilms,
						tasteMatchedRailTitle(nextGenrePhrase),
					)
				: 0,
		);
	}, [initial, isTodayShell, media, sessionUserId]);

	useEffect(() => {
		if (initial !== undefined) return;
		let cancelled = false;
		async function load() {
			try {
				const res =
					media === "tv"
						? await api.api.taste["for-you"].get({ query: { media: "tv" } })
						: await api.api.taste["for-you"].get();
				if (cancelled) return;
				if (res.error || !res.data) {
					setPayload(null);
					setMovies([]);
					return;
				}
				const data = res.data as TasteMatchedDiscoveryPayload;
				const films = moviesFromTastePayload(data);
				const nextGenrePhrase = data.coldStart
					? null
					: (data.genrePhrase ?? null);
				setPayload(data);
				setMovies(films);
				setGenrePhrase(nextGenrePhrase);
				if (isTodayShell) {
					setActiveIndex(
						commitTodayHeroIndex(films, tasteMatchedRailTitle(nextGenrePhrase)),
					);
				}
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
	}, [initial, isTodayShell, media, sessionUserId]);

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
		if (spotlightTmdbId == null) {
			setSpotlightLogoPath(null);
			return;
		}
		// Paint the wordmark we already hold while the fresh lookup is in flight.
		setSpotlightLogoPath(
			moviesRef.current.find((film) => film.tmdbId === spotlightTmdbId)
				?.logoPath ?? null,
		);
		let cancelled = false;
		void fetchSpotlightTitleLogoPath(media, spotlightTmdbId).then(
			(logoPath) => {
				if (cancelled || !logoPath) return;
				setSpotlightLogoPath(logoPath);
				setMovies((prev) =>
					prev.some(
						(film) =>
							film.tmdbId === spotlightTmdbId && film.logoPath !== logoPath,
					)
						? prev.map((film) =>
								film.tmdbId === spotlightTmdbId ? { ...film, logoPath } : film,
							)
						: prev,
				);
			},
		);
		return () => {
			cancelled = true;
		};
	}, [media, spotlightTmdbId]);

	useEffect(() => {
		if (spotlightTmdbId == null) {
			setResolvedTrailer(null);
			return;
		}
		const seeded =
			moviesRef.current.find((film) => film.tmdbId === spotlightTmdbId) ?? null;
		setResolvedTrailer(
			seeded?.trailerKey
				? {
						trailerKey: seeded.trailerKey,
						trailerSite: seeded.trailerSite ?? "YouTube",
					}
				: null,
		);
		let cancelled = false;
		void fetchSpotlightTrailer(media, spotlightTmdbId).then((row) => {
			if (cancelled || !row?.trailerKey) return;
			setResolvedTrailer(row);
			setMovies((prev) =>
				prev.some(
					(film) =>
						film.tmdbId === spotlightTmdbId &&
						(film.trailerKey !== row.trailerKey ||
							film.trailerSite !== row.trailerSite),
				)
					? prev.map((film) =>
							film.tmdbId === spotlightTmdbId
								? {
										...film,
										trailerKey: row.trailerKey,
										trailerSite: row.trailerSite,
									}
								: film,
						)
					: prev,
			);
		});
		return () => {
			cancelled = true;
		};
	}, [media, spotlightTmdbId]);

	useEffect(() => {
		if (spotlightTmdbId == null) {
			setPriorLogCount(0);
			return;
		}
		let cancelled = false;
		const fetchLogs = media === "tv" ? fetchMyLogsForTv : fetchMyLogsForMovie;
		void fetchLogs(spotlightTmdbId)
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
	}, [media, spotlightTmdbId]);

	const removeFromQueue = useCallback((tmdbId: number) => {
		const snapshot = moviesRef.current;
		const index = snapshot.findIndex((film) => film.tmdbId === tmdbId);
		if (index < 0) return false;

		setMovies((prev) => prev.filter((film) => film.tmdbId !== tmdbId));
		setActiveIndex((prev) =>
			activeIndexAfterRemoval(index, prev, snapshot.length - 1),
		);
		backfillSchedulerRef.current?.schedule();
		return true;
	}, []);

	const handleNotInterested = useCallback(
		async (tmdbId: number) => {
			const snapshot = moviesRef.current;
			const activeSnapshot = activeIndexRef.current;
			const index = snapshot.findIndex((film) => film.tmdbId === tmdbId);
			if (index < 0) return;
			if (isTodayShellRef.current) {
				trackTodayPickAction("not_interested", tmdbId, {}, media);
			}

			const remaining = snapshot.filter((film) => film.tmdbId !== tmdbId);
			setMovies(remaining);
			// Read first so a failed dismiss can put the day's pin back, skip included.
			const dayKey = formatDayKey(readViewerTimeZone());
			const previousPin = isTodayShellRef.current
				? readTodayPickContinuity({ media, dayKey })
				: null;
			if (isTodayShellRef.current) {
				// Record the skip before choosing the next day-seeded hero.
				skipTodayPickContinuity(tmdbId, { media, dayKey });
				setActiveIndex(
					commitTodayHeroIndex(remaining, tasteMatchedRailTitle(genrePhrase)),
				);
			} else {
				setActiveIndex((prev) =>
					activeIndexAfterRemoval(index, prev, snapshot.length - 1),
				);
			}
			// Not interested may advance immediately — unlike watched / watchlist.
			dispatchPick({ type: "not_interested_advanced" });

			try {
				const excludeTmdbIds = snapshot.map((film) => film.tmdbId);
				const res = await api.api.taste.dismiss.post(
					media === "tv"
						? { tvTmdbId: tmdbId, excludeTmdbIds }
						: { movieTmdbId: tmdbId, excludeTmdbIds },
				);
				if (res.error || !res.data) throw new Error("dismiss failed");
				backfillSchedulerRef.current?.schedule();
			} catch {
				setMovies(snapshot);
				setActiveIndex(activeSnapshot);
				if (previousPin) {
					writeTodayPickContinuity({
						film: previousPin.film,
						reason: previousPin.reason,
						media,
						dayKey: previousPin.dayKey || dayKey,
						skippedIds: previousPin.skippedIds,
						completedVia: previousPin.completedVia,
						pendingLogId: previousPin.pendingLogId,
					});
				}
				toast.error("Couldn't update suggestions");
			}
		},
		[genrePhrase, media, sessionUserId],
	);

	const handleTitleConsumed = useCallback(
		(tmdbId: number) => {
			// Today records complete in place — the complete-phase effect then advances.
			if (isTodayShell && tmdbId === spotlightTmdbIdRef.current) {
				dispatchPick({ type: "consumed_elsewhere", tmdbId });
				return;
			}
			removeFromQueue(tmdbId);
		},
		[isTodayShell, removeFromQueue],
	);

	/** Retire the finished title and show the next day-seeded hero (or `targetTmdbId` when chosen). */
	const handlePickAnother = useCallback(
		(targetTmdbId?: number) => {
			const completedId = todayPickCompletedTmdbId(pickStateRef.current);
			// Only a real transition counts — the reducer ignores it while active.
			if (completedId != null) {
				trackTodayPickAction(
					"pick_another",
					completedId,
					{
						chosenFromRail: targetTmdbId != null,
					},
					media,
				);
			}
			const dayKey = formatDayKey(readViewerTimeZone());
			const reason = tasteMatchedRailTitle(genrePhrase);
			const spotlightId = spotlightTmdbIdRef.current;
			// Skip, do not clear — clearing deletes the day's skipped ids.
			if (spotlightId != null) {
				skipTodayPickContinuity(spotlightId, { media, dayKey });
			}
			dispatchPick({ type: "pick_another" });
			if (completedId == null) return;
			advancedCompleteTmdbIdRef.current = completedId;
			const remaining = moviesRef.current.filter(
				(film) => film.tmdbId !== completedId,
			);
			if (targetTmdbId != null) {
				const pin = readTodayPickContinuity({ media, dayKey });
				const target = remaining.find((film) => film.tmdbId === targetTmdbId);
				if (target) {
					writeTodayPickContinuity({
						film: target,
						reason,
						media,
						dayKey,
						skippedIds: pin?.skippedIds ?? [],
					});
				}
			}
			setMovies(remaining);
			setActiveIndex(commitTodayHeroIndex(remaining, reason));
			backfillSchedulerRef.current?.schedule();
		},
		[genrePhrase, media, sessionUserId],
	);

	const handleAddToWatchlist = useCallback(async () => {
		if (!spotlight || watchlistBusy) return;
		setWatchlistBusy(true);
		try {
			const result = await postWatchlistAdd(
				media === "tv"
					? { tvId: spotlight.tmdbId }
					: { movieId: spotlight.tmdbId },
			);
			if (!result.ok) throw new Error("watchlist failed");
			if (isTodayShell) {
				trackTodayPickAction("watchlist", spotlight.tmdbId, {}, media);
				dispatchPick({ type: "watchlisted", tmdbId: spotlight.tmdbId });
			} else {
				handleTitleConsumed(spotlight.tmdbId);
			}
		} catch {
			toast.error("Couldn't update watchlist");
		} finally {
			setWatchlistBusy(false);
		}
	}, [handleTitleConsumed, isTodayShell, media, spotlight, watchlistBusy]);

	const handleOpenQuickLog = useCallback(() => {
		if (!spotlight) return;
		const posterUrl =
			tmdbPosterUrlFromPath(spotlight.posterPath, "w342") ?? undefined;
		openQuickLog({
			...(media === "tv"
				? {
						tvId: spotlight.tmdbId,
						logScope: "show" as const,
					}
				: { movieId: spotlight.tmdbId }),
			movieTitle: spotlight.title,
			posterUrl,
			averageRating: spotlight.communityAverage ?? undefined,
			priorLogCount,
			rewatch: priorLogCount > 0,
			onSuccess: (result) => {
				if (isTodayShell) {
					if (media === "tv") {
						trackTodayPickAction("watched", spotlight.tmdbId, {}, media);
						// TV Quick Log already collected the rating — settle in this handler.
						dispatchPick({
							type: "logged",
							tmdbId: spotlight.tmdbId,
							logId: null,
						});
						dispatchPick({ type: "rating_settled" });
						dispatchTasteTitleConsumed({
							tmdbId: spotlight.tmdbId,
							via: "diary",
							media: "tv",
						});
						return;
					}
					dispatchPick({
						type: "logged",
						tmdbId: spotlight.tmdbId,
						logId: result?.logId ?? null,
					});
					return;
				}
				handleTitleConsumed(spotlight.tmdbId);
			},
		});
	}, [
		handleTitleConsumed,
		isTodayShell,
		media,
		openQuickLog,
		priorLogCount,
		spotlight,
	]);

	/** Today **Watched** — saves the diary log immediately (no sheet); rating comes after. */
	const handleInstantWatched = useCallback(async () => {
		if (!spotlight || instantLogBusy) return;
		const tmdbId = spotlight.tmdbId;
		setInstantLogBusy(true);
		try {
			const result = await postLog(
				buildTodayInstantLogPayload({
					tmdbId,
					priorLogCount,
					todayYmd: formatTodayYmd(),
				}),
			);
			if (!result.ok) {
				console.error("[today] instant log failed", result.error);
				throw new Error("instant log failed");
			}
			const created = result.data as { id?: unknown } | null;
			trackTodayPickAction(
				"watched",
				tmdbId,
				{
					rewatch: priorLogCount > 0,
				},
				media,
			);
			const logId = typeof created?.id === "string" ? created.id : null;
			// Stay on just_logged — do not mark consumed until the rating step settles.
			dispatchPick({
				type: "logged",
				tmdbId,
				logId,
			});
			const dayKey = formatDayKey(readViewerTimeZone());
			const pin = readTodayPickContinuity({ media, dayKey });
			writeTodayPickContinuity({
				film: spotlight,
				reason: pin?.reason ?? tasteMatchedRailTitle(genrePhrase),
				media,
				dayKey,
				skippedIds: pin?.skippedIds ?? [],
				pendingLogId: logId,
			});
			setPriorLogCount((count) => count + 1);
			dispatchTodayWeekRefresh();
		} catch {
			toast.error("Couldn't save to your diary");
		} finally {
			setInstantLogBusy(false);
		}
	}, [genrePhrase, instantLogBusy, media, priorLogCount, spotlight]);

	/** Deletes the log Today just created and reopens the pick's actions. */
	const handleUndoLog = useCallback(async () => {
		const state = pickStateRef.current;
		if (state.phase !== "just_logged" || !state.logId || undoBusy) return;
		setUndoBusy(true);
		try {
			const result = await deleteLog(state.logId);
			if (!result.ok) {
				console.error("[today] undo log failed", result.error);
				throw new Error("undo failed");
			}
			trackTodayPickAction("undo", state.tmdbId, {}, media);
			dispatchPick({ type: "undo" });
			const dayKey = formatDayKey(readViewerTimeZone());
			const pin = readTodayPickContinuity({ media, dayKey });
			const undoneId = state.tmdbId;
			const film =
				moviesRef.current.find((row) => row.tmdbId === undoneId) ??
				(pin?.film.tmdbId === undoneId ? pin.film : undefined);
			// Keep the day's pin; drop this id from skips and restore its index.
			if (film) {
				writeTodayPickContinuity({
					film,
					reason: pin?.reason ?? tasteMatchedRailTitle(genrePhrase),
					media,
					dayKey,
					skippedIds: (pin?.skippedIds ?? []).filter((id) => id !== undoneId),
					pendingLogId: null,
					completedVia: null,
				});
			}
			const restoredIndex = moviesRef.current.findIndex(
				(row) => row.tmdbId === undoneId,
			);
			if (restoredIndex >= 0) {
				setActiveIndex(restoredIndex);
			}
			setPriorLogCount((count) => Math.max(0, count - 1));
			dispatchTodayWeekRefresh();
			focusWatchedAfterUndoRef.current = true;
		} catch {
			toast.error("Couldn't undo — the log is still in your diary");
		} finally {
			setUndoBusy(false);
		}
	}, [genrePhrase, media, undoBusy]);

	/** Clear the pending rating pin, then settle so the complete effect can skip. */
	const handleRatingSettled = useCallback(() => {
		const state = pickStateRef.current;
		const tmdbId =
			state.phase === "just_logged" ? state.tmdbId : spotlightTmdbIdRef.current;
		const dayKey = formatDayKey(readViewerTimeZone());
		const pin = readTodayPickContinuity({ media, dayKey });
		const film =
			(tmdbId != null
				? moviesRef.current.find((row) => row.tmdbId === tmdbId)
				: undefined) ??
			(pin && tmdbId != null && pin.tmdbId === tmdbId ? pin.film : undefined);
		if (film) {
			writeTodayPickContinuity({
				film,
				reason: pin?.reason ?? tasteMatchedRailTitle(genrePhrase),
				media,
				dayKey,
				skippedIds: pin?.skippedIds ?? [],
				pendingLogId: null,
			});
		}
		dispatchPick({ type: "rating_settled" });
		if (tmdbId != null) {
			dispatchTasteTitleConsumed({ tmdbId, via: "diary", media });
		}
	}, [genrePhrase, media]);

	const quickLogLabel = isTodayShell
		? priorLogCount > 0
			? "Log a rewatch"
			: "Watched"
		: priorLogCount > 0
			? "Rewatch"
			: "Add to Watched";

	useEffect(() => {
		const onConsumed = (event: Event) => {
			const detail = (event as CustomEvent<TasteTitleConsumedDetail>).detail;
			if (detail?.tmdbId == null) return;
			// Missing media is a movie event — TV completion must not clear a film pick.
			const eventMedia = detail.media ?? "movie";
			if (eventMedia !== media) return;
			handleTitleConsumed(detail.tmdbId);
		};
		window.addEventListener(TASTE_TITLE_CONSUMED_EVENT, onConsumed);
		return () =>
			window.removeEventListener(TASTE_TITLE_CONSUMED_EVENT, onConsumed);
	}, [handleTitleConsumed, media]);

	const pickDone =
		isTodayShell &&
		pickState.phase !== "active" &&
		pickState.tmdbId === spotlightTmdbId;
	const pickStatusCopy = pickDone ? todayPickStatusCopy(pickState) : null;

	const pickPhase = pickState.phase;
	const justLoggedId =
		pickDone && pickState.phase === "just_logged" ? pickState.logId : null;

	useEffect(() => {
		if (!isTodayShell || pickState.phase !== "complete") return;
		const completedId = pickState.tmdbId;
		if (advancedCompleteTmdbIdRef.current === completedId) return;
		advancedCompleteTmdbIdRef.current = completedId;
		const dayKey = formatDayKey(readViewerTimeZone());
		// just_logged stays put until rating settles — only complete advances.
		skipTodayPickContinuity(completedId, { media, dayKey });
		const remaining = moviesRef.current.filter(
			(film) => film.tmdbId !== completedId,
		);
		setMovies(remaining);
		setActiveIndex(
			commitTodayHeroIndex(remaining, tasteMatchedRailTitle(genrePhrase)),
		);
		dispatchPick({ type: "pick_another" });
		backfillSchedulerRef.current?.schedule();
	}, [genrePhrase, isTodayShell, media, pickState, sessionUserId]);

	useEffect(() => {
		// Undo remounts the actions — return focus to Watched, where the patron started.
		if (pickPhase === "active" && focusWatchedAfterUndoRef.current) {
			focusWatchedAfterUndoRef.current = false;
			watchedButtonRef.current?.focus();
			return;
		}
		if (!pickDone) return;
		// Pressed actions (Watched, Save/Skip) unmount — keep keyboard focus in the hero.
		const focused = document.activeElement;
		if (!focused || focused === document.body) {
			pickAnotherButtonRef.current?.focus();
		}
	}, [pickDone, pickPhase]);

	const todayShowsEmptyTile =
		!payload ||
		payload.coldStart ||
		(tasteHeroIsEmpty(movies) && !queueQualifiedRef.current) ||
		!spotlight;
	useTrackImpressionOnce(
		"today.pick.viewed",
		{
			state: payload == null ? "error" : todayShowsEmptyTile ? "empty" : "pick",
			tmdbId: todayShowsEmptyTile ? null : spotlightTmdbId,
		},
		isTodayShell && !loading,
	);

	if (loading) return <HomeTasteMatchedHeroSkeleton />;
	if (isTodayShell) {
		if (todayShowsEmptyTile) {
			return (
				<TodayPickEmptyTile
					failed={payload == null}
					onRetry={() => void handleRetryPick()}
				/>
			);
		}
	} else if (
		!payload ||
		payload.coldStart ||
		tasteHeroIsEmpty(movies) ||
		!spotlight
	) {
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
			aria-label={isTodayShell ? "Today’s pick" : "Films matched to your taste"}
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
							"relative z-20 mt-auto flex min-h-0 w-full flex-col gap-3 overflow-visible px-3 pb-1 sm:mt-0 sm:gap-2",
							HOME_TASTE_HERO_BAND_CONTENT_INSET_CLASSNAME,
							// Nudge title + actions + posters together — rating must not slide under buttons.
							HOME_TASTE_HERO_BAND_CONTENT_MOBILE_DROP_CLASSNAME,
							HOME_TASTE_HERO_BAND_CONTENT_2K_NUDGE_CLASSNAME,
							"sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:px-6",
						)}
					>
						<div
							className={cn(
								"mx-auto flex min-w-0 max-w-[min(100%,34rem)] shrink-0 flex-col gap-2 text-center sm:mx-0 sm:gap-3 sm:text-left",
							)}
						>
							<div
								className={cn(
									"space-y-2 sm:space-y-3",
									HOME_TASTE_HERO_BAND_CONTENT_MOBILE_NUDGE_CLASSNAME,
								)}
							>
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
									{isTodayShell ? (
										<>
											<span className="font-semibold text-foreground">
												Today’s pick
											</span>
											<span aria-hidden>·</span>
										</>
									) : null}
									<span ref={reasonSwapRef} className="t-text-swap">
										{tasteMatchedRailTitle(genrePhrase)}
									</span>
								</p>
								<Link
									href={
										media === "tv"
											? `/tv/${spotlight.tmdbId}`
											: `/movies/${spotlight.tmdbId}`
									}
									className="group mx-auto block min-w-0 sm:mx-0"
									onClick={
										isTodayShell
											? () => {
													trackTodayPickAction(
														"open_detail",
														spotlight.tmdbId,
														{},
														media,
													);
													const dayKey = formatDayKey(readViewerTimeZone());
													writeTodayPickContinuity({
														film: spotlight,
														reason: tasteMatchedRailTitle(genrePhrase),
														media,
														dayKey,
														skippedIds:
															readTodayPickContinuity({
																media,
																dayKey,
															})?.skippedIds ?? [],
													});
												}
											: undefined
									}
								>
									{titleLogoUrl ? (
										<div className="relative mx-auto h-[clamp(2.25rem,5.5vw,5.75rem)] w-full max-w-[min(100%,14rem)] sm:mx-0 sm:max-w-[min(100%,32rem)]">
											{/* biome-ignore lint/performance/noImgElement: TMDb wordmark — native img avoids Next optimizer edge cases on remote logos. */}
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
										<h2 className="text-balance font-sans font-semibold text-[clamp(1.375rem,4.5vw,3.25rem)] text-foreground uppercase leading-[0.95] tracking-[-0.03em] [text-shadow:-1px_0_0_color-mix(in_oklab,var(--foreground)_0%,#ff4d4d_28%),1px_0_0_color-mix(in_oklab,var(--foreground)_0%,#4da3ff_28%)] sm:text-[clamp(1.75rem,5.5vw,3.25rem)]">
											<span ref={titleSwapRef} className="t-text-swap">
												{spotlight.title}
											</span>
										</h2>
									)}
								</Link>
								<div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 sm:justify-start sm:gap-x-4 sm:gap-y-2">
									{hasAverage && displayAverage != null ? (
										<div className="flex items-center gap-0.5 sm:gap-1">
											<IconPatronScoreLeafLeft className="h-10 w-auto shrink-0 text-foreground/60 sm:h-11" />
											<div className="flex min-w-10 flex-col items-center gap-px text-center leading-none sm:min-w-11">
												<span className="sr-only">
													Community score{" "}
													{formatLogRatingDisplay(displayAverage)} out of 10,{" "}
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
							</div>
							{isTodayShell ? (
								<p className="sr-only" aria-live="polite">
									{pickStatusCopy ?? ""}
								</p>
							) : null}
							{pickDone ? (
								<div className="relative z-30 flex flex-col items-center gap-3 pt-0.5 sm:items-start sm:pt-1">
									<div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:justify-start">
										<p className="inline-flex items-center gap-1.5 font-medium text-foreground text-sm">
											<Check
												className="size-4 shrink-0 stroke-[2.5]"
												aria-hidden
											/>
											{pickStatusCopy}
										</p>
										{justLoggedId ? (
											<button
												type="button"
												className={cn(
													"inline-flex min-h-10 items-center rounded-full px-2 font-medium text-foreground/75 text-sm underline-offset-4 transition-colors duration-200 motion-reduce:transition-none [@media(hover:hover)]:hover:text-foreground [@media(hover:hover)]:hover:underline",
													"disabled:pointer-events-none disabled:opacity-50",
													"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
												)}
												disabled={undoBusy}
												onClick={() => void handleUndoLog()}
											>
												Undo
											</button>
										) : null}
										<button
											ref={pickAnotherButtonRef}
											type="button"
											className={cn(
												"inline-flex min-h-10 items-center justify-center rounded-full bg-foreground px-4 font-medium text-background text-xs transition-[transform,background-color,color] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none sm:min-h-11 sm:px-5 sm:text-sm",
												"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
											)}
											onClick={() => handlePickAnother()}
										>
											Pick another
										</button>
									</div>
									{justLoggedId ? (
										<TodayPickHowWasIt
											key={justLoggedId}
											logId={justLoggedId}
											averageRating={displayAverage}
											onSettled={handleRatingSettled}
										/>
									) : null}
								</div>
							) : (
								<TooltipProvider delay={0} closeDelay={80}>
									<div className="relative z-30 flex flex-wrap items-center justify-center gap-1.5 pt-0.5 sm:justify-start sm:gap-2 sm:pt-1">
										<DetailIconTooltip label={quickLogLabel}>
											<motion.button
												ref={watchedButtonRef}
												type="button"
												className={cn(
													"inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-foreground sm:size-12",
													DETAIL_MOTION_PRESSABLE_CLASS,
													"disabled:pointer-events-none disabled:opacity-50",
													"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
												)}
												style={motionProps.style}
												whileHover={motionProps.hover}
												whileTap={motionProps.tap}
												transition={motionProps.buttonTransition}
												aria-label={quickLogLabel}
												// Movie Today saves instantly. TV Today opens Quick Log (show scope).
												// The standalone hero keeps the Quick Log sheet.
												disabled={media === "tv" ? false : instantLogBusy}
												onClick={
													isTodayShell && media !== "tv"
														? () => void handleInstantWatched()
														: handleOpenQuickLog
												}
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
												onClick={() =>
													void handleNotInterested(spotlight.tmdbId)
												}
											>
												Not interested
											</button>
										</div>
									</div>
								</TooltipProvider>
							)}
						</div>

						{movies.length > 0 ? (
							<div
								className={cn(
									"relative z-10",
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
										"cursor-grab select-none",
										isPosterRailDragging && "cursor-grabbing",
									)}
									role="listbox"
									aria-label="Browse taste-matched films"
								>
									<AnimatePresence initial={false} mode="sync">
										{movies.map((film, index) => {
											const isActive = index === safeActiveIndex;
											const shouldEnter =
												!reduceMotion && enteringPosterIds.has(film.tmdbId);
											return (
												<motion.button
													key={film.tmdbId}
													type="button"
													data-taste-poster-index={index}
													role="option"
													aria-selected={isActive}
													aria-label={`Show ${film.title}`}
													// No layout FLIP — on mobile it stacks tiles on top of each other.
													layout={false}
													initial={
														shouldEnter ? { opacity: 0, scale: 0.96 } : false
													}
													animate={{ opacity: 1, scale: 1 }}
													exit={
														reduceMotion
															? undefined
															: { opacity: 0, scale: 0.96 }
													}
													transition={
														reduceMotion
															? { duration: 0 }
															: { duration: 0.15, ease: "easeOut" }
													}
													onAnimationComplete={() => {
														if (shouldEnter) {
															clearEnteringPosterId(film.tmdbId);
														}
													}}
													className={cn(
														"relative shrink-0 rounded-xl bg-background transition-[transform,opacity] duration-200 ease-out [--edge-opacity:1] motion-reduce:transition-none sm:rounded-2xl",
														// Keep pointer gestures on the button — not a floating browser image drag.
														"[&_img]:pointer-events-none [&_img]:[-webkit-user-drag:none]",
														isActive
															? cn(
																	HOME_TASTE_HERO_POSTER_TILE_ACTIVE_CLASSNAME,
																	"z-1 scale-[1.03] opacity-(--edge-opacity) ring-2 ring-foreground/85",
																)
															: cn(
																	HOME_TASTE_HERO_POSTER_TILE_IDLE_CLASSNAME,
																	"opacity-[calc(0.8*var(--edge-opacity))] [@media(hover:hover)]:opacity-(--edge-opacity) [@media(hover:hover)]:hover:scale-[1.02]",
																),
													)}
													onDragStart={(event) => {
														event.preventDefault();
													}}
													onClick={() => {
														// Grab-drag should not change the spotlight title.
														if (shouldSuppressClick()) return;
														// Choosing a different poster after completion is an explicit pick-another.
														if (pickDone) {
															if (!isActive) handlePickAnother(film.tmdbId);
															return;
														}
														setActiveIndex(index);
													}}
												>
													<MoviePoster
														movieId={film.tmdbId}
														title={film.title}
														posterUrl={tmdbPosterUrlFromPath(
															film.posterPath,
															"w342",
														)}
														className="aspect-2/3 w-full overflow-hidden rounded-xl sm:rounded-2xl"
														frameClassName="w-full rounded-xl border-0 sm:rounded-2xl"
														linkable={false}
													/>
												</motion.button>
											);
										})}
									</AnimatePresence>
								</div>
							</div>
						) : null}
					</div>
				</div>
			</div>
		</section>
	);
}

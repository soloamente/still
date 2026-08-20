"use client";

import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";
import IconEyeSlash from "@still/ui/icons/eye-slash";
import { cn } from "@still/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import {
	AnimatePresence,
	LayoutGroup,
	motion,
	useReducedMotion,
} from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MoviePoster } from "@/components/movie/movie-poster";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import { OnboardingSearchField } from "@/components/onboarding/onboarding-form-controls";
import { OnboardingStepHeader } from "@/components/onboarding/onboarding-steps/onboarding-step-header";
import { ListingMentionPickerRow } from "@/components/review/review-body-with-mentions";
import { SenseTrackSlider } from "@/components/ui/sense-track-slider";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	ONBOARDING_CATALOGUE_CELL_CLASSNAME,
	ONBOARDING_CATALOGUE_GRID_CLASSNAME,
	ONBOARDING_CATALOGUE_TITLE_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import {
	formatLogRatingDisplay,
	logRatingToDisplay,
	logRatingToStored,
} from "@/lib/log-rating";
import { ONBOARDING_QUICK_RATE_TMDB_IDS } from "@/lib/onboarding-quick-rate-pool";
import {
	canAdvanceOnboardingTaste,
	countOnboardingTasteRated,
	isOnboardingTasteSkipped,
} from "@/lib/onboarding-taste-state";
import type { OnboardingMovie } from "@/lib/onboarding-types";
import { fetchMoviesSearch } from "@/lib/still-api-fetch";
import { stillApiOrigin } from "@/lib/still-api-origin";
import { tmdbSetupHint } from "@/lib/tmdb-config";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

const TASTE_POOL_IDS = ONBOARDING_QUICK_RATE_TMDB_IDS.slice(0, 12);

const TASTE_POOL_SKELETON_KEYS = [
	"p01",
	"p02",
	"p03",
	"p04",
	"p05",
	"p06",
	"p07",
	"p08",
	"p09",
	"p10",
	"p11",
	"p12",
] as const;

/** Centered catalogue wall — matches `/home` lobby auto-fill tracks. */
const TASTE_STEP_GRID_CLASSNAME = ONBOARDING_CATALOGUE_GRID_CLASSNAME;

/** One taste tile — poster + centered copy + compact rating slider. */
const TASTE_STEP_CELL_CLASSNAME = ONBOARDING_CATALOGUE_CELL_CLASSNAME;

const TASTE_STEP_TITLE_CLASSNAME = ONBOARDING_CATALOGUE_TITLE_CLASSNAME;
const ONBOARDING_POSTER_FRAME_CLASSNAME =
	"rounded-2xl border-0 bg-background sm:rounded-[3rem]";
/** Force canvas fill on missing art — Calm can make default card fill disappear on the preview. */
const ONBOARDING_EMPTY_ARTWORK_CLASSNAME = "bg-background";

type TasteStepActions = {
	ratings: Record<number, number>;
	skipped: ReadonlySet<number>;
	searchAdds: OnboardingMovie[];
	onRate: (movieId: number, storedRating: number) => void;
	onClearRating: (movieId: number) => void;
	onMarkSkipped: (movieId: number) => void;
	onMarkUnskipped: (movieId: number) => void;
	onAddSearchMovie: (movie: OnboardingMovie) => void;
};

type UseTasteStepDataOptions = TasteStepActions & {
	/** Skip pool/search effects when the wizard is on another step. */
	enabled?: boolean;
};

export type TasteStepModel = TasteStepActions & {
	tastePool: OnboardingMovie[];
	poolLoading: boolean;
	poolFailed: boolean;
	visibleCatalogue: OnboardingMovie[];
	hiddenPickerMovieIds: ReadonlySet<number>;
	search: string;
	setSearch: (value: string) => void;
	searchResults: OnboardingMovie[];
	searchLoading: boolean;
	tmdbHint: string | null;
	ratedCount: number;
	canAdvance: boolean;
	handleScore: (movieId: number, displayScore: number) => void;
	pickSearchFilm: (movie: OnboardingMovie) => void;
	lastAddedMovieId: number | null;
	lastAddedMovieTick: number;
};

/** Load one pool film from the API — used in parallel for faster first paint. */
async function fetchTastePoolMovie(
	id: number,
): Promise<OnboardingMovie | null> {
	try {
		/**
		 * Use a direct same-origin fetch instead of the Eden singleton.
		 * The singleton can capture `localhost` during SSR module evaluation,
		 * which breaks mobile LAN dev (`192.168.x.x`) and leaves the taste
		 * poster pool empty until a manual search fetch happens client-side.
		 */
		const response = await fetch(
			new URL(`/api/movies/${id}`, stillApiOrigin()),
			{ credentials: "include", cache: "no-store" },
		);
		if (!response.ok) return null;
		const row = (await response.json()) as {
			tmdbId?: number;
			title?: string;
			poster_url?: string | null;
			posterPath?: string | null;
		} | null;
		if (!row?.title) return null;
		return {
			id: row.tmdbId ?? id,
			title: row.title,
			// Always normalize — absolute URLs pass through; path fragments get a TMDb prefix.
			poster_url: tmdbPosterUrlFromPath(
				row.poster_url ?? row.posterPath ?? null,
				"w342",
			),
		};
	} catch {
		return null;
	}
}

/** Shared taste-step state for split desktop layout (controls left, grid right). */
export function useTasteStepData({
	enabled = true,
	ratings,
	skipped,
	searchAdds,
	onRate,
	onClearRating,
	onMarkSkipped,
	onMarkUnskipped,
	onAddSearchMovie,
}: UseTasteStepDataOptions): TasteStepModel {
	const [tastePool, setTastePool] = useState<OnboardingMovie[]>([]);
	const [poolLoading, setPoolLoading] = useState(false);
	const [poolFailed, setPoolFailed] = useState(false);
	const [search, setSearch] = useState("");
	const [searchResults, setSearchResults] = useState<OnboardingMovie[]>([]);
	const [searchLoading, setSearchLoading] = useState(false);
	const [tmdbHint, setTmdbHint] = useState<string | null>(null);
	const [searchPinnedMovieIds, setSearchPinnedMovieIds] = useState<number[]>(
		[],
	);
	const [lastAddedMovieId, setLastAddedMovieId] = useState<number | null>(null);
	const [lastAddedMovieTick, setLastAddedMovieTick] = useState(0);

	useEffect(() => {
		if (!enabled) return;
		let cancelled = false;
		setPoolLoading(true);
		(async () => {
			// Parallel fetch — sequential 12× GET was leaving the grid empty for seconds.
			const rows = await Promise.all(
				TASTE_POOL_IDS.map((id) => fetchTastePoolMovie(id)),
			);
			if (cancelled) return;
			const nextPool = rows.filter(
				(row): row is OnboardingMovie => row != null,
			);
			/**
			 * Dev/StrictMode can trigger duplicate effect passes. If a later pass
			 * temporarily returns an empty pool, keep the already loaded posters
			 * instead of replacing visible content with an empty grid.
			 */
			setTastePool((current) =>
				nextPool.length > 0 || current.length === 0 ? nextPool : current,
			);
			// Show the failure hint only when we truly have no visible pool.
			setPoolFailed(nextPool.length === 0);
			setPoolLoading(false);
		})();
		return () => {
			cancelled = true;
		};
	}, [enabled]);

	useEffect(() => {
		if (!enabled) return;
		const trimmed = search.trim();
		if (!trimmed) {
			setSearchResults([]);
			setTmdbHint(null);
			setSearchLoading(false);
			return;
		}
		const ctrl = new AbortController();
		setSearchLoading(true);
		const timer = setTimeout(async () => {
			try {
				const res = await fetchMoviesSearch(trimmed, { signal: ctrl.signal });
				if (ctrl.signal.aborted) return;
				if (res.error) {
					setSearchResults([]);
					setTmdbHint(null);
					return;
				}
				const data = res.data as { results?: OnboardingMovie[] } | null;
				setTmdbHint(tmdbSetupHint(data));
				setSearchResults((data?.results ?? []).slice(0, 8));
			} catch {
				if (!ctrl.signal.aborted) {
					setSearchResults([]);
					setTmdbHint(null);
				}
			} finally {
				if (!ctrl.signal.aborted) setSearchLoading(false);
			}
		}, 220);
		return () => {
			clearTimeout(timer);
			ctrl.abort();
			setSearchLoading(false);
		};
	}, [enabled, search]);

	const visibleCatalogue = useMemo(() => {
		const poolVisible = tastePool.filter(
			(movie) => !isOnboardingTasteSkipped(movie.id, skipped),
		);
		const poolIds = new Set(poolVisible.map((movie) => movie.id));
		const addsVisible = searchAdds.filter(
			(movie) =>
				!poolIds.has(movie.id) && !isOnboardingTasteSkipped(movie.id, skipped),
		);
		const allVisible = [...addsVisible, ...poolVisible];
		// Search-picked titles stay pinned to the top (newest first), even when
		// the title already exists in the default quick-rate pool.
		const pinnedOrder = new Map(
			searchPinnedMovieIds.map((movieId, index) => [movieId, index]),
		);
		return [...allVisible].sort((a, b) => {
			const aPinned = pinnedOrder.get(a.id);
			const bPinned = pinnedOrder.get(b.id);
			if (aPinned == null && bPinned == null) return 0;
			if (aPinned == null) return 1;
			if (bPinned == null) return -1;
			return aPinned - bPinned;
		});
	}, [searchAdds, searchPinnedMovieIds, skipped, tastePool]);

	const hiddenPickerMovieIds = useMemo(
		() => new Set(visibleCatalogue.map((movie) => movie.id)),
		[visibleCatalogue],
	);

	const ratedCount = countOnboardingTasteRated(ratings, skipped);
	const canAdvance = canAdvanceOnboardingTaste(ratings, skipped);

	function handleScore(movieId: number, displayScore: number) {
		if (displayScore <= 0) {
			onClearRating(movieId);
			return;
		}
		const stored = logRatingToStored(displayScore);
		if (stored == null) return;
		onRate(movieId, stored);
	}

	const pickSearchFilm = useCallback(
		(movie: OnboardingMovie) => {
			const inPool = tastePool.some((row) => row.id === movie.id);
			if (isOnboardingTasteSkipped(movie.id, skipped)) {
				onMarkUnskipped(movie.id);
			}
			setSearchPinnedMovieIds((current) => [
				movie.id,
				...current.filter((id) => id !== movie.id),
			]);
			// Trigger transitions-dev panel reveal for the newly added tile.
			setLastAddedMovieId(movie.id);
			setLastAddedMovieTick((current) => current + 1);
			if (!inPool) {
				onAddSearchMovie(movie);
			}
			setSearch("");
			setSearchResults([]);
			setTmdbHint(null);
		},
		[onAddSearchMovie, onMarkUnskipped, skipped, tastePool],
	);

	return {
		ratings,
		skipped,
		searchAdds,
		onRate,
		onClearRating,
		onMarkSkipped,
		onMarkUnskipped,
		onAddSearchMovie,
		tastePool,
		poolLoading,
		poolFailed,
		visibleCatalogue,
		hiddenPickerMovieIds,
		search,
		setSearch,
		searchResults,
		searchLoading,
		tmdbHint,
		ratedCount,
		canAdvance,
		handleScore,
		pickSearchFilm,
		lastAddedMovieId,
		lastAddedMovieTick,
	};
}

/** Left column — title, inline search, progress (ratings live on the right grid). */
export function TasteStepControls({ model }: { model: TasteStepModel }) {
	const {
		search,
		setSearch,
		searchResults,
		searchLoading,
		tmdbHint,
		hiddenPickerMovieIds,
		pickSearchFilm,
	} = model;

	const trimmed = search.trim();
	const pickableResults = useMemo(
		() => searchResults.filter((movie) => !hiddenPickerMovieIds.has(movie.id)),
		[hiddenPickerMovieIds, searchResults],
	);
	const searchListRef = useRef<HTMLDivElement>(null);
	const searchListKey = useMemo(
		() => pickableResults.map((movie) => movie.id).join(","),
		[pickableResults],
	);
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		searchListRef,
		trimmed.length > 0 && !searchLoading && pickableResults.length > 0,
		searchListKey,
	);

	return (
		<div className="flex flex-col gap-6">
			<OnboardingStepHeader
				description="Rate at least eight films you've seen — skip anything you haven't watched."
				title="What have you loved lately?"
			/>

			<OnboardingSearchField
				onChange={(e) => setSearch(e.target.value)}
				onClear={() => setSearch("")}
				placeholder="Search films you've seen…"
				spellCheck={false}
				value={search}
			/>

			{trimmed ? (
				searchLoading ? (
					<p className="text-muted-foreground text-sm" role="status">
						Searching…
					</p>
				) : pickableResults.length === 0 ? (
					<p className="text-muted-foreground text-sm" role="status">
						{tmdbHint ?? `No films match “${trimmed}”`}
					</p>
				) : (
					<div className="relative isolate overflow-hidden rounded-2xl bg-background">
						{/* Clip mid-row for peek; equal inset; outer overflow+radius keeps bottom corners round. */}
						<div
							ref={searchListRef}
							className="scrollbar-none max-h-64 min-h-0 overflow-y-auto p-2 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
							style={{
								WebkitOverflowScrolling: "touch",
								touchAction: "pan-y",
							}}
							role="listbox"
							aria-label="Search films"
						>
							{pickableResults.map((hit) => (
								<ListingMentionPickerRow
									key={hit.id}
									active={false}
									onSelect={() => pickSearchFilm(hit)}
									posterUrl={tmdbPosterUrlFromPath(hit.poster_url, "w92")}
									subtitle="Film"
									title={hit.title}
								/>
							))}
						</div>
						{/* Top fade once scrolled away from the first row. */}
						<div
							aria-hidden
							className={cn(
								"pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-linear-to-b from-background to-background/0 transition-opacity duration-200 motion-reduce:transition-none",
								showHeaderFade ? "opacity-100" : "opacity-0",
							)}
						/>
						{/* Bottom: denser scrim + “More results” pill — hidden-content affordance. */}
						<div
							aria-hidden
							className={cn(
								"pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center justify-end transition-opacity duration-200 motion-reduce:transition-none",
								showFooterFade ? "opacity-100" : "opacity-0",
							)}
						>
							<div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-background via-background/90 to-background/0" />
							<span className="relative mb-2 inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 font-medium text-muted-foreground text-xs">
								<ChevronDown
									className="size-3.5 shrink-0 opacity-80"
									strokeWidth={2}
									aria-hidden
								/>
								More results
							</span>
						</div>
					</div>
				)
			) : null}
		</div>
	);
}

/** Right column (desktop) or stacked below controls (mobile) — poster grids. */
export function TasteStepGridPanel({
	model,
	className,
	mobileInline = false,
}: {
	model: TasteStepModel;
	className?: string;
	mobileInline?: boolean;
}) {
	const {
		visibleCatalogue,
		poolLoading,
		poolFailed,
		ratings,
		handleScore,
		onMarkSkipped,
		lastAddedMovieId,
		lastAddedMovieTick,
	} = model;
	const reduceMotion = useReducedMotion();
	const showPoolSkeleton = poolLoading && visibleCatalogue.length === 0;
	const gridScrollRef = useRef<HTMLDivElement>(null);
	const gridScrollKey = useMemo(
		() => visibleCatalogue.map((movie) => movie.id).join(","),
		[visibleCatalogue],
	);
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		gridScrollRef,
		!mobileInline,
		gridScrollKey,
	);
	// Soften the top crop whenever the grid overflows — not only after scrolling down.
	const showTopScrim = showHeaderFade || showFooterFade;

	return (
		<div
			className={cn(
				mobileInline
					? "relative w-full"
					: "relative flex h-full min-h-0 w-full flex-col overflow-hidden",
				className,
			)}
		>
			{/* Inner shell: scrollport + scrims share the same box so fades sit on the clip edge. */}
			<div
				className={cn(
					mobileInline
						? "w-full"
						: "relative isolate min-h-0 flex-1 overflow-hidden",
				)}
			>
				<div
					ref={gridScrollRef}
					className={cn(
						mobileInline
							? "w-full"
							: "h-full min-h-0 overflow-y-auto overscroll-contain",
					)}
					data-lenis-prevent-wheel={mobileInline ? undefined : true}
				>
					<div
						className={cn(
							"flex w-full flex-col px-4 py-8 sm:px-6",
							mobileInline
								? "items-stretch justify-start"
								: // safe-center: keep short grids optically centered; overflow still scrolls from top
									"justify-safe-center min-h-full items-center",
						)}
					>
						{showPoolSkeleton ? (
							<div
								className={TASTE_STEP_GRID_CLASSNAME}
								aria-busy
								aria-live="polite"
							>
								<p className="sr-only">Loading films to rate…</p>
								{TASTE_POOL_SKELETON_KEYS.map((posterKey) => (
									<div
										key={`taste-pool-skel-${posterKey}`}
										className={TASTE_STEP_CELL_CLASSNAME}
									>
										<ShimmerBone
											className="aspect-2/3 w-full rounded-[3rem] bg-background"
											aria-hidden
										/>
										<ShimmerBone
											className="mt-2 h-4 w-4/5 rounded-lg bg-background"
											aria-hidden
										/>
										<ShimmerBone
											className="mt-3 h-10 w-full rounded-xl bg-background"
											aria-hidden
										/>
									</div>
								))}
							</div>
						) : visibleCatalogue.length === 0 && poolFailed ? (
							<p
								className="max-w-sm text-pretty text-center text-muted-foreground text-sm"
								role="status"
							>
								Couldn&apos;t load films right now. Make sure the local server
								is running, then reload onboarding.
							</p>
						) : (
							<LayoutGroup>
								<div className={TASTE_STEP_GRID_CLASSNAME}>
									<AnimatePresence initial={false} mode="popLayout">
										{visibleCatalogue.map((movie, index) =>
											(() => {
												const isLatestAdded = movie.id === lastAddedMovieId;
												const animationKey = isLatestAdded
													? `${movie.id}-${lastAddedMovieTick}`
													: String(movie.id);
												const cardContent = (
													<>
														{/* Eager load the first screenful — panel-reveal blur/opacity
													    can stall Next/Image lazy intersection until a re-render
													    (e.g. typing in search). */}
														<TasteStepPoster
															movie={movie}
															priority={index < 8}
														/>
														<p
															className={cn(
																TASTE_STEP_TITLE_CLASSNAME,
																// Reserve two text lines so slider rows align across cards.
																"min-h-11",
															)}
														>
															{movie.title}
														</p>
														<TasteRatingSlider
															movieId={movie.id}
															onMarkSkipped={() => onMarkSkipped(movie.id)}
															onScore={(score) => handleScore(movie.id, score)}
															ratings={ratings}
														/>
													</>
												);
												if (mobileInline) {
													return (
														<motion.div
															key={animationKey}
															className={cn(
																TASTE_STEP_CELL_CLASSNAME,
																"h-full",
															)}
															initial={
																isLatestAdded && !reduceMotion
																	? { opacity: 0, y: 12, filter: "blur(2px)" }
																	: false
															}
															animate={{
																opacity: 1,
																y: 0,
																filter: "blur(0px)",
															}}
															transition={{
																duration: isLatestAdded ? 0.32 : 0,
																ease: [0.22, 1, 0.36, 1],
															}}
														>
															{cardContent}
														</motion.div>
													);
												}
												return (
													<motion.div
														key={animationKey}
														layout={!reduceMotion}
														layoutId={
															reduceMotion
																? undefined
																: `taste-catalogue-${movie.id}`
														}
														className={cn(TASTE_STEP_CELL_CLASSNAME, "h-full")}
														initial={
															reduceMotion ? false : { opacity: 0, scale: 0.96 }
														}
														animate={{ opacity: 1, scale: 1 }}
														exit={
															reduceMotion
																? undefined
																: { opacity: 0, scale: 0.96 }
														}
														transition={{
															duration: isLatestAdded ? 0.28 : 0.2,
															ease: [0.25, 0.46, 0.45, 0.94],
														}}
													>
														{cardContent}
													</motion.div>
												);
											})(),
										)}
									</AnimatePresence>
								</div>
							</LayoutGroup>
						)}
					</div>
				</div>
				{/* Soft card-tone edges aligned to the scroll clip (top + bottom). */}
				{mobileInline ? null : (
					<SheetScrollScrims
						footerTone="filmography"
						headerTone="filmography"
						showFooterFade={showFooterFade}
						showHeaderFade={showTopScrim}
					/>
				)}
			</div>
		</div>
	);
}

/** Step 5 — split layout: controls in wizard column, grid in preview slot on desktop. */
export function TasteStep(props: TasteStepActions) {
	const model = useTasteStepData({ ...props, enabled: true });
	return (
		<>
			<TasteStepControls model={model} />
			<div className="mt-6 lg:hidden">
				<TasteStepGridPanel model={model} />
			</div>
		</>
	);
}

function TasteStepPoster({
	movie,
	priority = false,
}: {
	movie: OnboardingMovie;
	priority?: boolean;
}) {
	return (
		<MoviePoster
			className="w-full"
			emptyArtworkClassName={ONBOARDING_EMPTY_ARTWORK_CLASSNAME}
			frameClassName={ONBOARDING_POSTER_FRAME_CLASSNAME}
			hoverEffect="elevation"
			linkable={false}
			movieId={movie.id}
			posterUrl={movie.poster_url}
			priority={priority}
			size="md"
			title={movie.title}
		/>
	);
}

function TasteRatingSlider({
	movieId,
	ratings,
	onScore,
	onMarkSkipped,
}: {
	movieId: number;
	ratings: Record<number, number>;
	onScore: (displayScore: number) => void;
	onMarkSkipped: () => void;
}) {
	const stored = ratings[movieId];
	const displayValue = stored != null ? (logRatingToDisplay(stored) ?? 0) : 0;
	const scoreLabel =
		displayValue > 0 ? formatLogRatingDisplay(displayValue) : "Rate";

	return (
		<div className="mt-auto flex w-full flex-col items-center gap-2 pt-2">
			{/* Track only on poster cards — ± pills shrink the scrub area too much. */}
			<SenseTrackSlider
				className="w-full"
				value={displayValue}
				min={0}
				max={10}
				step={0.5}
				onChange={onScore}
				label="Your rating"
				showStepButtons={false}
				valueText={`${formatLogRatingDisplay(displayValue)} out of 10`}
				ringOffsetClassName="focus-visible:ring-offset-card"
			/>
			<p
				className={cn(
					"font-semibold text-sm tabular-nums tracking-tight",
					// Rated: solid foreground (not muted /xx — that just reads gray).
					displayValue > 0 ? "text-foreground" : "text-muted-foreground",
				)}
				aria-hidden={displayValue <= 0}
			>
				{scoreLabel}
			</p>
			<button
				className={cn(
					"inline-flex min-h-9 select-none items-center justify-center gap-1.5 rounded-full bg-background px-3.5 py-1.5 font-medium text-muted-foreground text-xs transition-[color,background-color,transform] duration-200",
					"active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100",
					DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					"[@media(hover:hover)]:hover:text-foreground",
				)}
				onClick={onMarkSkipped}
				type="button"
			>
				<IconEyeSlash className="size-[1.125rem] shrink-0" aria-hidden />
				Haven&apos;t seen
			</button>
		</div>
	);
}

"use client";

import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";
import { cn } from "@still/ui/lib/utils";
import {
	AnimatePresence,
	LayoutGroup,
	motion,
	useReducedMotion,
} from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LogRatingSlider } from "@/components/log/log-rating-slider";
import { MoviePoster } from "@/components/movie/movie-poster";
import { OnboardingFieldInput } from "@/components/onboarding/onboarding-form-controls";
import { OnboardingStepHeader } from "@/components/onboarding/onboarding-steps/onboarding-step-header";
import { ListingMentionPickerRow } from "@/components/review/review-body-with-mentions";
import {
	ONBOARDING_CATALOGUE_CELL_CLASSNAME,
	ONBOARDING_CATALOGUE_GRID_CLASSNAME,
	ONBOARDING_CATALOGUE_TITLE_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import { logRatingToDisplay, logRatingToStored } from "@/lib/log-rating";
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
			// `/api/movies/:id` returns `poster_url`; keep `posterPath` fallback
			// for any legacy/local response shapes.
			poster_url:
				row.poster_url ?? tmdbPosterUrlFromPath(row.posterPath ?? null, "w342"),
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
		ratedCount,
		canAdvance,
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

	return (
		<div className="flex flex-col gap-6">
			<OnboardingStepHeader
				description="Rate at least eight films you've seen — skip anything you haven't watched."
				meta={`${ratedCount} / 8 rated${!canAdvance ? " · keep going" : " · ready to continue"}`}
				title="What have you loved lately?"
			/>

			<OnboardingFieldInput
				onChange={(e) => setSearch(e.target.value)}
				placeholder="Search films you've seen…"
				spellCheck={false}
				type="search"
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
					<div
						className="scrollbar-none max-h-56 min-h-0 overflow-y-auto rounded-2xl bg-background p-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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

	return (
		<div
			className={cn(
				mobileInline
					? "relative w-full"
					: "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden",
				className,
			)}
		>
			<div
				className={cn(
					mobileInline
						? "w-full"
						: "data-lenis-prevent-wheel min-h-0 flex-1 overflow-y-auto overscroll-contain",
				)}
				data-lenis-prevent-wheel={mobileInline ? undefined : true}
			>
				<div
					className={cn(
						"flex w-full flex-col px-4 py-8 sm:px-6",
						mobileInline
							? "items-stretch justify-start"
							: "min-h-full items-center justify-center",
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
							Couldn&apos;t load films right now. Make sure the local server is
							running, then reload onboarding.
						</p>
					) : (
						<LayoutGroup>
							<div className={TASTE_STEP_GRID_CLASSNAME}>
								<AnimatePresence initial={false} mode="popLayout">
									{visibleCatalogue.map((movie) =>
										(() => {
											const isLatestAdded = movie.id === lastAddedMovieId;
											const animationKey = isLatestAdded
												? `${movie.id}-${lastAddedMovieTick}`
												: String(movie.id);
											const cardContent = (
												<>
													<TasteStepPoster movie={movie} />
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
														className={cn(TASTE_STEP_CELL_CLASSNAME, "h-full")}
														initial={
															isLatestAdded && !reduceMotion
																? { opacity: 0, y: 12, filter: "blur(2px)" }
																: false
														}
														animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
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

function TasteStepPoster({ movie }: { movie: OnboardingMovie }) {
	return (
		<MoviePoster
			className="w-full"
			frameClassName={ONBOARDING_POSTER_FRAME_CLASSNAME}
			hoverEffect="elevation"
			linkable={false}
			movieId={movie.id}
			posterUrl={movie.poster_url}
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

	return (
		<div className="mt-auto flex w-full flex-col items-center gap-2 pt-2">
			<LogRatingSlider
				className="w-full"
				onChange={onScore}
				value={displayValue}
				variant="compact"
			/>
			<button
				className="relative inline-flex min-h-10 min-w-10 select-none items-center justify-center px-3 text-center text-muted-foreground text-xs transition-transform active:scale-[0.96] motion-reduce:transform-none [@media(hover:hover)]:hover:text-foreground"
				onClick={onMarkSkipped}
				type="button"
			>
				Haven&apos;t seen
			</button>
		</div>
	);
}

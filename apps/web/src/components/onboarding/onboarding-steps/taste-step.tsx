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
import { api } from "@/lib/api";
import {
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
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
};

/** Load one pool film from the API — used in parallel for faster first paint. */
async function fetchTastePoolMovie(
	id: number,
): Promise<OnboardingMovie | null> {
	try {
		const res = await api.api.movies({ id: String(id) }).get();
		const row = res.data as {
			tmdbId?: number;
			title?: string;
			posterPath?: string | null;
		} | null;
		if (!row?.title) return null;
		return {
			id: row.tmdbId ?? id,
			title: row.title,
			poster_url: tmdbPosterUrlFromPath(row.posterPath ?? null, "w342"),
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
	const [search, setSearch] = useState("");
	const [searchResults, setSearchResults] = useState<OnboardingMovie[]>([]);
	const [searchLoading, setSearchLoading] = useState(false);
	const [tmdbHint, setTmdbHint] = useState<string | null>(null);

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
			setTastePool(rows.filter((row): row is OnboardingMovie => row != null));
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
		return [...poolVisible, ...addsVisible];
	}, [searchAdds, skipped, tastePool]);

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
						className="scrollbar-none max-h-56 min-h-0 overflow-y-auto overscroll-y-contain rounded-2xl bg-background p-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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
}: {
	model: TasteStepModel;
	className?: string;
}) {
	const { visibleCatalogue, poolLoading, ratings, handleScore, onMarkSkipped } =
		model;
	const reduceMotion = useReducedMotion();
	const showPoolSkeleton = poolLoading && visibleCatalogue.length === 0;

	return (
		<div
			className={cn(
				"relative flex min-h-0 w-full flex-1 flex-col overflow-hidden",
				className,
			)}
		>
			<div
				className="data-lenis-prevent-wheel min-h-0 flex-1 overflow-y-auto overscroll-contain"
				data-lenis-prevent-wheel
			>
				<div className="flex min-h-full w-full flex-col items-center justify-center px-4 py-8 sm:px-6">
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
					) : (
						<LayoutGroup>
							<div className={TASTE_STEP_GRID_CLASSNAME}>
								<AnimatePresence initial={false} mode="popLayout">
									{visibleCatalogue.map((movie) => (
										<motion.div
											key={movie.id}
											layout={!reduceMotion}
											layoutId={
												reduceMotion ? undefined : `taste-catalogue-${movie.id}`
											}
											className={TASTE_STEP_CELL_CLASSNAME}
											initial={
												reduceMotion ? false : { opacity: 0, scale: 0.96 }
											}
											animate={{ opacity: 1, scale: 1 }}
											exit={
												reduceMotion ? undefined : { opacity: 0, scale: 0.96 }
											}
											transition={{
												duration: 0.2,
												ease: [0.25, 0.46, 0.45, 0.94],
											}}
										>
											<TasteStepPoster movie={movie} />
											<p className={TASTE_STEP_TITLE_CLASSNAME}>
												{movie.title}
											</p>
											<TasteRatingSlider
												movieId={movie.id}
												onMarkSkipped={() => onMarkSkipped(movie.id)}
												onScore={(score) => handleScore(movie.id, score)}
												ratings={ratings}
											/>
										</motion.div>
									))}
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
			frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
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
		<div className="flex w-full flex-col items-center gap-2 pt-2">
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

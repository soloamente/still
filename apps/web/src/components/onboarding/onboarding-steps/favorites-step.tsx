"use client";

import { cn } from "@still/ui/lib/utils";
import {
	AnimatePresence,
	LayoutGroup,
	motion,
	useReducedMotion,
} from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MoviePoster } from "@/components/movie/movie-poster";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import { OnboardingFieldInput } from "@/components/onboarding/onboarding-form-controls";
import { OnboardingStepHeader } from "@/components/onboarding/onboarding-steps/onboarding-step-header";
import {
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	ONBOARDING_CATALOGUE_CELL_CLASSNAME,
	ONBOARDING_CATALOGUE_GRID_CLASSNAME,
	ONBOARDING_CATALOGUE_TITLE_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import type { OnboardingMovie } from "@/lib/onboarding-types";
import { fetchMoviesSearch } from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

const MAX_FAVORITES = 8;

type FavoritesStepActions = {
	favorites: OnboardingMovie[];
	onToggleFavorite: (movie: OnboardingMovie) => void;
};

type UseFavoritesStepDataOptions = FavoritesStepActions & {
	/** Skip search effects when the wizard is on another step. */
	enabled?: boolean;
};

export type FavoritesStepModel = FavoritesStepActions & {
	search: string;
	setSearch: (value: string) => void;
	results: OnboardingMovie[];
	searchLoading: boolean;
	tmdbHint: string | null;
	pickableResults: OnboardingMovie[];
	atMaxFavorites: boolean;
};

/** Debounced film search for the favorites picker grid. */
export function useFavoritesStepData({
	enabled = true,
	favorites,
	onToggleFavorite,
}: UseFavoritesStepDataOptions): FavoritesStepModel {
	const [search, setSearch] = useState("");
	const [results, setResults] = useState<OnboardingMovie[]>([]);
	const [searchLoading, setSearchLoading] = useState(false);
	const [tmdbHint, setTmdbHint] = useState<string | null>(null);

	useEffect(() => {
		if (!enabled) return;
		const trimmed = search.trim();
		if (!trimmed) {
			setResults([]);
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
					setResults([]);
					setTmdbHint(null);
					return;
				}
				const data = res.data as { results?: OnboardingMovie[] } | null;
				setTmdbHint(tmdbSetupHint(data));
				setResults((data?.results ?? []).slice(0, 12));
			} catch {
				if (!ctrl.signal.aborted) {
					setResults([]);
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

	const favoriteIds = useMemo(
		() => new Set(favorites.map((movie) => movie.id)),
		[favorites],
	);

	const pickableResults = useMemo(
		() => results.filter((movie) => !favoriteIds.has(movie.id)),
		[favoriteIds, results],
	);

	return {
		favorites,
		onToggleFavorite,
		search,
		setSearch,
		results,
		searchLoading,
		tmdbHint,
		pickableResults,
		atMaxFavorites: favorites.length >= MAX_FAVORITES,
	};
}

/** Left column — title, search, progress (grid lives in the preview slot on desktop). */
export function FavoritesStepControls({
	model,
}: {
	model: FavoritesStepModel;
}) {
	const { favorites, search, setSearch, tmdbHint } = model;

	return (
		<div className="flex flex-col gap-6">
			<OnboardingStepHeader
				description={`Pick up to ${MAX_FAVORITES} films that define your taste.`}
				meta={`${favorites.length} / ${MAX_FAVORITES} selected`}
				title="Your favorites"
			/>

			<OnboardingFieldInput
				onChange={(e) => setSearch(e.target.value)}
				placeholder="Search films…"
				spellCheck={false}
				type="search"
				value={search}
			/>
			{tmdbHint ? (
				<p className="text-muted-foreground text-sm" role="status">
					{tmdbHint}
				</p>
			) : null}
		</div>
	);
}

function FavoritesCatalogueTile({
	movie,
	selected,
	disabled,
	onToggle,
}: {
	movie: OnboardingMovie;
	selected: boolean;
	disabled: boolean;
	onToggle: () => void;
}) {
	const reduceMotion = useReducedMotion();
	const showHoverAction = selected || !disabled;
	const actionLabel = selected ? "Remove" : "Add";

	return (
		<motion.div
			layout={!reduceMotion}
			layoutId={reduceMotion ? undefined : `favorites-catalogue-${movie.id}`}
			className={ONBOARDING_CATALOGUE_CELL_CLASSNAME}
			initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
			transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
		>
			<button
				aria-label={
					selected
						? `Remove ${movie.title} from favorites`
						: `Add ${movie.title} to favorites`
				}
				className={cn(
					"group/fav-poster relative w-full min-w-0 text-left",
					showHoverAction &&
						"cursor-pointer select-none [-webkit-tap-highlight-color:transparent]",
					disabled && !selected && "cursor-not-allowed opacity-50",
				)}
				disabled={disabled && !selected}
				onClick={onToggle}
				type="button"
			>
				{/* Full-width wrapper — avoid `t-review-slide__post` (`width: fit-content`) which collapses poster tracks. */}
				<div
					className={cn(
						"w-full transition-[opacity,filter] duration-300 ease-out motion-reduce:transition-none",
						showHoverAction &&
							"[@media(hover:hover)]:group-hover/fav-poster:opacity-65 [@media(hover:hover)]:group-hover/fav-poster:blur-[var(--page-blur)] [@media(hover:hover)]:group-focus-visible/fav-poster:opacity-65 [@media(hover:hover)]:group-focus-visible/fav-poster:blur-[var(--page-blur)]",
					)}
				>
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
				</div>
				{showHoverAction ? (
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity duration-300 ease-out motion-reduce:transition-none [@media(hover:hover)]:group-hover/fav-poster:opacity-100 [@media(hover:hover)]:group-focus-visible/fav-poster:opacity-100"
					>
						<span
							className={cn(
								"rounded-full px-5 py-2.5 font-semibold text-sm tracking-tight",
								selected
									? "bg-destructive text-destructive-foreground"
									: "bg-background text-foreground",
							)}
						>
							{actionLabel}
						</span>
					</div>
				) : null}
			</button>
			<p className={ONBOARDING_CATALOGUE_TITLE_CLASSNAME}>{movie.title}</p>
		</motion.div>
	);
}

/** Right column (desktop) or stacked below controls (mobile) — catalogue picker grid. */
export function FavoritesStepGridPanel({
	model,
	className,
}: {
	model: FavoritesStepModel;
	className?: string;
}) {
	const {
		favorites,
		onToggleFavorite,
		search,
		searchLoading,
		tmdbHint,
		pickableResults,
		atMaxFavorites,
	} = model;

	const trimmed = search.trim();
	const showSearchSection = trimmed.length > 0;
	const showEmptyHint =
		favorites.length === 0 && !showSearchSection && !searchLoading;

	const scrollRef = useRef<HTMLDivElement>(null);
	const scrollContentKey = useMemo(
		() =>
			[
				favorites.map((movie) => movie.id).join(","),
				pickableResults.map((movie) => movie.id).join(","),
				searchLoading ? "1" : "0",
				trimmed,
			].join("\0"),
		[favorites, pickableResults, searchLoading, trimmed],
	);
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		true,
		scrollContentKey,
	);

	return (
		<div
			className={cn(
				"relative isolate flex min-h-0 w-full flex-1 flex-col overflow-hidden",
				className,
			)}
		>
			<div
				ref={scrollRef}
				className="data-lenis-prevent-wheel min-h-0 flex-1 overflow-y-auto overscroll-contain"
				data-lenis-prevent-wheel
			>
				<div className="flex min-h-full w-full flex-col items-center justify-center px-4 py-8 sm:px-6">
					{searchLoading && showSearchSection ? (
						<p className="text-muted-foreground text-sm" role="status">
							Searching…
						</p>
					) : null}

					{showEmptyHint ? (
						<p className="max-w-sm text-pretty text-center text-muted-foreground text-sm">
							Search for films you love — they&apos;ll show up here in a
							catalogue grid.
						</p>
					) : null}

					{favorites.length > 0 ? (
						<section aria-label="Selected favorites" className="w-full">
							<p className="mb-4 text-center font-medium text-muted-foreground text-xs uppercase tracking-wider">
								Your picks
							</p>
							<LayoutGroup>
								<div className={ONBOARDING_CATALOGUE_GRID_CLASSNAME}>
									<AnimatePresence initial={false} mode="popLayout">
										{favorites.map((movie) => (
											<FavoritesCatalogueTile
												key={movie.id}
												disabled={false}
												movie={movie}
												onToggle={() => onToggleFavorite(movie)}
												selected
											/>
										))}
									</AnimatePresence>
								</div>
							</LayoutGroup>
						</section>
					) : null}

					{showSearchSection &&
					!searchLoading &&
					pickableResults.length === 0 ? (
						<p className="mt-6 max-w-sm text-pretty text-center text-muted-foreground text-sm">
							{tmdbHint ?? `No more films match “${trimmed}”`}
						</p>
					) : null}

					{pickableResults.length > 0 ? (
						<section
							aria-label="Search results"
							className={cn("w-full", favorites.length > 0 && "mt-10")}
						>
							<p className="mb-4 text-center font-medium text-muted-foreground text-xs uppercase tracking-wider">
								Search results
							</p>
							<LayoutGroup>
								<div className={ONBOARDING_CATALOGUE_GRID_CLASSNAME}>
									<AnimatePresence initial={false} mode="popLayout">
										{pickableResults.map((movie) => (
											<FavoritesCatalogueTile
												key={movie.id}
												disabled={atMaxFavorites}
												movie={movie}
												onToggle={() => onToggleFavorite(movie)}
												selected={false}
											/>
										))}
									</AnimatePresence>
								</div>
							</LayoutGroup>
						</section>
					) : null}
				</div>
			</div>
			<SheetScrollScrims
				footerTone="filmography"
				showFooterFade={showFooterFade}
				showHeaderFade={showHeaderFade}
			/>
		</div>
	);
}

/** Step 6 — split layout: controls in wizard column, catalogue grid in preview slot. */
export function FavoritesStep(props: FavoritesStepActions) {
	const model = useFavoritesStepData({ ...props, enabled: true });
	return (
		<>
			<FavoritesStepControls model={model} />
			<div className="mt-6 w-full lg:hidden">
				<FavoritesStepGridPanel model={model} />
			</div>
		</>
	);
}

"use client";

import IconHeart from "@still/ui/icons/heart";
import { cn } from "@still/ui/lib/utils";
import {
	AnimatePresence,
	LayoutGroup,
	motion,
	useReducedMotion,
} from "motion/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { MoviePoster } from "@/components/movie/movie-poster";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import { OnboardingSearchField } from "@/components/onboarding/onboarding-form-controls";
import { OnboardingStepHeader } from "@/components/onboarding/onboarding-steps/onboarding-step-header";
import {
	ONBOARDING_CATALOGUE_CELL_CLASSNAME,
	ONBOARDING_CATALOGUE_GRID_CLASSNAME,
	ONBOARDING_CATALOGUE_TITLE_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import {
	ONBOARDING_FAVORITES_MAX,
	type OnboardingMovie,
} from "@/lib/onboarding-types";
import { fetchMoviesSearch } from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

const MAX_FAVORITES = ONBOARDING_FAVORITES_MAX;
const ONBOARDING_POSTER_FRAME_CLASSNAME =
	"rounded-2xl border-0 bg-background sm:rounded-[3rem]";
/** Force canvas fill on missing art — Calm can make default card fill disappear on the preview. */
const ONBOARDING_EMPTY_ARTWORK_CLASSNAME = "bg-background";

/** Shared catalogue motion — panel-ease from transitions.dev; spring layout with bounce 0. */
const FAVORITES_EASE = [0.22, 1, 0.36, 1] as const;
const FAVORITES_TILE_TRANSITION = {
	duration: 0.28,
	ease: FAVORITES_EASE,
};
const FAVORITES_LAYOUT_TRANSITION = {
	type: "spring" as const,
	duration: 0.35,
	bounce: 0,
};

/** Centered catalogue empty — icon mark + title + short cue (preview column). */
function FavoritesCatalogueEmptyState({
	compact = false,
}: {
	/** Mobile inline stack — shorter vertical budget. */
	compact?: boolean;
}) {
	const reduceMotion = useReducedMotion();
	const chunk = (delay: number) =>
		reduceMotion
			? undefined
			: {
					opacity: 0,
					y: 10,
					filter: "blur(4px)",
					transition: { delay, duration: 0.32, ease: FAVORITES_EASE },
				};

	return (
		<motion.div
			className={cn(
				"flex w-full flex-col items-center justify-center text-center",
				compact ? "min-h-[12rem] py-8" : "min-h-[min(100%,28rem)] flex-1 py-12",
			)}
			role="status"
			initial={reduceMotion ? false : { opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={
				reduceMotion
					? undefined
					: {
							opacity: 0,
							y: -8,
							filter: "blur(3px)",
							transition: { duration: 0.2 },
						}
			}
			transition={{ duration: 0.25, ease: FAVORITES_EASE }}
		>
			<div className="flex max-w-sm flex-col items-center gap-5">
				{/* Quiet visual anchor — raised pill on card, no decorative border. */}
				<motion.span
					className="inline-flex size-16 items-center justify-center rounded-full bg-background text-foreground"
					aria-hidden
					initial={chunk(0)}
					animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
					transition={{ duration: 0.32, ease: FAVORITES_EASE }}
				>
					<IconHeart size="28px" className="opacity-90" />
				</motion.span>
				<div className="space-y-2">
					<motion.p
						className="text-balance font-semibold text-foreground text-lg tracking-tight"
						initial={chunk(0.08)}
						animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
						transition={{ duration: 0.32, ease: FAVORITES_EASE, delay: 0.08 }}
					>
						Nothing picked yet
					</motion.p>
					<motion.p
						className="text-pretty text-muted-foreground text-sm leading-relaxed"
						initial={chunk(0.16)}
						animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
						transition={{ duration: 0.32, ease: FAVORITES_EASE, delay: 0.16 }}
					>
						Search for films you love
						<br />
						they&apos;ll land here as a catalogue grid
					</motion.p>
				</div>
			</div>
		</motion.div>
	);
}

/** Centered status / no-hit line in the preview column. */
function FavoritesCatalogueStatus({
	children,
	compact = false,
}: {
	children: ReactNode;
	compact?: boolean;
}) {
	const reduceMotion = useReducedMotion();
	return (
		<motion.p
			className={cn(
				"max-w-sm text-pretty text-center text-muted-foreground text-sm",
				!compact && "mx-auto",
			)}
			role="status"
			initial={reduceMotion ? false : { opacity: 0, y: 6 }}
			animate={{ opacity: 1, y: 0 }}
			exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
			transition={{ duration: 0.2, ease: FAVORITES_EASE }}
		>
			{children}
		</motion.p>
	);
}

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
	const { search, setSearch, tmdbHint } = model;

	return (
		<div className="flex flex-col gap-6">
			<OnboardingStepHeader
				description={`Pick up to ${MAX_FAVORITES} films that define your taste.`}
				title="Your favorites"
			/>

			<OnboardingSearchField
				onChange={(e) => setSearch(e.target.value)}
				onClear={() => setSearch("")}
				placeholder="Search films…"
				spellCheck={false}
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
	disableMotion = false,
	enterDelay = 0,
}: {
	movie: OnboardingMovie;
	selected: boolean;
	disabled: boolean;
	onToggle: () => void;
	disableMotion?: boolean;
	/** Stagger search-result enters only (capped at call site). */
	enterDelay?: number;
}) {
	const reduceMotion = useReducedMotion();
	const showHoverAction = selected || !disabled;
	const actionLabel = selected ? "Remove" : "Add";

	const tileContent = (
		<>
			<button
				aria-label={
					selected
						? `Remove ${movie.title} from favorites`
						: `Add ${movie.title} to favorites`
				}
				className={cn(
					"group/fav-poster relative w-full min-w-0 text-left",
					showHoverAction &&
						"cursor-pointer touch-pan-y select-none [-webkit-tap-highlight-color:transparent]",
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
							"[@media(hover:hover)]:group-hover/fav-poster:opacity-65 [@media(hover:hover)]:group-hover/fav-poster:blur-(--page-blur) [@media(hover:hover)]:group-focus-visible/fav-poster:opacity-65 [@media(hover:hover)]:group-focus-visible/fav-poster:blur-(--page-blur)",
					)}
				>
					<MoviePoster
						className="w-full"
						emptyArtworkClassName={ONBOARDING_EMPTY_ARTWORK_CLASSNAME}
						frameClassName={ONBOARDING_POSTER_FRAME_CLASSNAME}
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
		</>
	);

	if (disableMotion) {
		return (
			<div className={ONBOARDING_CATALOGUE_CELL_CLASSNAME}>{tileContent}</div>
		);
	}

	return (
		<motion.div
			layout={!reduceMotion}
			layoutId={reduceMotion ? undefined : `favorites-catalogue-${movie.id}`}
			className={ONBOARDING_CATALOGUE_CELL_CLASSNAME}
			initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
			animate={{ opacity: 1, scale: 1, y: 0 }}
			exit={
				reduceMotion
					? undefined
					: { opacity: 0, scale: 0.96, y: -6, transition: { duration: 0.18 } }
			}
			transition={{
				...FAVORITES_TILE_TRANSITION,
				delay: enterDelay,
				layout: FAVORITES_LAYOUT_TRANSITION,
			}}
		>
			{tileContent}
		</motion.div>
	);
}

/** Right column (desktop) or stacked below controls (mobile) — catalogue picker grid. */
export function FavoritesStepGridPanel({
	model,
	className,
	mobileInline = false,
}: {
	model: FavoritesStepModel;
	className?: string;
	mobileInline?: boolean;
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
	const disableMotion = mobileInline;
	// Soften the top crop whenever the grid overflows — not only after scrolling down.
	const showTopScrim = showHeaderFade || showFooterFade;

	return (
		<div
			className={cn(
				mobileInline
					? "relative isolate w-full"
					: "relative flex h-full min-h-0 w-full flex-col overflow-hidden",
				className,
			)}
		>
			<div
				className={cn(
					mobileInline
						? "w-full"
						: "relative isolate min-h-0 flex-1 overflow-hidden",
				)}
			>
				<div
					ref={scrollRef}
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
								? "items-stretch justify-start gap-8"
								: "justify-safe-center min-h-full items-center gap-10",
						)}
					>
						{/* One LayoutGroup so tiles morph between Your picks ↔ Search results. */}
						<LayoutGroup id="onboarding-favorites-catalogue">
							<AnimatePresence initial={false} mode="popLayout">
								{showEmptyHint ? (
									<FavoritesCatalogueEmptyState
										key="favorites-empty"
										compact={mobileInline}
									/>
								) : null}
							</AnimatePresence>

							{favorites.length > 0 ? (
								<motion.section
									aria-label="Selected favorites"
									className="w-full"
									layout={!disableMotion}
									initial={disableMotion ? false : { opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={FAVORITES_TILE_TRANSITION}
								>
									<p className="mb-3 text-center font-medium text-muted-foreground text-xs uppercase tracking-wider">
										Your picks
										<span className="ms-1.5 text-foreground/50 tabular-nums">
											{favorites.length}/{MAX_FAVORITES}
										</span>
									</p>
									<div className={ONBOARDING_CATALOGUE_GRID_CLASSNAME}>
										<AnimatePresence initial={false} mode="popLayout">
											{favorites.map((movie) => (
												<FavoritesCatalogueTile
													key={movie.id}
													disabled={false}
													disableMotion={disableMotion}
													movie={movie}
													onToggle={() => onToggleFavorite(movie)}
													selected
												/>
											))}
										</AnimatePresence>
									</div>
								</motion.section>
							) : null}

							<AnimatePresence initial={false} mode="popLayout">
								{searchLoading && showSearchSection ? (
									<FavoritesCatalogueStatus
										key="favorites-searching"
										compact={mobileInline}
									>
										Searching…
									</FavoritesCatalogueStatus>
								) : null}

								{showSearchSection &&
								!searchLoading &&
								pickableResults.length === 0 ? (
									<FavoritesCatalogueStatus
										key="favorites-no-hits"
										compact={mobileInline}
									>
										{tmdbHint ?? `No more films match “${trimmed}”`}
									</FavoritesCatalogueStatus>
								) : null}
							</AnimatePresence>

							{pickableResults.length > 0 ? (
								<motion.section
									aria-label="Search results"
									className="w-full"
									layout={!disableMotion}
									initial={disableMotion ? false : { opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={FAVORITES_TILE_TRANSITION}
								>
									<p className="mb-3 text-center font-medium text-muted-foreground text-xs uppercase tracking-wider">
										Search results
									</p>
									<div className={ONBOARDING_CATALOGUE_GRID_CLASSNAME}>
										<AnimatePresence initial={false} mode="popLayout">
											{pickableResults.map((movie, index) => (
												<FavoritesCatalogueTile
													key={movie.id}
													disabled={atMaxFavorites}
													disableMotion={disableMotion}
													movie={movie}
													onToggle={() => onToggleFavorite(movie)}
													selected={false}
													enterDelay={
														disableMotion ? 0 : Math.min(index, 8) * 0.04
													}
												/>
											))}
										</AnimatePresence>
									</div>
								</motion.section>
							) : null}
						</LayoutGroup>
					</div>
				</div>
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

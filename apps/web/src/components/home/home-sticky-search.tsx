"use client";

import { cn } from "@still/ui/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Clapperboard, Search, Tv, Users } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { MoviePoster } from "@/components/movie/movie-poster";
import { FilterChipButton } from "@/components/ui/filter-chip-row";
import { parseHomeBrowseSurface } from "@/lib/home-browse-surface";
import {
	type CatalogTextSearchListingKind,
	useCatalogTextSearch,
} from "@/lib/use-catalog-text-search";
import {
	type SearchDialogBrowseCategory,
	type SearchDialogBrowsePreviewItem,
	useSearchDialogBrowsePreview,
} from "@/lib/use-search-dialog-browse-preview";

/** Browser key for recent home-bar film searches (shared with nothing else). */
const RECENT_SEARCH_STORAGE_KEY = "still.home-search-recent";
/** Cap list length so the pill row stays scannable. */
const RECENT_SEARCH_MAX = 10;
/** First TMDb search page is 20 rows; show all so the dialog can scroll when the sheet is short. */
const SEARCH_DIALOG_MAX_RESULTS = 20;

const BROWSE_PREVIEW_HEADING: Record<SearchDialogBrowseCategory, string> = {
	movies: "Popular",
	tv: "Popular",
	community: "From the community",
};

function browseCategoryFromSurface(
	surface: ReturnType<typeof parseHomeBrowseSurface>,
): SearchDialogBrowseCategory {
	if (surface === "tv") return "tv";
	if (surface === "community") return "community";
	return "movies";
}

/** Matches lobby / filter pills: raised `bg-background` token on the dialog’s `bg-card` sheet. */
function browseNavButtonClass(active: boolean) {
	return cn(
		"flex w-full items-center gap-2.5 rounded-full px-3 py-2.5 text-left font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
		active
			? "bg-background text-foreground"
			: "text-muted-foreground [@media(hover:hover)]:hover:bg-muted/45 [@media(hover:hover)]:hover:text-foreground",
	);
}

/** Inline Films / TV toggle under the query field (same token treatment, no full-width rail). */
function searchListingKindToggleClass(active: boolean) {
	return cn(
		"flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-left font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
		active
			? "bg-background text-foreground"
			: "text-muted-foreground [@media(hover:hover)]:hover:bg-muted/45 [@media(hover:hover)]:hover:text-foreground",
	);
}

/** Target panel width floor — wider than the pill so the open state feels roomy. */
const PANEL_MIN_WIDTH_PX = 600;
/** Cap on large viewports so the sheet stays scannable (still below viewport minus gutter). */
const PANEL_MAX_WIDTH_PX = 800;
/** Edge inset when clamping the anchored panel to the viewport. */
const VIEWPORT_GUTTER_PX = 12;
/** Grow width vs the trigger pill before floor / max / viewport clamps. */
const PANEL_WIDTH_TRIGGER_MULTIPLIER = 1.48;

function readRecentSearchQueries(): string[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = window.localStorage.getItem(RECENT_SEARCH_STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((item): item is string => typeof item === "string")
			.map((s) => s.trim())
			.filter(Boolean)
			.slice(0, RECENT_SEARCH_MAX);
	} catch {
		return [];
	}
}

function persistRecentSearchQueries(next: string[]): void {
	try {
		window.localStorage.setItem(
			RECENT_SEARCH_STORAGE_KEY,
			JSON.stringify(next),
		);
	} catch {
		// Private mode / quota — ignore; in-memory pills still work until refresh.
	}
}

/**
 * Dedupes case-insensitively, promotes the latest query to the front, caps length,
 * and returns the list callers should put in React state.
 */
function recordRecentSearchQuery(trimmed: string): string[] {
	const prev = readRecentSearchQueries();
	const next = [
		trimmed,
		...prev.filter((q) => q.toLowerCase() !== trimmed.toLowerCase()),
	].slice(0, RECENT_SEARCH_MAX);
	persistRecentSearchQueries(next);
	return next;
}

/** Keeps the panel horizontally centered on `centerX` while staying inside the viewport. */
function clampPanelLeftFromCenter(centerX: number, width: number): number {
	const vw = window.innerWidth;
	const half = width / 2;
	return Math.min(
		Math.max(VIEWPORT_GUTTER_PX, centerX - half),
		vw - width - VIEWPORT_GUTTER_PX,
	);
}

/** Computes fixed `top` / `left` / `width` / `maxHeight` for the dialog panel from the trigger rect. */
function computeAnchoredPanelStyle(trigger: DOMRect): {
	top: number;
	left: number;
	width: number;
	maxHeight: number;
} {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const width = Math.min(
		Math.max(
			Math.round(trigger.width * PANEL_WIDTH_TRIGGER_MULTIPLIER),
			PANEL_MIN_WIDTH_PX,
		),
		PANEL_MAX_WIDTH_PX,
		vw - VIEWPORT_GUTTER_PX * 2,
	);
	// Grow from the pill’s **horizontal center** so width animation does not bias to the right.
	const centerX = trigger.left + trigger.width / 2;
	const left = clampPanelLeftFromCenter(centerX, width);
	// Taller sheet than before so shortcuts + recents breathe (still clamped to viewport).
	const maxHeight = Math.min(
		vh * 0.82,
		Math.max(280, vh - trigger.top - VIEWPORT_GUTTER_PX),
	);
	return { top: trigger.top, left, width, maxHeight };
}

/**
 * `/home` sticky search: clicking the pill opens a **native modal dialog**; the card
 * **animates** from the pill’s screen rect to a wider, taller panel (Framer Motion).
 */
export function HomeStickySearch() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const triggerRef = useRef<HTMLButtonElement>(null);
	const dialogRef = useRef<HTMLDialogElement>(null);
	/** When set before `beginClose`, `finalizeDialogClose` runs `router.push` after the exit animation. */
	const pendingNavigationRef = useRef<string | null>(null);
	const titleId = useId();
	const dialogId = useId();

	const [draft, setDraft] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	/** When false while `panelLayout` is set, Framer plays **exit** then we call `dialog.close()`. */
	const [panelVisible, setPanelVisible] = useState(false);
	const [recentQueries, setRecentQueries] = useState<string[]>([]);
	const [browseCategory, setBrowseCategory] =
		useState<SearchDialogBrowseCategory>("movies");
	/** While typing, chooses `/api/movies/search` vs `/api/tv/search`; synced from browse rail when the query is empty. */
	const [searchListingKind, setSearchListingKind] =
		useState<CatalogTextSearchListingKind>("movie");
	const [panelLayout, setPanelLayout] = useState<{
		top: number;
		left: number;
		width: number;
		maxHeight: number;
		/** Horizontal center of the pill at open — `left` is derived so width grows symmetrically. */
		anchorCenterX: number;
		anchorTop: number;
		anchorWidth: number;
		anchorHeight: number;
	} | null>(null);

	const reduceMotion = useReducedMotion();
	const browseSurface = parseHomeBrowseSurface(searchParams.get("browse"));

	// Re-read localStorage when the pathname changes so recents stay fresh after navigations.
	useEffect(() => {
		void pathname;
		setRecentQueries(readRecentSearchQueries());
	}, [pathname]);

	// `showModal()` does not always stop wheel / trackpad scroll from reaching `#main-content`
	// (especially over the transparent dialog chrome). Lock document scroll for the modal lifetime.
	useEffect(() => {
		if (!dialogOpen) return;
		const html = document.documentElement;
		const body = document.body;
		const prevHtmlOverflow = html.style.overflow;
		const prevBodyOverflow = body.style.overflow;
		const prevHtmlPaddingRight = html.style.paddingRight;
		const scrollbarGutter = window.innerWidth - html.clientWidth;
		html.style.overflow = "hidden";
		body.style.overflow = "hidden";
		if (scrollbarGutter > 0) {
			html.style.paddingRight = `${scrollbarGutter}px`;
		}
		return () => {
			html.style.overflow = prevHtmlOverflow;
			body.style.overflow = prevBodyOverflow;
			html.style.paddingRight = prevHtmlPaddingRight;
		};
	}, [dialogOpen]);

	const finalizeDialogClose = useCallback(() => {
		const pending = pendingNavigationRef.current;
		pendingNavigationRef.current = null;
		dialogRef.current?.close();
		setPanelLayout(null);
		setPanelVisible(false);
		setDialogOpen(false);
		setDraft("");
		if (pending) {
			router.push(pending);
		}
	}, [router]);

	const beginClose = useCallback(() => {
		if (!panelLayout || !panelVisible) return;
		setPanelVisible(false);
	}, [panelLayout, panelVisible]);

	const trimmedDraft = draft.trim();
	const {
		results: searchResults,
		loading: searchLoading,
		setupHint,
	} = useCatalogTextSearch(draft, searchListingKind);
	const dialogSearchResults = searchResults.slice(0, SEARCH_DIALOG_MAX_RESULTS);

	const submitQuery = useCallback((trimmed: string) => {
		if (!trimmed) return;
		// Enter pins the query in recents; results stay in the dialog (no `/search` route).
		setRecentQueries(recordRecentSearchQuery(trimmed));
	}, []);

	const openDialog = useCallback(() => {
		const trigger = triggerRef.current;
		const dialog = dialogRef.current;
		if (!trigger || !dialog) return;
		const r = trigger.getBoundingClientRect();
		const layout = computeAnchoredPanelStyle(r);
		pendingNavigationRef.current = null;
		// Paint the anchored panel before `showModal()` so the first frame is not empty.
		flushSync(() => {
			setBrowseCategory(browseCategoryFromSurface(browseSurface));
			// Default TV vs film search from the lobby surface; refined by browse chips while empty.
			setSearchListingKind(browseSurface === "tv" ? "tv" : "movie");
			setPanelLayout({
				...layout,
				anchorCenterX: r.left + r.width / 2,
				anchorTop: r.top,
				anchorWidth: r.width,
				anchorHeight: r.height,
			});
			setDialogOpen(true);
			setPanelVisible(true);
		});
		dialog.showModal();
		if (reduceMotion) {
			requestAnimationFrame(() => {
				dialog.querySelector<HTMLInputElement>('input[name="q"]')?.focus();
			});
		}
	}, [browseSurface, reduceMotion]);

	// After the open animation (~scale + layout), focus the query field (skip when reduced motion — focused above).
	useEffect(() => {
		if (!panelLayout || !panelVisible || reduceMotion) return;
		const dialog = dialogRef.current;
		if (!dialog) return;
		const id = window.setTimeout(() => {
			dialog.querySelector<HTMLInputElement>('input[name="q"]')?.focus();
		}, 280);
		return () => window.clearTimeout(id);
	}, [panelLayout, panelVisible, reduceMotion]);

	const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		submitQuery(trimmedDraft);
	};

	const handleRecentPick = (query: string) => {
		const trimmed = query.trim();
		if (!trimmed) return;
		setRecentQueries(recordRecentSearchQuery(trimmed));
		setDraft(trimmed);
	};

	const handleCatalogSearchPick = (id: number) => {
		if (trimmedDraft) {
			setRecentQueries(recordRecentSearchQuery(trimmedDraft));
		}
		pendingNavigationRef.current =
			searchListingKind === "tv" ? `/tv/${id}` : `/movies/${id}`;
		beginClose();
	};

	const handlePreviewPick = useCallback(
		(item: SearchDialogBrowsePreviewItem) => {
			pendingNavigationRef.current =
				item.listingKind === "tv" ? `/tv/${item.id}` : `/movies/${item.id}`;
			beginClose();
		},
		[beginClose],
	);

	/** Mobbin-style empty sheet: browse chrome only while the query field is blank. */
	const isEmptyDraft = trimmedDraft === "";

	// Empty sheet: Movies / TV browse picks imply the same catalogue for the next typed query.
	useEffect(() => {
		if (!isEmptyDraft) return;
		if (browseCategory === "community") return;
		setSearchListingKind(browseCategory === "tv" ? "tv" : "movie");
	}, [browseCategory, isEmptyDraft]);

	/** Dim + panel mount together so Framer can fade the scrim with the sheet (native `::backdrop` only clears in `close()`). */
	const showSheet = Boolean(panelLayout && panelVisible);
	const browsePreviewEnabled = showSheet && isEmptyDraft;
	const { items: browsePreviewItems, loading: browsePreviewLoading } =
		useSearchDialogBrowsePreview(browseCategory, browsePreviewEnabled);

	return (
		<>
			<motion.button
				ref={triggerRef}
				type="button"
				onClick={openDialog}
				layout={false}
				className={cn(
					"flex w-[min(100%,48rem)] min-w-0 shrink-0 cursor-pointer items-center gap-2 justify-self-center rounded-full bg-card px-5 py-3 text-left shadow-sm transition-shadow sm:w-[min(100%,36rem)] [@media(hover:hover)]:hover:shadow-md",
					"origin-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				)}
				aria-haspopup="dialog"
				aria-expanded={dialogOpen}
				aria-controls={dialogId}
				animate={
					reduceMotion
						? { scale: 1 }
						: {
								// Pill “hands off” to the sheet: slight expand while open, tuck in during exit, neutral when idle.
								scale: showSheet ? 1.05 : dialogOpen ? 0.98 : 1,
							}
				}
				transition={
					reduceMotion
						? { duration: 0 }
						: {
								type: "spring",
								stiffness: 420,
								damping: 26,
								mass: 0.55,
							}
				}
				whileTap={reduceMotion ? undefined : { scale: 0.98 }}
			>
				<Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
				<span className="min-w-0 flex-1 truncate text-base text-muted-foreground md:text-sm">
					Films, TV, people…
				</span>
			</motion.button>

			<dialog
				ref={dialogRef}
				id={dialogId}
				aria-labelledby={titleId}
				className={cn(
					"fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0",
					// Block scroll chaining to the page behind the modal (wheel / touch overscroll).
					"overscroll-none",
					// Opacity + blur live on the in-dialog `motion` scrim so they track the exit animation;
					// the native backdrop would otherwise linger until `dialog.close()` runs.
					"backdrop:bg-transparent",
				)}
				// Let Framer finish the exit animation before the modal dismisses.
				onCancel={(event) => {
					event.preventDefault();
					beginClose();
				}}
				onClose={() => {
					setDialogOpen(false);
					setPanelLayout(null);
					setPanelVisible(false);
					setDraft("");
					pendingNavigationRef.current = null;
				}}
			>
				<AnimatePresence mode="sync" onExitComplete={finalizeDialogClose}>
					{showSheet ? (
						<motion.div
							key="home-sticky-search-dim"
							aria-hidden
							className="absolute inset-0 z-0 bg-black/55 backdrop-blur-[2px]"
							initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={
								reduceMotion
									? { duration: 0 }
									: {
											duration: 0.26,
											ease: [0.165, 0.84, 0.44, 1],
										}
							}
							onMouseDown={(event) => {
								if (event.target === event.currentTarget) {
									beginClose();
								}
							}}
						/>
					) : null}
					{showSheet && panelLayout ? (
						<motion.div
							key="home-sticky-search-panel"
							className={cn(
								// `min-h-0` lets this flex column respect `maxHeight` instead of growing with
								// content (default `min-height: auto`), so the body below can `overflow-y-auto`.
								"fixed z-10 flex min-h-0 origin-top flex-col overflow-hidden rounded-4xl bg-card text-foreground shadow-xl",
							)}
							initial={
								reduceMotion
									? {
											top: panelLayout.top,
											left: panelLayout.left,
											width: panelLayout.width,
											maxHeight: panelLayout.maxHeight,
											scale: 1,
											opacity: 1,
										}
									: {
											top: panelLayout.anchorTop,
											left: clampPanelLeftFromCenter(
												panelLayout.anchorCenterX,
												panelLayout.anchorWidth,
											),
											width: panelLayout.anchorWidth,
											maxHeight: panelLayout.anchorHeight,
											scale: 0.94,
											opacity: 0.88,
										}
							}
							animate={{
								top: panelLayout.top,
								left: panelLayout.left,
								width: panelLayout.width,
								maxHeight: panelLayout.maxHeight,
								scale: 1,
								opacity: 1,
							}}
							exit={
								reduceMotion
									? { opacity: 0 }
									: {
											scale: 0.94,
											opacity: 0,
										}
							}
							transition={
								reduceMotion
									? { duration: 0 }
									: {
											duration: 0.26,
											ease: [0.165, 0.84, 0.44, 1],
										}
							}
						>
							<h2 id={titleId} className="sr-only">
								Search films and TV
							</h2>
							<form
								onSubmit={handleFormSubmit}
								className="flex shrink-0 items-center gap-2 px-4 py-3"
							>
								<label
									htmlFor="home-sticky-search-dialog-input"
									className="sr-only"
								>
									Query
								</label>
								<Search
									className="size-4 shrink-0 text-muted-foreground"
									aria-hidden
								/>
								<input
									id="home-sticky-search-dialog-input"
									type="search"
									name="q"
									value={draft}
									onChange={(e) => setDraft(e.target.value)}
									autoComplete="off"
									spellCheck={false}
									placeholder="Films, TV shows, people…"
									className="min-w-0 flex-1 border-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm"
								/>
							</form>

							{/* Films vs TV — only while searching; empty-state browse rail already implies the next query’s catalogue. */}
							{!isEmptyDraft ? (
								<fieldset className="min-w-0 shrink-0 border-0 px-4 pb-2">
									<legend className="mb-1.5 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
										Show
									</legend>
									<div className="flex flex-wrap gap-2">
										<button
											type="button"
											aria-pressed={searchListingKind === "movie"}
											className={searchListingKindToggleClass(
												searchListingKind === "movie",
											)}
											onClick={() => setSearchListingKind("movie")}
										>
											<Clapperboard
												className="size-4 shrink-0 opacity-80"
												aria-hidden
											/>
											Films
										</button>
										<button
											type="button"
											aria-pressed={searchListingKind === "tv"}
											className={searchListingKindToggleClass(
												searchListingKind === "tv",
											)}
											onClick={() => setSearchListingKind("tv")}
										>
											<Tv className="size-4 shrink-0 opacity-80" aria-hidden />
											TV shows
										</button>
									</div>
								</fieldset>
							) : null}

							<div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
								{isEmptyDraft ? (
									<div className="shrink-0 px-4 pt-1 pb-3">
										{recentQueries.length > 0 ? (
											<div
												role="toolbar"
												aria-labelledby={`${titleId}-recent-heading`}
												className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5"
											>
												{recentQueries.map((query) => (
													<FilterChipButton
														key={query}
														type="button"
														onClick={() => handleRecentPick(query)}
														title={`Search for “${query}”`}
														className="min-w-0 max-w-56 shrink-0"
													>
														<span className="truncate">{query}</span>
													</FilterChipButton>
												))}
											</div>
										) : (
											<p className="text-muted-foreground text-xs leading-relaxed">
												Your recent film searches appear here.
											</p>
										)}
									</div>
								) : null}

								{isEmptyDraft ? (
									<div className="flex min-h-0 flex-1 flex-col gap-5 px-4 pb-4 sm:flex-row sm:items-start sm:gap-8">
										{/* Left rail — category picks update the preview column. */}
										<nav
											aria-labelledby={`${titleId}-browse-heading`}
											className="flex w-full shrink-0 flex-col gap-0.5 sm:w-42"
										>
											<div
												id={`${titleId}-browse-heading`}
												className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider"
											>
												Browse
											</div>
											<button
												type="button"
												className={browseNavButtonClass(
													browseCategory === "movies",
												)}
												aria-pressed={browseCategory === "movies"}
												onClick={() => setBrowseCategory("movies")}
											>
												<Clapperboard
													className="size-4 shrink-0 opacity-80"
													aria-hidden
												/>
												Movies
											</button>
											<button
												type="button"
												className={browseNavButtonClass(
													browseCategory === "tv",
												)}
												aria-pressed={browseCategory === "tv"}
												onClick={() => setBrowseCategory("tv")}
											>
												<Tv
													className="size-4 shrink-0 opacity-80"
													aria-hidden
												/>
												TV Shows
											</button>
											<button
												type="button"
												className={browseNavButtonClass(
													browseCategory === "community",
												)}
												aria-pressed={browseCategory === "community"}
												onClick={() => setBrowseCategory("community")}
											>
												<Users
													className="size-4 shrink-0 opacity-80"
													aria-hidden
												/>
												Community
											</button>
										</nav>

										{/* Right column — four suggested posters for the active category. */}
										<div
											className="min-w-0 flex-1"
											aria-live="polite"
											aria-busy={browsePreviewLoading}
										>
											<div
												id={`${titleId}-popular-heading`}
												className="mb-2 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider"
											>
												{BROWSE_PREVIEW_HEADING[browseCategory]}
											</div>
											{browsePreviewLoading ? (
												<p className="text-muted-foreground text-xs">
													Loading suggestions…
												</p>
											) : browsePreviewItems.length > 0 ? (
												<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
													{browsePreviewItems.map((item) => (
														<button
															key={`${browseCategory}-${item.listingKind}-${item.id}`}
															type="button"
															className="min-w-0 cursor-pointer rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
															onClick={() => handlePreviewPick(item)}
														>
															<MoviePoster
																movieId={item.id}
																title={item.title}
																posterUrl={item.posterUrl}
																size="md"
																showTitle
																linkable={false}
																listingKind={item.listingKind}
																frameClassName="rounded-2xl"
															/>
														</button>
													))}
												</div>
											) : (
												<p className="text-muted-foreground text-xs leading-relaxed">
													{browseCategory === "community"
														? "Community highlights will show here when lists and reviews are available."
														: "No suggestions right now — try again in a moment."}
												</p>
											)}
										</div>
									</div>
								) : (
									<div
										className="flex min-h-0 flex-1 flex-col px-4 pb-4"
										aria-live="polite"
										aria-busy={searchLoading}
									>
										{searchLoading ? (
											<p className="shrink-0 text-muted-foreground text-xs">
												Searching…
											</p>
										) : null}
										{dialogSearchResults.length > 0 ? (
											// Scrolling is handled by the sheet body above; keep a plain grid so one
											// scroll container receives wheel / touch gestures predictably.
											<div className="mt-2 grid auto-rows-min grid-cols-3 gap-3 pb-1 sm:grid-cols-4">
												{dialogSearchResults.map((hit) => (
													<button
														key={`${searchListingKind}-${hit.id}`}
														type="button"
														className="min-w-0 cursor-pointer rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
														onClick={() => handleCatalogSearchPick(hit.id)}
													>
														<MoviePoster
															movieId={hit.id}
															title={hit.title}
															posterUrl={hit.poster_url}
															size="md"
															showTitle
															linkable={false}
															listingKind={
																searchListingKind === "tv" ? "tv" : "movie"
															}
															frameClassName="rounded-2xl"
														/>
													</button>
												))}
											</div>
										) : !searchLoading ? (
											<p className="text-muted-foreground text-xs leading-relaxed">
												{setupHint ?? (
													<>
														No{" "}
														{searchListingKind === "tv" ? "TV shows" : "films"}{" "}
														found for &ldquo;{trimmedDraft}&rdquo;.
													</>
												)}
											</p>
										) : null}
									</div>
								)}
							</div>
						</motion.div>
					) : null}
				</AnimatePresence>
			</dialog>
		</>
	);
}

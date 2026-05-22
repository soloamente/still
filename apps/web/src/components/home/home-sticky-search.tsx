"use client";

import { cn } from "@still/ui/lib/utils";
import { Clapperboard, Search, Tv, Users } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { flushSync } from "react-dom";

import { SearchDialogListResults } from "@/components/home/search-dialog-list-results";
import {
	SearchDialogBrowsePreviewSkeleton,
	SearchDialogListSkeleton,
	SearchDialogPosterSkeletonGrid,
} from "@/components/home/search-dialog-result-skeletons";
import { SearchDialogStudioRail } from "@/components/home/search-dialog-studio-rail";
import { SearchTokenField } from "@/components/home/search-token-field";
import { MoviePoster } from "@/components/movie/movie-poster";
import { FilterChipButton } from "@/components/ui/filter-chip-row";
import {
	clampCatalogSearchPanelLeftFromCenter,
	computeCatalogSearchAnchoredPanelStyle,
	useCatalogSearchDialog,
} from "@/lib/catalog-search-dialog-store";
import { parseHomeBrowseSurface } from "@/lib/home-browse-surface";
import {
	type RecentSearchEntryV2,
	readHomeSearchRecents,
	recordHomeSearchRecent,
	restoreFromHomeSearchRecent,
} from "@/lib/home-search-recent-storage";
import { findSearchDialogStudio } from "@/lib/search-dialog-studios";
import {
	deriveSearchState,
	type SearchTag,
	upsertTag,
} from "@/lib/search-query-tags";
import {
	type CatalogTextSearchListingKind,
	useCatalogTextSearch,
} from "@/lib/use-catalog-text-search";
import { useCatalogTmdbLanguage } from "@/lib/use-catalog-tmdb-language";
import { useCatalogueTagSearch } from "@/lib/use-catalogue-tag-search";
import {
	type SearchDialogBrowseCategory,
	type SearchDialogBrowsePreviewItem,
	useSearchDialogBrowsePreview,
} from "@/lib/use-search-dialog-browse-preview";
import {
	mergeSearchDialogGenres,
	useSearchDialogGenres,
} from "@/lib/use-search-dialog-genres";
import { useSearchDialogStudios } from "@/lib/use-search-dialog-studios";

/** First TMDb search page is 20 rows; show all so the dialog can scroll when the sheet is short. */
const SEARCH_DIALOG_MAX_RESULTS = 20;

/** Stable id so the sticky pill and global dialog stay associated for a11y. */
const CATALOG_SEARCH_DIALOG_ID = "still-catalog-search-dialog";

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

/**
 * Global catalog search sheet — mounted once in `AppShell`. Opens from the sticky pill,
 * bottom-nav search, or ⌘K / Ctrl+K with the same anchored grow animation.
 */
export function CatalogSearchDialogRoot() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const dialogRef = useRef<HTMLDialogElement>(null);
	const homeTriggerEl = useCatalogSearchDialog((s) => s.homeTriggerEl);
	const openRequestId = useCatalogSearchDialog((s) => s.openRequestId);
	const pendingAnchor = useCatalogSearchDialog((s) => s.pendingAnchor);
	const setShellUi = useCatalogSearchDialog((s) => s.setShellUi);
	/** When set before `beginClose`, `finalizeDialogClose` runs `router.push` after the exit animation. */
	const pendingNavigationRef = useRef<string | null>(null);
	const titleId = useId();
	const registerImperativelyOpen = useCatalogSearchDialog(
		(s) => s.registerImperativelyOpen,
	);

	/** Committed filter pills + the active typed token (free text after pills). */
	const [searchTags, setSearchTags] = useState<SearchTag[]>([]);
	const [freeText, setFreeText] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	/** When false while `panelLayout` is set, Framer plays **exit** then we call `dialog.close()`. */
	const [panelVisible, setPanelVisible] = useState(false);
	const [recentQueries, setRecentQueries] = useState<RecentSearchEntryV2[]>([]);
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
		setSearchTags([]);
		setFreeText("");
		// Return focus to the sticky pill when present so Escape / close does not strand focus.
		requestAnimationFrame(() => homeTriggerEl?.focus());
		if (pending) {
			router.push(pending);
		}
	}, [router, homeTriggerEl]);

	const beginClose = useCallback(() => {
		if (!panelLayout || !panelVisible) return;
		setPanelVisible(false);
	}, [panelLayout, panelVisible]);

	const trimmedDraft = freeText.trim();
	const tagState = deriveSearchState(searchTags);
	const hasMediaTag = searchTags.some((t) => t.kind === "media");
	const effectiveListingKind = hasMediaTag
		? tagState.listingKind
		: searchListingKind;

	const openDialogFromRect = useCallback(
		(r: DOMRect) => {
			const dialog = dialogRef.current;
			if (!dialog) return;
			const layout = computeCatalogSearchAnchoredPanelStyle(r);
			pendingNavigationRef.current = null;
			// Paint the anchored panel before `showModal()` so the first frame is not empty.
			flushSync(() => {
				setBrowseCategory(browseCategoryFromSurface(browseSurface));
				setSearchTags([]);
				setFreeText("");
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
		},
		[browseSurface, reduceMotion],
	);

	useEffect(() => {
		registerImperativelyOpen(openDialogFromRect);
		return () => registerImperativelyOpen(null);
	}, [openDialogFromRect, registerImperativelyOpen]);

	// Fallback if `requestOpen` runs before the root mounts (e.g. very early keydown).
	useEffect(() => {
		if (openRequestId === 0 || !pendingAnchor) return;
		openDialogFromRect(pendingAnchor);
	}, [openRequestId, pendingAnchor, openDialogFromRect]);

	/** Global shortcut — catalog search sheet (not the legacy cmdk palette). */
	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if (
				!(event.metaKey || event.ctrlKey) ||
				event.key.toLowerCase() !== "k"
			) {
				return;
			}
			if (event.shiftKey) return;
			event.preventDefault();
			useCatalogSearchDialog.getState().requestOpen();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

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

	const handlePreviewPick = useCallback(
		(item: SearchDialogBrowsePreviewItem) => {
			pendingNavigationRef.current =
				item.listingKind === "tv" ? `/tv/${item.id}` : `/movies/${item.id}`;
			beginClose();
		},
		[beginClose],
	);

	/** Browse chrome only when there are no pills and no active text token. */
	const isEmptyDraft = searchTags.length === 0 && trimmedDraft === "";
	const hasStudioTag = searchTags.some((t) => t.kind === "studio");

	// Empty sheet: Movies / TV browse picks imply the same catalogue for the next typed query.
	useEffect(() => {
		if (!isEmptyDraft) return;
		if (browseCategory === "community") return;
		setSearchListingKind(browseCategory === "tv" ? "tv" : "movie");
	}, [browseCategory, isEmptyDraft]);

	/** Dim + panel mount together so Framer can fade the scrim with the sheet (native `::backdrop` only clears in `close()`). */
	const showSheet = Boolean(panelLayout && panelVisible);

	useEffect(() => {
		setShellUi({ dialogOpen, showSheet });
	}, [dialogOpen, showSheet, setShellUi]);
	/** Start browse fetches as soon as layout is known so data can land during the open animation. */
	const sheetLayoutReady = Boolean(panelLayout);
	const browsePreviewEnabled = sheetLayoutReady && isEmptyDraft;
	const { items: browsePreviewItems, loading: browsePreviewLoading } =
		useSearchDialogBrowsePreview(browseCategory, null, browsePreviewEnabled);
	const { studios: browseStudios, loading: browseStudiosLoading } =
		useSearchDialogStudios(
			sheetLayoutReady &&
				((browsePreviewEnabled && browseCategory === "movies") ||
					!isEmptyDraft),
		);
	const catalogTmdbLanguage = useCatalogTmdbLanguage(
		sheetLayoutReady || dialogOpen,
	);
	const { movieGenres, tvGenres } = useSearchDialogGenres(
		sheetLayoutReady || dialogOpen,
		catalogTmdbLanguage,
	);
	const suggestionGenres = mergeSearchDialogGenres(
		effectiveListingKind,
		movieGenres,
		tvGenres,
		catalogTmdbLanguage,
	);
	const genreCuratedTagCount = searchTags.filter(
		(t) => t.kind === "genre" || t.kind === "curated",
	).length;
	const catalogueTagsActive =
		searchTags.length > 0 && tagState.resultMode !== "lists";
	const browsePreviewHeading = BROWSE_PREVIEW_HEADING[browseCategory];

	const handleStudioRailSelect = useCallback(
		(companyId: number | null) => {
			if (companyId == null) return;
			const studio = findSearchDialogStudio(browseStudios, companyId);
			if (!studio) return;
			setSearchTags((prev) =>
				upsertTag(prev, {
					kind: "studio",
					id: studio.id,
					name: studio.name,
					logoUrl: studio.logoUrl,
				}),
			);
			setSearchListingKind("movie");
		},
		[browseStudios],
	);

	const structuredSearch = useCatalogueTagSearch(
		searchTags,
		freeText,
		showSheet && searchTags.length > 0,
	);
	const {
		results: plainSearchResults,
		loading: plainSearchLoading,
		setupHint: plainSetupHint,
	} = useCatalogTextSearch(
		searchTags.length === 0 ? freeText : "",
		effectiveListingKind,
	);
	const usesStructuredSearch = structuredSearch.active;
	const searchLoading = usesStructuredSearch
		? structuredSearch.loading
		: plainSearchLoading;
	const setupHint = usesStructuredSearch
		? structuredSearch.setupHint
		: plainSetupHint;
	const dialogSearchResults = (
		usesStructuredSearch
			? structuredSearch.catalogueResults
			: plainSearchResults
	).slice(0, SEARCH_DIALOG_MAX_RESULTS);

	/** Screen reader status for active search (result count or empty state). */
	const searchResultsStatusMessage = useMemo(() => {
		if (isEmptyDraft) return "";
		if (searchLoading) return "Searching";
		if (tagState.resultMode === "lists") {
			if (structuredSearch.needsSignIn) {
				return "Sign in to search your lists";
			}
			const n = structuredSearch.listResults.length;
			if (n === 0) {
				return trimmedDraft
					? `No lists match ${trimmedDraft}`
					: "You have no lists yet";
			}
			return `${n} ${n === 1 ? "list" : "lists"} found`;
		}
		const n = dialogSearchResults.length;
		const label = effectiveListingKind === "tv" ? "TV shows" : "films";
		if (n === 0) {
			if (setupHint) return setupHint;
			return trimmedDraft
				? `No ${label} found for ${trimmedDraft}`
				: `No ${label} found`;
		}
		return `${n} ${label} found`;
	}, [
		isEmptyDraft,
		searchLoading,
		tagState.resultMode,
		structuredSearch.needsSignIn,
		structuredSearch.listResults.length,
		dialogSearchResults.length,
		effectiveListingKind,
		setupHint,
		trimmedDraft,
	]);

	const recentGenreOptions = useMemo(
		() => ({ movieGenres, tvGenres }),
		[movieGenres, tvGenres],
	);

	// Re-read localStorage when route or genre locale changes so chip labels stay current.
	useEffect(() => {
		void pathname;
		setRecentQueries(readHomeSearchRecents(browseStudios, recentGenreOptions));
	}, [pathname, browseStudios, recentGenreOptions]);

	const submitQuery = useCallback(() => {
		setRecentQueries(
			recordHomeSearchRecent(
				searchTags,
				trimmedDraft,
				browseStudios,
				recentGenreOptions,
			),
		);
	}, [searchTags, trimmedDraft, browseStudios, recentGenreOptions]);

	const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		submitQuery();
	};

	const handleRecentPick = (entry: RecentSearchEntryV2) => {
		const { tags, freeText: restoredText } = restoreFromHomeSearchRecent(
			entry,
			recentGenreOptions,
		);
		setSearchTags(tags);
		setFreeText(restoredText);
		const media = tags.find(
			(t): t is Extract<SearchTag, { kind: "media" }> => t.kind === "media",
		);
		if (media) setSearchListingKind(media.listingKind);
		setRecentQueries(
			recordHomeSearchRecent(
				tags,
				restoredText,
				browseStudios,
				recentGenreOptions,
			),
		);
	};

	const handleCatalogSearchPick = (id: number) => {
		if (trimmedDraft || searchTags.length > 0) {
			setRecentQueries(
				recordHomeSearchRecent(
					searchTags,
					trimmedDraft,
					browseStudios,
					recentGenreOptions,
				),
			);
		}
		pendingNavigationRef.current =
			effectiveListingKind === "tv" ? `/tv/${id}` : `/movies/${id}`;
		beginClose();
	};

	return (
		<dialog
			ref={dialogRef}
			id={CATALOG_SEARCH_DIALOG_ID}
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
				setSearchTags([]);
				setFreeText("");
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
							// Clip horizontal overflow while width animates; body scrolls vertically inside.
							"fixed z-10 flex min-w-0 origin-top flex-col overflow-hidden rounded-4xl bg-card text-foreground shadow-xl",
						)}
						style={{ maxHeight: panelLayout.maxHeight }}
						initial={
							reduceMotion
								? {
										top: panelLayout.top,
										left: panelLayout.left,
										width: panelLayout.width,
										scale: 1,
										opacity: 1,
									}
								: {
										top: panelLayout.anchorTop,
										left: clampCatalogSearchPanelLeftFromCenter(
											panelLayout.anchorCenterX,
											panelLayout.anchorWidth,
										),
										width: panelLayout.anchorWidth,
										scale: 0.94,
										opacity: 0.88,
									}
						}
						animate={{
							top: panelLayout.top,
							left: panelLayout.left,
							width: panelLayout.width,
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
							className="catalog-search-query flex min-w-0 shrink-0 items-center gap-2 px-4 py-3 pb-0"
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
							<SearchTokenField
								inputId="home-sticky-search-dialog-input"
								tags={searchTags}
								onTagsChange={setSearchTags}
								inputValue={freeText}
								onInputValueChange={setFreeText}
								studios={browseStudios}
								genres={suggestionGenres}
								listingKind={effectiveListingKind}
								onSubmit={submitQuery}
							/>
						</form>

						{genreCuratedTagCount >= 3 ? (
							<p className="px-4 pb-1 text-muted-foreground text-xs leading-relaxed">
								All tags must match.
							</p>
						) : null}

						{/* Films vs TV — only while searching; empty-state browse rail already implies the next query’s catalogue. */}
						{!isEmptyDraft && !hasMediaTag ? (
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

						<div className="scrollbar-none min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain">
							{isEmptyDraft && recentQueries.length > 0 ? (
								<div className="shrink-0 px-4 pt-1 pb-3">
									<h3 id={`${titleId}-recent-heading`} className="sr-only">
										Recent searches
									</h3>
									<div
										role="toolbar"
										aria-labelledby={`${titleId}-recent-heading`}
										className="scrollbar-none flex flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain pb-0.5"
									>
										{recentQueries.map((entry) => (
											<FilterChipButton
												key={entry.label}
												type="button"
												onClick={() => handleRecentPick(entry)}
												title={`Search for “${entry.label}”`}
												className="min-w-0 max-w-56 shrink-0"
											>
												<span className="truncate">{entry.label}</span>
											</FilterChipButton>
										))}
									</div>
								</div>
							) : null}

							{isEmptyDraft ? (
								<div className="flex min-w-0 max-w-full flex-col gap-5 px-4 pb-4 sm:flex-row sm:items-start sm:gap-8">
									{/* Left rail — category picks update the preview column. */}
									<nav
										aria-labelledby={`${titleId}-browse-heading`}
										className="flex w-full min-w-0 shrink-0 flex-col gap-0.5 sm:w-42"
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
											className={browseNavButtonClass(browseCategory === "tv")}
											aria-pressed={browseCategory === "tv"}
											onClick={() => setBrowseCategory("tv")}
										>
											<Tv className="size-4 shrink-0 opacity-80" aria-hidden />
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

									{/* Right column — studio logos + suggested posters. */}
									<div
										className="min-w-0 max-w-full flex-1 overflow-x-hidden"
										aria-live="polite"
										aria-busy={browsePreviewLoading || browseStudiosLoading}
									>
										{browseCategory === "movies" && !hasStudioTag ? (
											<SearchDialogStudioRail
												studios={browseStudios}
												selectedStudioId={tagState.studioId}
												onSelectStudio={handleStudioRailSelect}
												loading={browseStudiosLoading}
											/>
										) : null}
										<div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
											<div
												id={`${titleId}-popular-heading`}
												className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider"
											>
												{browsePreviewHeading}
											</div>
										</div>
										{browsePreviewLoading ? (
											<>
												<span className="sr-only">Loading suggestions</span>
												<SearchDialogBrowsePreviewSkeleton />
											</>
										) : browsePreviewItems.length > 0 ? (
											<div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
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
															titleLines={1}
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
													? "Switch to Community on the lobby to browse lists, reviews, diary, and activity."
													: "No suggestions right now — try again in a moment."}
											</p>
										)}
									</div>
								</div>
							) : tagState.resultMode === "lists" ? (
								<div
									className="flex flex-col px-4 pb-4"
									aria-live="polite"
									aria-busy={searchLoading}
								>
									{searchResultsStatusMessage ? (
										<span className="sr-only">
											{searchResultsStatusMessage}
										</span>
									) : null}
									{structuredSearch.needsSignIn ? (
										<p className="text-muted-foreground text-xs leading-relaxed">
											<Link
												href="/sign-in"
												className="font-medium text-foreground underline-offset-2 [@media(hover:hover)]:hover:underline"
												onClick={() => beginClose()}
											>
												Sign in
											</Link>{" "}
											to search your lists.
										</p>
									) : searchLoading &&
										structuredSearch.listResults.length === 0 ? (
										<SearchDialogListSkeleton />
									) : structuredSearch.listResults.length > 0 ? (
										<div className={cn(searchLoading && "opacity-55")}>
											<SearchDialogListResults
												lists={structuredSearch.listResults}
												onPick={() => beginClose()}
											/>
										</div>
									) : (
										<p className="text-muted-foreground text-xs leading-relaxed">
											{trimmedDraft
												? `No lists match “${trimmedDraft}”.`
												: "You have no lists yet."}
										</p>
									)}
								</div>
							) : (
								<div
									className="flex flex-col px-4 pb-4"
									aria-live="polite"
									aria-busy={searchLoading}
								>
									{searchResultsStatusMessage ? (
										<span className="sr-only">
											{searchResultsStatusMessage}
										</span>
									) : null}
									{searchLoading && dialogSearchResults.length === 0 ? (
										<SearchDialogPosterSkeletonGrid />
									) : null}
									{dialogSearchResults.length > 0 ? (
										// Scrolling is handled by the sheet body above; keep a plain grid so one
										// scroll container receives wheel / touch gestures predictably.
										<div
											className={cn(
												"mt-2 grid auto-rows-min grid-cols-3 gap-3 pb-1 sm:grid-cols-4",
												searchLoading && "opacity-55",
											)}
										>
											{dialogSearchResults.map((hit) => (
												<button
													key={`${effectiveListingKind}-${hit.id}`}
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
														titleLines={1}
														linkable={false}
														listingKind={
															effectiveListingKind === "tv" ? "tv" : "movie"
														}
														frameClassName="rounded-2xl"
													/>
												</button>
											))}
										</div>
									) : !searchLoading ? (
										<p className="text-muted-foreground text-xs leading-relaxed">
											{setupHint ??
												(catalogueTagsActive && !trimmedDraft ? (
													"Nothing matched all filters — try removing a tag."
												) : (
													<>
														No{" "}
														{effectiveListingKind === "tv"
															? "TV shows"
															: "films"}{" "}
														found
														{trimmedDraft ? ` for “${trimmedDraft}”` : ""}.
													</>
												))}
										</p>
									) : null}
								</div>
							)}
						</div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</dialog>
	);
}

/**
 * `/home` (and lobby) sticky pill — registers with the global dialog for anchored motion.
 */
export function HomeStickySearch() {
	const triggerRef = useRef<HTMLButtonElement>(null);
	const reduceMotion = useReducedMotion();
	const requestOpen = useCatalogSearchDialog((s) => s.requestOpen);
	const setHomeTriggerEl = useCatalogSearchDialog((s) => s.setHomeTriggerEl);
	const { dialogOpen, showSheet } = useCatalogSearchDialog((s) => s.shellUi);

	useEffect(() => {
		setHomeTriggerEl(triggerRef.current);
		return () => setHomeTriggerEl(null);
	}, [setHomeTriggerEl]);

	const handleOpen = useCallback(() => {
		const trigger = triggerRef.current;
		if (!trigger) return;
		requestOpen(trigger.getBoundingClientRect());
	}, [requestOpen]);

	return (
		<motion.button
			ref={triggerRef}
			type="button"
			onClick={handleOpen}
			layout={false}
			className={cn(
				"flex w-[min(100%,48rem)] min-w-0 shrink-0 cursor-pointer items-center gap-2 justify-self-center rounded-full bg-card px-5 py-3 text-left shadow-sm transition-shadow sm:w-[min(100%,36rem)] [@media(hover:hover)]:hover:shadow-md",
				"origin-center outline-none focus-visible:outline-none",
			)}
			aria-haspopup="dialog"
			aria-expanded={dialogOpen}
			aria-controls={CATALOG_SEARCH_DIALOG_ID}
			animate={
				reduceMotion
					? { scale: 1 }
					: {
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
	);
}

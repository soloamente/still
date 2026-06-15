"use client";

import IconCinema from "@still/ui/icons/cinema";
import IconPeople from "@still/ui/icons/people";
import IconTvShows from "@still/ui/icons/tv-shows";
import { cn } from "@still/ui/lib/utils";
import { BorderBeam } from "border-beam";
import { Search, X } from "lucide-react";
import {
	AnimatePresence,
	LayoutGroup,
	motion,
	useReducedMotion,
} from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import type { FormEvent, MouseEvent } from "react";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal, flushSync } from "react-dom";

import { SearchDialogListResults } from "@/components/home/search-dialog-list-results";
import { SearchDialogPeopleResults } from "@/components/home/search-dialog-people-results";
import { SearchDialogPeopleSuggestions } from "@/components/home/search-dialog-people-suggestions";
import { SearchDialogRecentSearches } from "@/components/home/search-dialog-recent-searches";
import {
	SearchDialogBrowsePreviewSkeleton,
	SearchDialogListSkeleton,
	SearchDialogPosterSkeletonGrid,
} from "@/components/home/search-dialog-result-skeletons";
import { SearchDialogStudioRail } from "@/components/home/search-dialog-studio-rail";
import { SearchTagPill } from "@/components/home/search-tag-pill";
import { SearchTokenField } from "@/components/home/search-token-field";
import { MoviePoster } from "@/components/movie/movie-poster";
import {
	appThemeSearchBorderBeamColor,
	DEFAULT_APP_THEME_CLASS,
	resolveAppTheme,
} from "@/lib/app-themes";
import {
	clampCatalogSearchPanelLeftFromCenter,
	computeCatalogSearchAnchoredPanelStyle,
	normalizeCatalogSearchAnchorRect,
	useCatalogSearchDialog,
} from "@/lib/catalog-search-dialog-store";
import { parseHomeBrowseSurface } from "@/lib/home-browse-surface";
import { committedCatalogueSearchNeedsTagMetadata } from "@/lib/home-catalogue-search-load-page";
import {
	buildHomeCatalogueSearchClearHref,
	buildHomeCatalogueSearchCommitHref,
	canCommitCatalogueSearch,
	formatCommittedSearchSummary,
	isHomeCatalogueSearchActive,
	parseHomeCatalogueSearchParam,
	resolveCommitBrowseFromDraft,
} from "@/lib/home-catalogue-search-param";
import { readHomeLobbyPersisted } from "@/lib/home-lobby-persist";
import {
	type RecentSearchEntryV2,
	readHomeSearchRecents,
	recordHomeSearchRecent,
	removeHomeSearchRecent,
	restoreFromHomeSearchRecent,
} from "@/lib/home-search-recent-storage";
import { normalizeProfileSearchQuery } from "@/lib/profile-search-query";
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
import { useProfileSearch } from "@/lib/use-profile-search";
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
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";
import { useSoftwareGpuRendering } from "@/lib/use-software-gpu-rendering";

/** First TMDb search page is 20 rows; show all so the dialog can scroll when the sheet is short. */
const SEARCH_DIALOG_MAX_RESULTS = 20;

/** Stable id so the sticky pill and global dialog stay associated for a11y. */
const CATALOG_SEARCH_DIALOG_ID = "still-catalog-search-dialog";

const BROWSE_PREVIEW_HEADING: Record<SearchDialogBrowseCategory, string> = {
	movies: "Popular",
	tv: "Popular",
	people: "Patrons on Sense",
};

function browseCategoryFromSurface(
	surface: ReturnType<typeof parseHomeBrowseSurface>,
): SearchDialogBrowseCategory {
	if (surface === "tv") return "tv";
	return "movies";
}

/** Empty-state Browse rail — full-width chips with a sliding active fill on `bg-card`. */
function SearchDialogBrowseCategoryNav({
	browseCategory,
	onSelectCategory,
}: {
	browseCategory: SearchDialogBrowseCategory;
	onSelectCategory: (category: SearchDialogBrowseCategory) => void;
}) {
	const reduceMotion = useReducedMotion();
	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const chipClass = (active: boolean) =>
		cn(
			"relative flex w-full items-center gap-2.5 rounded-full px-3 py-2.5 text-left font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:bg-muted/45 [@media(hover:hover)]:hover:text-foreground",
		);

	return (
		<LayoutGroup id="search-dialog-browse-category-pill-group">
			<div className="flex flex-col gap-0.5">
				<button
					type="button"
					className={chipClass(browseCategory === "movies")}
					aria-pressed={browseCategory === "movies"}
					onClick={() => onSelectCategory("movies")}
				>
					{browseCategory === "movies" ? (
						<motion.span
							layoutId="search-dialog-browse-category-pill"
							className="absolute inset-0 z-0 rounded-full bg-background"
							transition={pillTransition}
						/>
					) : null}
					<span className="relative z-10 inline-flex items-center gap-2.5">
						<IconCinema className="size-5 shrink-0 opacity-80" aria-hidden />
						Movies
					</span>
				</button>
				<button
					type="button"
					className={chipClass(browseCategory === "tv")}
					aria-pressed={browseCategory === "tv"}
					onClick={() => onSelectCategory("tv")}
				>
					{browseCategory === "tv" ? (
						<motion.span
							layoutId="search-dialog-browse-category-pill"
							className="absolute inset-0 z-0 rounded-full bg-background"
							transition={pillTransition}
						/>
					) : null}
					<span className="relative z-10 inline-flex items-center gap-2.5">
						<IconTvShows className="size-5 shrink-0 opacity-80" aria-hidden />
						TV Shows
					</span>
				</button>
				<button
					type="button"
					className={chipClass(browseCategory === "people")}
					aria-pressed={browseCategory === "people"}
					onClick={() => onSelectCategory("people")}
				>
					{browseCategory === "people" ? (
						<motion.span
							layoutId="search-dialog-browse-category-pill"
							className="absolute inset-0 z-0 rounded-full bg-background"
							transition={pillTransition}
						/>
					) : null}
					<span className="relative z-10 inline-flex items-center gap-2.5">
						<IconPeople className="size-5 shrink-0 opacity-80" aria-hidden />
						People
					</span>
				</button>
			</div>
		</LayoutGroup>
	);
}

/**
 * Films · TV under the query field — loose chips with a sliding active fill only.
 */
function SearchDialogListingKindChips({
	searchListingKind,
	onSelectMovie,
	onSelectTv,
}: {
	searchListingKind: "movie" | "tv";
	onSelectMovie: () => void;
	onSelectTv: () => void;
}) {
	const reduceMotion = useReducedMotion();
	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const chipClass = (active: boolean) =>
		cn(
			"relative inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-left font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:bg-muted/45 [@media(hover:hover)]:hover:text-foreground",
		);

	return (
		<LayoutGroup id="search-dialog-listing-kind-pill-group">
			<div className="flex flex-wrap gap-2" role="toolbar" aria-label="Show">
				<button
					type="button"
					aria-pressed={searchListingKind === "movie"}
					className={chipClass(searchListingKind === "movie")}
					onClick={onSelectMovie}
				>
					{searchListingKind === "movie" ? (
						<motion.span
							layoutId="search-dialog-listing-kind-pill"
							className="absolute inset-0 z-0 rounded-full bg-background"
							transition={pillTransition}
						/>
					) : null}
					<span className="relative z-10 inline-flex items-center gap-2">
						<IconCinema className="size-5 shrink-0 opacity-80" aria-hidden />
						Films
					</span>
				</button>
				<button
					type="button"
					aria-pressed={searchListingKind === "tv"}
					className={chipClass(searchListingKind === "tv")}
					onClick={onSelectTv}
				>
					{searchListingKind === "tv" ? (
						<motion.span
							layoutId="search-dialog-listing-kind-pill"
							className="absolute inset-0 z-0 rounded-full bg-background"
							transition={pillTransition}
						/>
					) : null}
					<span className="relative z-10 inline-flex items-center gap-2">
						<IconTvShows className="size-5 shrink-0 opacity-80" aria-hidden />
						TV shows
					</span>
				</button>
			</div>
		</LayoutGroup>
	);
}

/** Top + bottom scrims on the dialog body scrollport — hides hard clip on `bg-card`. */
function SearchDialogBodyScrims({
	showHeaderFade,
	showFooterFade,
}: {
	showHeaderFade: boolean;
	showFooterFade: boolean;
}) {
	return (
		<>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-linear-to-b from-25% from-card via-card/85 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
					showHeaderFade ? "opacity-100" : "opacity-0",
				)}
			/>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-linear-to-t from-15% from-card/95 via-card/25 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
					showFooterFade ? "opacity-100" : "opacity-0",
				)}
			/>
		</>
	);
}

/**
 * Global catalog search sheet — mounted once in `AppShell`. Opens from the sticky pill,
 * bottom-nav search, or ⌘K / Ctrl+K with the same anchored grow animation.
 */
export type CatalogSearchViewer = {
	id: string;
	handle: string;
};

export function CatalogSearchDialogRoot({
	viewer = null,
}: {
	viewer?: CatalogSearchViewer | null;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const dialogRef = useRef<HTMLDialogElement>(null);
	const searchBodyScrollRef = useRef<HTMLDivElement>(null);
	const homeTriggerEl = useCatalogSearchDialog((s) => s.homeTriggerEl);
	const navSearchTriggerEl = useCatalogSearchDialog(
		(s) => s.navSearchTriggerEl,
	);
	const openRequestId = useCatalogSearchDialog((s) => s.openRequestId);
	const pendingAnchor = useCatalogSearchDialog((s) => s.pendingAnchor);
	const setShellUi = useCatalogSearchDialog((s) => s.setShellUi);
	/** When set before `beginClose`, `finalizeDialogClose` runs `router.push` after the exit animation. */
	const pendingNavigationRef = useRef<string | null>(null);
	/** One-shot: hydrate dialog draft from `?search=` when opening on `/home` Movies/TV. */
	const hydrateFromUrlOnOpenRef = useRef(false);
	const titleId = useId();
	const registerImperativelyOpen = useCatalogSearchDialog(
		(s) => s.registerImperativelyOpen,
	);
	const registerImperativelyClose = useCatalogSearchDialog(
		(s) => s.registerImperativelyClose,
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
	const [portalReady, setPortalReady] = useState(false);

	const reduceMotion = useReducedMotion();
	const softwareGpu = useSoftwareGpuRendering();
	const browseSurface = parseHomeBrowseSurface(searchParams.get("browse"));

	useEffect(() => {
		setPortalReady(true);
	}, []);

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
		hydrateFromUrlOnOpenRef.current = false;
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
			const anchor = normalizeCatalogSearchAnchorRect(r);
			const layout = computeCatalogSearchAnchoredPanelStyle(anchor);
			pendingNavigationRef.current = null;
			const committedSearchRaw = searchParams.get("search")?.trim() ?? "";
			const catalogueBrowse = browseSurface === "tv" ? "tv" : "movies";
			const hydrateFromUrl =
				Boolean(committedSearchRaw) &&
				isHomeCatalogueSearchActive(searchParams, catalogueBrowse);
			hydrateFromUrlOnOpenRef.current = hydrateFromUrl;
			// Paint the anchored panel before `showModal()` so the first frame is not empty.
			flushSync(() => {
				setBrowseCategory(browseCategoryFromSurface(browseSurface));
				if (!hydrateFromUrl) {
					setSearchTags([]);
					setFreeText("");
				}
				setSearchListingKind(browseSurface === "tv" ? "tv" : "movie");
				setPanelLayout({
					...layout,
					anchorCenterX: anchor.left + anchor.width / 2,
					anchorTop: anchor.top,
					anchorWidth: anchor.width,
					anchorHeight: anchor.height,
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
		[browseSurface, reduceMotion, searchParams],
	);

	useEffect(() => {
		registerImperativelyOpen(openDialogFromRect);
		return () => registerImperativelyOpen(null);
	}, [openDialogFromRect, registerImperativelyOpen]);

	useEffect(() => {
		registerImperativelyClose(beginClose);
		return () => registerImperativelyClose(null);
	}, [beginClose, registerImperativelyClose]);

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

	const handleProfileSelect = useCallback(
		(handle: string) => {
			pendingNavigationRef.current = `/profile/${encodeURIComponent(handle)}`;
			beginClose();
		},
		[beginClose],
	);

	/** Browse chrome only when there are no pills and no active text token. */
	const isEmptyDraft = searchTags.length === 0 && trimmedDraft === "";
	const hasStudioTag = searchTags.some((t) => t.kind === "studio");
	/** Dim + panel mount together so Framer can fade the scrim with the sheet (native `::backdrop` only clears in `close()`). */
	const showSheet = Boolean(panelLayout && panelVisible);
	const sheetLayoutReady = Boolean(panelLayout);
	const browsePreviewEnabled =
		sheetLayoutReady && isEmptyDraft && browseCategory !== "people";
	const peopleBrowseEnabled =
		sheetLayoutReady && isEmptyDraft && browseCategory === "people";
	const committedLobbySearchRaw = searchParams.get("search")?.trim() ?? "";
	const committedLobbyBrowse = browseSurface === "tv" ? "tv" : "movies";
	const committedLobbySearchActive =
		Boolean(committedLobbySearchRaw) &&
		browseSurface !== "community" &&
		isHomeCatalogueSearchActive(searchParams, committedLobbyBrowse);
	const { items: browsePreviewItems, loading: browsePreviewLoading } =
		useSearchDialogBrowsePreview(browseCategory, null, browsePreviewEnabled);
	const {
		studios: browseStudios,
		loading: browseStudiosLoading,
		loaded: browseStudiosLoaded,
	} = useSearchDialogStudios(
		dialogOpen &&
			(committedLobbySearchActive ||
				(sheetLayoutReady &&
					((browsePreviewEnabled &&
						(browseCategory === "movies" || browseCategory === "tv")) ||
						!isEmptyDraft))),
	);
	const catalogTmdbLanguage = useCatalogTmdbLanguage(
		sheetLayoutReady || dialogOpen,
	);
	const {
		movieGenres,
		tvGenres,
		loading: genresLoading,
	} = useSearchDialogGenres(
		sheetLayoutReady || dialogOpen,
		catalogTmdbLanguage,
	);

	// Empty sheet: Movies / TV browse picks imply the same catalogue for the next typed query.
	useEffect(() => {
		if (!isEmptyDraft) return;
		if (browseCategory === "people") return;
		setSearchListingKind(browseCategory === "tv" ? "tv" : "movie");
	}, [browseCategory, isEmptyDraft]);

	// Keep the anchored sheet aligned with the sticky pill (and clamped to the viewport) on resize / header reflow.
	useEffect(() => {
		if (!showSheet) return;
		const trigger = homeTriggerEl ?? navSearchTriggerEl;
		if (!trigger) return;

		const syncPanelLayoutFromTrigger = () => {
			const rect = normalizeCatalogSearchAnchorRect(
				trigger.getBoundingClientRect(),
			);
			if (rect.width <= 0 || rect.height <= 0) return;
			const layout = computeCatalogSearchAnchoredPanelStyle(rect);
			setPanelLayout((prev) =>
				prev
					? {
							...prev,
							...layout,
							anchorCenterX: rect.left + rect.width / 2,
							anchorTop: rect.top,
							anchorWidth: rect.width,
							anchorHeight: rect.height,
						}
					: null,
			);
		};

		const resizeObserver = new ResizeObserver(() => {
			syncPanelLayoutFromTrigger();
		});
		resizeObserver.observe(trigger);
		window.addEventListener("resize", syncPanelLayoutFromTrigger, {
			passive: true,
		});
		return () => {
			resizeObserver.disconnect();
			window.removeEventListener("resize", syncPanelLayoutFromTrigger);
		};
	}, [showSheet, homeTriggerEl, navSearchTriggerEl]);

	useEffect(() => {
		setShellUi({ dialogOpen, showSheet });
	}, [dialogOpen, showSheet, setShellUi]);

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
			if (companyId == null) {
				setSearchTags((prev) => prev.filter((tag) => tag.kind !== "studio"));
				return;
			}
			const studio = findSearchDialogStudio(browseStudios, companyId);
			if (!studio) return;
			const listingKind =
				browseCategory === "tv" ? ("tv" as const) : ("movie" as const);
			setSearchTags((prev) =>
				upsertTag(
					upsertTag(prev, {
						kind: "studio",
						id: studio.id,
						name: studio.name,
						logoUrl: studio.logoUrl,
					}),
					{ kind: "media", listingKind },
				),
			);
			setSearchListingKind(listingKind);
		},
		[browseCategory, browseStudios],
	);

	const structuredSearch = useCatalogueTagSearch(
		searchTags,
		freeText,
		showSheet && searchTags.length > 0,
		effectiveListingKind,
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

	const profileSearchQuery = normalizeProfileSearchQuery(trimmedDraft);
	const peopleSearchEnabled =
		Boolean(viewer) && profileSearchQuery.length >= 1 && showSheet;
	const { hits: profileSearchHits, loading: profileSearchLoading } =
		useProfileSearch(trimmedDraft, peopleSearchEnabled);
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

	const searchBodyScrollContentKey = useMemo(
		() =>
			[
				isEmptyDraft ? "browse" : "search",
				browseCategory,
				tagState.resultMode,
				dialogSearchResults.length,
				structuredSearch.listResults.length,
				profileSearchHits.length,
				searchLoading ? "loading" : "idle",
				recentQueries.length,
				browsePreviewItems.length,
			].join("\0"),
		[
			isEmptyDraft,
			browseCategory,
			tagState.resultMode,
			dialogSearchResults.length,
			structuredSearch.listResults.length,
			profileSearchHits.length,
			searchLoading,
			recentQueries.length,
			browsePreviewItems.length,
		],
	);
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		searchBodyScrollRef,
		showSheet,
		searchBodyScrollContentKey,
	);

	// Re-read localStorage when route or genre locale changes so chip labels stay current.
	useEffect(() => {
		void pathname;
		setRecentQueries(readHomeSearchRecents(browseStudios, recentGenreOptions));
	}, [pathname, browseStudios, recentGenreOptions]);

	// Reopen ⌘K on `/home` with committed `?search=` — restore pills + free text from URL.
	useEffect(() => {
		if (!dialogOpen || !hydrateFromUrlOnOpenRef.current) return;
		const raw = searchParams.get("search")?.trim();
		if (!raw) {
			hydrateFromUrlOnOpenRef.current = false;
			return;
		}
		const catalogueBrowse = browseSurface === "tv" ? "tv" : "movies";
		if (
			browseSurface === "community" ||
			!isHomeCatalogueSearchActive(searchParams, catalogueBrowse)
		) {
			hydrateFromUrlOnOpenRef.current = false;
			return;
		}
		if (browseStudiosLoading || genresLoading) return;
		if (
			committedCatalogueSearchNeedsTagMetadata(raw) &&
			committedLobbySearchActive &&
			!browseStudiosLoaded
		) {
			return;
		}

		const { tags, freeText: restoredText } = parseHomeCatalogueSearchParam(
			raw,
			browseStudios,
			{ movieGenres, tvGenres },
		);
		setSearchTags(tags);
		setFreeText(restoredText);
		const media = tags.find(
			(t): t is Extract<SearchTag, { kind: "media" }> => t.kind === "media",
		);
		if (media) {
			setSearchListingKind(media.listingKind);
			setBrowseCategory(media.listingKind === "tv" ? "tv" : "movies");
		} else if (tags.some((t) => t.kind === "curated" && t.slug === "anime")) {
			setSearchListingKind("tv");
			setBrowseCategory("tv");
		} else {
			setSearchListingKind(browseSurface === "tv" ? "tv" : "movie");
		}
		hydrateFromUrlOnOpenRef.current = false;
	}, [
		browseSurface,
		browseStudios,
		browseStudiosLoaded,
		browseStudiosLoading,
		committedLobbySearchActive,
		dialogOpen,
		genresLoading,
		movieGenres,
		searchParams,
		tvGenres,
	]);

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

	/** Enter on catalogue drafts — commit to `/home?search=` or record recents only. */
	const commitOrSubmitDraft = useCallback(() => {
		if (canCommitCatalogueSearch(searchTags, trimmedDraft)) {
			submitQuery();
			const targetBrowse = resolveCommitBrowseFromDraft(
				searchTags,
				effectiveListingKind,
			);
			const href = buildHomeCatalogueSearchCommitHref({
				browse: targetBrowse,
				tags: searchTags,
				freeText: trimmedDraft,
				currentParams: new URLSearchParams(searchParams.toString()),
			});
			const onHome = pathname === "/home" || pathname.endsWith("/home");
			const currentTmdbBrowse =
				browseSurface === "tv"
					? "tv"
					: browseSurface === "movies"
						? "movies"
						: null;
			const needsBrowseFix =
				onHome &&
				(browseSurface === "community" ||
					(currentTmdbBrowse != null && targetBrowse !== currentTmdbBrowse));

			if (!onHome || needsBrowseFix) {
				router.push(href);
			} else {
				router.replace(href, { scroll: false });
			}
			beginClose();
			return;
		}
		submitQuery();
	}, [
		beginClose,
		browseSurface,
		effectiveListingKind,
		pathname,
		router,
		searchParams,
		searchTags,
		submitQuery,
		trimmedDraft,
	]);

	const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		commitOrSubmitDraft();
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

	const handleRecentRemove = (entry: RecentSearchEntryV2) => {
		setRecentQueries(
			removeHomeSearchRecent(entry.label, browseStudios, recentGenreOptions),
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

	const catalogSearchDialog = (
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
				hydrateFromUrlOnOpenRef.current = false;
				pendingNavigationRef.current = null;
			}}
		>
			<AnimatePresence mode="sync" onExitComplete={finalizeDialogClose}>
				{showSheet ? (
					<motion.div
						key="home-sticky-search-dim"
						aria-hidden
						className={cn(
							"absolute inset-0 z-0",
							softwareGpu ? "bg-black/70" : "bg-black/55 backdrop-blur-[2px]",
						)}
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
							// Panel is absolute inside a viewport-fixed dialog (portaled to body).
							"absolute z-10 flex min-w-0 origin-top flex-col overflow-hidden rounded-4xl bg-card text-foreground shadow-xl",
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
							Search films, TV, and people
						</h2>
						<form
							onSubmit={handleFormSubmit}
							className="catalog-search-query flex min-w-0 shrink-0 items-center gap-2 px-4 py-2 pb-0"
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
								onSubmit={commitOrSubmitDraft}
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
								<legend className="sr-only">Show</legend>
								<SearchDialogListingKindChips
									searchListingKind={searchListingKind}
									onSelectMovie={() => setSearchListingKind("movie")}
									onSelectTv={() => setSearchListingKind("tv")}
								/>
							</fieldset>
						) : null}

						<div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
							<SearchDialogBodyScrims
								showHeaderFade={showHeaderFade}
								showFooterFade={showFooterFade}
							/>
							<div
								ref={searchBodyScrollRef}
								data-lenis-prevent-wheel
								className="scrollbar-none contain-[paint] min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch]"
							>
								{!isEmptyDraft && viewer ? (
									<SearchDialogPeopleResults
										hits={profileSearchHits}
										loading={profileSearchLoading}
										onSelect={handleProfileSelect}
									/>
								) : null}

								{isEmptyDraft && recentQueries.length > 0 ? (
									<SearchDialogRecentSearches
										entries={recentQueries}
										headingId={`${titleId}-recent-heading`}
										onPick={handleRecentPick}
										onRemove={handleRecentRemove}
									/>
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
											<SearchDialogBrowseCategoryNav
												browseCategory={browseCategory}
												onSelectCategory={setBrowseCategory}
											/>
										</nav>

										{/* Right column — studio logos, suggested posters, or patrons. */}
										<div
											className="min-w-0 max-w-full flex-1"
											aria-live="polite"
											aria-busy={
												browseCategory === "people"
													? false
													: browsePreviewLoading || browseStudiosLoading
											}
										>
											{browseCategory === "people" ? (
												<>
													<div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
														<div
															id={`${titleId}-people-heading`}
															className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider"
														>
															{browsePreviewHeading}
														</div>
													</div>
													{viewer ? (
														<SearchDialogPeopleSuggestions
															enabled={peopleBrowseEnabled}
															onSelect={handleProfileSelect}
															showEmptyState
														/>
													) : (
														<p className="text-muted-foreground text-xs leading-relaxed">
															<Link
																href="/sign-in"
																className="font-medium text-foreground underline-offset-2 [@media(hover:hover)]:hover:underline"
																onClick={() => beginClose()}
															>
																Sign in
															</Link>{" "}
															to see suggested patrons.
														</p>
													)}
												</>
											) : (
												<>
													{(browseCategory === "movies" ||
														browseCategory === "tv") &&
													!hasStudioTag ? (
														<SearchDialogStudioRail
															studios={browseStudios}
															selectedStudioId={tagState.studioId}
															onSelectStudio={handleStudioRailSelect}
															loading={browseStudiosLoading}
															listingKind={
																browseCategory === "tv" ? "tv" : "movie"
															}
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
															<span className="sr-only">
																Loading suggestions
															</span>
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
															No suggestions right now — try again in a moment.
														</p>
													)}
												</>
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
						</div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</dialog>
	);

	// Portal keeps `position: fixed` relative to the viewport (not a scrolled app ancestor).
	if (!portalReady) return null;
	return createPortal(catalogSearchDialog, document.body);
}

/**
 * `/home` (and lobby) sticky pill — registers with the global dialog for anchored motion.
 */
export function HomeStickySearch() {
	const router = useRouter();
	const pathname = usePathname() ?? "";
	const searchParams = useSearchParams();
	const triggerRef = useRef<HTMLDivElement>(null);
	const reduceMotion = useReducedMotion();
	const { theme, resolvedTheme } = useTheme();
	const [themeReady, setThemeReady] = useState(false);
	const requestOpen = useCatalogSearchDialog((s) => s.requestOpen);
	const setHomeTriggerEl = useCatalogSearchDialog((s) => s.setHomeTriggerEl);
	const { dialogOpen, showSheet } = useCatalogSearchDialog((s) => s.shellUi);

	const onHome = pathname === "/home" || pathname.endsWith("/home");
	const browse = parseHomeBrowseSurface(searchParams.get("browse"));
	const catalogueBrowse = browse === "tv" ? "tv" : "movies";
	const searchRaw = searchParams.get("search")?.trim() ?? "";
	const committedSearchActive =
		onHome && isHomeCatalogueSearchActive(searchParams, catalogueBrowse);

	const needsSummaryMetadata = committedSearchActive;

	const { studios, loading: studiosLoading } =
		useSearchDialogStudios(needsSummaryMetadata);
	const catalogTmdbLanguage = useCatalogTmdbLanguage(needsSummaryMetadata);
	const {
		movieGenres,
		tvGenres,
		loading: genresLoading,
	} = useSearchDialogGenres(needsSummaryMetadata, catalogTmdbLanguage);

	const committedSearchDisplay = useMemo(() => {
		if (!committedSearchActive || !searchRaw) return null;
		if (studiosLoading || genresLoading) {
			return {
				tags: [] as SearchTag[],
				freeText: formatCommittedSearchSummary([], searchRaw) || searchRaw,
				loading: true,
			};
		}
		return {
			...parseHomeCatalogueSearchParam(searchRaw, studios, {
				movieGenres,
				tvGenres,
			}),
			loading: false,
		};
	}, [
		committedSearchActive,
		genresLoading,
		movieGenres,
		searchRaw,
		studios,
		studiosLoading,
		tvGenres,
	]);

	// `next-themes` resolves from localStorage after hydration — keep BorderBeam colors
	// on the SSR default until then so inline `<style>` tags match server markup.
	useEffect(() => {
		setThemeReady(true);
	}, []);

	const borderBeamColorVariant = appThemeSearchBorderBeamColor(
		themeReady && theme !== undefined
			? resolveAppTheme(resolvedTheme ?? theme)
			: DEFAULT_APP_THEME_CLASS,
	);

	useEffect(() => {
		setHomeTriggerEl(triggerRef.current);
		return () => setHomeTriggerEl(null);
	}, [setHomeTriggerEl]);

	const handleOpen = useCallback(() => {
		const trigger = triggerRef.current;
		if (!trigger) return;
		requestOpen(trigger.getBoundingClientRect());
	}, [requestOpen]);

	const handleClearSearch = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			event.preventDefault();
			event.stopPropagation();
			const persisted = readHomeLobbyPersisted();
			router.replace(
				buildHomeCatalogueSearchClearHref(catalogueBrowse, persisted),
			);
		},
		[router, catalogueBrowse],
	);

	return (
		/* Animated border trace on the catalog search pill (border-beam). */
		<BorderBeam
			size="line"
			theme="auto"
			colorVariant={borderBeamColorVariant}
			borderRadius={9999}
			active={!reduceMotion}
			strength={2.4}
			className="w-full min-w-0 max-w-full"
		>
			<motion.div
				ref={triggerRef}
				layout={false}
				className={cn(
					// Keep the original single-row shell (`px-5 py-3`) — nested buttons must not add min-height.
					"flex w-full min-w-0 items-center rounded-full bg-card py-3 pl-5",
					committedSearchActive ? "gap-1 pr-3" : "gap-2 pr-5",
				)}
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
			>
				<button
					type="button"
					onClick={handleOpen}
					className={cn(
						"flex min-h-0 min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left",
						"origin-center outline-none focus-visible:outline-none",
					)}
					aria-haspopup="dialog"
					aria-expanded={dialogOpen}
					aria-controls={CATALOG_SEARCH_DIALOG_ID}
				>
					<Search
						className="size-4 shrink-0 text-muted-foreground"
						aria-hidden
					/>
					{committedSearchDisplay ? (
						<span className="flex min-h-0 min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden">
							{committedSearchDisplay.tags.map((tag) => (
								<SearchTagPill
									key={
										tag.kind === "studio"
											? `studio-${tag.id}`
											: tag.kind === "genre"
												? `genre-${tag.listingKind}-${tag.id}`
												: tag.kind === "curated"
													? `curated-${tag.slug}`
													: tag.kind === "media"
														? `media-${tag.listingKind}`
														: "lists"
									}
									tag={tag}
									variant="display"
									density="compact"
								/>
							))}
							{committedSearchDisplay.freeText ? (
								<span
									className={cn(
										"min-w-0 truncate text-base leading-none md:text-sm",
										committedSearchDisplay.loading ||
											committedSearchDisplay.tags.length === 0
											? "font-medium text-foreground"
											: "text-foreground/90",
									)}
								>
									{committedSearchDisplay.freeText}
								</span>
							) : null}
						</span>
					) : (
						<span className="min-w-0 flex-1 truncate text-base text-muted-foreground md:text-sm">
							Films, TV, @people, lists…
						</span>
					)}
				</button>
				{committedSearchActive ? (
					<button
						type="button"
						aria-label="Clear search"
						className={cn(
							// Compact icon control — avoid `size-9` which stretched the pill taller than `py-3`.
							"relative inline-flex shrink-0 rounded-full p-1 text-muted-foreground",
							"[@media(hover:hover)]:hover:bg-background [@media(hover:hover)]:hover:text-foreground",
						)}
						onMouseDown={(event) => event.stopPropagation()}
						onClick={handleClearSearch}
					>
						<X className="size-4" aria-hidden />
					</button>
				) : null}
			</motion.div>
		</BorderBeam>
	);
}

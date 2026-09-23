"use client";

import { cn } from "@still/ui/lib/utils";
import { BorderBeam } from "border-beam";
import { Search, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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

import { SearchDialogCastCrewResults } from "@/components/home/search-dialog-cast-crew-results";
import { SearchDialogFooter } from "@/components/home/search-dialog-footer";
import { SearchDialogGenreRail } from "@/components/home/search-dialog-genre-rail";
import { SearchDialogListResults } from "@/components/home/search-dialog-list-results";
import { SearchDialogMediaChip } from "@/components/home/search-dialog-media-chip";
import { SearchDialogPeopleRail } from "@/components/home/search-dialog-people-rail";
import { SearchDialogPosterGrid } from "@/components/home/search-dialog-poster-grid";
import { SearchDialogPosterRail } from "@/components/home/search-dialog-poster-rail";
import { SearchDialogRecentSearches } from "@/components/home/search-dialog-recent-searches";
import { SearchDialogListSkeleton } from "@/components/home/search-dialog-result-skeletons";
import { SearchDialogSelectedStudioTile } from "@/components/home/search-dialog-selected-studio";
import { SearchDialogStudioRail } from "@/components/home/search-dialog-studio-rail";
import { SearchTagPill } from "@/components/home/search-tag-pill";
import { SearchTokenField } from "@/components/home/search-token-field";
import {
	appThemeSearchBorderBeamColor,
	DEFAULT_APP_THEME_CLASS,
	isAppThemeLight,
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
import { runInputClearDissolve } from "@/lib/input-clear-dissolve";
import { normalizeProfileSearchQuery } from "@/lib/profile-search-query";
import type { SearchDialogGenreRailItem } from "@/lib/search-dialog-featured-genres";
import {
	cycleSearchListingKind,
	type SearchDialogListingKind,
	searchDialogCatalogueKind,
} from "@/lib/search-dialog-listing-kind";
import { findSearchDialogStudio } from "@/lib/search-dialog-studios";
import {
	deriveSearchState,
	type SearchTag,
	searchTagKey,
	upsertTag,
} from "@/lib/search-query-tags";
import { recordPersonSearchHit } from "@/lib/still-api-fetch";
import { useCastCrewSearch } from "@/lib/use-cast-crew-search";
import { useCatalogTextSearch } from "@/lib/use-catalog-text-search";
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
import { useSearchDialogPopularPeople } from "@/lib/use-search-dialog-popular-people";
import { useSearchDialogStudios } from "@/lib/use-search-dialog-studios";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";
import { useSoftwareGpuRendering } from "@/lib/use-software-gpu-rendering";

/** First TMDb search page is 20 rows; show all so the dialog can scroll when the sheet is short. */
const SEARCH_DIALOG_MAX_RESULTS = 20;

/** Stable id so the sticky pill and global dialog stay associated for a11y. */
const CATALOG_SEARCH_DIALOG_ID = "still-catalog-search-dialog";

function browseCategoryFromSurface(
	surface: ReturnType<typeof parseHomeBrowseSurface>,
): SearchDialogBrowseCategory {
	if (surface === "tv") return "tv";
	return "movies";
}

/** Top + bottom scrims on the nested body well (`bg-background`). */
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
					"pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-linear-to-b from-25% from-background via-background/85 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
					showHeaderFade ? "opacity-100" : "opacity-0",
				)}
			/>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-linear-to-t from-15% from-background/95 via-background/25 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
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
	/** While typing, chooses movies / TV / people search; synced from browse when empty. */
	const [searchListingKind, setSearchListingKind] =
		useState<SearchDialogListingKind>("movie");
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
	/** Media pills stay Movies/Shows; otherwise Tab can land on People. */
	const effectiveListingKind: SearchDialogListingKind = hasMediaTag
		? tagState.listingKind
		: searchListingKind;
	const isPeopleSearch =
		effectiveListingKind === "people" && tagState.resultMode !== "lists";
	const catalogueListingKind = searchDialogCatalogueKind(effectiveListingKind);

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

	const handlePersonSelect = useCallback(
		(id: number, snapshot?: { name?: string; imageUrl?: string | null }) => {
			void recordPersonSearchHit(id, {
				name: snapshot?.name,
				profileUrl: snapshot?.imageUrl,
			});
			pendingNavigationRef.current = `/people/${id}`;
			beginClose();
		},
		[beginClose],
	);

	/** Browse chrome only when there are no pills and no active text token. */
	const isEmptyDraft = searchTags.length === 0 && trimmedDraft === "";
	/** Dim + panel mount together so Framer can fade the scrim with the sheet (native `::backdrop` only clears in `close()`). */
	const showSheet = Boolean(panelLayout && panelVisible);
	const sheetLayoutReady = Boolean(panelLayout);
	const browsePreviewEnabled = sheetLayoutReady && isEmptyDraft;
	/** TMDb popular people on empty query (unsigned too); typed query uses cast/crew search. */
	const popularPeopleEnabled = sheetLayoutReady && trimmedDraft === "";
	const committedLobbySearchRaw = searchParams.get("search")?.trim() ?? "";
	const committedLobbyBrowse = browseSurface === "tv" ? "tv" : "movies";
	const committedLobbySearchActive =
		Boolean(committedLobbySearchRaw) &&
		browseSurface !== "community" &&
		isHomeCatalogueSearchActive(searchParams, committedLobbyBrowse);
	const { items: browsePreviewItems, loading: browsePreviewLoading } =
		useSearchDialogBrowsePreview(browseCategory, null, browsePreviewEnabled);
	const { railItems: popularPeopleRailItems, loading: popularPeopleLoading } =
		useSearchDialogPopularPeople(popularPeopleEnabled);
	const {
		studios: browseStudios,
		loading: browseStudiosLoading,
		loaded: browseStudiosLoaded,
	} = useSearchDialogStudios(
		dialogOpen &&
			(committedLobbySearchActive ||
				(sheetLayoutReady && (browsePreviewEnabled || !isEmptyDraft))),
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

	// Empty sheet: Movies / TV / People browse picks imply the same mode for the next typed query.
	useEffect(() => {
		if (!isEmptyDraft) return;
		if (browseCategory === "people") {
			setSearchListingKind("people");
			return;
		}
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
		catalogueListingKind,
		movieGenres,
		tvGenres,
		catalogTmdbLanguage,
	);
	const genreCuratedTagCount = searchTags.filter(
		(t) => t.kind === "genre" || t.kind === "curated",
	).length;
	const catalogueTagsActive =
		searchTags.length > 0 && tagState.resultMode !== "lists";

	const handleStudioRailSelect = useCallback(
		(companyId: number | null) => {
			if (companyId == null) {
				setSearchTags((prev) => prev.filter((tag) => tag.kind !== "studio"));
				return;
			}
			const studio = findSearchDialogStudio(browseStudios, companyId);
			if (!studio) return;
			const listingKind =
				catalogueListingKind === "tv" ? ("tv" as const) : ("movie" as const);
			setSearchTags((prev) =>
				upsertTag(prev, {
					kind: "studio",
					id: studio.id,
					name: studio.name,
					logoUrl: studio.logoUrl,
				}),
			);
			setSearchListingKind(listingKind);
		},
		[browseStudios, catalogueListingKind],
	);

	const handleListingKindCycle = useCallback(() => {
		const next = cycleSearchListingKind(effectiveListingKind);
		setSearchListingKind(next);
		setBrowseCategory(
			next === "tv" ? "tv" : next === "people" ? "people" : "movies",
		);
		setSearchTags((prev) => {
			if (next === "people") {
				// People search is free-text cast/crew — drop catalogue filter pills.
				return prev.filter(
					(tag) =>
						tag.kind !== "media" &&
						tag.kind !== "studio" &&
						tag.kind !== "genre" &&
						tag.kind !== "curated",
				);
			}
			if (!prev.some((tag) => tag.kind === "media")) return prev;
			return upsertTag(prev, { kind: "media", listingKind: next });
		});
	}, [effectiveListingKind]);

	const handleGenreRailSelect = useCallback(
		(item: SearchDialogGenreRailItem) => {
			if (item.kind === "curated") {
				setSearchTags((prev) => {
					const exists = prev.some(
						(tag) => tag.kind === "curated" && tag.slug === item.slug,
					);
					if (exists) {
						return prev.filter(
							(tag) => !(tag.kind === "curated" && tag.slug === item.slug),
						);
					}
					return upsertTag(prev, {
						kind: "curated",
						slug: item.slug,
						label: item.label,
					});
				});
				return;
			}
			setSearchTags((prev) => {
				const exists = prev.some(
					(tag) =>
						tag.kind === "genre" &&
						tag.id === item.id &&
						tag.listingKind === item.listingKind,
				);
				if (exists) {
					return prev.filter(
						(tag) =>
							!(
								tag.kind === "genre" &&
								tag.id === item.id &&
								tag.listingKind === item.listingKind
							),
					);
				}
				return upsertTag(prev, {
					kind: "genre",
					id: item.id,
					name: item.name,
					listingKind: item.listingKind,
				});
			});
		},
		[],
	);

	const structuredSearch = useCatalogueTagSearch(
		searchTags,
		freeText,
		showSheet && searchTags.length > 0 && !isPeopleSearch,
		catalogueListingKind,
	);
	const {
		results: plainSearchResults,
		totalResults: plainSearchTotalResults,
		loading: plainSearchLoading,
		setupHint: plainSetupHint,
	} = useCatalogTextSearch(
		searchTags.length === 0 && !isPeopleSearch ? freeText : "",
		catalogueListingKind,
	);
	const {
		results: peopleSearchResults,
		totalResults: peopleSearchTotalResults,
		loading: peopleSearchLoading,
		setupHint: peopleSetupHint,
	} = useCastCrewSearch(
		freeText,
		showSheet && isPeopleSearch && searchTags.length === 0,
	);
	const usesStructuredSearch = structuredSearch.active;
	const searchLoading = isPeopleSearch
		? peopleSearchLoading
		: usesStructuredSearch
			? structuredSearch.loading
			: plainSearchLoading;
	const setupHint = isPeopleSearch
		? peopleSetupHint
		: usesStructuredSearch
			? structuredSearch.setupHint
			: plainSetupHint;
	const dialogSearchResults = (
		usesStructuredSearch
			? structuredSearch.catalogueResults
			: plainSearchResults
	).slice(0, SEARCH_DIALOG_MAX_RESULTS);
	const dialogPeopleResults = peopleSearchResults.slice(
		0,
		SEARCH_DIALOG_MAX_RESULTS,
	);

	const footerResultCount = isEmptyDraft
		? browseCategory === "people"
			? popularPeopleRailItems.length
			: browsePreviewItems.length
		: tagState.resultMode === "lists"
			? structuredSearch.listResults.length
			: isPeopleSearch
				? peopleSearchTotalResults
				: usesStructuredSearch
					? structuredSearch.catalogueTotalResults
					: plainSearchTotalResults;

	const dialogTagRow = searchTags.filter((tag) => tag.kind !== "media");
	const selectedStudioTag = searchTags.find(
		(tag): tag is Extract<SearchTag, { kind: "studio" }> =>
			tag.kind === "studio",
	);

	const profileSearchQuery = normalizeProfileSearchQuery(trimmedDraft);
	const peopleSearchEnabled =
		Boolean(viewer) && profileSearchQuery.length >= 1 && showSheet;
	const { hits: profileSearchHits } = useProfileSearch(
		trimmedDraft,
		peopleSearchEnabled,
	);
	const popularPeopleRail = (
		<SearchDialogPeopleRail
			items={popularPeopleRailItems}
			loading={popularPeopleLoading}
			onPick={(item) =>
				handlePersonSelect(Number(item.id), {
					name: item.name,
					imageUrl: item.imageUrl,
				})
			}
		/>
	);
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
		if (isPeopleSearch) {
			const n = dialogPeopleResults.length;
			if (n === 0) {
				if (setupHint) return setupHint;
				return trimmedDraft
					? `No people found for ${trimmedDraft}`
					: "No people found";
			}
			return `${n} ${n === 1 ? "person" : "people"} found`;
		}
		const n = dialogSearchResults.length;
		const label = catalogueListingKind === "tv" ? "TV shows" : "films";
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
		isPeopleSearch,
		dialogPeopleResults.length,
		dialogSearchResults.length,
		catalogueListingKind,
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
		// People mode opens via row tap — Enter just records the query.
		if (isPeopleSearch) {
			submitQuery();
			return;
		}
		if (canCommitCatalogueSearch(searchTags, trimmedDraft)) {
			submitQuery();
			const targetBrowse = resolveCommitBrowseFromDraft(
				searchTags,
				catalogueListingKind,
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
		catalogueListingKind,
		isPeopleSearch,
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

	const handleCatalogSearchPick = (
		id: number,
		kindOverride?: "movie" | "tv",
	) => {
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
		// Category body passes the row's own kind; legacy catalog grid relies on
		// the Movies/Shows chip / media tag (people mode never hits this path).
		const kind = kindOverride ?? catalogueListingKind;
		pendingNavigationRef.current =
			kind === "tv" ? `/tv/${id}` : `/movies/${id}`;
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
							"absolute z-10 flex min-w-0 origin-top flex-col overflow-hidden rounded-4xl bg-card text-foreground",
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
						<div className="relative shrink-0 px-2.5 pt-2.5">
							<form
								onSubmit={handleFormSubmit}
								className="catalog-search-query flex min-w-0 items-center gap-[15px] rounded-full pb-2 pr-10 pl-2.5"
							>
								<label
									htmlFor="home-sticky-search-dialog-input"
									className="sr-only"
								>
									Query
								</label>
								<Search
									className="size-[17px] shrink-0 text-muted-foreground"
									aria-hidden
								/>
								<div className="scrollbar-none flex min-w-0 flex-1 flex-nowrap items-center gap-[5px] overflow-x-auto">
									{dialogTagRow.map((tag) => (
										<SearchTagPill
											key={searchTagKey(tag)}
											tag={tag}
											density="dialog"
											onRemove={() =>
												setSearchTags((prev) =>
													prev.filter(
														(row) => searchTagKey(row) !== searchTagKey(tag),
													),
												)
											}
										/>
									))}
									<SearchTokenField
										inputId="home-sticky-search-dialog-input"
										tags={searchTags}
										onTagsChange={setSearchTags}
										inputValue={freeText}
										onInputValueChange={setFreeText}
										studios={browseStudios}
										genres={suggestionGenres}
										listingKind={catalogueListingKind}
										onSubmit={commitOrSubmitDraft}
										onTabCycleListingKind={handleListingKindCycle}
										hideTags
										placeholder="Search"
									/>
									{tagState.resultMode !== "lists" ? (
										<SearchDialogMediaChip
											listingKind={effectiveListingKind}
											onToggle={handleListingKindCycle}
										/>
									) : null}
								</div>
							</form>
							<button
								type="button"
								aria-label="Close search"
								onClick={() => beginClose()}
								className={cn(
									"absolute top-3.5 right-3 inline-flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground",
									"[@media(hover:hover)]:hover:text-foreground",
								)}
							>
								<X className="size-4" aria-hidden />
							</button>
						</div>

						{genreCuratedTagCount >= 3 ? (
							<p className="px-2.5 pb-1 text-muted-foreground text-xs leading-relaxed">
								All tags must match.
							</p>
						) : null}

						{/* Nested canvas well under the search bar — on the raised `bg-card` shell. */}
						<div className="relative mx-2.5 mb-2.5 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] bg-background">
							<SearchDialogBodyScrims
								showHeaderFade={showHeaderFade}
								showFooterFade={showFooterFade}
							/>
							<div
								ref={searchBodyScrollRef}
								data-lenis-prevent-wheel
								className="scrollbar-none contain-[paint] min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch]"
							>
								{isEmptyDraft && recentQueries.length > 0 ? (
									<SearchDialogRecentSearches
										entries={recentQueries}
										headingId={`${titleId}-recent-heading`}
										onPick={handleRecentPick}
										onRemove={handleRecentRemove}
									/>
								) : null}

								<div className="flex min-w-0 max-w-full flex-col gap-2.5 px-2.5 py-2.5">
									{isEmptyDraft &&
									tagState.resultMode !== "lists" &&
									browseCategory !== "people" ? (
										<SearchDialogStudioRail
											studios={browseStudios}
											selectedStudioId={tagState.studioId}
											onSelectStudio={handleStudioRailSelect}
											loading={browseStudiosLoading}
											listingKind={catalogueListingKind}
										/>
									) : null}

									{isEmptyDraft &&
									tagState.resultMode !== "lists" &&
									browseCategory !== "people" ? (
										<SearchDialogGenreRail
											genres={suggestionGenres}
											listingKind={catalogueListingKind}
											selectedTags={searchTags}
											onSelect={handleGenreRailSelect}
											loading={genresLoading}
										/>
									) : null}

									{tagState.resultMode === "lists" ? (
										<div
											className="flex flex-col"
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
									) : isEmptyDraft ? (
										<>
											{browseCategory !== "people" ? (
												browsePreviewLoading &&
												browsePreviewItems.length === 0 ? (
													<>
														<span className="sr-only">Loading suggestions</span>
														<SearchDialogPosterRail
															items={[]}
															loading
															onPick={() => undefined}
														/>
													</>
												) : (
													<SearchDialogPosterRail
														items={browsePreviewItems}
														loading={browsePreviewLoading}
														onPick={handlePreviewPick}
														label="Popular titles"
													/>
												)
											) : null}
											{popularPeopleRail}
										</>
									) : isPeopleSearch ? (
										<div
											className="flex flex-col gap-2.5"
											aria-live="polite"
											aria-busy={searchLoading}
										>
											{searchResultsStatusMessage ? (
												<span className="sr-only">
													{searchResultsStatusMessage}
												</span>
											) : null}
											{searchLoading && dialogPeopleResults.length === 0 ? (
												<SearchDialogCastCrewResults
													results={[]}
													loading
													onSelect={() => undefined}
												/>
											) : null}
											{dialogPeopleResults.length > 0 ? (
												<div className={cn(searchLoading && "opacity-55")}>
													<SearchDialogCastCrewResults
														results={dialogPeopleResults}
														loading={false}
														onSelect={(id) => {
															const hit = dialogPeopleResults.find(
																(row) => row.id === id,
															);
															handlePersonSelect(id, {
																name: hit?.name,
																imageUrl: hit?.profileUrl ?? null,
															});
														}}
													/>
												</div>
											) : !searchLoading ? (
												<p className="text-muted-foreground text-xs leading-relaxed">
													{setupHint ?? (
														<>
															No people found
															{trimmedDraft
																? ` for “${trimmedDraft}”`
																: ""}
															.
														</>
													)}
												</p>
											) : null}
										</div>
									) : (
										<div
											className="flex flex-col gap-2.5"
											aria-live="polite"
											aria-busy={searchLoading}
										>
											{searchResultsStatusMessage ? (
												<span className="sr-only">
													{searchResultsStatusMessage}
												</span>
											) : null}
											{selectedStudioTag ? (
												<SearchDialogSelectedStudioTile
													studioId={selectedStudioTag.id}
													name={selectedStudioTag.name}
													logoUrl={selectedStudioTag.logoUrl}
												/>
											) : null}
											{searchLoading && dialogSearchResults.length === 0 ? (
												<SearchDialogPosterGrid
													items={[]}
													loading
													onPick={() => undefined}
													label={
														catalogueListingKind === "tv" ? "Shows" : "Movies"
													}
												/>
											) : null}
											{dialogSearchResults.length > 0 ? (
												<div className={cn(searchLoading && "opacity-55")}>
													<SearchDialogPosterGrid
														items={dialogSearchResults.map((hit) => ({
															id: hit.id,
															title: hit.title,
															posterUrl: hit.poster_url,
															listingKind: catalogueListingKind,
														}))}
														onPick={(item) => handleCatalogSearchPick(item.id)}
														label={
															catalogueListingKind === "tv" ? "Shows" : "Movies"
														}
													/>
												</div>
											) : !searchLoading ? (
												<p className="text-muted-foreground text-xs leading-relaxed">
													{setupHint ??
														(catalogueTagsActive && !trimmedDraft ? (
															"Nothing matched all filters — try removing a tag."
														) : (
															<>
																No{" "}
																{catalogueListingKind === "tv"
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
						</div>
						<SearchDialogFooter
							resultCount={footerResultCount}
							listingKind={effectiveListingKind}
							resultMode={
								tagState.resultMode === "lists"
									? "lists"
									: isPeopleSearch
										? "people"
										: catalogueListingKind
							}
							isEmptyDraft={isEmptyDraft}
							studioFound={Boolean(selectedStudioTag) && !isEmptyDraft}
						/>
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
/** ⌘ vs Ctrl — resolved after mount so SSR markup stays stable. */
function useCatalogSearchModKeyLabel(): string | null {
	const [label, setLabel] = useState<string | null>(null);
	useEffect(() => {
		const platform =
			(
				navigator as Navigator & {
					userAgentData?: { platform?: string };
				}
			).userAgentData?.platform ??
			navigator.platform ??
			"";
		const apple =
			/Mac|iPhone|iPod|iPad/i.test(platform) ||
			/Mac OS X/i.test(navigator.userAgent);
		setLabel(apple ? "⌘" : "Ctrl");
	}, []);
	return label;
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
	return target.isContentEditable;
}

/**
 * Lights each shortcut chip as Ctrl/⌘ then K is held (skips while typing in fields).
 */
function useCatalogSearchShortcutPress(enabled: boolean): {
	modPressed: boolean;
	kPressed: boolean;
} {
	const [modPressed, setModPressed] = useState(false);
	const [kPressed, setKPressed] = useState(false);

	useEffect(() => {
		if (!enabled) {
			setModPressed(false);
			setKPressed(false);
			return;
		}

		const onKeyDown = (event: KeyboardEvent) => {
			if (isEditableKeyboardTarget(event.target)) {
				setModPressed(false);
				setKPressed(false);
				return;
			}
			if (event.key === "Control" || event.key === "Meta") {
				setModPressed(true);
			}
			if (event.ctrlKey || event.metaKey) {
				setModPressed(true);
			}
			if (event.code === "KeyK" && !event.repeat) {
				setKPressed(true);
			}
		};

		const onKeyUp = (event: KeyboardEvent) => {
			if (event.code === "KeyK") {
				setKPressed(false);
			}
			if (event.key === "Control" || event.key === "Meta") {
				setModPressed(event.ctrlKey || event.metaKey);
			} else if (!(event.ctrlKey || event.metaKey)) {
				setModPressed(false);
			}
		};

		const clear = () => {
			setModPressed(false);
			setKPressed(false);
		};

		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		window.addEventListener("blur", clear);
		document.addEventListener("visibilitychange", clear);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("blur", clear);
			document.removeEventListener("visibilitychange", clear);
		};
	}, [enabled]);

	return { modPressed, kPressed };
}

export function HomeStickySearch() {
	const router = useRouter();
	const pathname = usePathname() ?? "";
	const searchParams = useSearchParams();
	const triggerRef = useRef<HTMLDivElement>(null);
	const clearSlotRef = useRef<HTMLSpanElement>(null);
	const clearMirrorRef = useRef<HTMLDivElement>(null);
	const clearPlaceholderRef = useRef<HTMLDivElement>(null);
	const clearGlowRef = useRef<HTMLDivElement>(null);
	const clearDissolveCancelRef = useRef<(() => void) | null>(null);
	const clearingRef = useRef(false);
	const [isClearing, setIsClearing] = useState(false);
	const reduceMotion = useReducedMotion();
	const { theme, resolvedTheme } = useTheme();
	const [themeReady, setThemeReady] = useState(false);
	const modKeyLabel = useCatalogSearchModKeyLabel();
	const requestOpen = useCatalogSearchDialog((s) => s.requestOpen);
	const setHomeTriggerEl = useCatalogSearchDialog((s) => s.setHomeTriggerEl);
	const { dialogOpen, showSheet } = useCatalogSearchDialog((s) => s.shellUi);

	const onHome = pathname === "/home" || pathname.endsWith("/home");
	const browse = parseHomeBrowseSurface(searchParams.get("browse"));
	const catalogueBrowse = browse === "tv" ? "tv" : "movies";
	const searchRaw = searchParams.get("search")?.trim() ?? "";
	const committedSearchActive =
		onHome && isHomeCatalogueSearchActive(searchParams, catalogueBrowse);

	const shortcutHintsVisible =
		Boolean(modKeyLabel) &&
		!committedSearchActive &&
		!dialogOpen &&
		!isClearing;
	const { modPressed, kPressed } =
		useCatalogSearchShortcutPress(shortcutHintsVisible);

	const needsSummaryMetadata = committedSearchActive || isClearing;

	const { studios, loading: studiosLoading } =
		useSearchDialogStudios(needsSummaryMetadata);
	const catalogTmdbLanguage = useCatalogTmdbLanguage(needsSummaryMetadata);
	const {
		movieGenres,
		tvGenres,
		loading: genresLoading,
	} = useSearchDialogGenres(needsSummaryMetadata, catalogTmdbLanguage);

	const committedSearchDisplay = useMemo(() => {
		if ((!committedSearchActive && !isClearing) || !searchRaw) return null;
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
		isClearing,
		movieGenres,
		searchRaw,
		studios,
		studiosLoading,
		tvGenres,
	]);

	// Flattened label for the dissolve mirror (pills stay as resting UI).
	const clearMirrorText = useMemo(() => {
		if (!committedSearchDisplay) return searchRaw;
		return (
			formatCommittedSearchSummary(
				committedSearchDisplay.tags,
				committedSearchDisplay.freeText,
				80,
			) ||
			committedSearchDisplay.freeText ||
			searchRaw
		);
	}, [committedSearchDisplay, searchRaw]);

	const activeAppTheme = resolveAppTheme(
		themeReady && theme !== undefined
			? (resolvedTheme ?? theme)
			: DEFAULT_APP_THEME_CLASS,
	);
	const clearDissolveIsDark = !isAppThemeLight(activeAppTheme);

	// `next-themes` resolves from localStorage after hydration — keep BorderBeam colors
	// on the SSR default until then so inline `<style>` tags match server markup.
	useEffect(() => {
		setThemeReady(true);
	}, []);

	const borderBeamColorVariant = appThemeSearchBorderBeamColor(activeAppTheme);

	useEffect(() => {
		setHomeTriggerEl(triggerRef.current);
		return () => setHomeTriggerEl(null);
	}, [setHomeTriggerEl]);

	// Drop in-flight dissolve if the pill unmounts mid-clear.
	useEffect(() => {
		return () => {
			clearDissolveCancelRef.current?.();
			clearDissolveCancelRef.current = null;
			clearingRef.current = false;
		};
	}, []);

	// Hold `.is-clearing` until the URL actually drops `?search=` (avoids pill flash).
	useEffect(() => {
		if (isClearing && !committedSearchActive) {
			setIsClearing(false);
		}
	}, [committedSearchActive, isClearing]);

	const handleOpen = useCallback(() => {
		if (clearingRef.current) return;
		const trigger = triggerRef.current;
		if (!trigger) return;
		requestOpen(trigger.getBoundingClientRect());
	}, [requestOpen]);

	const navigateClearSearch = useCallback(() => {
		const persisted = readHomeLobbyPersisted();
		router.replace(
			buildHomeCatalogueSearchClearHref(catalogueBrowse, persisted),
		);
	}, [router, catalogueBrowse]);

	const handleClearSearch = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			event.preventDefault();
			event.stopPropagation();
			if (clearingRef.current) return;

			const wrap = clearSlotRef.current;
			const mirror = clearMirrorRef.current;
			const placeholder = clearPlaceholderRef.current;
			const glow = clearGlowRef.current;

			// Instant clear when reduced motion or dissolve DOM is missing.
			if (
				reduceMotion ||
				!wrap ||
				!mirror ||
				!placeholder ||
				!glow ||
				!clearMirrorText.trim()
			) {
				navigateClearSearch();
				return;
			}

			clearingRef.current = true;
			flushSync(() => {
				setIsClearing(true);
			});

			const handle = runInputClearDissolve(
				{
					wrap,
					mirror,
					placeholder,
					glow,
					fontSource: mirror,
				},
				{
					text: clearMirrorText,
					isDark: clearDissolveIsDark,
					reducedMotion: false,
					onComplete: () => {
						clearDissolveCancelRef.current = null;
						clearingRef.current = false;
						// Keep React `isClearing` until `committedSearchActive` flips false.
						navigateClearSearch();
					},
				},
			);
			clearDissolveCancelRef.current = handle.cancel;
		},
		[clearDissolveIsDark, clearMirrorText, navigateClearSearch, reduceMotion],
	);

	const showCommittedChrome = Boolean(committedSearchDisplay) || isClearing;
	const showClearButton = committedSearchActive || isClearing;

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
					showClearButton ? "gap-1 pr-3" : "gap-2 pr-5",
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
					aria-keyshortcuts="Meta+K Control+K"
					aria-label={
						modKeyLabel
							? `Search catalogue (${modKeyLabel}+K)`
							: "Search catalogue"
					}
				>
					<Search
						className="size-4 shrink-0 text-muted-foreground"
						aria-hidden
					/>
					{/* transitions.dev clear dissolve slot — mirror/placeholder/glow over live pills. */}
					<span
						ref={clearSlotRef}
						className={cn(
							"t-clear home-sticky-search-clear flex min-h-0 min-w-0 flex-1 items-center",
							showCommittedChrome && "has-value",
							isClearing && "is-clearing",
						)}
					>
						<span className="t-clear-live flex min-h-0 min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden">
							{committedSearchDisplay ? (
								<>
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
								</>
							) : (
								<span className="min-w-0 flex-1 truncate text-base text-muted-foreground md:text-sm">
									Films, TV, @people, lists…
								</span>
							)}
						</span>
						<div
							ref={clearMirrorRef}
							className="t-clear-mirror truncate font-medium text-base text-foreground leading-none md:text-sm"
							aria-hidden
						/>
						<div
							ref={clearPlaceholderRef}
							className="t-clear-placeholder min-w-0 truncate text-base text-muted-foreground md:text-sm"
							aria-hidden
						>
							Films, TV, @people, lists…
						</div>
						<div ref={clearGlowRef} className="t-clear-glow" aria-hidden />
					</span>
					{/* Shortcut hint — desktop only; cleared when a committed search shows the X. */}
					{shortcutHintsVisible ? (
						<span
							className="pointer-events-none hidden shrink-0 items-center gap-1 sm:inline-flex"
							aria-hidden
						>
							{/* Fully rounded chips — light up as each key is held. */}
							<kbd
								className={cn(
									"rounded-full px-2.5 py-1 font-medium text-[10px] tabular-nums transition-[color,background-color] duration-150",
									modPressed
										? "bg-foreground/15 text-foreground"
										: "bg-background text-muted-foreground",
								)}
							>
								{modKeyLabel}
							</kbd>
							<kbd
								className={cn(
									"rounded-full px-2.5 py-1 font-medium text-[10px] tabular-nums transition-[color,background-color] duration-150",
									kPressed
										? "bg-foreground/15 text-foreground"
										: "bg-background text-muted-foreground",
								)}
							>
								K
							</kbd>
						</span>
					) : null}
				</button>
				{showClearButton ? (
					<button
						type="button"
						aria-label="Clear search"
						className={cn(
							// Compact icon control — avoid `size-9` which stretched the pill taller than `py-3`.
							"t-clear-btn relative inline-flex shrink-0 rounded-full p-1 text-muted-foreground",
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

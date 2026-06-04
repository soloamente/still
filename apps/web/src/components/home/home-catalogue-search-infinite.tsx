"use client";

import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";
import { useCallback, useMemo } from "react";

import {
	type PopularMovieSeed,
	PopularMoviesInfinite,
} from "@/components/movie/popular-movies-infinite";
import {
	buildCatalogueSearchPlanFromCommit,
	committedCatalogueSearchNeedsTagMetadata,
	loadCatalogueSearchPage,
} from "@/lib/home-catalogue-search-load-page";
import type { HomeCatalogueSearchLobbySort } from "@/lib/home-catalogue-search-param";
import {
	formatCommittedSearchSummary,
	parseHomeCatalogueSearchParam,
} from "@/lib/home-catalogue-search-param";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import { useCatalogTmdbLanguage } from "@/lib/use-catalog-tmdb-language";
import { useSearchDialogGenres } from "@/lib/use-search-dialog-genres";
import { useSearchDialogStudios } from "@/lib/use-search-dialog-studios";

const SEARCH_GRID_POSTER_SKELETON_KEYS = [
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

/** Poster grid placeholder while the search RSC payload streams. */
export function HomeCatalogueSearchGridSkeleton() {
	return (
		<div className="flex min-h-0 flex-1 flex-col" aria-busy aria-live="polite">
			<p className="sr-only">Loading search results…</p>
			<div className={HOME_LOBBY_CATALOGUE_GRID_CLASSNAME}>
				{SEARCH_GRID_POSTER_SKELETON_KEYS.map((posterKey) => (
					<ShimmerBone
						key={`home-search-skel-poster-${posterKey}`}
						className="aspect-2/3 w-full rounded-[3rem] bg-background"
						aria-hidden
					/>
				))}
			</div>
		</div>
	);
}

/**
 * Committed `/home?search=` lobby grid — page 1 from RSC seeds; pages 2…N via scroll
 * (`loadPage`), matching watchlist / browse lobby infinite scroll.
 */
export function HomeCatalogueSearchInfinite({
	browse,
	signedIn,
	monochromePeersOnHover,
	searchRaw,
	searchSort,
	searchWaveKey,
	seedMovies,
	totalPages,
	initialError = false,
}: {
	browse: "movies" | "tv";
	signedIn: boolean;
	monochromePeersOnHover: boolean;
	searchRaw: string;
	searchSort: HomeCatalogueSearchLobbySort;
	searchWaveKey: string;
	seedMovies: PopularMovieSeed[];
	totalPages: number;
	initialError?: boolean;
}) {
	const catalogMedia = browse === "tv" ? "tv" : "movie";
	const emptyNoun = browse === "tv" ? "shows" : "films";

	// Tag metadata only for scroll paging on structured queries — never blocks first paint.
	const needsTagMetadata = committedCatalogueSearchNeedsTagMetadata(searchRaw);
	const catalogTmdbLanguage = useCatalogTmdbLanguage(needsTagMetadata);
	const { studios } = useSearchDialogStudios(needsTagMetadata);
	const { movieGenres, tvGenres } = useSearchDialogGenres(
		needsTagMetadata,
		catalogTmdbLanguage,
	);

	const parsed = useMemo(
		() =>
			parseHomeCatalogueSearchParam(searchRaw, studios, {
				movieGenres,
				tvGenres,
			}),
		[searchRaw, studios, movieGenres, tvGenres],
	);

	const plan = useMemo(
		() =>
			buildCatalogueSearchPlanFromCommit(
				parsed.tags,
				parsed.freeText,
				browse,
				searchSort,
			),
		[parsed.tags, parsed.freeText, browse, searchSort],
	);

	const summary =
		formatCommittedSearchSummary(parsed.tags, parsed.freeText) || searchRaw;

	const loadPage = useCallback(
		(page: number) => loadCatalogueSearchPage(plan, page),
		[plan],
	);

	const cellKey = useCallback(
		(m: PopularMovieSeed) => `${m.listingKind ?? catalogMedia}:${m.id}`,
		[catalogMedia],
	);

	if (!searchRaw) {
		return null;
	}

	if (initialError) {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-6 sm:px-4 sm:py-10">
				<div
					className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border border-dashed bg-card/40 px-6 py-12 text-center sm:px-10 sm:py-14"
					role="alert"
				>
					<div className="space-y-2">
						<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
							Couldn&apos;t load search results
						</p>
						<p className="text-muted-foreground text-sm leading-relaxed">
							TMDb may be unavailable. Try again or use Clear search in the chip
							row above to return to the catalogue.
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (seedMovies.length === 0) {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-6 sm:px-4 sm:py-10">
				<div
					className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border border-dashed bg-card/40 px-6 py-12 text-center sm:px-10 sm:py-14"
					role="status"
				>
					<div className="space-y-2">
						<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
							No {emptyNoun} found
						</p>
						<p className="text-muted-foreground text-sm leading-relaxed">
							{summary
								? `Nothing matched “${summary}”. Try different tags or wording.`
								: "Try different tags or wording."}
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<PopularMoviesInfinite
			key={searchWaveKey}
			blockedReason={null}
			catalogueRadialSurface="home"
			signedIn={signedIn}
			catalogMedia={catalogMedia}
			catalogLabel="search"
			catalogueWaveKeyOverride={searchWaveKey}
			getPosterCellKey={cellKey}
			getDedupeKey={cellKey}
			loadPage={loadPage}
			gridClassName={HOME_LOBBY_CATALOGUE_GRID_CLASSNAME}
			monochromePeersOnHover={monochromePeersOnHover}
			posterFrameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
			posterHoverEffect="elevation"
			posterLinkClassName={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
			seedMovies={seedMovies}
			seedPage={1}
			showTitle={false}
			staggerPosterEntrance
			totalPages={totalPages}
			totalResults={0}
		/>
	);
}

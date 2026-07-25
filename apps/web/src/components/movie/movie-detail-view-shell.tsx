"use client";

import { cn } from "@still/ui/lib/utils";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { LobbyNavigationProvider } from "@/components/lobby/lobby-navigation-provider";
import { MovieDetailSectionNav } from "@/components/movie/movie-detail-section-nav";
import { MovieDetailStreaming } from "@/components/movie/movie-detail-streaming";
import { MovieDetailTopBar } from "@/components/movie/movie-detail-top-bar";
import { ListingPresenceProvider } from "@/components/realtime/listing-presence-provider";
import { MovieReviewDeepLinkOpener } from "@/components/review/movie-review-deep-link-opener";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import type { MovieDetailSectionNavItem } from "@/lib/movie-detail-sections";
import { MOVIE_DETAIL_SECTION_NAV_GUTTER_CLASS } from "@/lib/movie-detail-sections";
import {
	type MovieDetailListingKind,
	type MovieDetailView,
	parseMovieDetailTvQuoteEpisode,
	parseMovieDetailViewFromSearchParams,
} from "@/lib/movie-detail-view";
import type { MovieWatchProvidersViewModel } from "@/lib/movie-watch-providers";

/**
 * Client shell for film/TV detail — instant tab switches without freezing sticky
 * chrome; About/Community stream in via RSC Suspense siblings from the page.
 */
export function MovieDetailViewShell({
	initialView,
	basePath,
	movieId,
	title,
	listingKind = "movie",
	sectionNavItems,
	hero,
	watchProviders,
	theatricalOnly = false,
	about,
	community,
	quotes,
}: {
	initialView: MovieDetailView;
	basePath: string;
	movieId: number;
	title: string;
	listingKind?: MovieDetailListingKind;
	sectionNavItems: MovieDetailSectionNavItem[];
	hero: ReactNode;
	watchProviders: MovieWatchProvidersViewModel;
	/** Empty Streaming tab — cinema-only message when no at-home providers. */
	theatricalOnly?: boolean;
	about: ReactNode;
	community: ReactNode;
	quotes: ReactNode;
}) {
	return (
		<LobbyNavigationProvider>
			<MovieDetailViewShellBody
				initialView={initialView}
				basePath={basePath}
				movieId={movieId}
				title={title}
				listingKind={listingKind}
				sectionNavItems={sectionNavItems}
				hero={hero}
				watchProviders={watchProviders}
				theatricalOnly={theatricalOnly}
				about={about}
				community={community}
				quotes={quotes}
			/>
		</LobbyNavigationProvider>
	);
}

function MovieDetailViewShellBody({
	initialView,
	basePath,
	movieId,
	title,
	listingKind,
	sectionNavItems,
	hero,
	watchProviders,
	theatricalOnly,
	about,
	community,
	quotes,
}: {
	initialView: MovieDetailView;
	basePath: string;
	movieId: number;
	title: string;
	listingKind: MovieDetailListingKind;
	sectionNavItems: MovieDetailSectionNavItem[];
	hero: ReactNode;
	watchProviders: MovieWatchProvidersViewModel;
	theatricalOnly: boolean;
	about: ReactNode;
	community: ReactNode;
	quotes: ReactNode;
}) {
	const searchParams = useSearchParams();
	const urlView = parseMovieDetailViewFromSearchParams({
		view: searchParams.get("view") ?? initialView,
		tab: searchParams.get("tab"),
	});
	const tvQuoteEpisode = parseMovieDetailTvQuoteEpisode({
		season: searchParams.get("season"),
		episode: searchParams.get("episode"),
	});
	const [view, setView] = useState<MovieDetailView>(urlView);
	const previousViewRef = useRef(view);

	useEffect(() => {
		setView(urlView);
	}, [urlView]);

	// Off-tab RSC panels unmount so short tabs (Streaming) don't inherit About scroll height.
	useEffect(() => {
		if (previousViewRef.current === view) return;
		previousViewRef.current = view;
		window.scrollTo({ top: 0, behavior: "instant" });
	}, [view]);

	const showSectionNav = view === "about" && sectionNavItems.length >= 2;

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			<MovieReviewDeepLinkOpener />
			<MovieDetailTopBar
				movieId={movieId}
				title={title}
				view={view}
				detailBasePath={basePath}
				listingKind={listingKind}
				tvQuoteEpisode={tvQuoteEpisode}
				onViewChange={setView}
			/>
			{showSectionNav ? (
				<MovieDetailSectionNav sections={sectionNavItems} />
			) : null}

			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"relative flex min-h-0 flex-1 flex-col overflow-x-clip overflow-y-visible",
				)}
			>
				<ListingPresenceProvider
					listingKind={listingKind}
					listingId={movieId}
				/>
				<article
					className={cn(
						"flex min-h-0 flex-1 flex-col",
						showSectionNav && MOVIE_DETAIL_SECTION_NAV_GUTTER_CLASS,
					)}
				>
					{/* Stable keyed slots — RSC Suspense panels must not be conditional direct
					    siblings in the article array (Turbopack key warning). */}
					<div key="movie-detail-tab-hero">
						{view === "about" ? hero : null}
					</div>

					<div key="movie-detail-tab-streaming">
						{view === "streaming" ? (
							<div className="mx-auto flex w-full max-w-2xl flex-col px-2.5 pt-6 pb-8 sm:px-3 sm:pt-8 sm:pb-10">
								<MovieDetailStreaming
									watchProviders={watchProviders}
									theatricalOnly={theatricalOnly}
								/>
							</div>
						) : null}
					</div>

					<div key="movie-detail-tab-about">
						{view === "about" ? about : null}
					</div>

					<div key="movie-detail-tab-community">
						{view === "community" ? community : null}
					</div>

					<div key="movie-detail-tab-quotes">
						{view === "quotes" ? quotes : null}
					</div>
				</article>
			</section>
		</div>
	);
}

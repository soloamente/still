"use client";

import { cn } from "@still/ui/lib/utils";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

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

	useEffect(() => {
		setView(urlView);
	}, [urlView]);

	const showSectionNav = view === "about" && sectionNavItems.length >= 2;

	return (
		<div className="flex flex-1 flex-col bg-background">
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
					"relative flex-1 overflow-x-clip overflow-y-visible",
				)}
			>
				<ListingPresenceProvider
					listingKind={listingKind}
					listingId={movieId}
				/>
				<article
					className={cn(
						"flex flex-1 flex-col",
						showSectionNav && MOVIE_DETAIL_SECTION_NAV_GUTTER_CLASS,
					)}
				>
					{hero}

					<div
						className="mx-auto flex w-full max-w-2xl flex-col px-2.5 pt-6 pb-8 sm:px-3 sm:pt-8 sm:pb-10"
						hidden={view !== "streaming"}
					>
						<MovieDetailStreaming watchProviders={watchProviders} />
					</div>
					<div hidden={view !== "about"}>{about}</div>
					<div hidden={view !== "community"}>{community}</div>
					{/* Unmount quotes off-tab — TV episode picker auto-defaults sync ?view=quotes. */}
					{view === "quotes" ? quotes : null}
				</article>
			</section>
		</div>
	);
}

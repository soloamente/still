"use client";

import { cn } from "@still/ui/lib/utils";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { LobbyNavigationProvider } from "@/components/lobby/lobby-navigation-provider";
import { MovieDetailSectionNav } from "@/components/movie/movie-detail-section-nav";
import { MovieDetailStreaming } from "@/components/movie/movie-detail-streaming";
import { MovieDetailTopBar } from "@/components/movie/movie-detail-top-bar";
import { MovieReviewDeepLinkOpener } from "@/components/review/movie-review-deep-link-opener";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import type { MovieDetailSectionNavItem } from "@/lib/movie-detail-sections";
import { MOVIE_DETAIL_SECTION_NAV_GUTTER_CLASS } from "@/lib/movie-detail-sections";
import {
	type MovieDetailView,
	parseMovieDetailView,
} from "@/lib/movie-detail-view";
import type { MovieWatchProvidersViewModel } from "@/lib/movie-watch-providers";

/**
 * Client shell for film/TV detail — instant About/Streaming tab switches without
 * freezing sticky chrome; About body streams in via RSC Suspense sibling.
 */
export function MovieDetailViewShell({
	initialView,
	basePath,
	movieId,
	title,
	sectionNavItems,
	hero,
	watchProviders,
	about,
}: {
	initialView: MovieDetailView;
	basePath: string;
	movieId: number;
	title: string;
	sectionNavItems: MovieDetailSectionNavItem[];
	hero: ReactNode;
	watchProviders: MovieWatchProvidersViewModel;
	about: ReactNode;
}) {
	return (
		<LobbyNavigationProvider>
			<MovieDetailViewShellBody
				initialView={initialView}
				basePath={basePath}
				movieId={movieId}
				title={title}
				sectionNavItems={sectionNavItems}
				hero={hero}
				watchProviders={watchProviders}
				about={about}
			/>
		</LobbyNavigationProvider>
	);
}

function MovieDetailViewShellBody({
	initialView,
	basePath,
	movieId,
	title,
	sectionNavItems,
	hero,
	watchProviders,
	about,
}: {
	initialView: MovieDetailView;
	basePath: string;
	movieId: number;
	title: string;
	sectionNavItems: MovieDetailSectionNavItem[];
	hero: ReactNode;
	watchProviders: MovieWatchProvidersViewModel;
	about: ReactNode;
}) {
	const searchParams = useSearchParams();
	const urlView = parseMovieDetailView(searchParams.get("view") ?? initialView);
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
				onViewChange={setView}
			/>
			{showSectionNav ? (
				<MovieDetailSectionNav sections={sectionNavItems} />
			) : null}

			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"flex-1 overflow-x-clip overflow-y-visible",
				)}
			>
				<article
					className={cn(
						"flex flex-1 flex-col",
						showSectionNav && MOVIE_DETAIL_SECTION_NAV_GUTTER_CLASS,
					)}
				>
					{hero}

					{/* Keep both panels mounted so Streaming ↔ About is instant after first paint. */}
					<div
						className="mx-auto flex w-full max-w-2xl flex-col px-2.5 pt-6 pb-8 sm:px-3 sm:pt-8 sm:pb-10"
						hidden={view !== "streaming"}
					>
						<MovieDetailStreaming watchProviders={watchProviders} />
					</div>
					<div hidden={view !== "about"}>{about}</div>
				</article>
			</section>
		</div>
	);
}

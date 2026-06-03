"use client";

import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { DiaryLobbyChrome } from "@/components/diary/diary-lobby-chrome";
import { DiaryLobbyInfinite } from "@/components/diary/diary-lobby-infinite";
import {
	DiaryLobbyParamsProvider,
	useDiaryLobbyParams,
} from "@/components/diary/diary-lobby-params-context";
import {
	LobbyNavigationProvider,
	useLobbyNavigation,
} from "@/components/lobby/lobby-navigation-provider";
import { buildDiaryLobbyHref } from "@/lib/diary-lobby-order";
import type { DiarySeed } from "@/lib/fetch-my-diary-server";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import type { HomeVenue } from "@/lib/home-venue";

export interface DiaryPatronLobbyShellProps {
	seed: DiarySeed;
	media: "movie" | "tv";
	endpointOrder: "latest" | "earliest" | "title";
	venue: HomeVenue;
	monochromePeersOnHover: boolean;
}

function DiaryPatronLobbyBody(props: DiaryPatronLobbyShellProps) {
	const { seed, media, endpointOrder, venue, monochromePeersOnHover } = props;
	const { ledgerTab } = useDiaryLobbyParams();
	const { navigate } = useLobbyNavigation();

	const hasRows = seed.results.length > 0;
	const otherTab = ledgerTab === "movies" ? "tv" : "movies";
	const otherTabHasRows =
		otherTab === "movies" ? seed.tabCounts.movies > 0 : seed.tabCounts.tv > 0;
	const ledgerLabel = ledgerTab === "movies" ? "films" : "TV shows";
	const order =
		endpointOrder === "earliest"
			? "earliest_seen"
			: endpointOrder === "title"
				? "title_az"
				: "latest_seen";

	const switchVenueHref = buildDiaryLobbyHref({
		order,
		venue: venue === "theaters" ? "streaming" : "theaters",
		tab: ledgerTab,
	});
	const switchTabHref = buildDiaryLobbyHref({ order, venue, tab: otherTab });

	return (
		<section
			className={cn(
				HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
				"overflow-visible",
			)}
		>
			<DiaryLobbyChrome />

			{!hasRows ? (
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-6 sm:px-4 sm:py-10">
					<div
						className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border border-dashed bg-card/40 px-6 py-12 text-center sm:px-10 sm:py-14"
						role="status"
					>
						{seed.tabCounts.movies + seed.tabCounts.tv > 0 ? (
							otherTabHasRows ? (
								<>
									<div className="space-y-2">
										<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
											No {ledgerLabel} for{" "}
											{venue === "theaters" ? "in cinemas" : "at home"}
										</p>
										<p className="text-muted-foreground text-sm leading-relaxed">
											Switch the venue chip above, or check the other diary tab.
										</p>
									</div>
									<button
										type="button"
										className={buttonVariants({
											variant: "outline",
											size: "pill",
										})}
										onClick={() => navigate(switchVenueHref)}
									>
										Show {venue === "theaters" ? "at home" : "in cinemas"}{" "}
										instead
									</button>
									<button
										type="button"
										className={buttonVariants({
											variant: "outline",
											size: "pill",
										})}
										onClick={() => navigate(switchTabHref)}
									>
										Show {otherTab === "movies" ? "Movies" : "TV Shows"}
									</button>
								</>
							) : (
								<>
									<div className="space-y-2">
										<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
											No {ledgerLabel} for{" "}
											{venue === "theaters" ? "in cinemas" : "at home"}
										</p>
										<p className="text-muted-foreground text-sm leading-relaxed">
											Switch the venue chip above, or edit a screening and set
											where you watched.
										</p>
									</div>
									<button
										type="button"
										className={buttonVariants({
											variant: "outline",
											size: "pill",
										})}
										onClick={() => navigate(switchVenueHref)}
									>
										Show {venue === "theaters" ? "at home" : "in cinemas"}{" "}
										instead
									</button>
								</>
							)
						) : (
							<>
								<div className="space-y-2">
									<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
										No screenings logged yet
									</p>
									<p className="text-muted-foreground text-sm leading-relaxed">
										Your diary will mirror the home lobby grid — open a film and
										tap <em>Log</em> to fill this wall.
									</p>
								</div>
								<Link
									href="/home"
									className={buttonVariants({
										variant: "outline",
										size: "pill",
									})}
								>
									Search films
								</Link>
							</>
						)}
					</div>
				</div>
			) : (
				<DiaryLobbyInfinite
					seeds={seed.results}
					totalPages={seed.total_pages}
					query={{ media, order: endpointOrder, venue }}
					monochromePeersOnHover={monochromePeersOnHover}
				/>
			)}
		</section>
	);
}

/** Client `/diary` lobby — server seeds page 1; chips re-seed via the URL. */
export function DiaryPatronLobbyShell(props: DiaryPatronLobbyShellProps) {
	return (
		<LobbyNavigationProvider>
			<DiaryLobbyParamsProvider
				movieCount={props.seed.tabCounts.movies}
				tvCount={props.seed.tabCounts.tv}
			>
				<DiaryPatronLobbyBody {...props} />
			</DiaryLobbyParamsProvider>
		</LobbyNavigationProvider>
	);
}

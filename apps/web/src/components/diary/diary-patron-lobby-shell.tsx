"use client";

import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useMemo } from "react";
import { DiaryCatalogOrderChips } from "@/components/diary/diary-catalog-order-chips";
import type { DiaryLogRow } from "@/components/diary/diary-entry";
import { DiaryLobbyCatalogue } from "@/components/diary/diary-lobby-catalogue";
import {
	DiaryLobbyParamsProvider,
	useDiaryLobbyParams,
} from "@/components/diary/diary-lobby-params-context";
import { DiaryVenueChips } from "@/components/diary/diary-venue-chips";
import {
	LobbyNavigationProvider,
	useLobbyNavigation,
} from "@/components/lobby/lobby-navigation-provider";
import { buildDiaryLobbyGridItems } from "@/lib/diary-lobby-grouping";
import {
	buildDiaryLobbyHref,
	diaryLogMatchesDiaryLobbyVenue,
	isDiaryLogWithListing,
	sortDiaryLobbyRowsForOrder,
} from "@/lib/diary-lobby-order";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

export interface DiaryPatronLobbyShellProps {
	rawRows: DiaryLogRow[];
	monochromePeersOnHover: boolean;
	signedIn: boolean;
}

function DiaryPatronLobbyBody({
	rawRows,
	monochromePeersOnHover,
	signedIn,
}: DiaryPatronLobbyShellProps) {
	const { order, venue } = useDiaryLobbyParams();
	const { navigate } = useLobbyNavigation();

	const withListing = useMemo(
		() => rawRows.filter(isDiaryLogWithListing),
		[rawRows],
	);
	const hasAnyDiaryLogs = withListing.length > 0;

	const gridItems = useMemo(() => {
		const forVenue = withListing.filter((row) =>
			diaryLogMatchesDiaryLobbyVenue(row, venue),
		);
		const lobbyRows = sortDiaryLobbyRowsForOrder(forVenue, order);
		return buildDiaryLobbyGridItems(lobbyRows, order);
	}, [withListing, venue, order]);

	const catalogueWaveKeyOverride = useMemo(
		() => `${order}::${gridItems.map((item) => item.key).join("|")}`,
		[order, gridItems],
	);

	const hasRows = gridItems.length > 0;
	const switchVenueHref = buildDiaryLobbyHref({
		order,
		venue: venue === "theaters" ? "streaming" : "theaters",
	});

	return (
		<section
			className={cn(
				HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
				"overflow-visible",
			)}
		>
			<div className="flex shrink-0 items-center justify-between gap-3">
				<DiaryCatalogOrderChips />
				<DiaryVenueChips />
			</div>

			{!hasRows ? (
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-6 sm:px-4 sm:py-10">
					<div
						className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border border-dashed bg-card/40 px-6 py-12 text-center sm:px-10 sm:py-14"
						role="status"
					>
						{hasAnyDiaryLogs ? (
							<>
								<div className="space-y-2">
									<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
										No logs for{" "}
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
									Show {venue === "theaters" ? "at home" : "in cinemas"} instead
								</button>
							</>
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
				<DiaryLobbyCatalogue
					catalogueWaveKeyOverride={catalogueWaveKeyOverride}
					items={gridItems}
					monochromePeersOnHover={monochromePeersOnHover}
					signedIn={signedIn}
				/>
			)}
		</section>
	);
}

/**
 * Client `/diary` lobby — filters patron logs locally so venue/order chips feel instant.
 */
export function DiaryPatronLobbyShell(props: DiaryPatronLobbyShellProps) {
	return (
		<LobbyNavigationProvider>
			<DiaryLobbyParamsProvider>
				<DiaryPatronLobbyBody {...props} />
			</DiaryLobbyParamsProvider>
		</LobbyNavigationProvider>
	);
}

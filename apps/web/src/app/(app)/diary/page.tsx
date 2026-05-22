import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
	LobbyCatalogChipFallback,
	LobbyStickyChromeFallback,
	LobbyVenueChipFallback,
} from "@/components/app/lobby-suspense-fallbacks";
import { DiaryCatalogOrderChips } from "@/components/diary/diary-catalog-order-chips";
import { DiaryLobbyCatalogue } from "@/components/diary/diary-lobby-catalogue";
import { CatalogWatchRegionPrompt } from "@/components/home/catalog-watch-region-prompt";
import { HomeCatalogViewModeToolbar } from "@/components/home/home-catalog-view-mode-toolbar";
import { HomeStickyChrome } from "@/components/home/home-sticky-chrome";
import { authServer } from "@/lib/auth-server";
import { buildDiaryLobbyGridItems } from "@/lib/diary-lobby-grouping";
import {
	buildDiaryLobbyHref,
	diaryLogMatchesDiaryLobbyVenue,
	isDiaryLogWithListing,
	parseDiaryLobbyOrder,
	parseDiaryLobbyVenue,
	sortDiaryLobbyRowsForOrder,
} from "@/lib/diary-lobby-order";
import { fetchMyLogsMeServer } from "@/lib/fetch-my-logs-me-server";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import {
	readCatalogMonochromePeersOnHoverPref,
	readCatalogTmdbWatchRegionPref,
} from "@/lib/profile-preferences";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Diary" };
export const dynamic = "force-dynamic";

export default async function DiaryPage({
	searchParams,
}: {
	searchParams: Promise<{ order?: string; venue?: string }>;
}) {
	const sp = await searchParams;
	const lobbyOrder = parseDiaryLobbyOrder(sp.order);
	const lobbyVenue = parseDiaryLobbyVenue(sp.venue);
	const switchVenueHref = buildDiaryLobbyHref({
		order: lobbyOrder,
		venue: lobbyVenue === "theaters" ? "streaming" : "theaters",
	});

	const [session, api] = await Promise.all([authServer(), serverApi()]);
	const [raw, profileRes] = await Promise.all([
		fetchMyLogsMeServer(api),
		api.api.profiles.me.get().catch(() => ({ data: null })),
	]);
	const profileData = profileRes.data as {
		handle: string;
		displayName: string;
		preferences?: Record<string, unknown> | null;
	} | null;
	const mePrefs = profileData?.preferences ?? null;
	const monochromePeersOnHover = readCatalogMonochromePeersOnHoverPref(mePrefs);
	const catalogWatchPref = readCatalogTmdbWatchRegionPref(mePrefs);
	const needsCatalogWatchRegionPrompt = Boolean(
		session && catalogWatchPref === null,
	);

	const stickyUser =
		session && profileData?.handle
			? {
					id: session.user.id,
					name: session.user.name ?? profileData.displayName ?? "You",
					image: session.user.image ?? null,
					handle: profileData.handle,
					email: session.user.email ?? null,
				}
			: null;

	const withListing = raw.filter(isDiaryLogWithListing);
	const hasAnyDiaryLogs = withListing.length > 0;
	const forVenue = withListing.filter((r) =>
		diaryLogMatchesDiaryLobbyVenue(r, lobbyVenue),
	);
	const lobbyRows = sortDiaryLobbyRowsForOrder(forVenue, lobbyOrder);

	const gridItems = buildDiaryLobbyGridItems(lobbyRows, lobbyOrder);
	const catalogueWaveKeyOverride = `${lobbyOrder}:${lobbyVenue}:${gridItems.map((item) => item.key).join("|")}`;
	const hasRows = gridItems.length > 0;

	return (
		// Match `/home` shell ÔÇö fills `<main>` from `AppShell` (`flex-1 min-h-0` + bottom reserve).
		<div className="flex min-h-0 flex-1 flex-col overflow-visible bg-background">
			<Suspense fallback={<LobbyStickyChromeFallback />}>
				<HomeStickyChrome user={stickyUser} />
			</Suspense>

			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"overflow-visible",
				)}
			>
				<div className="flex shrink-0 items-center justify-between gap-3">
					<Suspense fallback={<LobbyCatalogChipFallback />}>
						<DiaryCatalogOrderChips />
					</Suspense>
					<Suspense fallback={<LobbyVenueChipFallback />}>
						<HomeCatalogViewModeToolbar />
					</Suspense>
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
											{lobbyVenue === "theaters" ? "in cinemas" : "at home"}
										</p>
										<p className="text-muted-foreground text-sm leading-relaxed">
											Switch the venue chip above, or edit a screening and set
											where you watched.
										</p>
									</div>
									<Link
										href={switchVenueHref}
										className={buttonVariants({
											variant: "outline",
											size: "pill",
										})}
									>
										Show {lobbyVenue === "theaters" ? "at home" : "in cinemas"}{" "}
										instead
									</Link>
								</>
							) : (
								<>
									<div className="space-y-2">
										<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
											No screenings logged yet
										</p>
										<p className="text-muted-foreground text-sm leading-relaxed">
											Your diary will mirror the home lobby grid ÔÇö open a film
											and tap <em>Log</em> to fill this wall.
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
					/>
				)}
			</section>

			{session ? (
				<CatalogWatchRegionPrompt open={needsCatalogWatchRegionPrompt} />
			) : null}
		</div>
	);
}

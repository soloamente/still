import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
	LobbyCatalogChipFallback,
	LobbyStickyChromeFallback,
} from "@/components/app/lobby-suspense-fallbacks";
import { HomeStickyChrome } from "@/components/home/home-sticky-chrome";
import { ListsCatalogOrderChips } from "@/components/list/lists-catalog-order-chips";
import { ListsLobbyCatalogue } from "@/components/list/lists-lobby-catalogue";
import { ListsNewListButton } from "@/components/list/lists-new-list-button";
import { authServer } from "@/lib/auth-server";
import type { MeProfile } from "@/lib/fetch-me-profile";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import { toListBoardRow } from "@/lib/list-board-row";
import {
	listBoardRowToLobbySeed,
	parseListsLobbyOrder,
	sortListsLobbyRows,
} from "@/lib/lists-lobby-order";
import { buildPatronNavUserOrNull } from "@/lib/patron-nav-user";
import { readCatalogMonochromePeersOnHoverPref } from "@/lib/profile-preferences";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Lists" };
export const dynamic = "force-dynamic";

export default async function ListsPage({
	searchParams,
}: {
	searchParams: Promise<{ order?: string }>;
}) {
	const sp = await searchParams;
	const lobbyOrder = parseListsLobbyOrder(sp.order);

	const session = await authServer();

	// Guests browse an empty lobby — do not hit `/api/lists/me` or profile.
	if (!session) {
		return (
			<div className="flex flex-1 flex-col overflow-visible bg-background">
				<Suspense fallback={<LobbyStickyChromeFallback />}>
					<HomeStickyChrome user={null} />
				</Suspense>

				<section
					className={cn(
						HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
						"overflow-visible",
					)}
				>
					<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-10 sm:px-4 sm:py-16">
						<div
							className="flex w-full max-w-md flex-col items-center gap-5 rounded-[2rem] bg-background px-6 py-12 text-center sm:px-10 sm:py-14"
							role="status"
						>
							<div className="flex flex-col gap-2">
								<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
									No lists yet
								</p>
								<p className="text-pretty text-muted-foreground text-sm leading-relaxed">
									Group titles into a list — a genre lane, a year, a shared
									canon — then open it from here.
								</p>
							</div>
							<ListsNewListButton label="Create your first list" />
							<Link
								href="/home"
								className={cn(
									buttonVariants({
										variant: "ghost",
										size: "pill",
									}),
									"min-h-11",
								)}
							>
								Browse films and shows
							</Link>
						</div>
					</div>
				</section>
			</div>
		);
	}

	const api = await serverApi();
	const [mineRes, profileRes] = await Promise.all([
		api.api.lists.me.get().catch(() => ({ data: [] })),
		api.api.profiles.me.get().catch(() => ({ data: null })),
	]);

	const profileData = profileRes.data as Exclude<MeProfile, null> | null;

	const mePrefs = profileData?.preferences ?? null;
	const monochromePeersOnHover = readCatalogMonochromePeersOnHoverPref(mePrefs);

	const stickyUser = buildPatronNavUserOrNull(session, profileData);

	const raw = ((mineRes.data as unknown[]) ?? []).map(toListBoardRow);
	const lobbyRows = sortListsLobbyRows(raw, lobbyOrder);
	const seeds = lobbyRows.map(listBoardRowToLobbySeed);
	const hasRows = seeds.length > 0;

	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<Suspense fallback={<LobbyStickyChromeFallback />}>
				<HomeStickyChrome user={stickyUser} />
			</Suspense>

			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"overflow-visible",
				)}
			>
				{hasRows ? (
					<div className="flex shrink-0 items-center justify-between gap-2">
						<Suspense fallback={<LobbyCatalogChipFallback />}>
							<ListsCatalogOrderChips />
						</Suspense>
						<div className="flex shrink-0 items-center">
							<ListsNewListButton />
						</div>
					</div>
				) : null}

				{!hasRows ? (
					<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-10 sm:px-4 sm:py-16">
						<div
							className="flex w-full max-w-md flex-col items-center gap-5 rounded-[2rem] bg-background px-6 py-12 text-center sm:px-10 sm:py-14"
							role="status"
						>
							<div className="flex flex-col gap-2">
								<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
									No lists yet
								</p>
								<p className="text-pretty text-muted-foreground text-sm leading-relaxed">
									Group titles into a list — a genre lane, a year, a shared
									canon — then open it from here.
								</p>
							</div>
							<ListsNewListButton label="Create your first list" />
							<Link
								href="/home"
								className={cn(
									buttonVariants({
										variant: "ghost",
										size: "pill",
									}),
									"min-h-11",
								)}
							>
								Browse films and shows
							</Link>
						</div>
					</div>
				) : (
					<ListsLobbyCatalogue
						monochromePeersOnHover={monochromePeersOnHover}
						seeds={seeds}
					/>
				)}
			</section>
		</div>
	);
}

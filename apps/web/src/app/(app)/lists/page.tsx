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
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import { toListBoardRow } from "@/lib/list-board-row";
import {
	listBoardRowToLobbySeed,
	parseListsLobbyOrder,
	sortListsLobbyRows,
} from "@/lib/lists-lobby-order";
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

	const [session, api] = await Promise.all([authServer(), serverApi()]);
	const [mineRes, profileRes] = await Promise.all([
		api.api.lists.me.get().catch(() => ({ data: [] })),
		api.api.profiles.me.get().catch(() => ({ data: null })),
	]);

	const profileData = profileRes.data as {
		handle: string;
		displayName: string;
		preferences?: Record<string, unknown> | null;
	} | null;

	const mePrefs = profileData?.preferences ?? null;
	const monochromePeersOnHover = readCatalogMonochromePeersOnHoverPref(mePrefs);

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

	const raw = ((mineRes.data as unknown[]) ?? []).map(toListBoardRow);
	const lobbyRows = sortListsLobbyRows(raw, lobbyOrder);
	const seeds = lobbyRows.map(listBoardRowToLobbySeed);
	const catalogueWaveKeyOverride = `${lobbyOrder}:${seeds.map((s) => s.id).join("|")}`;
	const hasRows = seeds.length > 0;

	return (
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
						<ListsCatalogOrderChips />
					</Suspense>
					<div className="flex shrink-0 items-center">
						<ListsNewListButton />
					</div>
				</div>

				{!hasRows ? (
					<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-6 sm:px-4 sm:py-10">
						<div
							className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border border-dashed bg-card/40 px-6 py-12 text-center sm:px-10 sm:py-14"
							role="status"
						>
							<div className="space-y-2">
								<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
									No lists yet
								</p>
								<p className="text-muted-foreground text-sm leading-relaxed">
									When you want to group titles — a genre lane, an annual top
									ten, a shared canon — tap{" "}
									<strong className="text-foreground">New list</strong> or save
									from any film page with{" "}
									<strong className="text-foreground">Add to list</strong>.
								</p>
							</div>
							<ListsNewListButton label="Create your first list" />
							<Link
								href="/home"
								className={buttonVariants({
									variant: "ghost",
									size: "pill",
								})}
							>
								Browse films and shows
							</Link>
						</div>
					</div>
				) : (
					<ListsLobbyCatalogue
						catalogueWaveKeyOverride={catalogueWaveKeyOverride}
						monochromePeersOnHover={monochromePeersOnHover}
						seeds={seeds}
					/>
				)}
			</section>
		</div>
	);
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { LobbyStickyChromeFallback } from "@/components/app/lobby-suspense-fallbacks";
import { CatalogWatchRegionPrompt } from "@/components/home/catalog-watch-region-prompt";
import { HomeStickyChrome } from "@/components/home/home-sticky-chrome";
import { WatchlistLobbyCatalogue } from "@/components/watchlist/watchlist-lobby-catalogue";
import { WatchlistLobbyFallback } from "@/components/watchlist/watchlist-lobby-fallback";
import { WatchlistPatronLobbyShell } from "@/components/watchlist/watchlist-patron-lobby-shell";
import { authServer } from "@/lib/auth-server";
import { fetchMyWatchlistServer } from "@/lib/fetch-my-watchlist-server";
import {
	readCatalogMonochromePeersOnHoverPref,
	readCatalogTmdbWatchRegionPref,
} from "@/lib/profile-preferences";
import { serverApi } from "@/lib/server-api";
import { parseWatchlistLobbyOrder } from "@/lib/watchlist-lobby-order";

export const metadata: Metadata = { title: "Watchlist" };
export const dynamic = "force-dynamic";

/** Streamed grid — only this awaits the (slow) watchlist query. */
async function WatchlistLobbyData({
	order,
	monochromePeersOnHover,
	signedIn,
}: {
	order: string;
	monochromePeersOnHover: boolean;
	signedIn: boolean;
}) {
	const { seeds, totalPages, totalResults } = await fetchMyWatchlistServer({
		order,
	});
	return (
		<WatchlistLobbyCatalogue
			seeds={seeds}
			totalPages={totalPages}
			totalResults={totalResults}
			monochromePeersOnHover={monochromePeersOnHover}
			signedIn={signedIn}
		/>
	);
}

export default async function WatchlistPage({
	searchParams,
}: {
	searchParams: Promise<{ order?: string }>;
}) {
	const sp = await searchParams;
	const order = parseWatchlistLobbyOrder(sp?.order);

	const [session, api] = await Promise.all([authServer(), serverApi()]);
	const profileRes = await api.api.profiles.me
		.get()
		.catch(() => ({ data: null }));

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

	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<Suspense fallback={<LobbyStickyChromeFallback />}>
				<HomeStickyChrome user={stickyUser} />
			</Suspense>

			<WatchlistPatronLobbyShell>
				<Suspense fallback={<WatchlistLobbyFallback />}>
					<WatchlistLobbyData
						order={order}
						monochromePeersOnHover={monochromePeersOnHover}
						signedIn={Boolean(session)}
					/>
				</Suspense>
			</WatchlistPatronLobbyShell>

			{session ? (
				<CatalogWatchRegionPrompt open={needsCatalogWatchRegionPrompt} />
			) : null}
		</div>
	);
}

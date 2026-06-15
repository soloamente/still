import type { Metadata } from "next";
import { cache, Suspense } from "react";

import { CatalogWatchRegionPrompt } from "@/components/home/catalog-watch-region-prompt";
import { HomeStickyChrome } from "@/components/home/home-sticky-chrome";
import { WatchlistLobbyCatalogue } from "@/components/watchlist/watchlist-lobby-catalogue";
import { WatchlistLobbyFallback } from "@/components/watchlist/watchlist-lobby-fallback";
import { WatchlistPatronLobbyShell } from "@/components/watchlist/watchlist-patron-lobby-shell";
import { authServer } from "@/lib/auth-server";
import type { MeProfile } from "@/lib/fetch-me-profile";
import { fetchMyWatchlistServer } from "@/lib/fetch-my-watchlist-server";
import { buildPatronNavUserOrNull } from "@/lib/patron-nav-user";
import {
	readCatalogMonochromePeersOnHoverPref,
	readCatalogTmdbWatchRegionPref,
} from "@/lib/profile-preferences";
import { serverApi } from "@/lib/server-api";
import { parseWatchlistLobbyOrder } from "@/lib/watchlist-lobby-order";

export const metadata: Metadata = { title: "Watchlist" };
export const dynamic = "force-dynamic";

/**
 * Session + profile for the page chrome. `cache()` dedupes it across the chrome and
 * grid boundaries so the page body itself never blocks — that keeps the route-level
 * `(app)/loading.tsx` skeleton from flashing, leaving the poster grid as the only
 * visible loading state.
 */
const loadWatchlistChromeContext = cache(async () => {
	const [session, api] = await Promise.all([authServer(), serverApi()]);
	const profileRes = await api.api.profiles.me
		.get()
		.catch(() => ({ data: null }));

	const profileData = profileRes.data as Exclude<MeProfile, null> | null;

	const mePrefs = profileData?.preferences ?? null;
	const stickyUser = buildPatronNavUserOrNull(session, profileData);

	return {
		signedIn: Boolean(session),
		stickyUser,
		monochromePeersOnHover: readCatalogMonochromePeersOnHoverPref(mePrefs),
		needsCatalogWatchRegionPrompt: Boolean(
			session && readCatalogTmdbWatchRegionPref(mePrefs) === null,
		),
	};
});

/** Sticky header — streams in with no skeleton (no second "UI" loader). */
async function WatchlistChrome() {
	const { stickyUser, signedIn, needsCatalogWatchRegionPrompt } =
		await loadWatchlistChromeContext();
	return (
		<>
			<HomeStickyChrome user={stickyUser} />
			{signedIn ? (
				<CatalogWatchRegionPrompt open={needsCatalogWatchRegionPrompt} />
			) : null}
		</>
	);
}

/** Streamed grid — the watchlist query is the only thing behind the poster shimmer. */
async function WatchlistLobbyData({ order }: { order: string }) {
	const [
		{ monochromePeersOnHover, signedIn },
		{ seeds, totalPages, totalResults },
	] = await Promise.all([
		loadWatchlistChromeContext(),
		fetchMyWatchlistServer({ order }),
	]);
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

	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			{/* No fallback — the header just appears; no separate "UI" loader. */}
			<Suspense fallback={null}>
				<WatchlistChrome />
			</Suspense>

			<WatchlistPatronLobbyShell>
				<Suspense fallback={<WatchlistLobbyFallback />}>
					<WatchlistLobbyData order={order} />
				</Suspense>
			</WatchlistPatronLobbyShell>
		</div>
	);
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { WatchlistLobbyCatalogue } from "@/components/watchlist/watchlist-lobby-catalogue";
import { WatchlistLobbyFallback } from "@/components/watchlist/watchlist-lobby-fallback";
import { fetchMyWatchlistServer } from "@/lib/fetch-my-watchlist-server";
import {
	parseWatchlistLobbyOrder,
	resolveWatchlistLegacyRedirect,
} from "@/lib/watchlist-lobby-order";
import { parseWatchlistProviderIds } from "@/lib/watchlist-provider-filter";

export const metadata: Metadata = { title: "Watchlist" };
export const dynamic = "force-dynamic";

type WatchlistSearchParams = {
	order?: string;
	providers?: string;
	filters?: string;
};

/**
 * Streamed grid — the watchlist query is the only thing behind the poster shimmer.
 * `searchParams` is awaited **here** (inside the inner Suspense), not in the page
 * body, so changing `?order=` does not suspend the layout chip rail.
 *
 * `key` remounts the catalogue per sort + provider filter so each view records one
 * `watchlist.mode_viewed` impression.
 */
async function WatchlistLobbyData({
	searchParams,
}: {
	searchParams: Promise<WatchlistSearchParams>;
}) {
	const sp = await searchParams;
	const order = parseWatchlistLobbyOrder(sp?.order);
	const providers = parseWatchlistProviderIds(sp?.providers);

	const { seeds, totalPages, totalResults, needsRegion, region, failed } =
		await fetchMyWatchlistServer({ order, providers });
	return (
		<WatchlistLobbyCatalogue
			key={`${order}:${providers.join(",")}`}
			order={order}
			providers={providers}
			seeds={seeds}
			totalPages={totalPages}
			totalResults={totalResults}
			needsRegion={needsRegion}
			region={region}
			failed={failed}
		/>
	);
}

/**
 * Sync page — passing the `searchParams` Promise into the inner boundary means
 * this module never suspends on order changes, so `loading.tsx` does not replace
 * the wall on chip taps (layout chips stay mounted either way).
 */
export default async function WatchlistPage({
	searchParams,
}: {
	searchParams: Promise<WatchlistSearchParams>;
}) {
	const sp = await searchParams;
	const legacyHref = resolveWatchlistLegacyRedirect(sp);
	if (legacyHref != null) redirect(legacyHref);

	return (
		<Suspense fallback={<WatchlistLobbyFallback />}>
			<WatchlistLobbyData searchParams={searchParams} />
		</Suspense>
	);
}

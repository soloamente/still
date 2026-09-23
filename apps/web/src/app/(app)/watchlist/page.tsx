import type { Metadata } from "next";
import { Suspense } from "react";
import { WatchlistLobbyCatalogue } from "@/components/watchlist/watchlist-lobby-catalogue";
import { WatchlistLobbyFallback } from "@/components/watchlist/watchlist-lobby-fallback";
import { fetchMyWatchlistServer } from "@/lib/fetch-my-watchlist-server";
import { parseWatchlistLobbyOrder } from "@/lib/watchlist-lobby-order";

export const metadata: Metadata = { title: "Watchlist" };
export const dynamic = "force-dynamic";

/**
 * Streamed grid — the watchlist query is the only thing behind the poster shimmer.
 * `searchParams` is awaited **here** (inside the inner Suspense), not in the page
 * body, so changing `?order=` does not suspend the layout chip rail.
 */
async function WatchlistLobbyData({
	searchParams,
}: {
	searchParams: Promise<{ order?: string }>;
}) {
	const sp = await searchParams;
	const order = parseWatchlistLobbyOrder(sp?.order);
	const { seeds, totalPages, totalResults } = await fetchMyWatchlistServer({
		order,
	});
	return (
		<WatchlistLobbyCatalogue
			order={order}
			seeds={seeds}
			totalPages={totalPages}
			totalResults={totalResults}
		/>
	);
}

/**
 * Sync page — passing the `searchParams` Promise into the inner boundary means
 * this module never suspends on order changes, so `loading.tsx` does not replace
 * the wall on chip taps (layout chips stay mounted either way).
 */
export default function WatchlistPage({
	searchParams,
}: {
	searchParams: Promise<{ order?: string }>;
}) {
	return (
		<Suspense fallback={<WatchlistLobbyFallback />}>
			<WatchlistLobbyData searchParams={searchParams} />
		</Suspense>
	);
}

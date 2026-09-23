import type { Metadata } from "next";
import { Suspense } from "react";
import { WatchlistLobbyCatalogue } from "@/components/watchlist/watchlist-lobby-catalogue";
import { WatchlistLobbyFallback } from "@/components/watchlist/watchlist-lobby-fallback";
import { fetchMyWatchlistServer } from "@/lib/fetch-my-watchlist-server";
import { fetchTvWatchMeServerResult } from "@/lib/fetch-tv-watch-me-server";
import {
	parseWatchlistLobbyOrder,
	sortContinueSeeds,
	tvWatchBundleToContinueSeed,
} from "@/lib/watchlist-lobby-order";

export const metadata: Metadata = { title: "Watchlist" };
export const dynamic = "force-dynamic";

/**
 * Streamed grid — the watchlist query is the only thing behind the poster shimmer.
 * `searchParams` is awaited **here** (inside the inner Suspense), not in the page
 * body, so changing `?order=` does not suspend the layout chip rail.
 *
 * `key={order}` remounts the catalogue per mode so each mode records exactly one
 * `watchlist.mode_viewed` impression.
 */
async function WatchlistLobbyData({
	searchParams,
}: {
	searchParams: Promise<{ order?: string }>;
}) {
	const sp = await searchParams;
	const order = parseWatchlistLobbyOrder(sp?.order);

	// Continue watching is served by `GET /api/tv-watch/me` — never `/api/watchlist`.
	if (order === "continue") {
		// Result variant so a tv-watch failure shows the retry state, not "No shows in progress".
		const { bundles, failed } = await fetchTvWatchMeServerResult(undefined, {
			status: "watching,rewatching",
			// Each row runs `buildWatchDto` (season/episode lookups) — keep it one lobby page.
			limit: 24,
		});
		const todayYmd = new Date().toISOString().slice(0, 10);
		const seeds = sortContinueSeeds(
			bundles
				.map((b) => tvWatchBundleToContinueSeed(b, todayYmd))
				.filter((s): s is NonNullable<typeof s> => s != null),
		);
		return (
			<WatchlistLobbyCatalogue
				key={order}
				order={order}
				seeds={seeds}
				totalPages={1}
				totalResults={seeds.length}
				needsRegion={false}
				region={undefined}
				failed={failed}
			/>
		);
	}

	const { seeds, totalPages, totalResults, needsRegion, region, failed } =
		await fetchMyWatchlistServer({ order });
	return (
		<WatchlistLobbyCatalogue
			key={order}
			order={order}
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

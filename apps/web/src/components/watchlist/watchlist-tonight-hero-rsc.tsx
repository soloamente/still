import { WatchlistTonightHero } from "@/components/watchlist/watchlist-tonight-hero";
import { fetchWatchlistTonightHeroServer } from "@/lib/fetch-watchlist-tonight-hero-server";

/** Isolated RSC boundary — tonight pool loads without blocking the poster grid. */
export async function WatchlistTonightHeroRsc() {
	const initial = await fetchWatchlistTonightHeroServer();
	return <WatchlistTonightHero initial={initial} />;
}

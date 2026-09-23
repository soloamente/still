import { HomeContinueWatchingRail } from "@/components/home/home-continue-watching-rail";
import { WatchlistTonightHero } from "@/components/watchlist/watchlist-tonight-hero";
import { fetchTvWatchMeServerResult } from "@/lib/fetch-tv-watch-me-server";
import { fetchWatchlistTonightHeroServer } from "@/lib/fetch-watchlist-tonight-hero-server";

/**
 * Hero + continue band — one RSC boundary so both reads run in parallel without
 * blocking the sort chips or poster grid.
 */
export async function WatchlistLobbyTopRsc() {
	const [hero, tvWatch] = await Promise.all([
		fetchWatchlistTonightHeroServer(),
		fetchTvWatchMeServerResult(undefined, {
			status: "watching,rewatching",
			limit: 12,
		}),
	]);

	const showContinue = !tvWatch.failed && tvWatch.bundles.length > 0;

	return (
		<div className="flex min-w-0 flex-col gap-3 pb-1">
			<WatchlistTonightHero initial={hero} />
			{showContinue ? (
				// Same stacking as Today week/circle under the pick hero bleed.
				<div className="relative z-10 min-w-0">
					<HomeContinueWatchingRail
						items={tvWatch.bundles}
						heading="Or continue watching"
					/>
				</div>
			) : null}
		</div>
	);
}

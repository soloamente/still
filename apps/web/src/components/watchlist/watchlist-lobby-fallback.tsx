import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";

import { HOME_LOBBY_CATALOGUE_GRID_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

/** Poster-wall placeholder shown while page 1 of the watchlist streams in. */
export function WatchlistLobbyFallback() {
	return (
		<div className={HOME_LOBBY_CATALOGUE_GRID_CLASSNAME} aria-hidden>
			{Array.from({ length: 12 }).map((_, i) => (
				<ShimmerBone
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder cells
					key={i}
					className="aspect-[2/3] w-full rounded-xl bg-card/60"
				/>
			))}
		</div>
	);
}

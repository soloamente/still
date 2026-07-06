"use client";

import { Lock } from "lucide-react";
import { CataloguePosterTile } from "@/components/catalogue/catalogue-poster-tile";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import type { LeaderboardLogItem } from "@/lib/home-leaderboard-types";
import { patronWatchLedgerPosterLabels } from "@/lib/patron-watch-ledger-poster-labels";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";

/** Same rounded poster tiles as {@link PersonFilmographyGrid}. */
const LEDGER_POSTER_FRAME_CLASSNAME = "rounded-2xl border-0";

/**
 * Watched titles in the leaderboard drawer — poster grid matching person filmography.
 */
export function PatronWatchLedgerGrid({
	items,
	kind,
	period,
	hiddenCount = 0,
}: {
	items: LeaderboardLogItem[];
	kind: "films" | "tv";
	period: HomeLeaderboardPeriod;
	hiddenCount?: number;
}) {
	if (!items.length && hiddenCount === 0) {
		return (
			<p
				className="rounded-2xl bg-muted/25 p-8 text-center text-muted-foreground text-sm"
				role="status"
			>
				No {kind === "tv" ? "show" : "film"} logs in this window.
			</p>
		);
	}

	return (
		<div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5">
			{items.map((item, index) => {
				const tmdbId = item.movieId ?? item.tvId;
				if (tmdbId == null) return null;

				const listingKind = item.tvId != null ? "tv" : "movie";
				const { posterCaption, posterCaptionSubline, metaLine } =
					patronWatchLedgerPosterLabels(item, period);

				return (
					<div key={item.logId} className="min-w-0 text-center">
						<CataloguePosterTile
							surface="drawer"
							listingKind={listingKind}
							tmdbId={tmdbId}
							title={item.title}
							posterUrl={tmdbPosterUrlFromPath(item.posterPath, "w342")}
							priority={index < 6}
							hoverEffect="elevation"
							hoverStacking="sheet"
							frameClassName={LEDGER_POSTER_FRAME_CLASSNAME}
							posterCaption={posterCaption}
							posterCaptionSubline={posterCaptionSubline}
						/>
						{metaLine ? (
							<p className="mt-1 line-clamp-3 text-center text-[10px] text-muted-foreground leading-snug">
								{metaLine}
							</p>
						) : null}
					</div>
				);
			})}
			{Array.from({ length: hiddenCount }).map((_, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: anonymous placeholder tiles — no identity, no state, never reordered
				<div key={`private-${index}`} className="min-w-0 text-center">
					{/* bg-background reads as a tile on the drawer's bg-card surface (muted ≈ card on Calm). */}
					<div className="relative flex aspect-2/3 flex-col items-center justify-center gap-1.5 rounded-2xl bg-background px-2">
						<Lock
							className="size-5 shrink-0 text-muted-foreground/70"
							aria-hidden
						/>
						<p className="text-balance text-center text-[10px] text-muted-foreground leading-snug">
							Private title
						</p>
					</div>
				</div>
			))}
		</div>
	);
}

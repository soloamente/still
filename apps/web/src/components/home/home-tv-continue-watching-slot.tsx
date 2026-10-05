"use client";

import { useHomeBrowseSurface } from "@/components/home/home-browse-surface-context";
import { HomeContinueWatchingRail } from "@/components/home/home-continue-watching-rail";
import type { TvWatchBundle } from "@/lib/tv-watch-types";

/**
 * TV lobby rail — sits under **Your week** / **From your circle**, not under the
 * Popular · Latest sort row (optimistic browse pill must hide it on Movies).
 */
export function HomeTvContinueWatchingSlot({
	items,
}: {
	items: TvWatchBundle[];
}) {
	const { activeBrowse } = useHomeBrowseSurface();
	if (activeBrowse !== "tv" || items.length === 0) return null;

	return (
		<div className="relative z-10 shrink-0">
			<HomeContinueWatchingRail items={items} />
		</div>
	);
}

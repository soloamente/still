"use client";

import {
	LobbyCatalogChipFallback,
	LobbyVenueChipFallback,
} from "@/components/app/lobby-suspense-fallbacks";
import { CommunityFeedSkeleton } from "@/components/home/community-feed-skeleton";

/**
 * Placeholder while the Community RSC payload loads after an optimistic browse tap.
 */
export function CommunityLobbySkeleton() {
	return (
		<div
			className="flex min-h-0 flex-1 flex-col gap-2.5"
			aria-busy
			aria-live="polite"
		>
			<p className="sr-only">Loading community…</p>
			<div className="flex shrink-0 items-center justify-between gap-3">
				<LobbyCatalogChipFallback />
				<LobbyVenueChipFallback />
			</div>
			{/* Default community tab is Lists — poster-wall silhouette. */}
			<CommunityFeedSkeleton feed="lists" />
		</div>
	);
}

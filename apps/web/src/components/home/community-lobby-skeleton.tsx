"use client";

import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";

import {
	LobbyCatalogChipFallback,
	LobbyVenueChipFallback,
} from "@/components/app/lobby-suspense-fallbacks";
import { HOME_LOBBY_CATALOGUE_GRID_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

const COMMUNITY_LOBBY_POSTER_SKELETON_KEYS = [
	"p01",
	"p02",
	"p03",
	"p04",
	"p05",
	"p06",
	"p07",
	"p08",
	"p09",
	"p10",
	"p11",
	"p12",
] as const;

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
			{/* Default feed is Lists — poster-wall silhouette */}
			<div
				className={`min-h-0 flex-1 px-0.5 pb-2 ${HOME_LOBBY_CATALOGUE_GRID_CLASSNAME}`}
			>
				{COMMUNITY_LOBBY_POSTER_SKELETON_KEYS.map((posterKey) => (
					<ShimmerBone
						key={`community-lobby-skel-poster-${posterKey}`}
						className="aspect-2/3 w-full rounded-[3rem] bg-background"
						aria-hidden
					/>
				))}
			</div>
		</div>
	);
}

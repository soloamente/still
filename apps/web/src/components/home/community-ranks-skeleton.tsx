"use client";

import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";

import { HOME_COMMUNITY_RANKS_PODIUM_TRAY_CLASSNAME } from "@/lib/home-community-ranks-layout";

const COMMUNITY_RANKS_ROW_SKELETON_KEYS = [
	"row-a",
	"row-b",
	"row-c",
	"row-d",
	"row-e",
] as const;

/** Placeholder podium + rows while deferred leaderboard maps load. */
export function CommunityRanksSkeleton() {
	return (
		<div
			className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-2"
			aria-busy
			aria-live="polite"
		>
			<p className="sr-only">Loading rankings…</p>
			<div className={HOME_COMMUNITY_RANKS_PODIUM_TRAY_CLASSNAME}>
				<div className="flex items-end justify-center gap-3">
					<ShimmerBone
						className="h-44 w-24 rounded-t-2xl bg-background"
						aria-hidden
					/>
					<ShimmerBone
						className="h-52 w-28 rounded-t-2xl bg-background"
						aria-hidden
					/>
					<ShimmerBone
						className="h-40 w-24 rounded-t-2xl bg-background"
						aria-hidden
					/>
				</div>
			</div>
			<ul className="flex flex-col gap-2">
				{COMMUNITY_RANKS_ROW_SKELETON_KEYS.map((rowKey) => (
					<ShimmerBone
						key={`community-ranks-row-skel-${rowKey}`}
						className="h-12 w-full rounded-xl bg-background"
						aria-hidden
					/>
				))}
			</ul>
		</div>
	);
}

"use client";

import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";

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
			className="flex min-h-0 flex-1 flex-col items-center gap-8 px-2 py-8"
			aria-busy
			aria-live="polite"
		>
			<p className="sr-only">Loading rankings…</p>
			<div className="flex w-full max-w-lg items-end justify-center gap-3">
				<ShimmerBone
					className="h-28 w-24 rounded-2xl bg-background"
					aria-hidden
				/>
				<ShimmerBone
					className="h-36 w-28 rounded-2xl bg-background"
					aria-hidden
				/>
				<ShimmerBone
					className="h-24 w-24 rounded-2xl bg-background"
					aria-hidden
				/>
			</div>
			<ul className="mx-auto flex w-full max-w-md flex-col gap-3">
				{COMMUNITY_RANKS_ROW_SKELETON_KEYS.map((rowKey) => (
					<ShimmerBone
						key={`community-ranks-row-skel-${rowKey}`}
						className="h-12 w-full rounded-2xl bg-background"
						aria-hidden
					/>
				))}
			</ul>
		</div>
	);
}

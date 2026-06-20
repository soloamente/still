"use client";

import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";

const STAFF_PLANS_SKELETON_ROW_IDS = [
	"staff-plans-row-a",
	"staff-plans-row-b",
	"staff-plans-row-c",
	"staff-plans-row-d",
	"staff-plans-row-e",
	"staff-plans-row-f",
] as const;

/** Grid-shaped loading placeholders while the plan catalogue fetches. */
export function StaffPlansLoadingSkeleton() {
	return (
		<div className="space-y-2 rounded-2xl bg-background p-2">
			<ShimmerBone className="h-9 w-full rounded-xl" />
			{STAFF_PLANS_SKELETON_ROW_IDS.map((rowId) => (
				<ShimmerBone key={rowId} className="h-11 w-full rounded-xl" />
			))}
		</div>
	);
}

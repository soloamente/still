import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";

import {
	TODAY_CARD_HEADING_CLASSNAME,
	TODAY_SUPPORTING_CARD_CLASSNAME,
} from "@/lib/today-card-layout";

/** Suspense fallback for `TodayCircleCardRsc` — poster + byline footprint. */
export function TodayCircleCardSkeleton() {
	return (
		<section
			className={TODAY_SUPPORTING_CARD_CLASSNAME}
			aria-busy
			aria-label="Loading activity from people you follow"
		>
			<p className={TODAY_CARD_HEADING_CLASSNAME}>From your circle</p>
			<div className="flex items-start gap-3">
				<ShimmerBone className="aspect-2/3 w-14 shrink-0 rounded-lg bg-card" />
				<div className="flex flex-1 flex-col gap-2">
					<ShimmerBone className="h-8 w-32 rounded-full bg-card" />
					<ShimmerBone className="h-5 w-40 max-w-full rounded-md bg-card" />
					<ShimmerBone className="h-4 w-24 rounded-md bg-card" />
				</div>
			</div>
		</section>
	);
}

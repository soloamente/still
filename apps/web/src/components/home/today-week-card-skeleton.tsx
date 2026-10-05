import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";

import {
	TODAY_CARD_HEADING_CLASSNAME,
	TODAY_SUPPORTING_CARD_CLASSNAME,
} from "@/lib/today-card-layout";
import { TODAY_WEEK_DAYS } from "@/lib/today-week-pulse";

/** Inner placeholder rows — also used by the client card while it refetches. */
export function TodayWeekCardSkeletonBody() {
	return (
		<>
			<ShimmerBone className="h-6 w-48 max-w-full rounded-md bg-card" />
			<div className="flex gap-3">
				{TODAY_WEEK_DAYS.map((day) => (
					<span key={day.id} className="flex flex-col items-center gap-2">
						<ShimmerBone className="h-3 w-4 rounded-sm bg-card" />
						<ShimmerBone className="size-2.5 rounded-full bg-card" />
					</span>
				))}
			</div>
			<ShimmerBone className="mt-auto h-11 w-32 rounded-full bg-card" />
		</>
	);
}

/** Suspense fallback for `TodayWeekCardRsc` — same footprint as the loaded card. */
export function TodayWeekCardSkeleton() {
	return (
		<section
			className={TODAY_SUPPORTING_CARD_CLASSNAME}
			aria-busy
			aria-label="Loading your week"
		>
			<p className={TODAY_CARD_HEADING_CLASSNAME}>Your week</p>
			<TodayWeekCardSkeletonBody />
		</section>
	);
}

import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";

import { TODAY_WEEK_DAYS } from "@/lib/today-week-pulse";

/** Shared Today supporting-card tile — flat `bg-background` on the lobby `bg-card`. */
export const TODAY_SUPPORTING_CARD_CLASSNAME =
	"flex min-h-[11rem] min-w-0 flex-col gap-3 rounded-3xl bg-background p-5";

/** Inner placeholder rows — also used by the client card while it refetches. */
export function TodayWeekCardSkeletonBody() {
	return (
		<>
			<ShimmerBone className="h-6 w-48 max-w-full rounded-md bg-card" />
			<div className="flex gap-3">
				{TODAY_WEEK_DAYS.map((day) => (
					<ShimmerBone key={day.id} className="size-2.5 rounded-full bg-card" />
				))}
			</div>
			<ShimmerBone className="mt-auto h-10 w-32 rounded-full bg-card" />
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
			<p className="font-medium text-muted-foreground text-sm">Your week</p>
			<TodayWeekCardSkeletonBody />
		</section>
	);
}

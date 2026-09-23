import { Suspense } from "react";

import { HomeTasteMatchedHeroRsc } from "@/components/home/home-taste-matched-hero-rsc";
import { HomeTasteMatchedHeroSkeleton } from "@/components/home/home-taste-matched-hero-skeleton";
import { TodayCircleCardRsc } from "@/components/home/today-circle-card-rsc";
import { TodayCircleCardSkeleton } from "@/components/home/today-circle-card-skeleton";
import { TodayWeekCardRsc } from "@/components/home/today-week-card-rsc";
import { TodayWeekCardSkeleton } from "@/components/home/today-week-card-skeleton";
import type { TodayOnSenseReads } from "@/lib/today-on-sense-reads";

/**
 * Today on Sense — signed-in habit layer at the top of the `/home` lobby card.
 * Pick · Your week · From your circle stream behind independent Suspense
 * boundaries so one slow read never blocks the others (no aggregate fetch).
 */
export function TodayOnSense({ reads }: { reads: TodayOnSenseReads }) {
	return (
		<section
			aria-labelledby="today-on-sense-heading"
			className="flex min-w-0 flex-col gap-3 pb-2"
		>
			<h2 id="today-on-sense-heading" className="sr-only">
				Today on Sense
			</h2>
			<Suspense fallback={<HomeTasteMatchedHeroSkeleton />}>
				<HomeTasteMatchedHeroRsc
					completionMode="today-shell"
					read={reads.pick}
				/>
			</Suspense>
			{/* `relative z-10` — the pick's media bleed extends under this row. */}
			<div className="relative z-10 grid min-w-0 gap-3 sm:grid-cols-2">
				<Suspense fallback={<TodayWeekCardSkeleton />}>
					<TodayWeekCardRsc read={reads.week} />
				</Suspense>
				<Suspense fallback={<TodayCircleCardSkeleton />}>
					<TodayCircleCardRsc read={reads.circle} />
				</Suspense>
			</div>
		</section>
	);
}

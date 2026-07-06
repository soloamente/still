"use client";

import { PlanFeatureGate } from "@/components/plans/plan-feature-gate";

/** Upsell when Still patrons open Wrapped for a year before the current UTC snapshot. */
export function YearInReviewPlanGate({ year }: { year: number }) {
	return (
		<div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-16 text-center">
			<div>
				<h1 className="font-semibold text-2xl text-foreground tracking-tight">
					{year} in review
				</h1>
				<p className="mt-2 text-pretty text-muted-foreground text-sm leading-relaxed">
					Your current-year snapshot is free on Still. Earlier years unlock with
					Attuned full stats.
				</p>
			</div>
			<PlanFeatureGate featureKey="full_stats">
				<span className="sr-only">Full stats</span>
			</PlanFeatureGate>
		</div>
	);
}

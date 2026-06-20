"use client";

import { cn } from "@still/ui/lib/utils";
import { useState } from "react";

import type { PlanFeature, PlanTier } from "@/lib/staff-plan-features-api";

import { PlanFeatureInlineEdit } from "./plan-feature-inline-edit";

const TIER_ORDER = ["still", "attuned", "immersed", "devoted"] as const;

function StatusDot({ status }: { status: string }) {
	return (
		<span
			role="img"
			className={cn(
				"mt-1 inline-block size-1.5 shrink-0 rounded-full",
				status === "exists" ? "bg-emerald-700" : "bg-amber-700",
			)}
			aria-label={status}
		/>
	);
}

export function StaffPlansDetailsView({
	tiers,
	features,
	onFeaturesChange,
}: {
	tiers: PlanTier[];
	features: PlanFeature[];
	onFeaturesChange: (features: PlanFeature[]) => void;
}) {
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const orderedTiers = TIER_ORDER.map((id) =>
		tiers.find((t) => t.id === id),
	).filter(Boolean) as PlanTier[];

	return (
		<div className="space-y-10">
			{orderedTiers.map((tier) => {
				const tierFeatures = features.filter((f) =>
					f.tierIds.includes(tier.id),
				);

				return (
					<section key={tier.id}>
						<div className="mb-4 flex items-center gap-3 border-border border-b pb-3">
							<span className="rounded-full bg-muted px-3 py-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
								{tier.name}
							</span>
							<span className="text-muted-foreground/50 text-sm">
								{tier.tagline}
							</span>
							<span className="ml-auto text-muted-foreground/40 text-xs">
								{tier.priceYearly == null
									? "Free"
									: `$${(tier.priceYearly / 100).toFixed(0)}/yr`}
							</span>
						</div>

						<div className="space-y-1">
							{tierFeatures.length === 0 && (
								<p className="text-muted-foreground/50 text-sm">
									No features assigned to this tier yet.
								</p>
							)}
							{tierFeatures.map((feature) => (
								<div key={feature.id}>
									<button
										type="button"
										className={cn(
											"group grid w-full cursor-pointer grid-cols-[160px_1fr_20px] items-start gap-4 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/30",
											expandedId === feature.id && "bg-muted/30",
										)}
										onClick={() =>
											setExpandedId(
												expandedId === feature.id ? null : feature.id,
											)
										}
									>
										<div className="flex items-start gap-2 pt-0.5">
											<StatusDot status={feature.buildStatus} />
											<span className="font-medium text-foreground/80 text-sm leading-snug">
												{feature.name}
											</span>
										</div>
										<p className="text-muted-foreground text-sm leading-relaxed">
											{feature.description}
										</p>
										<span className="pt-0.5 text-muted-foreground/30 text-xs opacity-0 transition-opacity group-hover:opacity-100">
											✎
										</span>
									</button>

									{expandedId === feature.id && (
										<div className="mt-1 px-3 pb-2">
											<PlanFeatureInlineEdit
												feature={feature}
												tiers={tiers}
												onSaved={(updated) => {
													onFeaturesChange(updated);
													setExpandedId(null);
												}}
												onCancel={() => setExpandedId(null)}
											/>
										</div>
									)}
								</div>
							))}
						</div>
					</section>
				);
			})}
		</div>
	);
}

"use client";

import { cn } from "@still/ui/lib/utils";
import { useState } from "react";

import type { PlanFeature, PlanTier } from "@/lib/staff-plan-features-api";

import { PlanFeatureInlineEdit } from "./plan-feature-inline-edit";
import { PlanFeatureRowExpandPanel } from "./plan-feature-row-expand-panel";

const TIER_ORDER = ["still", "attuned", "immersed", "devoted"] as const;

function BuildStatusDot({ status }: { status: string }) {
	return (
		<span
			role="img"
			aria-label={status}
			className={cn(
				"mt-[5px] inline-block size-1.5 shrink-0 rounded-full",
				status === "exists" ? "bg-emerald-600/70" : "bg-amber-500/70",
			)}
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
		<div className="space-y-4">
			{orderedTiers.map((tier) => {
				const tierFeatures = features.filter((f) =>
					f.tierIds.includes(tier.id),
				);

				return (
					<section
						key={tier.id}
						className="rounded-2xl bg-background p-3 sm:p-4"
					>
						<div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
							<h3 className="font-medium text-foreground text-sm">
								{tier.name}
							</h3>
							<p className="text-muted-foreground text-xs">{tier.tagline}</p>
							<span className="ml-auto text-muted-foreground text-xs tabular-nums">
								{tier.priceYearly == null
									? "Free"
									: `$${(tier.priceYearly / 100).toFixed(0)}/yr`}
							</span>
						</div>

						{tierFeatures.length === 0 ? (
							<p className="px-3 py-4 text-center text-muted-foreground text-sm">
								No features assigned yet.
							</p>
						) : (
							<ul className="space-y-1">
								{tierFeatures.map((feature) => {
									const isExpanded = expandedId === feature.id;

									return (
										<li
											key={feature.id}
											className={cn(
												"rounded-xl transition-colors duration-200",
												isExpanded
													? "overflow-hidden bg-card"
													: "overflow-visible",
											)}
										>
											<button
												type="button"
												aria-expanded={isExpanded}
												className={cn(
													"group flex min-h-10 w-full select-none items-start gap-3 px-3 py-2.5 text-left transition-colors duration-200",
													isExpanded
														? "font-medium text-foreground"
														: "[@media(hover:hover)]:hover:bg-card/60",
												)}
												onClick={() =>
													setExpandedId(isExpanded ? null : feature.id)
												}
											>
												<BuildStatusDot status={feature.buildStatus} />
												<div className="min-w-0 flex-1">
													<p className="font-medium text-sm leading-snug">
														{feature.name}
													</p>
													<p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
														{feature.description}
													</p>
												</div>
											</button>

											{isExpanded ? (
												<PlanFeatureRowExpandPanel>
													<PlanFeatureInlineEdit
														embedded
														feature={feature}
														tiers={tiers}
														onSaved={(updated) => {
															onFeaturesChange(updated);
															setExpandedId(null);
														}}
														onCancel={() => setExpandedId(null)}
													/>
												</PlanFeatureRowExpandPanel>
											) : null}
										</li>
									);
								})}
							</ul>
						)}
					</section>
				);
			})}
		</div>
	);
}

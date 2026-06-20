"use client";

import { cn } from "@still/ui/lib/utils";
import { useState } from "react";

import type { PlanFeature, PlanTier } from "@/lib/staff-plan-features-api";

import { PlanFeatureInlineEdit } from "./plan-feature-inline-edit";

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
		<div className="space-y-8">
			{orderedTiers.map((tier) => {
				const tierFeatures = features.filter((f) =>
					f.tierIds.includes(tier.id),
				);

				return (
					<section key={tier.id}>
						{/* Tier header */}
						<div className="mb-2 flex items-baseline gap-3 border-border border-b pb-2">
							<h3 className="font-medium text-sm">{tier.name}</h3>
							<p className="text-muted-foreground text-xs">{tier.tagline}</p>
							<span className="ml-auto text-muted-foreground text-xs tabular-nums">
								{tier.priceYearly == null
									? "Free"
									: `$${(tier.priceYearly / 100).toFixed(0)}/yr`}
							</span>
						</div>

						{tierFeatures.length === 0 ? (
							<p className="px-3 py-2 text-muted-foreground text-sm">
								No features assigned yet.
							</p>
						) : (
							<ul className="space-y-0.5">
								{tierFeatures.map((feature) => (
									<li key={feature.id}>
										<button
											type="button"
											className={cn(
												"group flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-200",
												expandedId === feature.id
													? "bg-card"
													: "[@media(hover:hover)]:hover:bg-card/60",
											)}
											onClick={() =>
												setExpandedId(
													expandedId === feature.id ? null : feature.id,
												)
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
									</li>
								))}
							</ul>
						)}
					</section>
				);
			})}
		</div>
	);
}

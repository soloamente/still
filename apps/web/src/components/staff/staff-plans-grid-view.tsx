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
				"inline-block size-1.5 shrink-0 rounded-full",
				status === "exists" ? "bg-emerald-700" : "bg-amber-700",
			)}
			aria-label={status}
		/>
	);
}

export function StaffPlansGridView({
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
		<div className="overflow-x-auto">
			<table className="w-full min-w-[640px] border-collapse text-sm">
				<thead>
					<tr className="border-border border-b">
						<th className="py-2 pr-4 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
							Feature
						</th>
						{orderedTiers.map((tier) => (
							<th
								key={tier.id}
								className="w-24 py-2 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wider"
							>
								{tier.name}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{features.map((feature) => (
						<>
							<tr
								key={feature.id}
								className={cn(
									"group cursor-pointer border-border/50 border-b transition-colors hover:bg-muted/30",
									expandedId === feature.id && "bg-muted/30",
								)}
								onClick={() =>
									setExpandedId(expandedId === feature.id ? null : feature.id)
								}
							>
								<td className="py-2.5 pr-4">
									<span className="flex items-center gap-2">
										<StatusDot status={feature.buildStatus} />
										<span className="text-foreground/80 text-sm">
											{feature.name}
										</span>
										<span className="ml-auto text-muted-foreground/40 text-xs opacity-0 transition-opacity group-hover:opacity-100">
											✎
										</span>
									</span>
								</td>
								{orderedTiers.map((tier) => (
									<td
										key={tier.id}
										className="py-2.5 text-center text-muted-foreground"
									>
										{feature.tierIds.includes(tier.id) ? (
											<span className="text-base text-emerald-700">✓</span>
										) : (
											<span className="text-muted-foreground/20">—</span>
										)}
									</td>
								))}
							</tr>

							{expandedId === feature.id && (
								<tr key={`${feature.id}-edit`}>
									<td colSpan={orderedTiers.length + 1} className="pt-1 pb-3">
										<PlanFeatureInlineEdit
											feature={feature}
											tiers={tiers}
											onSaved={(updated) => {
												onFeaturesChange(updated);
												setExpandedId(null);
											}}
											onCancel={() => setExpandedId(null)}
										/>
									</td>
								</tr>
							)}
						</>
					))}
				</tbody>
			</table>
		</div>
	);
}

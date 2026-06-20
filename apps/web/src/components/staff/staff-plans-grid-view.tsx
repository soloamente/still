"use client";

import { cn } from "@still/ui/lib/utils";
import { Fragment, useState } from "react";

import type { PlanFeature, PlanTier } from "@/lib/staff-plan-features-api";

import { PlanFeatureInlineEdit } from "./plan-feature-inline-edit";

const TIER_ORDER = ["still", "attuned", "immersed", "devoted"] as const;

function BuildStatusDot({ status }: { status: string }) {
	return (
		<span
			role="img"
			aria-label={status}
			className={cn(
				"inline-block size-1.5 shrink-0 rounded-full",
				status === "exists" ? "bg-emerald-600/70" : "bg-amber-500/70",
			)}
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
		<div className="rounded-md border border-border">
			{/* Header row */}
			<div className="grid grid-cols-[1fr_repeat(4,5.5rem)] border-border border-b px-4 py-2">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
					Feature
				</p>
				{orderedTiers.map((tier) => (
					<p
						key={tier.id}
						className="text-center font-medium text-muted-foreground text-xs uppercase tracking-wider"
					>
						{tier.name}
					</p>
				))}
			</div>

			{/* Feature rows */}
			<ul className="divide-y divide-border">
				{features.map((feature) => (
					<Fragment key={feature.id}>
						<li>
							<button
								type="button"
								className={cn(
									"grid w-full grid-cols-[1fr_repeat(4,5.5rem)] items-center px-4 py-3 text-left transition-colors duration-200",
									expandedId === feature.id
										? "bg-card text-foreground"
										: "text-foreground [@media(hover:hover)]:hover:bg-card/60",
								)}
								onClick={() =>
									setExpandedId(expandedId === feature.id ? null : feature.id)
								}
							>
								<span className="flex min-w-0 items-center gap-2">
									<BuildStatusDot status={feature.buildStatus} />
									<span className="truncate text-sm">{feature.name}</span>
								</span>
								{orderedTiers.map((tier) => (
									<span
										key={tier.id}
										className="flex items-center justify-center"
									>
										{feature.tierIds.includes(tier.id) ? (
											<span
												role="img"
												aria-label="included"
												className="size-1.5 rounded-full bg-foreground/40"
											/>
										) : null}
									</span>
								))}
							</button>

							{expandedId === feature.id && (
								<div className="border-border border-t px-4 pt-3 pb-4">
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
					</Fragment>
				))}
			</ul>
		</div>
	);
}

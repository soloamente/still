"use client";

import { cn } from "@still/ui/lib/utils";
import { useRef, useState } from "react";

import type { PlanFeature, PlanTier } from "@/lib/staff-plan-features-api";

import { PlanFeatureInlineEdit } from "./plan-feature-inline-edit";
import { PlanFeatureRowExpandPanel } from "./plan-feature-row-expand-panel";

const TIER_ORDER = ["still", "attuned", "immersed", "devoted"] as const;

/** Matches `StaffPlansPageHeader` row height (`py-2` + `min-h-10`). */
const STAFF_PLANS_GRID_STICKY_TOP_CLASSNAME = "top-14";

/** Above page-header scroll scrim (`z-20`), below back bar (`z-40`). */
const STAFF_PLANS_GRID_STICKY_Z_CLASSNAME = "z-30";

const GRID_COLUMNS_CLASSNAME =
	"grid grid-cols-[minmax(0,1fr)_repeat(4,5.5rem)]";

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

function TierIncludedMark({ included }: { included: boolean }) {
	if (!included) return null;

	return (
		<span
			role="img"
			aria-label="included"
			className="size-2 rounded-full bg-foreground/45"
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
	const headerScrollRef = useRef<HTMLDivElement>(null);
	const bodyScrollRef = useRef<HTMLDivElement>(null);
	const syncingScrollRef = useRef(false);

	const orderedTiers = TIER_ORDER.map((id) =>
		tiers.find((t) => t.id === id),
	).filter(Boolean) as PlanTier[];

	function syncHorizontalScroll(source: "header" | "body") {
		if (syncingScrollRef.current) return;

		const from =
			source === "header" ? headerScrollRef.current : bodyScrollRef.current;
		const to =
			source === "header" ? bodyScrollRef.current : headerScrollRef.current;
		if (!from || !to) return;

		syncingScrollRef.current = true;
		to.scrollLeft = from.scrollLeft;
		syncingScrollRef.current = false;
	}

	return (
		<div className="rounded-2xl bg-background p-2">
			{/* Sticky lives outside horizontal overflow — `overflow-x-auto` breaks viewport sticky. */}
			<div
				className={cn(
					"sticky mb-1 bg-background",
					STAFF_PLANS_GRID_STICKY_Z_CLASSNAME,
					STAFF_PLANS_GRID_STICKY_TOP_CLASSNAME,
				)}
			>
				<div
					ref={headerScrollRef}
					className="scrollbar-none overflow-x-auto overflow-y-visible"
					onScroll={() => syncHorizontalScroll("header")}
				>
					<div
						className={cn(
							GRID_COLUMNS_CLASSNAME,
							"min-w-lg rounded-xl bg-card/45 px-3 py-2",
						)}
					>
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
				</div>
			</div>

			<div
				ref={bodyScrollRef}
				className="scrollbar-none overflow-x-auto overflow-y-visible"
				onScroll={() => syncHorizontalScroll("body")}
			>
				<ul className="min-w-lg space-y-1">
					{features.map((feature) => {
						const isExpanded = expandedId === feature.id;

						return (
							<li
								key={feature.id}
								className={cn(
									"rounded-xl transition-colors duration-200",
									isExpanded ? "overflow-hidden bg-card" : "overflow-visible",
								)}
							>
								<button
									type="button"
									aria-expanded={isExpanded}
									className={cn(
										"grid min-h-10 w-full select-none grid-cols-[minmax(0,1fr)_repeat(4,5.5rem)] items-center px-3 py-2.5 text-left transition-colors duration-200",
										isExpanded
											? "font-medium text-foreground"
											: "text-foreground [@media(hover:hover)]:hover:bg-card/60",
									)}
									onClick={() => setExpandedId(isExpanded ? null : feature.id)}
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
											<TierIncludedMark
												included={feature.tierIds.includes(tier.id)}
											/>
										</span>
									))}
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
			</div>
		</div>
	);
}

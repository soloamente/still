"use client";

import type { PlanTier } from "@/lib/staff-plan-features-api";

import { PlanFilterChip } from "./plan-filter-chip";

const TIER_ORDER = ["still", "attuned", "immersed", "devoted"] as const;

/** Multi-select tier filter chips — each chip is content-sized with a trailing check circle. */
export function PlanTierChipPicker({
	tiers,
	selectedTierIds,
	onToggle,
	disabled = false,
}: {
	tiers: PlanTier[];
	selectedTierIds: string[];
	onToggle: (tierId: string) => void;
	disabled?: boolean;
}) {
	const orderedTiers = TIER_ORDER.map((id) =>
		tiers.find((t) => t.id === id),
	).filter(Boolean) as PlanTier[];

	return (
		<fieldset
			className="flex w-fit max-w-full flex-wrap gap-1.5 border-0 p-0"
			aria-label="Available tiers"
		>
			{orderedTiers.map((tier) => (
				<PlanFilterChip
					key={tier.id}
					label={tier.name}
					selected={selectedTierIds.includes(tier.id)}
					onClick={() => onToggle(tier.id)}
					disabled={disabled}
				/>
			))}
		</fieldset>
	);
}

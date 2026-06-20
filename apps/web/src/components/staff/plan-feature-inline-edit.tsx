"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { Textarea } from "@still/ui/components/textarea";
import { cn } from "@still/ui/lib/utils";
import { useId, useState } from "react";
import { toast } from "sonner";

import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import {
	type PlanFeature,
	type PlanTier,
	updatePlanFeature,
} from "@/lib/staff-plan-features-api";

const TIER_ORDER = ["still", "attuned", "immersed", "devoted"] as const;

const STATUS_OPTIONS = [
	{ id: "exists" as const, label: "Exists" },
	{ id: "planned" as const, label: "Planned" },
];

export function PlanFeatureInlineEdit({
	feature,
	tiers,
	onSaved,
	onCancel,
}: {
	feature: PlanFeature;
	tiers: PlanTier[];
	onSaved: (features: PlanFeature[]) => void;
	onCancel: () => void;
}) {
	const fieldId = useId();
	const [name, setName] = useState(feature.name);
	const [description, setDescription] = useState(feature.description);
	const [buildStatus, setBuildStatus] = useState<"exists" | "planned">(
		feature.buildStatus as "exists" | "planned",
	);
	const [selectedTierIds, setSelectedTierIds] = useState<string[]>(
		feature.tierIds,
	);
	const [saving, setSaving] = useState(false);

	function toggleTier(id: string) {
		setSelectedTierIds((prev) =>
			prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
		);
	}

	async function handleSave() {
		if (!name.trim() || !description.trim()) {
			toast.error("Name and description are required.");
			return;
		}
		setSaving(true);
		try {
			const updated = await updatePlanFeature(feature.id, {
				name: name.trim(),
				description: description.trim(),
				buildStatus,
				tierIds: selectedTierIds,
			});
			onSaved(updated);
			toast.success("Feature saved.");
		} catch {
			toast.error("Failed to save feature.");
		} finally {
			setSaving(false);
		}
	}

	const orderedTiers = TIER_ORDER.map((id) =>
		tiers.find((t) => t.id === id),
	).filter(Boolean) as PlanTier[];

	return (
		<div className="space-y-4 rounded-2xl bg-background p-4">
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor={`${fieldId}-name`}>Feature name</Label>
					<Input
						id={`${fieldId}-name`}
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
				</div>

				<div className="space-y-2">
					<p className="font-medium text-sm">Build status</p>
					<SegmentedPillToolbar
						layoutId={`${fieldId}-status`}
						aria-label="Build status"
						value={buildStatus}
						onChange={setBuildStatus}
						options={STATUS_OPTIONS}
					/>
				</div>

				<div className="space-y-2 sm:col-span-2">
					<Label htmlFor={`${fieldId}-desc`}>Description</Label>
					<Textarea
						id={`${fieldId}-desc`}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						className="min-h-20 resize-none"
					/>
				</div>

				<div className="space-y-2 sm:col-span-2">
					<p className="font-medium text-sm">Available in</p>
					<div className="flex flex-wrap gap-2">
						{orderedTiers.map((tier) => (
							<button
								key={tier.id}
								type="button"
								onClick={() => toggleTier(tier.id)}
								className={cn(
									"rounded-full border px-3 py-1 font-medium text-xs transition-colors duration-200",
									selectedTierIds.includes(tier.id)
										? "border-foreground/20 bg-card text-foreground"
										: "border-transparent bg-muted/40 text-muted-foreground [@media(hover:hover)]:hover:bg-muted/70 [@media(hover:hover)]:hover:text-foreground",
								)}
							>
								{tier.name}
							</button>
						))}
					</div>
				</div>
			</div>

			<div className="flex justify-end gap-2">
				<Button
					variant="outline"
					size="sm"
					onClick={onCancel}
					disabled={saving}
				>
					Cancel
				</Button>
				<Button size="sm" onClick={handleSave} disabled={saving}>
					{saving ? "Saving…" : "Save"}
				</Button>
			</div>
		</div>
	);
}

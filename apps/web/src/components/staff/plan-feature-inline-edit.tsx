"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Textarea } from "@still/ui/components/textarea";
import { cn } from "@still/ui/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

import {
	type PlanFeature,
	type PlanTier,
	updatePlanFeature,
} from "@/lib/staff-plan-features-api";

const TIER_ORDER = ["still", "attuned", "immersed", "devoted"] as const;

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
		<div className="space-y-4 rounded-2xl bg-muted/30 p-4">
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div className="space-y-1.5">
					<label
						htmlFor={`edit-name-${feature.id}`}
						className="font-semibold text-muted-foreground text-xs uppercase tracking-widest"
					>
						Feature name
					</label>
					<Input
						id={`edit-name-${feature.id}`}
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
				</div>

				<div className="space-y-1.5">
					<p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
						Build status
					</p>
					<div className="flex gap-2">
						{(["exists", "planned"] as const).map((s) => (
							<button
								key={s}
								type="button"
								onClick={() => setBuildStatus(s)}
								className={cn(
									"rounded-full border px-3 py-1 font-semibold text-xs transition-colors",
									buildStatus === s
										? "border-foreground/20 bg-foreground/10 text-foreground"
										: "border-muted text-muted-foreground hover:border-foreground/20 hover:text-foreground",
								)}
							>
								{s}
							</button>
						))}
					</div>
				</div>

				<div className="space-y-1.5 sm:col-span-2">
					<label
						htmlFor={`edit-desc-${feature.id}`}
						className="font-semibold text-muted-foreground text-xs uppercase tracking-widest"
					>
						Description
					</label>
					<Textarea
						id={`edit-desc-${feature.id}`}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						className="min-h-20 resize-none"
					/>
				</div>

				<div className="space-y-1.5 sm:col-span-2">
					<p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
						Available in
					</p>
					<div className="flex flex-wrap gap-2">
						{orderedTiers.map((tier) => (
							<button
								key={tier.id}
								type="button"
								onClick={() => toggleTier(tier.id)}
								className={cn(
									"rounded-full border px-3 py-1 font-semibold text-xs transition-colors",
									selectedTierIds.includes(tier.id)
										? "border-foreground/20 bg-foreground/10 text-foreground"
										: "border-muted text-muted-foreground hover:border-foreground/20 hover:text-foreground",
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
					className="rounded-full"
					onClick={onCancel}
					disabled={saving}
				>
					Cancel
				</Button>
				<Button
					size="sm"
					className="rounded-full"
					onClick={handleSave}
					disabled={saving}
				>
					{saving ? "Saving…" : "Save"}
				</Button>
			</div>
		</div>
	);
}

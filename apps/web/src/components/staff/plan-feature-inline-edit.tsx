"use client";

import { Input } from "@still/ui/components/input";
import { Textarea } from "@still/ui/components/textarea";
import { cn } from "@still/ui/lib/utils";
import { useId, useState } from "react";
import { toast } from "sonner";

import { MeFormField } from "@/components/profile/me-form-field";
import { MeSaveButton } from "@/components/profile/me-save-button";
import { MeSecondaryButton } from "@/components/profile/me-secondary-button";
import {
	type PlanFeature,
	type PlanTier,
	updatePlanFeature,
} from "@/lib/staff-plan-features-api";

import { PlanBuildStatusChipFilter } from "./plan-build-status-chip-filter";
import { planFieldControlClass } from "./plan-field-control-class";
import { PlanTierChipPicker } from "./plan-tier-chip-picker";

export function PlanFeatureInlineEdit({
	feature,
	tiers,
	onSaved,
	onCancel,
	embedded = false,
}: {
	feature: PlanFeature;
	tiers: PlanTier[];
	onSaved: (features: PlanFeature[]) => void;
	onCancel: () => void;
	/** Grid/details expanders — form sits inside the active row card without a nested panel. */
	embedded?: boolean;
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

	return (
		<div
			className={cn(
				embedded
					? "space-y-3 px-3 pt-1 pb-3"
					: "space-y-4 rounded-2xl bg-background p-4 sm:p-5",
			)}
		>
			<div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
				<MeFormField id={`${fieldId}-name`} label="Feature name">
					<Input
						id={`${fieldId}-name`}
						value={name}
						onChange={(e) => setName(e.target.value)}
						className={planFieldControlClass()}
					/>
				</MeFormField>

				<div className="space-y-2">
					<p className="font-medium text-foreground text-sm">Build status</p>
					<PlanBuildStatusChipFilter
						value={buildStatus}
						onChange={setBuildStatus}
						disabled={saving}
					/>
				</div>

				<MeFormField
					id={`${fieldId}-desc`}
					label="Description"
					className="sm:col-span-2"
				>
					<Textarea
						id={`${fieldId}-desc`}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						className={planFieldControlClass("min-h-20 resize-none py-3")}
					/>
				</MeFormField>

				<div className="space-y-2 sm:col-span-2">
					<p className="font-medium text-foreground text-sm">Available in</p>
					<PlanTierChipPicker
						tiers={tiers}
						selectedTierIds={selectedTierIds}
						onToggle={toggleTier}
						disabled={saving}
					/>
				</div>
			</div>

			<div className="flex justify-end gap-2 pt-1">
				<MeSecondaryButton
					type="button"
					size="compact"
					onClick={onCancel}
					disabled={saving}
				>
					Cancel
				</MeSecondaryButton>
				<MeSaveButton
					type="button"
					size="compact"
					loading={saving}
					disabled={saving}
					onClick={() => void handleSave()}
				>
					Save
				</MeSaveButton>
			</div>
		</div>
	);
}

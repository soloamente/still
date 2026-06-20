"use client";

import { Input } from "@still/ui/components/input";
import { Textarea } from "@still/ui/components/textarea";
import { useId, useState } from "react";
import { toast } from "sonner";

import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { MeFormField } from "@/components/profile/me-form-field";
import { MeSaveButton } from "@/components/profile/me-save-button";
import { MeSecondaryButton } from "@/components/profile/me-secondary-button";
import {
	createPlanFeature,
	type PlanFeature,
	type PlanTier,
} from "@/lib/staff-plan-features-api";

import { PlanBuildStatusChipFilter } from "./plan-build-status-chip-filter";
import { planFieldControlClass } from "./plan-field-control-class";
import { PlanTierChipPicker } from "./plan-tier-chip-picker";
import { usePlanFeatureDrawer } from "./use-plan-feature-drawer";

export function PlanFeatureCreateDrawerRoot({
	tiers,
	onCreated,
}: {
	tiers: PlanTier[];
	onCreated: (features: PlanFeature[]) => void;
}) {
	const fieldId = useId();
	const { isOpen, close } = usePlanFeatureDrawer();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [buildStatus, setBuildStatus] = useState<"exists" | "planned">(
		"planned",
	);
	const [selectedTierIds, setSelectedTierIds] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);

	function reset() {
		setName("");
		setDescription("");
		setBuildStatus("planned");
		setSelectedTierIds([]);
	}

	function handleOpenChange(next: boolean) {
		if (!next) {
			close();
			reset();
		}
	}

	function toggleTier(id: string) {
		setSelectedTierIds((prev) =>
			prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
		);
	}

	async function handleSubmit() {
		if (!name.trim() || !description.trim()) {
			toast.error("Name and description are required.");
			return;
		}
		setSaving(true);
		try {
			const updated = await createPlanFeature({
				name: name.trim(),
				description: description.trim(),
				buildStatus,
				tierIds: selectedTierIds,
			});
			onCreated(updated);
			toast.success("Feature created.");
			close();
			reset();
		} catch {
			toast.error("Failed to create feature.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<DetailVaulSheet
			open={isOpen}
			onOpenChange={handleOpenChange}
			title="New feature"
			description="Appears in the grid and details view immediately."
		>
			<div className="mx-auto w-full max-w-lg space-y-5 px-4 pt-2 pb-10 sm:max-w-xl">
				<MeFormField id={`${fieldId}-name`} label="Feature name">
					<Input
						id={`${fieldId}-name`}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. Taste overlap scores"
						className={planFieldControlClass()}
					/>
				</MeFormField>

				<MeFormField id={`${fieldId}-desc`} label="Description">
					<Textarea
						id={`${fieldId}-desc`}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Plain-language explanation shown on the pricing page…"
						className={planFieldControlClass("min-h-24 resize-none py-3")}
					/>
				</MeFormField>

				<div className="space-y-2">
					<p className="font-medium text-foreground text-sm">Available in</p>
					<PlanTierChipPicker
						tiers={tiers}
						selectedTierIds={selectedTierIds}
						onToggle={toggleTier}
						disabled={saving}
					/>
				</div>

				<div className="space-y-2">
					<p className="font-medium text-foreground text-sm">Build status</p>
					<PlanBuildStatusChipFilter
						value={buildStatus}
						onChange={setBuildStatus}
						disabled={saving}
					/>
				</div>

				<div className="flex gap-2 pt-2">
					<MeSecondaryButton
						type="button"
						size="compact"
						onClick={() => handleOpenChange(false)}
						disabled={saving}
					>
						Cancel
					</MeSecondaryButton>
					<div className="flex flex-1 justify-stretch [&>button]:w-full">
						<MeSaveButton
							type="button"
							size="compact"
							loading={saving}
							disabled={saving}
							onClick={() => void handleSubmit()}
						>
							{saving ? "Creating…" : "Create feature"}
						</MeSaveButton>
					</div>
				</div>
			</div>
		</DetailVaulSheet>
	);
}

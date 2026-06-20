"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { Textarea } from "@still/ui/components/textarea";
import { cn } from "@still/ui/lib/utils";
import { useId, useState } from "react";
import { toast } from "sonner";

import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import {
	createPlanFeature,
	type PlanFeature,
	type PlanTier,
} from "@/lib/staff-plan-features-api";

import { usePlanFeatureDrawer } from "./use-plan-feature-drawer";

const TIER_ORDER = ["still", "attuned", "immersed", "devoted"] as const;

const STATUS_OPTIONS = [
	{ id: "planned" as const, label: "Planned" },
	{ id: "exists" as const, label: "Exists" },
];

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

	const orderedTiers = TIER_ORDER.map((id) =>
		tiers.find((t) => t.id === id),
	).filter(Boolean) as PlanTier[];

	return (
		<DetailVaulSheet
			open={isOpen}
			onOpenChange={handleOpenChange}
			title="New feature"
			description="Appears in the grid and details view immediately."
		>
			<div className="mx-auto w-full max-w-lg space-y-4 px-4 pt-2 pb-10 sm:max-w-xl">
				<div className="space-y-2">
					<Label htmlFor={`${fieldId}-name`}>Feature name</Label>
					<Input
						id={`${fieldId}-name`}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. Taste overlap scores"
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor={`${fieldId}-desc`}>Description</Label>
					<Textarea
						id={`${fieldId}-desc`}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Plain-language explanation shown on the pricing page…"
						className="min-h-24 resize-none"
					/>
				</div>

				<div className="space-y-2">
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

				<div className="flex gap-2 pt-2">
					<Button
						variant="outline"
						onClick={() => handleOpenChange(false)}
						disabled={saving}
					>
						Cancel
					</Button>
					<Button className="flex-1" onClick={handleSubmit} disabled={saving}>
						{saving ? "Creating…" : "Create feature"}
					</Button>
				</div>
			</div>
		</DetailVaulSheet>
	);
}

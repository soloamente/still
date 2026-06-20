"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Textarea } from "@still/ui/components/textarea";
import { cn } from "@still/ui/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import {
	createPlanFeature,
	type PlanFeature,
	type PlanTier,
} from "@/lib/staff-plan-features-api";

import { usePlanFeatureDrawer } from "./use-plan-feature-drawer";

const TIER_ORDER = ["still", "attuned", "immersed", "devoted"] as const;

export function PlanFeatureCreateDrawerRoot({
	tiers,
	onCreated,
}: {
	tiers: PlanTier[];
	onCreated: (features: PlanFeature[]) => void;
}) {
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
			title="Add feature"
			description="New feature will appear in the grid and details view immediately."
		>
			<div className="mx-auto w-full max-w-lg space-y-5 px-4 pt-2 pb-10 sm:max-w-xl">
				<div className="space-y-1.5">
					<label
						htmlFor="create-feature-name"
						className="font-semibold text-muted-foreground text-xs uppercase tracking-widest"
					>
						Feature name
					</label>
					<Input
						id="create-feature-name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. Taste overlap scores"
					/>
				</div>

				<div className="space-y-1.5">
					<label
						htmlFor="create-feature-desc"
						className="font-semibold text-muted-foreground text-xs uppercase tracking-widest"
					>
						Description
					</label>
					<Textarea
						id="create-feature-desc"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Plain language explanation shown on the pricing page and details view…"
						className="min-h-24 resize-none"
					/>
				</div>

				<div className="space-y-1.5">
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

				<div className="flex gap-2 pt-2">
					<Button
						variant="outline"
						className="rounded-full"
						onClick={() => handleOpenChange(false)}
						disabled={saving}
					>
						Cancel
					</Button>
					<Button
						className="flex-1 rounded-full"
						onClick={handleSubmit}
						disabled={saving}
					>
						{saving ? "Creating…" : "Create feature"}
					</Button>
				</div>
			</div>
		</DetailVaulSheet>
	);
}

"use client";

import {
	isPlanFeatureKey,
	PLAN_TIER_IDS,
	type PlanFeatureKey,
	type PlanTierId,
} from "@still/plans";
import { Button } from "@still/ui/components/button";
import { Checkbox } from "@still/ui/components/checkbox";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { errorMessage } from "@/lib/staff-error-message";
import {
	fetchPlanCatalogue,
	type PlanFeature,
} from "@/lib/staff-plan-features-api";

const TIER_LABELS: Record<PlanTierId, string> = {
	still: "Still",
	attuned: "Attuned",
	immersed: "Immersed",
	devoted: "Devoted",
};

type StaffUserPlanFormProps = {
	userId: string;
	subscriptionTier: PlanTierId;
	planOverride: PlanTierId | null;
	effectiveTier: PlanTierId;
	featureGrants: readonly PlanFeatureKey[];
	onSaved: (next: {
		subscriptionTier: PlanTierId;
		planOverride: PlanTierId | null;
		effectiveTier: PlanTierId;
		featureGrants: PlanFeatureKey[];
		isPro: boolean;
	}) => void;
};

/** Staff-only plan override + grant-only feature extras for a patron. */
export function StaffUserPlanForm({
	userId,
	subscriptionTier,
	planOverride,
	effectiveTier,
	featureGrants,
	onSaved,
}: StaffUserPlanFormProps) {
	const [catalogueFeatures, setCatalogueFeatures] = useState<PlanFeature[]>([]);
	const [catalogueLoading, setCatalogueLoading] = useState(true);
	const [draftOverride, setDraftOverride] = useState<PlanTierId | "none">(
		planOverride ?? "none",
	);
	const [draftGrants, setDraftGrants] = useState<PlanFeatureKey[]>([
		...featureGrants,
	]);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		setDraftOverride(planOverride ?? "none");
		setDraftGrants([...featureGrants]);
	}, [planOverride, featureGrants]);

	useEffect(() => {
		let cancelled = false;
		fetchPlanCatalogue()
			.then(({ features }) => {
				if (!cancelled) setCatalogueFeatures(features);
			})
			.catch(() => {
				if (!cancelled) {
					toast.error("Could not load plan feature catalogue");
				}
			})
			.finally(() => {
				if (!cancelled) setCatalogueLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const grantOptions = useMemo(
		() =>
			catalogueFeatures.filter(
				(feature): feature is PlanFeature & { key: PlanFeatureKey } =>
					feature.buildStatus === "exists" &&
					typeof feature.key === "string" &&
					isPlanFeatureKey(feature.key),
			),
		[catalogueFeatures],
	);

	const dirty =
		(draftOverride === "none" ? null : draftOverride) !== planOverride ||
		draftGrants.length !== featureGrants.length ||
		draftGrants.some((key) => !featureGrants.includes(key));

	async function handleSave() {
		if (saving || !dirty) return;
		setSaving(true);
		const nextOverride = draftOverride === "none" ? null : draftOverride;
		try {
			const res = await api.api.staff.users({ id: userId }).plan.patch({
				planOverride: nextOverride,
				featureGrants: draftGrants,
			});
			if (res.error) {
				toast.error(
					errorMessage(res.error.value, "Could not update patron plan"),
				);
				return;
			}
			const payload = res.data as {
				entitlements?: {
					subscriptionTier: PlanTierId;
					planOverride: PlanTierId | null;
					effectiveTier: PlanTierId;
					featureGrants: PlanFeatureKey[];
					isPro: boolean;
				};
			} | null;
			if (payload?.entitlements) {
				onSaved(payload.entitlements);
			} else {
				onSaved({
					subscriptionTier,
					planOverride: nextOverride,
					effectiveTier: nextOverride ?? subscriptionTier,
					featureGrants: draftGrants,
					isPro: false,
				});
			}
			toast.success("Patron plan updated");
		} catch (err) {
			toast.error(errorMessage(err, "Could not update patron plan"));
		} finally {
			setSaving(false);
		}
	}

	return (
		<section className="space-y-4 rounded-xl bg-background/60 p-4">
			<div className="space-y-1">
				<p className="font-medium text-sm">Plan override</p>
				<p className="text-muted-foreground text-xs leading-relaxed">
					Complimentary tier access — wins over Polar subscription (
					{TIER_LABELS[subscriptionTier]} subscribed). Effective tier:{" "}
					<span className="font-medium text-foreground">
						{TIER_LABELS[effectiveTier]}
					</span>
					.
				</p>
			</div>

			<label
				htmlFor="staff-plan-override"
				className="block space-y-1.5 text-sm"
			>
				<span className="text-muted-foreground">Override tier</span>
				<select
					id="staff-plan-override"
					className="h-11 w-full max-w-xs rounded-2xl bg-card px-4 text-foreground text-sm"
					value={draftOverride}
					onChange={(event) =>
						setDraftOverride(event.target.value as PlanTierId | "none")
					}
					disabled={saving}
				>
					<option value="none">None (use subscription)</option>
					{PLAN_TIER_IDS.map((tierId) => (
						<option key={tierId} value={tierId}>
							{TIER_LABELS[tierId]}
						</option>
					))}
				</select>
			</label>

			<div className="space-y-2">
				<p className="font-medium text-sm">Grant-only extras</p>
				<p className="text-muted-foreground text-xs leading-relaxed">
					Unlock individual features above the patron&apos;s effective tier.
				</p>
				{catalogueLoading ? (
					<p className="text-muted-foreground text-xs">Loading catalogue…</p>
				) : grantOptions.length === 0 ? (
					<p className="text-muted-foreground text-xs">
						No gateable features in catalogue.
					</p>
				) : (
					<ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
						{grantOptions.map((feature) => {
							const checked = draftGrants.includes(feature.key);
							return (
								<li key={feature.key}>
									<div className="flex items-start gap-2 text-sm">
										<Checkbox
											checked={checked}
											disabled={saving}
											onCheckedChange={(next) => {
												setDraftGrants((prev) => {
													if (next === true) {
														return prev.includes(feature.key)
															? prev
															: [...prev, feature.key];
													}
													return prev.filter((key) => key !== feature.key);
												});
											}}
										/>
										<span>
											<span className="font-medium">{feature.name}</span>
											<span className="mt-0.5 block text-muted-foreground text-xs">
												{feature.key}
											</span>
										</span>
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</div>

			<Button
				type="button"
				size="sm"
				disabled={!dirty || saving}
				onClick={() => void handleSave()}
			>
				{saving ? "Saving…" : "Save plan"}
			</Button>
		</section>
	);
}

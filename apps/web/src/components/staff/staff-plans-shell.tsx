"use client";

import { staffPlansRoomId } from "@still/realtime";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useListingPresence } from "@/hooks/use-listing-presence";
import {
	fetchPlanCatalogue,
	type PlanFeature,
	type PlanTier,
} from "@/lib/staff-plan-features-api";

import { PlanFeatureCreateDrawerRoot } from "./plan-feature-create-drawer";
import { StaffPlansDetailsView } from "./staff-plans-details-view";
import { StaffPlansGridView } from "./staff-plans-grid-view";
import { type PlansView, StaffPlansTopbar } from "./staff-plans-topbar";

export function StaffPlansShell() {
	const [view, setView] = useState<PlansView>("grid");
	const [tiers, setTiers] = useState<PlanTier[]>([]);
	const [features, setFeatures] = useState<PlanFeature[]>([]);
	const [loading, setLoading] = useState(true);

	const snapshot = useListingPresence({
		roomId: staffPlansRoomId(),
		listingKind: "movie",
		listingId: 0,
	});

	useEffect(() => {
		fetchPlanCatalogue()
			.then(({ tiers, features }) => {
				setTiers(tiers);
				setFeatures(features);
			})
			.catch(() => toast.error("Failed to load plan catalogue."))
			.finally(() => setLoading(false));
	}, []);

	return (
		<section className="mb-10">
			<StaffPlansTopbar
				viewingPatrons={snapshot.viewingPatrons}
				viewerCount={snapshot.viewerCount}
				view={view}
				onViewChange={setView}
			/>

			{loading ? (
				<div className="py-8 text-center text-muted-foreground text-sm">
					Loading…
				</div>
			) : features.length === 0 ? (
				<div className="rounded-2xl bg-background py-12 text-center">
					<p className="text-muted-foreground text-sm">
						No features yet — add the first one.
					</p>
				</div>
			) : view === "grid" ? (
				<StaffPlansGridView
					tiers={tiers}
					features={features}
					onFeaturesChange={setFeatures}
				/>
			) : (
				<StaffPlansDetailsView
					tiers={tiers}
					features={features}
					onFeaturesChange={setFeatures}
				/>
			)}

			<PlanFeatureCreateDrawerRoot tiers={tiers} onCreated={setFeatures} />
		</section>
	);
}

"use client";

import { staffPlansRoomId } from "@still/realtime";
import { cn } from "@still/ui/lib/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SkeletonShimmerReveal } from "@/components/ui/skeleton-shimmer-reveal";
import { useListingPresence } from "@/hooks/use-listing-presence";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import {
	fetchPlanCatalogue,
	type PlanFeature,
	type PlanTier,
} from "@/lib/staff-plan-features-api";

import { PlanFeatureCreateDrawerRoot } from "./plan-feature-create-drawer";
import { StaffPlansDetailsView } from "./staff-plans-details-view";
import { StaffPlansGridView } from "./staff-plans-grid-view";
import { StaffPlansLoadingSkeleton } from "./staff-plans-loading-skeleton";
import { StaffPlansPageHeader } from "./staff-plans-page-header";
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
		<div className="flex min-h-0 flex-1 flex-col overflow-visible bg-background">
			<StaffPlansPageHeader />

			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"flex-1 overflow-visible",
				)}
			>
				<div className="mb-6 text-center">
					<h1 className="font-sans font-semibold text-2xl tracking-[-0.02em]">
						Plans
					</h1>
					<p className="mx-auto mt-1 max-w-2xl text-balance text-muted-foreground text-sm leading-relaxed">
						Subscription tier feature catalogue. Changes are live immediately.
					</p>
				</div>

				<StaffPlansTopbar
					viewingPatrons={snapshot.viewingPatrons}
					viewerCount={snapshot.viewerCount}
					view={view}
					onViewChange={setView}
				/>

				<SkeletonShimmerReveal
					loaded={!loading}
					fallback={<StaffPlansLoadingSkeleton />}
				>
					{features.length === 0 ? (
						<div className="flex min-h-56 flex-col items-center justify-center rounded-2xl bg-background px-6 py-12 text-center">
							<p className="font-medium text-foreground text-sm">
								No features yet
							</p>
							<p className="mt-1 max-w-sm text-muted-foreground text-sm">
								Add the first subscription feature to populate the grid and
								details views.
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
				</SkeletonShimmerReveal>

				<PlanFeatureCreateDrawerRoot tiers={tiers} onCreated={setFeatures} />
			</section>
		</div>
	);
}

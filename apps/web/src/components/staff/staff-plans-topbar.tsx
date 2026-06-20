"use client";

import { Button } from "@still/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@still/ui/components/tooltip";
import { cn } from "@still/ui/lib/utils";
import { Plus } from "lucide-react";

import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import type { ListingPresenceViewingPatron } from "@/lib/fetch-listing-presence";
import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";

import { openPlanFeatureDrawer } from "./use-plan-feature-drawer";

const MAX_AVATARS = 5;

export type PlansView = "grid" | "details";

const VIEW_OPTIONS = [
	{ id: "grid" as const, label: "Grid" },
	{ id: "details" as const, label: "Details" },
];

export function StaffPlansTopbar({
	viewingPatrons,
	viewerCount,
	view,
	onViewChange,
}: {
	viewingPatrons: ListingPresenceViewingPatron[];
	viewerCount: number;
	view: PlansView;
	onViewChange: (v: PlansView) => void;
}) {
	const visible = viewingPatrons.slice(0, MAX_AVATARS);
	const overflow = viewerCount - visible.length;

	return (
		<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 className="font-medium text-lg">Features</h2>
			</div>

			<div className="flex items-center gap-3">
				{/* Live presence */}
				{viewerCount > 0 && (
					<TooltipProvider delay={0}>
						<div className="flex items-center">
							{visible.map((patron, i) => (
								<Tooltip key={patron.userId}>
									<TooltipTrigger
										render={
											<span
												className={cn(
													"block size-7 shrink-0 cursor-default rounded-full ring-2 ring-background",
													i > 0 && "-ml-2",
												)}
											/>
										}
									>
										<PatronPortraitWithMetalTier
											handle={patron.handle}
											avatarUrl={patron.image}
											name={patron.displayName || patron.handle}
											className="size-full rounded-full"
											width={28}
											height={28}
											showOnlineStatus
											presenceState={patron.presenceState}
											isAnimated={inferAnimatedFromProfileUrl(
												patron.image,
												patron.avatarIsAnimated,
											)}
											diaryMetalTier={patron.diaryMetalTier}
										/>
									</TooltipTrigger>
									<TooltipContent side="bottom" sideOffset={6}>
										<p className="text-xs">
											{patron.displayName}
											{patron.handle ? (
												<span className="ml-1 text-muted-foreground">
													· @{patron.handle}
												</span>
											) : null}
										</p>
									</TooltipContent>
								</Tooltip>
							))}
							{overflow > 0 && (
								<span
									className={cn(
										"-ml-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted ring-2 ring-background",
										"font-semibold text-muted-foreground text-xs tabular-nums",
									)}
								>
									+{overflow}
								</span>
							)}
						</div>
					</TooltipProvider>
				)}

				<SegmentedPillToolbar
					layoutId="staff-plans-view"
					aria-label="Plans view"
					value={view}
					onChange={onViewChange}
					options={VIEW_OPTIONS}
				/>

				<Button
					type="button"
					variant="secondary"
					size="sm"
					onClick={openPlanFeatureDrawer}
				>
					<Plus className="mr-1.5 size-3.5" />
					New feature
				</Button>
			</div>
		</div>
	);
}

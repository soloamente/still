"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@still/ui/components/tooltip";
import { cn } from "@still/ui/lib/utils";
import { Plus } from "lucide-react";

import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
} from "@/lib/detail-action-motion";
import type { ListingPresenceViewingPatron } from "@/lib/fetch-listing-presence";
import { HOME_LOBBY_FILTER_ROW_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
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
		<div
			className={cn(
				HOME_LOBBY_FILTER_ROW_CLASSNAME,
				"mb-4 grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-x-3",
			)}
		>
			<div className="flex shrink-0 justify-start">
				<SegmentedPillToolbar
					layoutId="staff-plans-view"
					aria-label="Plans view"
					value={view}
					onChange={onViewChange}
					options={VIEW_OPTIONS}
				/>
			</div>

			<div className="flex min-w-0 items-center justify-center gap-2">
				<p className="font-medium text-foreground text-sm">Features</p>
				{viewerCount > 0 ? (
					<TooltipProvider delay={0}>
						<div className="flex items-center">
							{visible.map((patron, i) => (
								<Tooltip key={patron.userId}>
									<TooltipTrigger
										render={
											<span
												className={cn(
													"block size-7 shrink-0 cursor-default rounded-full ring-2 ring-card",
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
							{overflow > 0 ? (
								<span
									className={cn(
										"-ml-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-background ring-2 ring-card",
										"font-semibold text-muted-foreground text-xs tabular-nums",
									)}
								>
									+{overflow}
								</span>
							) : null}
						</div>
					</TooltipProvider>
				) : null}
			</div>

			<div className="flex shrink-0 justify-end">
				<DetailMotionButton
					type="button"
					onClick={openPlanFeatureDrawer}
					className={cn(
						"inline-flex h-12 min-h-12 items-center gap-1.5 rounded-full bg-background px-5 font-medium text-foreground text-sm",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						DETAIL_MOTION_PRESSABLE_CLASS,
					)}
				>
					<Plus className="size-3.5 shrink-0" aria-hidden />
					New feature
				</DetailMotionButton>
			</div>
		</div>
	);
}

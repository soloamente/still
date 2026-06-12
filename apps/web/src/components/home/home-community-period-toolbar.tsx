"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import IconSlider from "@still/ui/icons/slider";
import { cn } from "@still/ui/lib/utils";
import { useState } from "react";

import { useHomeCommunityLobbyParams } from "@/components/home/home-community-lobby-params-context";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import {
	HOME_COMMUNITY_RANK_KINDS,
	type HomeCommunityRankKind,
	homeCommunityRankKindLabel,
	isHomeLeaderboardFeed,
} from "@/lib/home-community-feed";
import {
	HOME_LEADERBOARD_PERIODS,
	type HomeLeaderboardPeriod,
	leaderboardPeriodLabel,
} from "@/lib/home-leaderboard-period";
import {
	HOME_LOBBY_CHIP_TRACK_CLASSNAME,
	HOME_LOBBY_FILTERS_TRIGGER_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";

/**
 * Week / Month / Year / All time — sits on the right of Community feed chips (mirrors
 * Movies/TV venue rail). Filters bundled community payloads locally for instant taps.
 */
export function HomeCommunityPeriodToolbar() {
	const { feed, period, rankKind, selectPeriod, selectRankKind } =
		useHomeCommunityLobbyParams();
	const [open, setOpen] = useState(false);
	const periodLabel = leaderboardPeriodLabel(period);
	const onRanks = isHomeLeaderboardFeed(feed);
	const rankKindLabel = homeCommunityRankKindLabel(rankKind);

	return (
		<>
			{/* Desktop — inline pill rail */}
			<div className="hidden shrink-0 sm:block">
				<SegmentedPillToolbar
					layoutId="home-community-period-pill"
					aria-label="Community period"
					compact
					value={period}
					onChange={(next: HomeLeaderboardPeriod) => selectPeriod(next)}
					options={HOME_LEADERBOARD_PERIODS}
				/>
			</div>
			{/* Mobile — filters icon in chip track; period lives inside the panel */}
			<div
				className={cn(HOME_LOBBY_CHIP_TRACK_CLASSNAME, "shrink-0 sm:hidden")}
				role="toolbar"
				aria-label="Community filters"
			>
				<Popover open={open} onOpenChange={setOpen} modal={false}>
					<PopoverTrigger
						type="button"
						className={HOME_LOBBY_FILTERS_TRIGGER_CLASSNAME}
						aria-label={
							onRanks
								? `Community filters — ${rankKindLabel}, ${periodLabel}`
								: `Community filters — ${periodLabel}`
						}
						title={
							onRanks
								? `Community filters — ${rankKindLabel}, ${periodLabel}`
								: `Community filters — ${periodLabel}`
						}
					>
						<IconSlider
							size="1.125rem"
							className="shrink-0 opacity-95"
							aria-hidden
						/>
					</PopoverTrigger>
					<PopoverContent
						side="bottom"
						align="end"
						sideOffset={12}
						initialFocus={false}
						className="w-[min(100vw-1.5rem,22rem)] overflow-visible rounded-[1.75rem] p-3 shadow-mobbin-xl"
					>
						<div className="flex min-h-0 flex-col gap-3">
							<div className="shrink-0 px-0.5">
								<p className="text-balance font-semibold text-base text-foreground leading-snug">
									Filters
								</p>
								<p className="mt-0.5 text-pretty text-muted-foreground text-sm leading-snug">
									{onRanks ? `${rankKindLabel} · ${periodLabel}` : periodLabel}
								</p>
							</div>
							{onRanks ? (
								<div>
									<p className="mb-2 px-0.5 font-medium text-muted-foreground text-xs tracking-wide">
										Catalogue
									</p>
									<SegmentedPillToolbar
										layoutId="home-community-rank-kind-pill-mobile"
										aria-label="Rankings catalogue"
										compact
										value={rankKind}
										onChange={(next: HomeCommunityRankKind) => {
											selectRankKind(next);
										}}
										options={HOME_COMMUNITY_RANK_KINDS}
									/>
								</div>
							) : null}
							<div>
								<p className="mb-2 px-0.5 font-medium text-muted-foreground text-xs tracking-wide">
									Time period
								</p>
								<SegmentedPillToolbar
									layoutId="home-community-period-pill-mobile"
									aria-label="Community period"
									compact
									value={period}
									onChange={(next: HomeLeaderboardPeriod) => {
										selectPeriod(next);
										setOpen(false);
									}}
									options={HOME_LEADERBOARD_PERIODS}
								/>
							</div>
						</div>
					</PopoverContent>
				</Popover>
			</div>
		</>
	);
}

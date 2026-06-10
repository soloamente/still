"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { openPatronWatchLedger } from "@/components/home/patron-watch-ledger-drawer";
import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import {
	leaderboardCountButtonClassName,
	leaderboardHandleLinkClassName,
} from "@/lib/home-leaderboard-interactive";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import type {
	LeaderboardEntry,
	LeaderboardKind,
} from "@/lib/home-leaderboard-types";
import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";

export function HomeLeaderboardRow({
	entry,
	kind,
	period,
	isViewer,
}: {
	entry: LeaderboardEntry;
	kind: LeaderboardKind;
	period: HomeLeaderboardPeriod;
	isViewer: boolean;
}) {
	return (
		<li
			className={cn(
				"flex min-h-12 items-center gap-3 rounded-xl bg-background px-3 py-2",
				isViewer && "bg-muted/20",
			)}
		>
			<span className="w-8 shrink-0 text-center font-semibold text-muted-foreground text-sm tabular-nums">
				{entry.rank}
			</span>
			<Link
				href={`/profile/${entry.handle}`}
				className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<PatronPortraitWithMetalTier
					handle={entry.handle}
					avatarUrl={entry.image}
					name={entry.displayName}
					className="size-10 rounded-full"
					width={40}
					height={40}
					isAnimated={inferAnimatedFromProfileUrl(
						entry.image,
						entry.avatarIsAnimated,
					)}
					diaryMetalTier={entry.diaryMetalTier}
				/>
			</Link>
			<div className="min-w-0 flex-1 leading-none">
				<Link
					href={`/profile/${entry.handle}`}
					className={leaderboardHandleLinkClassName(
						"block max-w-full truncate font-semibold text-foreground text-sm leading-none",
					)}
					title={`Open ${entry.displayName}'s profile`}
				>
					{entry.displayName}
				</Link>
				<Link
					href={`/profile/${entry.handle}`}
					className={leaderboardHandleLinkClassName(
						"mt-0.5 block max-w-full truncate text-xs leading-none",
					)}
					title={`Open @${entry.handle}'s profile`}
				>
					@{entry.handle}
				</Link>
			</div>
			<DetailMotionButton
				type="button"
				className={leaderboardCountButtonClassName(
					"min-h-10 min-w-10 shrink-0 font-semibold text-base text-foreground tabular-nums",
				)}
				title="View watch log for this period"
				onClick={() =>
					openPatronWatchLedger({
						userId: entry.userId,
						handle: entry.handle,
						displayName: entry.displayName,
						image: entry.image,
						avatarIsAnimated: entry.avatarIsAnimated,
						diaryMetalTier: entry.diaryMetalTier,
						kind,
						period,
					})
				}
				aria-label={`${entry.count} logs — view watch list`}
			>
				{entry.count}
			</DetailMotionButton>
		</li>
	);
}

"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { CommunityRanksRowCount } from "@/components/home/community-ranks-podium-count";
import { openPatronWatchLedger } from "@/components/home/patron-watch-ledger-drawer";
import { PatronPortraitWithAura } from "@/components/profile/patron-portrait-with-aura";
import {
	HOME_COMMUNITY_RANKS_ROW_CLASSNAME,
	HOME_COMMUNITY_RANKS_VIEWER_ROW_CLASSNAME,
} from "@/lib/home-community-ranks-layout";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import type {
	LeaderboardEntry,
	LeaderboardKind,
} from "@/lib/home-leaderboard-types";
import {
	leaderboardKindCountLabel,
	leaderboardKindLedgerCta,
} from "@/lib/leaderboard-kind-labels";
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
	const ctaLabel = leaderboardKindLedgerCta(kind);
	const statNoun = leaderboardKindCountLabel(kind, entry.count);

	return (
		<li
			className={cn(
				HOME_COMMUNITY_RANKS_ROW_CLASSNAME,
				isViewer && HOME_COMMUNITY_RANKS_VIEWER_ROW_CLASSNAME,
			)}
		>
			<span className="w-8 shrink-0 text-center font-semibold text-muted-foreground text-sm tabular-nums">
				{entry.rank}
			</span>
			<Link
				href={`/profile/${entry.handle}`}
				className="flex min-w-0 flex-1 items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			>
				<PatronPortraitWithAura
					handle={entry.handle}
					avatarUrl={entry.image}
					name={entry.displayName}
					className="size-10 shrink-0 rounded-full"
					width={40}
					height={40}
					isAnimated={inferAnimatedFromProfileUrl(
						entry.image,
						entry.avatarIsAnimated,
					)}
					planTier={entry.planTier}
					staffRole={entry.staffRole}
				/>
				<span className="flex min-w-0 flex-col gap-0.5 leading-none">
					<span className="max-w-full truncate font-semibold text-foreground text-sm">
						{entry.displayName}
					</span>
					<span className="max-w-full truncate text-muted-foreground text-xs leading-snug">
						@{entry.handle}
					</span>
				</span>
			</Link>
			<CommunityRanksRowCount
				count={entry.count}
				ctaLabel={ctaLabel}
				title="View watch log for this period"
				ariaLabel={`${entry.count} ${statNoun} — view watch list`}
				onClick={() =>
					openPatronWatchLedger({
						userId: entry.userId,
						handle: entry.handle,
						displayName: entry.displayName,
						image: entry.image,
						avatarIsAnimated: entry.avatarIsAnimated,
						planTier: entry.planTier,
						staffRole: entry.staffRole,
						kind,
						period,
					})
				}
			/>
		</li>
	);
}

"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { CommunityRanksRowCount } from "@/components/home/community-ranks-podium-count";
import {
	buildPatronMembersLedgerSeed,
	openPatronMembersLedger,
} from "@/components/home/patron-members-ledger-drawer";
import { MembersFollowButton } from "@/components/members/members-follow-button";
import { PatronPortraitWithAura } from "@/components/profile/patron-portrait-with-aura";
import {
	HOME_COMMUNITY_RANKS_ROW_CLASSNAME,
	HOME_COMMUNITY_RANKS_VIEWER_ROW_CLASSNAME,
} from "@/lib/home-community-ranks-layout";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import {
	membersLeaderboardLedgerCta,
	membersLeaderboardStatNoun,
} from "@/lib/members-leaderboard";
import type {
	MembersLeaderboardEntry,
	MembersLeaderboardSort,
} from "@/lib/members-leaderboard-types";
import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";

export function MembersLeaderboardRow({
	entry,
	sort,
	period,
	viewerUserId,
}: {
	entry: MembersLeaderboardEntry;
	sort: MembersLeaderboardSort;
	period: HomeLeaderboardPeriod;
	viewerUserId: string | null;
}) {
	const isViewer = viewerUserId != null && entry.userId === viewerUserId;
	const statNoun = membersLeaderboardStatNoun(sort, entry.count);
	const showFollow = viewerUserId != null && !isViewer;

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
			<div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
				<CommunityRanksRowCount
					count={entry.count}
					ctaLabel={membersLeaderboardLedgerCta(sort)}
					title={`View ${statNoun} for this period`}
					ariaLabel={`${entry.count} ${statNoun} — view details`}
					onClick={() =>
						openPatronMembersLedger(
							buildPatronMembersLedgerSeed(entry, sort, period),
						)
					}
				/>
				{showFollow ? (
					<MembersFollowButton
						targetUserId={entry.userId}
						initialFollowing={entry.viewerFollows}
						sort={sort}
						period={period}
					/>
				) : null}
			</div>
		</li>
	);
}

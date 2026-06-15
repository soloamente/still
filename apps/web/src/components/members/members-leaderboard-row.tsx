"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import {
	buildPatronMembersLedgerSeed,
	openPatronMembersLedger,
} from "@/components/home/patron-members-ledger-drawer";
import { MembersFollowButton } from "@/components/members/members-follow-button";
import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import {
	leaderboardCountButtonClassName,
	leaderboardHandleLinkClassName,
} from "@/lib/home-leaderboard-interactive";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { membersLeaderboardStatNoun } from "@/lib/members-leaderboard";
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
			<div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
				<DetailMotionButton
					type="button"
					className={leaderboardCountButtonClassName(
						"min-h-10 min-w-10 font-semibold text-base text-foreground tabular-nums",
					)}
					title={`View ${statNoun} for this period`}
					onClick={() =>
						openPatronMembersLedger(
							buildPatronMembersLedgerSeed(entry, sort, period),
						)
					}
					aria-label={`${entry.count} ${statNoun} — view details`}
				>
					{entry.count}
				</DetailMotionButton>
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

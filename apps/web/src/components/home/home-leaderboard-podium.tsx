"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { CommunityRanksPodiumCount } from "@/components/home/community-ranks-podium-count";
import { openPatronWatchLedger } from "@/components/home/patron-watch-ledger-drawer";
import { PatronPortraitWithAura } from "@/components/profile/patron-portrait-with-aura";
import {
	type CommunityRanksPodiumSlot,
	communityRanksPodiumSlotLabel,
	HOME_COMMUNITY_RANKS_PODIUM_COLUMN_CLASSNAME,
	leaderboardKindLedgerCta,
} from "@/lib/community-ranks-podium";
import { HOME_COMMUNITY_RANKS_PODIUM_TRAY_CLASSNAME } from "@/lib/home-community-ranks-layout";
import { leaderboardHandleLinkClassName } from "@/lib/home-leaderboard-interactive";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import type {
	LeaderboardEntry,
	LeaderboardKind,
} from "@/lib/home-leaderboard-types";
import { leaderboardKindCountLabel } from "@/lib/leaderboard-kind-labels";
import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";

function PodiumTile({
	entry,
	slot,
	kind,
	period,
	reduceMotion,
}: {
	entry: LeaderboardEntry;
	slot: CommunityRanksPodiumSlot;
	kind: LeaderboardKind;
	period: HomeLeaderboardPeriod;
	reduceMotion: boolean;
}) {
	const rankLabel = communityRanksPodiumSlotLabel(slot);
	const avatarSize = slot === "first" ? 72 : 56;

	return (
		<motion.div
			className={HOME_COMMUNITY_RANKS_PODIUM_COLUMN_CLASSNAME}
			initial={reduceMotion ? false : { opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				type: "tween",
				duration: 0.2,
				delay: slot === "first" ? 0.1 : slot === "second" ? 0 : 0.2,
			}}
		>
			<p className="font-medium text-muted-foreground text-xs tracking-wide">
				{rankLabel}
			</p>
			<Link
				href={`/profile/${entry.handle}`}
				className="relative mt-2 overflow-visible rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<PatronPortraitWithAura
					handle={entry.handle}
					avatarUrl={entry.image}
					name={entry.displayName}
					className={cn(
						"rounded-full bg-card object-cover font-medium text-foreground",
						slot === "first" ? "size-16 sm:size-18" : "size-14",
					)}
					width={avatarSize}
					height={avatarSize}
					isAnimated={inferAnimatedFromProfileUrl(
						entry.image,
						entry.avatarIsAnimated,
					)}
					planTier={entry.planTier}
					staffRole={entry.staffRole}
				/>
			</Link>
			{/* Identity block — display name + handle stacked tight under the portrait. */}
			<div className="mt-2 flex w-full min-w-0 flex-col items-center gap-0.5 px-1 text-center">
				<Link
					href={`/profile/${entry.handle}`}
					className={leaderboardHandleLinkClassName(
						"max-w-full truncate font-semibold text-foreground text-sm leading-snug",
					)}
					title={`Open ${entry.displayName}'s profile`}
				>
					{entry.displayName?.trim() || entry.handle}
				</Link>
				<Link
					href={`/profile/${entry.handle}`}
					className={leaderboardHandleLinkClassName(
						"max-w-full truncate text-xs leading-snug",
					)}
					title={`Open @${entry.handle}'s profile`}
				>
					@{entry.handle}
				</Link>
			</div>
			<CommunityRanksPodiumCount
				slot={slot}
				count={entry.count}
				ctaLabel={leaderboardKindLedgerCta(kind)}
				title="View watch log for this period"
				ariaLabel={`${entry.count} ${leaderboardKindCountLabel(kind, entry.count)} — view watch list`}
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
		</motion.div>
	);
}

/**
 * Tier-card podium — 2nd · 1st · 3rd on one `bg-card` tray with pedestal blocks.
 */
export function HomeLeaderboardPodium({
	entries,
	kind,
	period,
}: {
	entries: LeaderboardEntry[];
	kind: LeaderboardKind;
	period: HomeLeaderboardPeriod;
}) {
	const reduceMotion = useReducedMotion();
	const first = entries[0];
	const second = entries[1];
	const third = entries[2];

	if (!first) return null;

	return (
		<div className={HOME_COMMUNITY_RANKS_PODIUM_TRAY_CLASSNAME}>
			<div className="flex items-end justify-center gap-2 sm:gap-3">
				{second ? (
					<PodiumTile
						entry={second}
						slot="second"
						kind={kind}
						period={period}
						reduceMotion={Boolean(reduceMotion)}
					/>
				) : (
					<div className="min-w-0 flex-1" aria-hidden />
				)}
				<PodiumTile
					entry={first}
					slot="first"
					kind={kind}
					period={period}
					reduceMotion={Boolean(reduceMotion)}
				/>
				{third ? (
					<PodiumTile
						entry={third}
						slot="third"
						kind={kind}
						period={period}
						reduceMotion={Boolean(reduceMotion)}
					/>
				) : (
					<div className="min-w-0 flex-1" aria-hidden />
				)}
			</div>
		</div>
	);
}

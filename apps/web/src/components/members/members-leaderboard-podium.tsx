"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { CommunityRanksPodiumCount } from "@/components/home/community-ranks-podium-count";
import {
	buildPatronMembersLedgerSeed,
	openPatronMembersLedger,
} from "@/components/home/patron-members-ledger-drawer";
import { PatronPortraitWithAura } from "@/components/profile/patron-portrait-with-aura";
import {
	type CommunityRanksPodiumSlot,
	communityRanksPodiumSlotLabel,
	HOME_COMMUNITY_RANKS_PODIUM_COLUMN_CLASSNAME,
} from "@/lib/community-ranks-podium";
import { HOME_COMMUNITY_RANKS_PODIUM_TRAY_CLASSNAME } from "@/lib/home-community-ranks-layout";
import { leaderboardHandleLinkClassName } from "@/lib/home-leaderboard-interactive";
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

function MembersPodiumTile({
	entry,
	slot,
	sort,
	period,
	reduceMotion,
}: {
	entry: MembersLeaderboardEntry;
	slot: CommunityRanksPodiumSlot;
	sort: MembersLeaderboardSort;
	period: HomeLeaderboardPeriod;
	reduceMotion: boolean;
}) {
	const rankLabel = communityRanksPodiumSlotLabel(slot);
	const statNoun = membersLeaderboardStatNoun(sort, entry.count);
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
				/>
			</Link>
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
				ctaLabel={membersLeaderboardLedgerCta(sort)}
				title={`View ${statNoun} for this period`}
				ariaLabel={`${entry.count} ${statNoun} — view details`}
				onClick={() =>
					openPatronMembersLedger(
						buildPatronMembersLedgerSeed(entry, sort, period),
					)
				}
			/>
		</motion.div>
	);
}

/**
 * Tier-card podium for patron contribution ranks — mirrors {@link HomeLeaderboardPodium}.
 */
export function MembersLeaderboardPodium({
	items,
	sort,
	period,
}: {
	items: MembersLeaderboardEntry[];
	sort: MembersLeaderboardSort;
	period: HomeLeaderboardPeriod;
}) {
	const reduceMotion = useReducedMotion();
	const first = items[0];
	const second = items[1];
	const third = items[2];

	if (!first) return null;

	return (
		<div className={HOME_COMMUNITY_RANKS_PODIUM_TRAY_CLASSNAME}>
			<div className="flex items-end justify-center gap-2 sm:gap-3">
				{second ? (
					<MembersPodiumTile
						entry={second}
						slot="second"
						sort={sort}
						period={period}
						reduceMotion={Boolean(reduceMotion)}
					/>
				) : (
					<div className="min-w-0 flex-1" aria-hidden />
				)}
				<MembersPodiumTile
					entry={first}
					slot="first"
					sort={sort}
					period={period}
					reduceMotion={Boolean(reduceMotion)}
				/>
				{third ? (
					<MembersPodiumTile
						entry={third}
						slot="third"
						sort={sort}
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

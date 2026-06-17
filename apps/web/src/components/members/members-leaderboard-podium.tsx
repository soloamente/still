"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import {
	buildPatronMembersLedgerSeed,
	openPatronMembersLedger,
} from "@/components/home/patron-members-ledger-drawer";
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

type PodiumSlot = "second" | "first" | "third";

/** Rank washes on `bg-card` — gold 1st, silver 2nd, desert-orange 3rd (mirrors film/show ranks). */
function podiumSlotSurfaceClass(slot: PodiumSlot): string {
	switch (slot) {
		case "first":
			return "bg-[color-mix(in_oklab,oklch(0.7_0.17_78)_32%,var(--background))]";
		case "second":
			return "bg-[color-mix(in_oklab,oklch(0.76_0.06_258)_28%,var(--background))]";
		case "third":
			return "bg-[color-mix(in_oklab,var(--color-desert-orange)_30%,var(--background))]";
		default: {
			const _exhaustive: never = slot;
			return _exhaustive;
		}
	}
}

function MembersPodiumTile({
	entry,
	slot,
	sort,
	period,
	reduceMotion,
}: {
	entry: MembersLeaderboardEntry;
	slot: PodiumSlot;
	sort: MembersLeaderboardSort;
	period: HomeLeaderboardPeriod;
	reduceMotion: boolean;
}) {
	const rankLabel =
		slot === "first" ? "1st" : slot === "second" ? "2nd" : "3rd";
	const statNoun = membersLeaderboardStatNoun(sort, entry.count);

	return (
		<motion.div
			className={cn(
				"flex min-w-0 max-w-[7.5rem] flex-1 flex-col items-center rounded-2xl px-2 py-3 sm:max-w-[8.5rem]",
				podiumSlotSurfaceClass(slot),
				slot === "first" && "-translate-y-2.5",
			)}
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
				<PatronPortraitWithMetalTier
					handle={entry.handle}
					avatarUrl={entry.image}
					name={entry.displayName}
					className="size-14 rounded-full bg-card object-cover font-medium text-foreground sm:size-16"
					width={64}
					height={64}
					isAnimated={inferAnimatedFromProfileUrl(
						entry.image,
						entry.avatarIsAnimated,
					)}
					diaryMetalTier={entry.diaryMetalTier}
				/>
			</Link>
			<p className="mt-2 max-w-full truncate font-semibold text-foreground text-sm">
				{entry.displayName?.trim() || entry.handle}
			</p>
			<Link
				href={`/profile/${entry.handle}`}
				className={leaderboardHandleLinkClassName(
					"mt-0.5 max-w-full truncate text-xs",
				)}
				title={`Open @${entry.handle}'s profile`}
			>
				@{entry.handle}
			</Link>
			<DetailMotionButton
				type="button"
				className={leaderboardCountButtonClassName(
					"mt-1 font-semibold text-foreground text-xl tabular-nums",
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
		</motion.div>
	);
}

/**
 * Tier-card podium for patron contribution ranks — 2nd · 1st · 3rd on `bg-card` tray
 * (same layout as {@link HomeLeaderboardPodium} on Films/Shows).
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
		<div className="rounded-2xl bg-card p-4 sm:p-5">
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

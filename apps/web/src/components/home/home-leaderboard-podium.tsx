"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import { openPatronWatchLedger } from "@/components/home/patron-watch-ledger-drawer";
import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { PatronPortraitAvatar } from "@/components/profile/patron-portrait-avatar";
import {
	leaderboardCountButtonClassName,
	leaderboardHandleLinkClassName,
} from "@/lib/home-leaderboard-interactive";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import type {
	LeaderboardEntry,
	LeaderboardKind,
} from "@/lib/home-leaderboard-types";

type PodiumSlot = "second" | "first" | "third";

/** Rank washes on `bg-card` — gold 1st, silver 2nd, desert-orange 3rd (no borders). */
function podiumSlotSurfaceClass(slot: PodiumSlot): string {
	switch (slot) {
		case "first":
			return "bg-[color-mix(in_oklab,oklch(0.7_0.17_78)_32%,var(--background))]";
		case "second":
			return "bg-[color-mix(in_oklab,oklch(0.76_0.06_258)_28%,var(--background))]";
		case "third":
			return "bg-[color-mix(in_oklab,var(--color-desert-orange)_30%,var(--background))]";
	}
}

function PodiumTile({
	entry,
	slot,
	kind,
	period,
	reduceMotion,
}: {
	entry: LeaderboardEntry;
	slot: PodiumSlot;
	kind: LeaderboardKind;
	period: HomeLeaderboardPeriod;
	reduceMotion: boolean;
}) {
	const rankLabel =
		slot === "first" ? "1st" : slot === "second" ? "2nd" : "3rd";

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
				className="mt-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<PatronPortraitAvatar
					handle={entry.handle}
					avatarUrl={entry.image}
					name={entry.displayName}
					className="size-14 rounded-full bg-card object-cover font-medium text-foreground sm:size-16"
					width={64}
					height={64}
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
				title="View watch log for this period"
				onClick={() =>
					openPatronWatchLedger({
						userId: entry.userId,
						handle: entry.handle,
						displayName: entry.displayName,
						image: entry.image,
						kind,
						period,
					})
				}
				aria-label={`${entry.count} logs — view watch list`}
			>
				{entry.count}
			</DetailMotionButton>
		</motion.div>
	);
}

/**
 * Tier-card podium — 2nd · 1st · 3rd on `bg-card` tray (Achievements-like).
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
		<div className="rounded-2xl bg-card p-4 sm:p-5">
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

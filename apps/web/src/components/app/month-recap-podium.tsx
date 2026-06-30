"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import { leaderboardHandleLinkClassName } from "@/lib/home-leaderboard-interactive";
import type {
	MonthRecapCategoryId,
	MonthRecapEntry,
} from "@/lib/month-recap-types";
import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";

type PodiumSlot = "second" | "first" | "third";

/** Rank washes on `bg-card` — gold 1st, silver 2nd, desert-orange 3rd (mirrors Community ranks). */
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

function monthRecapStatNoun(
	categoryId: MonthRecapCategoryId,
	count: number,
): string {
	const plural = count === 1 ? "" : "s";
	switch (categoryId) {
		case "films":
			return `film${plural}`;
		case "tv":
			return `show${plural}`;
		case "reviews":
			return `review${plural}`;
		default: {
			const _exhaustive: never = categoryId;
			return _exhaustive;
		}
	}
}

function MonthRecapPodiumTile({
	entry,
	slot,
	categoryId,
	reduceMotion,
}: {
	entry: MonthRecapEntry;
	slot: PodiumSlot;
	categoryId: MonthRecapCategoryId;
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
			<p className="mt-1 font-semibold text-foreground text-xl tabular-nums">
				{entry.count}
				<span className="sr-only">
					{" "}
					{monthRecapStatNoun(categoryId, entry.count)}
				</span>
			</p>
			<p className="text-muted-foreground text-xs">
				{monthRecapStatNoun(categoryId, entry.count)}
			</p>
		</motion.div>
	);
}

/** Compact top-3 row for month-recap slides — profile links only (no ledger drawer). */
export function MonthRecapPodium({
	entries,
	categoryId,
}: {
	entries: MonthRecapEntry[];
	categoryId: MonthRecapCategoryId;
}) {
	const reduceMotion = useReducedMotion();
	const first = entries[0];
	const second = entries[1];
	const third = entries[2];

	if (!first) return null;

	return (
		<div className="w-full rounded-2xl bg-background p-4 sm:p-5">
			<div className="flex items-end justify-center gap-2 sm:gap-3">
				{second ? (
					<MonthRecapPodiumTile
						entry={second}
						slot="second"
						categoryId={categoryId}
						reduceMotion={Boolean(reduceMotion)}
					/>
				) : (
					<div className="min-w-0 flex-1" aria-hidden />
				)}
				<MonthRecapPodiumTile
					entry={first}
					slot="first"
					categoryId={categoryId}
					reduceMotion={Boolean(reduceMotion)}
				/>
				{third ? (
					<MonthRecapPodiumTile
						entry={third}
						slot="third"
						categoryId={categoryId}
						reduceMotion={Boolean(reduceMotion)}
					/>
				) : (
					<div className="min-w-0 flex-1" aria-hidden />
				)}
			</div>
		</div>
	);
}

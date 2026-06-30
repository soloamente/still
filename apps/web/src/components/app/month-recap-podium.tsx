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
			return "bg-[color-mix(in_oklab,oklch(0.7_0.17_78)_42%,var(--background))]";
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

/** Resolve podium slots by rank — API order is not guaranteed. */
function resolvePodiumEntries(entries: MonthRecapEntry[]): {
	first: MonthRecapEntry | undefined;
	second: MonthRecapEntry | undefined;
	third: MonthRecapEntry | undefined;
} {
	const ordered = entries.slice().sort((a, b) => a.rank - b.rank);
	return {
		first: ordered.find((entry) => entry.rank === 1) ?? ordered[0],
		second: ordered.find((entry) => entry.rank === 2) ?? ordered[1],
		third: ordered.find((entry) => entry.rank === 3) ?? ordered[2],
	};
}

function podiumTileLayoutClass(slot: PodiumSlot): string {
	switch (slot) {
		case "first":
			return "z-10 min-w-0 max-w-[10rem] flex-[1.35] -translate-y-5 px-2.5 py-4 sm:max-w-[11rem]";
		case "second":
			return "min-w-0 max-w-[6.25rem] flex-1 translate-y-0 px-2 py-2.5 opacity-90 sm:max-w-[7rem]";
		case "third":
			return "min-w-0 max-w-[6.25rem] flex-1 translate-y-3 px-2 py-2.5 opacity-85 sm:max-w-[7rem]";
		default: {
			const _exhaustive: never = slot;
			return _exhaustive;
		}
	}
}

function podiumPortraitClass(slot: PodiumSlot): string {
	switch (slot) {
		case "first":
			return "size-[4.5rem] sm:size-20";
		case "second":
		case "third":
			return "size-11 sm:size-12";
		default: {
			const _exhaustive: never = slot;
			return _exhaustive;
		}
	}
}

function podiumPortraitDimensions(slot: PodiumSlot): {
	width: number;
	height: number;
} {
	switch (slot) {
		case "first":
			return { width: 80, height: 80 };
		case "second":
		case "third":
			return { width: 48, height: 48 };
		default: {
			const _exhaustive: never = slot;
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
	const portraitSize = podiumPortraitDimensions(slot);

	return (
		<motion.div
			className={cn(
				"flex flex-col items-center rounded-2xl",
				podiumTileLayoutClass(slot),
				podiumSlotSurfaceClass(slot),
			)}
			initial={reduceMotion ? false : { opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				type: "tween",
				duration: 0.2,
				delay: slot === "first" ? 0.1 : slot === "second" ? 0 : 0.2,
			}}
		>
			<p
				className={cn(
					"font-medium tracking-wide",
					slot === "first"
						? "text-foreground text-sm"
						: "text-muted-foreground text-xs",
				)}
			>
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
					className={cn(
						"rounded-full bg-card object-cover font-medium text-foreground",
						podiumPortraitClass(slot),
					)}
					width={portraitSize.width}
					height={portraitSize.height}
					isAnimated={inferAnimatedFromProfileUrl(
						entry.image,
						entry.avatarIsAnimated,
					)}
					diaryMetalTier={entry.diaryMetalTier}
				/>
			</Link>
			<p
				className={cn(
					"mt-2 max-w-full truncate font-semibold text-foreground",
					slot === "first" ? "text-base" : "text-sm",
				)}
			>
				{entry.displayName?.trim() || entry.handle}
			</p>
			<Link
				href={`/profile/${entry.handle}`}
				className={leaderboardHandleLinkClassName(
					cn(
						"mt-0.5 max-w-full truncate",
						slot === "first" ? "text-sm" : "text-xs",
					),
				)}
				title={`Open @${entry.handle}'s profile`}
			>
				@{entry.handle}
			</Link>
			<p
				className={cn(
					"mt-1 font-semibold text-foreground tabular-nums",
					slot === "first" ? "text-2xl" : "text-lg",
				)}
			>
				{entry.count}
				<span className="sr-only">
					{" "}
					{monthRecapStatNoun(categoryId, entry.count)}
				</span>
			</p>
			<p
				className={cn(
					"text-muted-foreground",
					slot === "first" ? "text-xs" : "text-[11px]",
				)}
			>
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
	const { first, second, third } = resolvePodiumEntries(entries);

	if (!first) return null;

	return (
		<div className="flex w-full items-end justify-center gap-1.5 sm:gap-2">
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
	);
}

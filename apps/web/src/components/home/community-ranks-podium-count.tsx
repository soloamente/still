"use client";

import { cn } from "@still/ui/lib/utils";
import { ChevronRight } from "lucide-react";

import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import {
	COMMUNITY_RANKS_PODIUM_CTA_CLASSNAME,
	type CommunityRanksPodiumSlot,
	communityRanksPodiumCountTextClass,
	communityRanksPodiumPedestalButtonClass,
} from "@/lib/community-ranks-podium";
import { leaderboardCountButtonClassName } from "@/lib/home-leaderboard-interactive";

/**
 * Podium pedestal control — big count + always-visible "View …" CTA so the bar
 * reads as tappable, not decorative chrome.
 */
export function CommunityRanksPodiumCount({
	slot,
	count,
	ctaLabel,
	title,
	ariaLabel,
	onClick,
}: {
	slot: CommunityRanksPodiumSlot;
	count: number;
	ctaLabel: string;
	title: string;
	ariaLabel: string;
	onClick: () => void;
}) {
	return (
		<DetailMotionButton
			type="button"
			className={communityRanksPodiumPedestalButtonClass(slot)}
			title={title}
			aria-label={ariaLabel}
			onClick={onClick}
		>
			<span
				className={cn(
					"tabular-nums leading-none",
					communityRanksPodiumCountTextClass(slot),
				)}
			>
				{count}
			</span>
			<span className={COMMUNITY_RANKS_PODIUM_CTA_CLASSNAME}>
				{ctaLabel}
				<ChevronRight className="size-3 shrink-0 opacity-80" aria-hidden />
			</span>
		</DetailMotionButton>
	);
}

/** Compact rank-row count — same ledger CTA language as the podium pedestals. */
export function CommunityRanksRowCount({
	count,
	ctaLabel,
	title,
	ariaLabel,
	onClick,
}: {
	count: number;
	ctaLabel: string;
	title: string;
	ariaLabel: string;
	onClick: () => void;
}) {
	return (
		<DetailMotionButton
			type="button"
			className={leaderboardCountButtonClassName(
				"flex min-h-10 min-w-[3.25rem] shrink-0 flex-col items-center justify-center gap-0.5 px-2 py-1.5",
			)}
			title={title}
			aria-label={ariaLabel}
			onClick={onClick}
		>
			<span className="font-semibold text-base text-foreground tabular-nums leading-none">
				{count}
			</span>
			<span
				className={cn(
					COMMUNITY_RANKS_PODIUM_CTA_CLASSNAME,
					"text-[10px] leading-none",
				)}
			>
				{ctaLabel}
				<ChevronRight className="size-2.5 shrink-0 opacity-80" aria-hidden />
			</span>
		</DetailMotionButton>
	);
}

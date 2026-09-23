import { cn } from "@still/ui/lib/utils";

import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

export type CommunityRanksPodiumSlot = "second" | "first" | "third";

export { leaderboardKindLedgerCta } from "@/lib/leaderboard-kind-labels";

/** Place digit for quiet ordinal typography (not a metal badge). */
export function communityRanksPodiumBadgeDigit(
	slot: CommunityRanksPodiumSlot,
): "1" | "2" | "3" {
	switch (slot) {
		case "first":
			return "1";
		case "second":
			return "2";
		case "third":
			return "3";
		default: {
			const _exhaustive: never = slot;
			return _exhaustive;
		}
	}
}

/** Quiet place mark — muted type only; plan frames carry identity, not medals. */
export const COMMUNITY_RANKS_PODIUM_ORDINAL_CLASSNAME =
	"font-medium text-[10px] text-muted-foreground tabular-nums leading-none sm:text-xs";

export const COMMUNITY_RANKS_PODIUM_STAGE_CLASSNAME =
	"relative flex items-start justify-center gap-2 sm:gap-3";

/** First three entries only — never invents missing 2nd/3rd places. */
export function communityRanksPodiumFilled<T>(
	entries: readonly T[],
): { first: T; second: T | undefined; third: T | undefined } | null {
	const first = entries[0];
	if (!first) return null;
	return { first, second: entries[1], third: entries[2] };
}

export function communityRanksPodiumSlotLabel(
	slot: CommunityRanksPodiumSlot,
): string {
	switch (slot) {
		case "first":
			return "1st";
		case "second":
			return "2nd";
		case "third":
			return "3rd";
		default: {
			const _exhaustive: never = slot;
			return _exhaustive;
		}
	}
}

/** Large log count — 1st reads largest; no pedestal height staging. */
export function communityRanksPodiumCountTextClass(
	slot: CommunityRanksPodiumSlot,
): string {
	switch (slot) {
		case "first":
			return "text-3xl sm:text-4xl";
		case "second":
			return "text-2xl sm:text-3xl";
		case "third":
			return "text-xl sm:text-2xl";
		default: {
			const _exhaustive: never = slot;
			return _exhaustive;
		}
	}
}

/**
 * Ledger count control — flat `bg-background` on the podium tray (Sense elevation),
 * not gold/silver/bronze pedestals.
 */
export function communityRanksPodiumCountButtonClass(
	_slot: CommunityRanksPodiumSlot,
): string {
	return cn(
		"mt-3 flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl bg-background px-3 py-3",
		"font-semibold text-foreground transition-[transform,colors] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none",
		DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
	);
}

/** Muted action line under the count — always visible so the control reads as tappable. */
export const COMMUNITY_RANKS_PODIUM_CTA_CLASSNAME =
	"flex items-center gap-0.5 font-medium text-[10px] text-foreground/75 leading-none sm:text-xs";

/** Podium column width cap — keeps three-up layout balanced on narrow viewports. */
export const HOME_COMMUNITY_RANKS_PODIUM_COLUMN_CLASSNAME = cn(
	"flex min-w-0 max-w-[7.75rem] flex-1 flex-col items-center sm:max-w-[8.75rem]",
);

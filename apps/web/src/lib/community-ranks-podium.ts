import { cn } from "@still/ui/lib/utils";

export type CommunityRanksPodiumSlot = "second" | "first" | "third";

export { leaderboardKindLedgerCta } from "@/lib/leaderboard-kind-labels";

/** Rank washes — gold 1st, silver 2nd, desert-orange 3rd (inset pedestals, no borders). */
export function communityRanksPodiumPedestalClass(
	slot: CommunityRanksPodiumSlot,
): string {
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

/** Pedestal block height — 1st tallest so the stage reads without translate hacks. */
export function communityRanksPodiumPedestalHeightClass(
	slot: CommunityRanksPodiumSlot,
): string {
	switch (slot) {
		case "first":
			return "h-22 sm:h-26";
		case "second":
			return "h-18 sm:h-20";
		case "third":
			return "h-16 sm:h-18";
		default: {
			const _exhaustive: never = slot;
			return _exhaustive;
		}
	}
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

/** Large log count centered inside the pedestal block — 1st reads largest. */
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

/** Full-width pedestal press target — count + visible ledger CTA. */
export function communityRanksPodiumPedestalButtonClass(
	slot: CommunityRanksPodiumSlot,
): string {
	return cn(
		"mt-3 flex w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-t-2xl px-2 py-2",
		"font-semibold text-foreground transition-[transform,filter] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none",
		"[@media(hover:hover)]:hover:brightness-110",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
		communityRanksPodiumPedestalHeightClass(slot),
		communityRanksPodiumPedestalClass(slot),
	);
}

/** Muted action line under the count — always visible so the pedestal reads as a control. */
export const COMMUNITY_RANKS_PODIUM_CTA_CLASSNAME =
	"flex items-center gap-0.5 font-medium text-[10px] text-foreground/75 leading-none sm:text-xs";

/** Podium column width cap — keeps three-up layout balanced on narrow viewports. */
export const HOME_COMMUNITY_RANKS_PODIUM_COLUMN_CLASSNAME = cn(
	"flex min-w-0 max-w-[7.75rem] flex-1 flex-col items-center sm:max-w-[8.75rem]",
);

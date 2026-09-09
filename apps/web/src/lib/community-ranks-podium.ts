import { cn } from "@still/ui/lib/utils";

export type CommunityRanksPodiumSlot = "second" | "first" | "third";

export { leaderboardKindLedgerCta } from "@/lib/leaderboard-kind-labels";

/** 3D medal face — gold 1st, silver 2nd, desert-orange bronze 3rd. */
export function communityRanksPodiumPedestalClass(
	slot: CommunityRanksPodiumSlot,
): string {
	switch (slot) {
		case "first":
			return "bg-[linear-gradient(180deg,oklch(0.22_0.03_78)_0_10px,oklch(0.82_0.12_82)_12px,oklch(0.62_0.14_72)_100%)] text-zinc-950";
		case "second":
			return "bg-[linear-gradient(180deg,oklch(0.2_0.02_260)_0_10px,oklch(0.86_0.02_250)_12px,oklch(0.62_0.03_250)_100%)] text-zinc-950";
		case "third":
			return "bg-[linear-gradient(180deg,oklch(0.24_0.04_55)_0_10px,color-mix(in_oklab,var(--color-desert-orange)_72%,white)_12px,var(--color-desert-orange)_100%)] text-zinc-950";
		default: {
			const _exhaustive: never = slot;
			return _exhaustive;
		}
	}
}

/** Place digit painted on the silver badge (Task 4 mounts it on the pedestal face). */
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

export const COMMUNITY_RANKS_PODIUM_BADGE_CLASSNAME =
	"absolute top-0 left-1/2 z-10 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[radial-gradient(circle_at_32%_28%,white,#b8bcc4_62%)] font-bold text-[11px] text-zinc-900 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.5)]";

export const COMMUNITY_RANKS_PODIUM_STAGE_CLASSNAME =
	"relative flex items-end justify-center gap-2 sm:gap-3";

/** Soft floor light — radial only, no backdrop-blur. */
export const COMMUNITY_RANKS_PODIUM_FLOOR_GLOW_CLASSNAME =
	"pointer-events-none absolute inset-x-[8%] bottom-0 h-8 bg-[radial-gradient(ellipse_at_center,oklch(0.85_0.08_82_/_0.22),transparent_70%)]";

/** First three entries only — never invents missing 2nd/3rd places. */
export function communityRanksPodiumFilled<T>(
	entries: readonly T[],
): { first: T; second: T | undefined; third: T | undefined } | null {
	const first = entries[0];
	if (!first) return null;
	return { first, second: entries[1], third: entries[2] };
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
		// Badge hangs on the top lip (`top-0 -translate-y-1/2`); interior is for count + CTA.
		"relative mt-3 flex w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-t-2xl px-2 py-2",
		"font-semibold transition-[transform,filter] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none",
		"[@media(hover:hover)]:hover:brightness-110",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
		communityRanksPodiumPedestalHeightClass(slot),
		communityRanksPodiumPedestalClass(slot),
	);
}

/** Muted action line under the count — always visible so the pedestal reads as a control. */
export const COMMUNITY_RANKS_PODIUM_CTA_CLASSNAME =
	"flex items-center gap-0.5 font-medium text-[10px] text-foreground/75 leading-none sm:text-xs";

/** Pedestal-only CTA — same layout as the row CTA, darker ink on gold/silver/bronze faces. */
export const COMMUNITY_RANKS_PODIUM_PEDESTAL_CTA_CLASSNAME =
	"flex items-center gap-0.5 font-medium text-[10px] text-zinc-950/70 leading-none sm:text-xs";

/** Podium column width cap — keeps three-up layout balanced on narrow viewports. */
export const HOME_COMMUNITY_RANKS_PODIUM_COLUMN_CLASSNAME = cn(
	"flex min-w-0 max-w-[7.75rem] flex-1 flex-col items-center sm:max-w-[8.75rem]",
);

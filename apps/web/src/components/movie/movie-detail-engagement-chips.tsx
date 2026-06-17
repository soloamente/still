"use client";

import IconClockRotateClockwise from "@still/ui/icons/clock-rotate-clockwise";
import IconHeartFilled from "@still/ui/icons/heart-filled";
import IconListPlay from "@still/ui/icons/list-play";
import IconScreeningFill from "@still/ui/icons/screening-fill";
import { cn } from "@still/ui/lib/utils";

import { formatEngagementCountAbbrev } from "@/lib/format-engagement-count";
import {
	formatListingEngagementChipAriaLabel,
	formatListingEngagementChipTooltip,
	type ListingEngagementChipKind,
} from "@/lib/listing-engagement-chip-copy";

export type ListingEngagementCounts = {
	watchesCount: number;
	listsCount: number;
	favoritesCount: number;
	watchlistCount: number;
};

const CHIP_CONFIG: {
	kind: ListingEngagementChipKind;
	icon: typeof IconScreeningFill;
	iconClassName: string;
}[] = [
	{
		kind: "watched",
		icon: IconScreeningFill,
		iconClassName: "text-emerald-400/90",
	},
	{
		kind: "lists",
		icon: IconListPlay,
		iconClassName: "text-sky-400/90",
	},
	{
		kind: "favorited",
		icon: IconHeartFilled,
		iconClassName: "text-orange-400/90",
	},
	{
		kind: "watchlist",
		icon: IconClockRotateClockwise,
		iconClassName: "text-muted-foreground",
	},
];

function resolveCount(
	counts: ListingEngagementCounts,
	kind: ListingEngagementChipKind,
): number {
	switch (kind) {
		case "watched":
			return counts.watchesCount;
		case "lists":
			return counts.listsCount;
		case "favorited":
			return counts.favoritesCount;
		case "watchlist":
			return counts.watchlistCount;
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

/**
 * Letterboxd-style engagement chips — abbreviated counts with exact tooltips.
 * Drawer wiring lands in milestone 1b (`onChipPress`).
 */
export function MovieDetailEngagementChips({
	counts,
	className,
	onChipPress,
}: {
	counts: ListingEngagementCounts;
	className?: string;
	onChipPress?: (kind: ListingEngagementChipKind) => void;
}) {
	return (
		<div
			className={cn(
				"flex flex-wrap items-center justify-center gap-x-4 gap-y-2",
				className,
			)}
		>
			{CHIP_CONFIG.map(({ kind, icon: Icon, iconClassName }) => {
				const count = resolveCount(counts, kind);
				const abbrev = formatEngagementCountAbbrev(count);
				const tooltip = formatListingEngagementChipTooltip(kind, count);

				return (
					<button
						key={kind}
						type="button"
						title={tooltip}
						aria-label={formatListingEngagementChipAriaLabel(kind, abbrev)}
						className={cn(
							"inline-flex min-h-10 items-center gap-1.5 rounded-full px-1 py-1",
							"text-muted-foreground text-sm tabular-nums",
							"select-none outline-none",
							"focus-visible:ring-2 focus-visible:ring-desert-orange/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
							"[@media(hover:hover)]:hover:text-foreground",
						)}
						onClick={() => onChipPress?.(kind)}
					>
						<Icon
							aria-hidden
							className={cn("size-4 shrink-0", iconClassName)}
						/>
						<span aria-hidden>{abbrev}</span>
						<span className="sr-only">{tooltip}</span>
					</button>
				);
			})}
		</div>
	);
}

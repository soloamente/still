export type ListingEngagementChipKind =
	| "watched"
	| "lists"
	| "favorited"
	| "watchlist";

/** Exact-count tooltip for engagement chips (hover + sr-only supplement). */
export function formatListingEngagementChipTooltip(
	kind: ListingEngagementChipKind,
	count: number,
): string {
	const n = Math.max(0, Math.floor(count));
	const formatted = n.toLocaleString("en-US");
	switch (kind) {
		case "watched":
			return n === 1
				? "Watched by 1 patron"
				: `Watched by ${formatted} patrons`;
		case "lists":
			return n === 1 ? "Appears in 1 list" : `Appears in ${formatted} lists`;
		case "favorited":
			return n === 1
				? "Favorited by 1 patron"
				: `Favorited by ${formatted} patrons`;
		case "watchlist":
			return n === 1 ? "On 1 watchlist" : `On ${formatted} watchlists`;
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

/** Accessible chip label combining kind + abbreviated count. */
export function formatListingEngagementChipAriaLabel(
	kind: ListingEngagementChipKind,
	abbrev: string,
): string {
	switch (kind) {
		case "watched":
			return `Watched by ${abbrev} patrons`;
		case "lists":
			return `Appears in ${abbrev} lists`;
		case "favorited":
			return `Favorited by ${abbrev} patrons`;
		case "watchlist":
			return `On ${abbrev} watchlists`;
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

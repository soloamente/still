import type { ListingEngagementChipKind } from "@/lib/listing-engagement-chip-copy";

/** Drawer title per engagement chip kind. */
export function listingEngagementDrawerTitle(
	kind: ListingEngagementChipKind,
): string {
	switch (kind) {
		case "watched":
			return "Watched by patrons";
		case "lists":
			return "Lists with this title";
		case "favorited":
			return "Favorited by patrons";
		case "watchlist":
			return "On watchlists";
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

/** Drawer description under the title. */
export function listingEngagementDrawerDescription(
	kind: ListingEngagementChipKind,
): string {
	switch (kind) {
		case "watched":
			return "Patrons you can see who logged this title in their diary.";
		case "lists":
			return "Lists you can open that include this title.";
		case "favorited":
			return "Patrons you can see who favorited this title.";
		case "watchlist":
			return "Patrons with public profiles who saved this title to watch.";
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

/** Empty drawer body copy when the chip count is zero. */
export function listingEngagementDrawerEmptyCopy(
	kind: ListingEngagementChipKind,
): string {
	switch (kind) {
		case "watched":
			return "No patrons you can see have logged this title yet.";
		case "lists":
			return "No lists you can open include this title yet.";
		case "favorited":
			return "No patrons you can see have favorited this title yet.";
		case "watchlist":
			return "No public watchlists include this title yet.";
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

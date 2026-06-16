import type {
	ListingPresenceSnapshot,
	ListingPresenceViewingPatron,
} from "@/lib/fetch-listing-presence";

/** Max public-profile chips rendered before a `+N` overflow pill. */

export const LISTING_PRESENCE_VISIBLE_VIEWING_PATRONS = 3;

/** Compact muted label beside the numeric count in the corner pill. */
export const LISTING_PRESENCE_COMPACT_VIEWING_LABEL = "other viewing";

/** Screen-reader label for portrait presence dots. */
export function formatPatronPresenceDotLabel(
	handle: string,
	state: "active" | "away",
): string {
	return state === "active" ? `@${handle} online now` : `@${handle} away`;
}

/**
 * Visible occupancy line for title detail presence row (excludes self).
 * Returns empty string when alone — caller hides the row.
 */
export function formatListingPresenceViewingLine(viewerCount: number): string {
	if (viewerCount <= 0) return "";
	if (viewerCount === 1) return "1 other patron viewing";
	return `${viewerCount} other patrons viewing`;
}

export type ListingPresenceRowDisplay = {
	visibleViewingPatrons: ListingPresenceViewingPatron[];

	viewingMoreCount: number;

	unidentifiedCount: number;

	countLine: string;
};

export type ListingPresenceDrawerCopy = {
	title: string;
	description: string;
	hiddenCount: number;
};

/** Drawer copy derived from visible patron rows + anonymous/hidden count. */
export function buildListingPresenceDrawerCopy(input: {
	viewerCount: number;
	visibleCount: number;
}): ListingPresenceDrawerCopy {
	const visible = Math.max(0, input.visibleCount);
	const title =
		visible === 1 ? "1 patron viewing now" : `${visible} patrons viewing now`;
	const hiddenCount = Math.max(0, input.viewerCount - visible);
	const description =
		hiddenCount > 0
			? `${hiddenCount} more ${hiddenCount === 1 ? "patron is" : "patrons are"} viewing with private visibility settings.`
			: "Patrons currently visible in this title presence room.";
	return {
		title,
		description,
		hiddenCount,
	};
}

/** Pure display resolver for presence row copy and chip caps (unit tested). */

export function resolveListingPresenceRowDisplay(
	snapshot: ListingPresenceSnapshot,
): ListingPresenceRowDisplay | null {
	const { viewerCount, viewingPatrons } = snapshot;

	if (viewerCount <= 0) return null;

	const visibleViewingPatrons = viewingPatrons.slice(
		0,

		LISTING_PRESENCE_VISIBLE_VIEWING_PATRONS,
	);

	const viewingMoreCount = Math.max(
		0,

		viewingPatrons.length - visibleViewingPatrons.length,
	);

	const unidentifiedCount = Math.max(0, viewerCount - viewingPatrons.length);

	let countLine = "";

	if (viewingPatrons.length === 0) {
		countLine = formatListingPresenceViewingLine(viewerCount);
	} else if (unidentifiedCount > 0) {
		countLine = formatListingPresenceViewingLine(unidentifiedCount);
	}

	return {
		visibleViewingPatrons,

		viewingMoreCount,

		unidentifiedCount,

		countLine,
	};
}

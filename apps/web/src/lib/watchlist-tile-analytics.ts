/**
 * `watchlist.tile_action` payload helpers. Props carry only enum values —
 * never the reason pill text, which can name a recommender or a list title.
 */

/** Spec action values (plus the alert toggle pair). */
export type WatchlistTileAction =
	| "open"
	| "watched"
	| "remove"
	| "add_to_list"
	| "alert_on"
	| "alert_off";

/** Watch tonight reason buckets — mirrors server `WatchlistTonightReasonKind`. */
export type WatchlistReasonKind =
	| "available"
	| "friend"
	| "list"
	| "taste"
	| "recent";

/** Every radial action id `buildCatalogueRadialItemSpecs` can emit. */
export type CatalogueRadialActionId =
	| "open"
	| "copy"
	| "quick-log"
	| "edit-log"
	| "watchlist"
	| "add-to-list"
	| "streaming-alert"
	| "remove-watchlist"
	| "not-interested";

const RADIAL_ACTION_IDS: ReadonlySet<string> = new Set<CatalogueRadialActionId>(
	[
		"open",
		"copy",
		"quick-log",
		"edit-log",
		"watchlist",
		"add-to-list",
		"streaming-alert",
		"remove-watchlist",
		"not-interested",
	],
);

function isCatalogueRadialActionId(id: string): id is CatalogueRadialActionId {
	return RADIAL_ACTION_IDS.has(id);
}

/**
 * Radial id → tracked action, or `null` when the id isn't reported on select.
 * `streaming-alert` is reported as `alert_on` / `alert_off` only after the
 * PATCH succeeds, so it maps to `null` here.
 */
export function watchlistTileActionForRadialId(
	id: string,
): WatchlistTileAction | null {
	if (!isCatalogueRadialActionId(id)) return null;
	switch (id) {
		case "open":
			return "open";
		case "quick-log":
			return "watched";
		case "remove-watchlist":
			return "remove";
		case "add-to-list":
			return "add_to_list";
		case "copy":
		case "edit-log":
		case "watchlist":
		case "streaming-alert":
		case "not-interested":
			return null;
		default: {
			const unhandled: never = id;
			throw new Error(`Unhandled radial action: ${String(unhandled)}`);
		}
	}
}

/** Event props — `mode` is the lobby order, or `null` when unknown. */
export function watchlistTileActionProps(args: {
	mode: string | null | undefined;
	action: WatchlistTileAction;
	reasonKind: WatchlistReasonKind | null | undefined;
}): {
	mode: string | null;
	action: WatchlistTileAction;
	reason: string | null;
} {
	return {
		mode: args.mode ?? null,
		action: args.action,
		reason: args.reasonKind ?? null,
	};
}

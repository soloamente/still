import { describe, expect, test } from "bun:test";

import {
	watchlistTileActionForRadialId,
	watchlistTileActionProps,
} from "./watchlist-tile-analytics";

describe("watchlistTileActionForRadialId", () => {
	test("maps radial ids to spec action values", () => {
		expect(watchlistTileActionForRadialId("open")).toBe("open");
		expect(watchlistTileActionForRadialId("quick-log")).toBe("watched");
		expect(watchlistTileActionForRadialId("remove-watchlist")).toBe("remove");
		expect(watchlistTileActionForRadialId("add-to-list")).toBe("add_to_list");
	});

	test("untracked and unknown ids map to null", () => {
		expect(watchlistTileActionForRadialId("copy")).toBeNull();
		expect(watchlistTileActionForRadialId("edit-log")).toBeNull();
		expect(watchlistTileActionForRadialId("watchlist")).toBeNull();
		// Reported after the PATCH as alert_on / alert_off instead.
		expect(watchlistTileActionForRadialId("streaming-alert")).toBeNull();
		expect(watchlistTileActionForRadialId("not-interested")).toBeNull();
		expect(watchlistTileActionForRadialId("something-new")).toBeNull();
	});
});

describe("watchlistTileActionProps", () => {
	test("sends the reason kind, never caption text; unknown mode is null", () => {
		expect(
			watchlistTileActionProps({
				mode: "tonight",
				action: "open",
				reasonKind: "friend",
			}),
		).toEqual({ mode: "tonight", action: "open", reason: "friend" });
		expect(
			watchlistTileActionProps({
				mode: undefined,
				action: "alert_on",
				reasonKind: undefined,
			}),
		).toEqual({ mode: null, action: "alert_on", reason: null });
	});
});

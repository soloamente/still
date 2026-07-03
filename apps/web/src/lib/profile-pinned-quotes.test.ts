import { describe, expect, test } from "bun:test";

import {
	filterPinnedQuoteLobbyItems,
	normalizePinnedQuoteSaveIds,
} from "./profile-pinned-quotes";
import type { SavedQuoteLobbyItem } from "./quote-saved-types";

function quoteItem(saveId: string): SavedQuoteLobbyItem {
	return {
		saveId,
		savedAt: "2026-01-01T00:00:00.000Z",
		visibility: "public",
		quote: {
			id: `quote-${saveId}`,
			body: "Line",
			speaker: null,
			timestampMs: null,
			timestampLabel: null,
			source: "external_api",
			upvoteCount: 0,
			seasonNumber: null,
			episodeNumber: null,
		},
		listing: {
			kind: "movie",
			id: 1,
			title: "Film",
			posterPath: null,
			posterUrl: null,
			year: 2020,
			seasonNumber: null,
			episodeNumber: null,
		},
	};
}

describe("normalizePinnedQuoteSaveIds", () => {
	test("dedupes and caps at max pins", () => {
		expect(normalizePinnedQuoteSaveIds(["a", "a", "b", "c", "d"])).toEqual([
			"a",
			"b",
			"c",
		]);
	});
});

describe("filterPinnedQuoteLobbyItems", () => {
	test("returns empty when there are no pins", () => {
		expect(filterPinnedQuoteLobbyItems([quoteItem("save-1")], [])).toEqual([]);
	});

	test("drops saves that are not pinned and preserves pin order", () => {
		const items = [
			quoteItem("save-b"),
			quoteItem("save-a"),
			quoteItem("save-c"),
		];
		expect(filterPinnedQuoteLobbyItems(items, ["save-a", "save-c"])).toEqual([
			quoteItem("save-a"),
			quoteItem("save-c"),
		]);
	});
});

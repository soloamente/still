import { describe, expect, test } from "bun:test";

import {
	buildDiaryLobbyHref,
	filterDiaryLogsForLedgerTab,
	resolveDiaryLedgerTab,
} from "./diary-lobby-order";

describe("resolveDiaryLedgerTab", () => {
	test("defaults to movies when both ledgers have rows", () => {
		expect(resolveDiaryLedgerTab(null, 10, 80)).toBe("movies");
	});

	test("defaults to tv when only TV rows exist", () => {
		expect(resolveDiaryLedgerTab(null, 0, 12)).toBe("tv");
	});

	test("honours explicit tab param", () => {
		expect(resolveDiaryLedgerTab("tv", 10, 80)).toBe("tv");
	});
});

describe("buildDiaryLobbyHref", () => {
	test("always includes tab and omits default order/venue", () => {
		expect(
			buildDiaryLobbyHref({
				tab: "movies",
				order: "latest_seen",
				venue: "streaming",
			}),
		).toBe("/diary?tab=movies");
	});

	test("preserves non-default order and venue", () => {
		expect(
			buildDiaryLobbyHref({
				tab: "tv",
				order: "earliest_seen",
				venue: "theaters",
			}),
		).toBe("/diary?tab=tv&order=earliest&venue=theaters");
	});
});

describe("filterDiaryLogsForLedgerTab", () => {
	test("splits movie and TV rows", () => {
		const rows = [
			{ movie: { title: "A" }, tv: null, log: { id: "1" } },
			{ movie: null, tv: { title: "B" }, log: { id: "2" } },
		] as Parameters<typeof filterDiaryLogsForLedgerTab>[0];

		expect(filterDiaryLogsForLedgerTab(rows, "movies")).toHaveLength(1);
		expect(filterDiaryLogsForLedgerTab(rows, "tv")).toHaveLength(1);
	});
});

import { describe, expect, test } from "bun:test";
import type { DiaryLogRow } from "@/components/diary/diary-entry";
import {
	buildDiaryLobbyHref,
	filterDiaryLogsForLedgerTab,
	resolveDiaryLedgerTab,
	sortDiaryLobbyRowsForOrder,
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

function movieRow(
	id: string,
	watchedAt: string,
	createdAt: string,
): DiaryLogRow {
	return {
		log: {
			id,
			watchedAt,
			createdAt,
			rating: null,
			liked: false,
			rewatch: false,
			note: null,
		},
		movie: {
			tmdbId: Number(id),
			title: `M${id}`,
			posterPath: null,
			year: null,
		},
		tv: null,
	} as DiaryLogRow;
}

describe("sortDiaryLobbyRowsForOrder tiebreak", () => {
	const sameDay = "2026-05-01T00:00:00.000Z";
	const rows = [
		movieRow("1", sameDay, "2026-05-01T09:00:00.000Z"), // logged first
		movieRow("2", sameDay, "2026-05-01T18:00:00.000Z"), // logged later
	];

	test("latest_seen puts the later-created row first on watchedAt ties", () => {
		const out = sortDiaryLobbyRowsForOrder(rows, "latest_seen");
		expect(out.map((r) => r.log.id)).toEqual(["2", "1"]);
	});

	test("earliest_seen puts the earlier-created row first on watchedAt ties", () => {
		const out = sortDiaryLobbyRowsForOrder(rows, "earliest_seen");
		expect(out.map((r) => r.log.id)).toEqual(["1", "2"]);
	});
});

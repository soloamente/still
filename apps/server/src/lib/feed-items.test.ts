import { describe, expect, it } from "bun:test";

import {
	compareFeedRows,
	feedAtMs,
	isFeedRowOlderThanCursor,
	listActivityAt,
	sortFeedRows,
} from "./feed-items";

describe("feedAtMs", () => {
	it("orders log activity by createdAt ahead of backdated watchedAt", () => {
		const reviewAt = new Date("2026-06-07T10:05:00Z");
		const logCreatedAt = new Date("2026-06-07T11:00:00Z");
		const logWatchedAt = new Date("2026-06-07T02:00:00Z");

		const merged = [
			{ kind: "review" as const, at: reviewAt },
			{ kind: "log" as const, at: logCreatedAt },
		].sort((a, b) => feedAtMs(b.at) - feedAtMs(a.at));

		expect(merged[0]?.kind).toBe("log");
		expect(feedAtMs(logWatchedAt)).toBeLessThan(feedAtMs(reviewAt));
	});
});

describe("compareFeedRows", () => {
	it("orders by at desc", () => {
		const newer = {
			kind: "review" as const,
			at: "2026-06-07T12:00:00.000Z",
			id: "a",
		};
		const older = {
			kind: "log" as const,
			at: "2026-06-07T10:00:00.000Z",
			id: "b",
		};
		expect(compareFeedRows(newer, older)).toBeLessThan(0);
		expect(compareFeedRows(older, newer)).toBeGreaterThan(0);
	});

	it("at equal — log before review", () => {
		const at = "2026-06-07T12:00:00.000Z";
		const log = { kind: "log" as const, at, id: "l1" };
		const review = { kind: "review" as const, at, id: "r1" };
		expect(compareFeedRows(log, review)).toBeLessThan(0);
	});

	it("cursor keeps same-second log when cursor is review", () => {
		const at = "2026-06-07T12:00:00.000Z";
		const cursor = { kind: "review" as const, at, id: "r1" };
		const log = { kind: "log" as const, at, id: "l1" };
		expect(isFeedRowOlderThanCursor(log, cursor)).toBe(false);
		expect(isFeedRowOlderThanCursor(cursor, log)).toBe(true);
	});
});

describe("sortFeedRows", () => {
	it("log with newer createdAt beats older review despite backdated watch", () => {
		const rows = sortFeedRows([
			{
				kind: "review",
				at: "2026-06-07T10:05:00.000Z",
				id: "r1",
			},
			{
				kind: "log",
				at: "2026-06-07T11:00:00.000Z",
				id: "l1",
			},
		]);
		expect(rows[0]?.kind).toBe("log");
	});
});

describe("listActivityAt", () => {
	it("uses createdAt when metadata updatedAt is newer but no item add", () => {
		const createdAt = new Date("2026-06-07T08:00:00.000Z");
		const at = listActivityAt({ createdAt }, null);
		expect(at.getTime()).toBe(createdAt.getTime());
	});

	it("uses latest list_item.addedAt when newer than createdAt", () => {
		const createdAt = new Date("2026-06-07T08:00:00.000Z");
		const addedAt = new Date("2026-06-07T12:00:00.000Z");
		const at = listActivityAt({ createdAt }, addedAt);
		expect(at.getTime()).toBe(addedAt.getTime());
	});
});

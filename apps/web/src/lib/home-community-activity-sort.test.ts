import { describe, expect, it } from "bun:test";

import {
	activityFeedCursorFromItem,
	type HomeCommunityActivityItem,
	sortActivityItems,
} from "./home-community-activity";

describe("sortActivityItems", () => {
	it("re-sorts appended page into desc order", () => {
		const review: HomeCommunityActivityItem = {
			kind: "review",
			at: "2026-06-07T10:00:00.000Z",
			payload: { review: { id: "r1" } },
		};
		const log: HomeCommunityActivityItem = {
			kind: "log",
			at: "2026-06-07T11:00:00.000Z",
			payload: { log: { id: "l1" } },
		};
		const sorted = sortActivityItems([
			review,
			{
				kind: "list",
				at: "2026-06-07T09:00:00.000Z",
				payload: { list: { id: "x" } },
			},
			log,
		]);
		expect(sorted[0]?.kind).toBe("log");
		expect(sorted[1]?.kind).toBe("review");
	});
});

describe("activityFeedCursorFromItem", () => {
	it("builds composite cursor from last row", () => {
		const item: HomeCommunityActivityItem = {
			kind: "review",
			at: "2026-06-07T10:00:00.000Z",
			payload: { review: { id: "r1" } },
		};
		expect(activityFeedCursorFromItem(item)).toEqual({
			before: "2026-06-07T10:00:00.000Z",
			beforeKind: "review",
			beforeId: "r1",
		});
	});
});

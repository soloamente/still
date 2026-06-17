import { describe, expect, test } from "bun:test";

import {
	parseRealtimeStreamRoomsParam,
	parseXReadResult,
	REALTIME_STREAM_MAX_ROOMS,
} from "@/lib/realtime-stream-read";

describe("realtime-stream-read", () => {
	test("parseRealtimeStreamRoomsParam dedupes and trims", () => {
		expect(
			parseRealtimeStreamRoomsParam("user:u1:inbox, review:rev_1 "),
		).toEqual(["user:u1:inbox", "review:rev_1"]);
	});

	test("parseRealtimeStreamRoomsParam rejects empty and over-max lists", () => {
		expect(parseRealtimeStreamRoomsParam(null)).toBeNull();
		expect(parseRealtimeStreamRoomsParam("   ")).toBeNull();
		expect(
			parseRealtimeStreamRoomsParam(
				Array.from(
					{ length: REALTIME_STREAM_MAX_ROOMS + 1 },
					(_, i) => `room:${i}`,
				).join(","),
			),
		).toBeNull();
	});

	test("parseXReadResult flattens Redis stream messages", () => {
		const entries = parseXReadResult([
			[
				"sense:stream:review:rev_1",
				[
					[
						"1700000000000-0",
						["data", JSON.stringify({ type: "comment.created" })],
					],
				],
			],
		]);

		expect(entries).toEqual([
			{
				streamKey: "sense:stream:review:rev_1",
				entryId: "1700000000000-0",
				fields: { data: JSON.stringify({ type: "comment.created" }) },
			},
		]);
	});

	test("parseXReadResult returns empty array for null timeout", () => {
		expect(parseXReadResult(null)).toEqual([]);
	});
});

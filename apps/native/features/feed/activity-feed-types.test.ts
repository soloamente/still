import { describe, expect, test } from "bun:test";
import {
	activityRowKey,
	coerceActivityTimestamp,
	parseFeedApiActivityItems,
} from "./activity-feed-types";

describe("parseFeedApiActivityItems", () => {
	test("keeps only known kinds and coerces timestamps", () => {
		const out = parseFeedApiActivityItems({
			items: [
				{
					kind: "log",
					at: "2026-06-04T10:00:00.000Z",
					payload: { log: { id: "L1" } },
				},
				{ kind: "bogus", at: "2026-06-04T09:00:00.000Z", payload: {} },
				{
					kind: "review",
					at: new Date("2026-06-04T08:00:00.000Z"),
					payload: { review: { id: "R1" } },
				},
			],
		});
		expect(out).toHaveLength(2);
		expect(out[0].kind).toBe("log");
		expect(out[1].at).toBe("2026-06-04T08:00:00.000Z");
	});
	test("handles null / missing items", () => {
		expect(parseFeedApiActivityItems(null)).toEqual([]);
		expect(parseFeedApiActivityItems(undefined)).toEqual([]);
		expect(parseFeedApiActivityItems({})).toEqual([]);
	});
});

describe("activityRowKey", () => {
	test("uses entity id per kind", () => {
		expect(
			activityRowKey({ kind: "log", at: "x", payload: { log: { id: "L1" } } }),
		).toBe("log:L1");
		expect(
			activityRowKey({
				kind: "review",
				at: "x",
				payload: { review: { id: "R1" } },
			}),
		).toBe("review:R1");
		expect(
			activityRowKey({
				kind: "list",
				at: "x",
				payload: { list: { id: "S1" } },
			}),
		).toBe("list:S1");
	});
	test("divergence keys off media id", () => {
		expect(
			activityRowKey({ kind: "divergence", at: "x", payload: { movieId: 42 } }),
		).toBe("divergence:m:42");
		expect(
			activityRowKey({ kind: "divergence", at: "x", payload: { tvId: 7 } }),
		).toBe("divergence:t:7");
	});
	test("falls back to kind:at when id missing", () => {
		expect(activityRowKey({ kind: "log", at: "T", payload: {} })).toBe("log:T");
	});
});

describe("coerceActivityTimestamp", () => {
	test("Date → ISO, string passthrough, else now", () => {
		expect(coerceActivityTimestamp(new Date("2026-01-01T00:00:00.000Z"))).toBe(
			"2026-01-01T00:00:00.000Z",
		);
		expect(coerceActivityTimestamp("2026-02-02")).toBe("2026-02-02");
		expect(typeof coerceActivityTimestamp(123)).toBe("string");
	});
});

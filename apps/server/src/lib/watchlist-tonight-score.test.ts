import { describe, expect, test } from "bun:test";
import {
	rankWatchlistTonight,
	scoreWatchlistTonight,
	type WatchlistTonightSignals,
} from "./watchlist-tonight-score";

const NOW = new Date("2026-09-23T12:00:00Z");
function signals(
	over: Partial<WatchlistTonightSignals> = {},
): WatchlistTonightSignals {
	return {
		providerName: null,
		recommenders: [],
		ownListTitle: null,
		tasteAffinity: 0,
		addedAt: new Date("2026-01-01T00:00:00Z"),
		now: NOW,
		...over,
	};
}

describe("scoreWatchlistTonight", () => {
	test("no signals → score 0, no pill", () => {
		expect(scoreWatchlistTonight(signals())).toEqual({
			score: 0,
			reason: null,
		});
	});
	test("availability is the strongest signal", () => {
		const r = scoreWatchlistTonight(
			signals({
				providerName: "Netflix",
				recommenders: [{ name: "Maya", scrubbed: false }],
			}),
		);
		expect(r.score).toBe(70);
		expect(r.reason).toEqual({ kind: "available", label: "Now on Netflix" });
	});
	test("friend recs: +5 per extra sender, capped at 40", () => {
		const many = Array.from({ length: 5 }, (_, i) => ({
			name: `P${i}`,
			scrubbed: false,
		}));
		const r = scoreWatchlistTonight(signals({ recommenders: many }));
		expect(r.score).toBe(40);
		expect(r.reason).toEqual({
			kind: "friend",
			label: "P0 and 4 others recommended",
		});
	});
	test("two friends → singular 'other'", () => {
		const r = scoreWatchlistTonight(
			signals({
				recommenders: [
					{ name: "Maya", scrubbed: false },
					{ name: "Ben", scrubbed: false },
				],
			}),
		);
		expect(r.reason?.label).toBe("Maya and 1 other recommended");
	});
	test("single friend label", () => {
		const r = scoreWatchlistTonight(
			signals({ recommenders: [{ name: "Maya", scrubbed: false }] }),
		);
		expect(r.reason?.label).toBe("Maya recommended");
	});
	test("scrubbed recs count but never name anyone", () => {
		const r = scoreWatchlistTonight(
			signals({ recommenders: [{ name: "Maya", scrubbed: true }] }),
		);
		expect(r.score).toBe(30);
		expect(r.reason).toEqual({ kind: "friend", label: "Recommended to you" });
	});
	test("own list reason", () => {
		const r = scoreWatchlistTonight(signals({ ownListTitle: "Heist nights" }));
		expect(r).toEqual({
			score: 20,
			reason: { kind: "list", label: "On your Heist nights list" },
		});
	});
	test("taste affinity scales 0–20 and clamps", () => {
		expect(scoreWatchlistTonight(signals({ tasteAffinity: 0.5 })).score).toBe(
			10,
		);
		expect(scoreWatchlistTonight(signals({ tasteAffinity: 3 })).reason).toEqual(
			{
				kind: "taste",
				label: "Matches your taste",
			},
		);
	});
	test("recency: full 10 today, 0 after 30 days", () => {
		expect(scoreWatchlistTonight(signals({ addedAt: NOW })).score).toBe(10);
		expect(scoreWatchlistTonight(signals({ addedAt: NOW })).reason?.label).toBe(
			"Added recently",
		);
		const old = new Date(NOW.getTime() - 31 * 86_400_000);
		expect(scoreWatchlistTonight(signals({ addedAt: old })).score).toBe(0);
	});
	test("recency pill only under 3 days; older saves still score", () => {
		const twoDays = new Date(NOW.getTime() - 2 * 86_400_000);
		expect(
			scoreWatchlistTonight(signals({ addedAt: twoDays })).reason?.label,
		).toBe("Added recently");
		const fiveDays = new Date(NOW.getTime() - 5 * 86_400_000);
		const r = scoreWatchlistTonight(signals({ addedAt: fiveDays }));
		expect(r.score).toBeGreaterThan(0);
		expect(r.reason).toBeNull();
	});
	test("stale recency never outranks a weaker real signal for the pill", () => {
		const fiveDays = new Date(NOW.getTime() - 5 * 86_400_000);
		const r = scoreWatchlistTonight(
			signals({ addedAt: fiveDays, tasteAffinity: 0.1 }),
		);
		expect(r.reason?.kind).toBe("taste");
	});
	test("tie in contribution breaks in table order (list beats taste)", () => {
		const r = scoreWatchlistTonight(
			signals({ ownListTitle: "X", tasteAffinity: 1 }),
		);
		expect(r.reason?.kind).toBe("list");
	});
});

describe("rankWatchlistTonight", () => {
	test("orders by score, then newest save, then key", () => {
		const rows = [
			{
				key: "movie:2",
				signals: signals({ addedAt: new Date("2026-01-02T00:00:00Z") }),
			},
			{ key: "movie:1", signals: signals({ providerName: "Max" }) },
			{
				key: "movie:3",
				signals: signals({ addedAt: new Date("2026-01-02T00:00:00Z") }),
			},
		];
		expect(rankWatchlistTonight(rows).map((r) => r.key)).toEqual([
			"movie:1",
			"movie:2",
			"movie:3",
		]);
	});
});

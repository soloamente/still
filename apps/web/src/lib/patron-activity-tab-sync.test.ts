import { describe, expect, test } from "bun:test";

import {
	aggregatePatronActivityFromTabs,
	PATRON_ACTIVITY_TAB_STALE_MS,
} from "./patron-activity-tab-sync";

describe("aggregatePatronActivityFromTabs", () => {
	const now = 1_000_000;

	test("single active tab is active", () => {
		expect(
			aggregatePatronActivityFromTabs(
				new Map([["a", { state: "active", at: now }]]),
				now,
			),
		).toBe("active");
	});

	test("single away tab is away", () => {
		expect(
			aggregatePatronActivityFromTabs(
				new Map([["a", { state: "away", at: now }]]),
				now,
			),
		).toBe("away");
	});

	test("any active tab keeps patron active", () => {
		expect(
			aggregatePatronActivityFromTabs(
				new Map([
					["a", { state: "away", at: now }],
					["b", { state: "active", at: now }],
				]),
				now,
			),
		).toBe("active");
	});

	test("all live tabs away is away", () => {
		expect(
			aggregatePatronActivityFromTabs(
				new Map([
					["a", { state: "away", at: now }],
					["b", { state: "away", at: now - 1_000 }],
				]),
				now,
			),
		).toBe("away");
	});

	test("ignores stale tabs when another tab is active", () => {
		expect(
			aggregatePatronActivityFromTabs(
				new Map([
					[
						"stale",
						{
							state: "away",
							at: now - PATRON_ACTIVITY_TAB_STALE_MS - 1,
						},
					],
					["live", { state: "active", at: now }],
				]),
				now,
			),
		).toBe("active");
	});
});

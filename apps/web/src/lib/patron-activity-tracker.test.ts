import { describe, expect, test } from "bun:test";

import {
	derivePatronActivityState,
	PATRON_AFK_IDLE_MS,
} from "./patron-activity-tracker";

describe("derivePatronActivityState", () => {
	const now = 1_000_000;

	test("hidden document is away", () => {
		expect(
			derivePatronActivityState({
				nowMs: now,
				lastInputAtMs: now,
				documentHidden: true,
			}),
		).toBe("away");
	});

	test("idle 5 min on visible tab is away", () => {
		expect(
			derivePatronActivityState({
				nowMs: now,
				lastInputAtMs: now - PATRON_AFK_IDLE_MS,
				documentHidden: false,
			}),
		).toBe("away");
	});

	test("recent input on visible tab is active", () => {
		expect(
			derivePatronActivityState({
				nowMs: now,
				lastInputAtMs: now - 60_000,
				documentHidden: false,
			}),
		).toBe("active");
	});

	test("idle just under threshold stays active", () => {
		expect(
			derivePatronActivityState({
				nowMs: now,
				lastInputAtMs: now - PATRON_AFK_IDLE_MS + 1,
				documentHidden: false,
			}),
		).toBe("active");
	});
});

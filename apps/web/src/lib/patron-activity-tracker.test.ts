import { describe, expect, test } from "bun:test";

import {
	buildPresenceHeartbeatBody,
	derivePatronActivityState,
	PATRON_AFK_IDLE_MS,
	shouldEmitPatronActivityFlip,
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

describe("shouldEmitPatronActivityFlip", () => {
	test("skips initial mount", () => {
		expect(shouldEmitPatronActivityFlip(null, "active")).toBe(false);
	});

	test("emits on active to away", () => {
		expect(shouldEmitPatronActivityFlip("active", "away")).toBe(true);
	});

	test("emits on away to active", () => {
		expect(shouldEmitPatronActivityFlip("away", "active")).toBe(true);
	});

	test("skips duplicate state", () => {
		expect(shouldEmitPatronActivityFlip("away", "away")).toBe(false);
	});
});

describe("buildPresenceHeartbeatBody", () => {
	test("includes activityState in heartbeat payload", () => {
		expect(buildPresenceHeartbeatBody("patron:app", "away")).toEqual({
			room: "patron:app",
			activityState: "away",
		});
	});
});

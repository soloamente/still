import { describe, expect, test } from "bun:test";

import { companionLivePositionSec } from "./discord-activity-display";

describe("companionLivePositionSec", () => {
	test("keeps counting from the sample while playing", () => {
		const sampledAtMs = Date.parse("2026-09-30T00:00:00.000Z");
		expect(
			companionLivePositionSec({
				positionSec: 100,
				durationSec: 3600,
				playing: true,
				sampledAtMs,
				nowMs: sampledAtMs + 30_000,
			}),
		).toBe(130);
	});

	test("stays on the snapshot while paused", () => {
		const sampledAtMs = Date.parse("2026-09-30T00:00:00.000Z");
		expect(
			companionLivePositionSec({
				positionSec: 100,
				durationSec: 3600,
				playing: false,
				sampledAtMs,
				nowMs: sampledAtMs + 30_000,
			}),
		).toBe(100);
	});

	test("does not run past the duration", () => {
		expect(
			companionLivePositionSec({
				positionSec: 3590,
				durationSec: 3600,
				playing: true,
				sampledAtMs: 0,
				nowMs: 30_000,
			}),
		).toBe(3600);
	});

	test("ignores a sample time that is not a number", () => {
		expect(
			companionLivePositionSec({
				positionSec: 40,
				durationSec: 3600,
				playing: true,
				sampledAtMs: Number.NaN,
				nowMs: 90_000,
			}),
		).toBe(40);
	});
});

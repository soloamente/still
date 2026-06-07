import { afterEach, describe, expect, it } from "bun:test";

import { formatActivityWatchTimestamp } from "./format";

describe("formatActivityWatchTimestamp", () => {
	const realDateNow = Date.now;

	afterEach(() => {
		Date.now = realDateNow;
	});

	it("labels today's watch date as today", () => {
		Date.now = () => new Date("2026-06-07T15:00:00").getTime();
		expect(formatActivityWatchTimestamp(new Date("2026-06-07T12:00:00"))).toBe(
			"today",
		);
	});

	it("labels yesterday's watch date", () => {
		Date.now = () => new Date("2026-06-07T15:00:00").getTime();
		expect(formatActivityWatchTimestamp(new Date("2026-06-06T12:00:00"))).toBe(
			"yesterday",
		);
	});

	it("formats older watch dates without misleading ago labels", () => {
		Date.now = () => new Date("2026-06-07T15:00:00").getTime();
		expect(formatActivityWatchTimestamp(new Date("2026-05-20T12:00:00"))).toBe(
			"May 20",
		);
	});
});

import { describe, expect, test } from "bun:test";

import { getTimestamps } from "../../vendor/premid-activities/premid/src/functions/getTimestamps.ts";
import { getTimestampsFromMedia } from "../../vendor/premid-activities/premid/src/functions/getTimestampsFromMedia.ts";

describe("timestamp helpers", () => {
	test("turns playback position into start and end unix seconds", () => {
		const before = Math.floor(Date.now() / 1000);
		const [start, end] = getTimestamps(30, 3600);
		const after = Math.floor(Date.now() / 1000);

		expect(end - start).toBe(3600);
		expect(start).toBeGreaterThanOrEqual(before - 30);
		expect(start).toBeLessThanOrEqual(after - 30);
	});

	test("reads start and end from a playing media element", () => {
		const media = {
			readyState: 4,
			currentTime: 12,
			duration: 90,
		} as HTMLMediaElement;

		const [start, end] = getTimestampsFromMedia(media);
		expect(end - start).toBe(90);
		expect(start).toBeGreaterThan(0);
	});

	test("returns zeros when the media element has no duration yet", () => {
		const media = {
			readyState: 0,
			currentTime: 0,
			duration: Number.NaN,
		} as HTMLMediaElement;

		expect(getTimestampsFromMedia(media)).toEqual([0, 0]);
	});
});

import { describe, expect, test } from "bun:test";

import { shouldRejectDevotedRequest } from "./devoted-request";

describe("shouldRejectDevotedRequest", () => {
	test("accepts when patron is not Devoted and has no recent request", () => {
		expect(
			shouldRejectDevotedRequest({
				effectiveTier: "immersed",
				recentRequestCount: 0,
			}),
		).toBeNull();
	});

	test("rejects when patron already has Devoted effective tier", () => {
		expect(
			shouldRejectDevotedRequest({
				effectiveTier: "devoted",
				recentRequestCount: 0,
			}),
		).toBe("already_devoted");
	});

	test("rejects when a request was sent within the cooldown window", () => {
		expect(
			shouldRejectDevotedRequest({
				effectiveTier: "still",
				recentRequestCount: 1,
			}),
		).toBe("already_requested");
	});
});

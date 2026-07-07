import { describe, expect, test } from "bun:test";

import { readNotificationPrefsFromProfile } from "./notification-preferences";

describe("notification-preferences", () => {
	test("defaults review likes to off", () => {
		const prefs = readNotificationPrefsFromProfile(null);
		expect(prefs["review.liked"]).toBe(false);
		expect(prefs["follow.created"]).toBe(true);
		expect(prefs["mention.in_review_or_comment"]).toBe(true);
	});
});

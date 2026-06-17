import { describe, expect, test } from "bun:test";

import {
	computeNotificationsUnreadCount,
	shouldRunNotificationsInboxPoll,
} from "@/lib/notifications-inbox-poll";

describe("notifications-inbox-poll helpers", () => {
	test("computeNotificationsUnreadCount counts rows without readAt", () => {
		expect(
			computeNotificationsUnreadCount([
				{ readAt: null },
				{ readAt: "2026-01-01T00:00:00.000Z" },
				{ readAt: null },
			]),
		).toBe(2);
	});

	test("shouldRunNotificationsInboxPoll is true only when tab is visible", () => {
		expect(shouldRunNotificationsInboxPoll("visible")).toBe(true);
		expect(shouldRunNotificationsInboxPoll("hidden")).toBe(false);
	});
});

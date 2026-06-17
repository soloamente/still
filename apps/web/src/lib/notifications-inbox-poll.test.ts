import { describe, expect, test } from "bun:test";

import {
	computeNotificationsUnreadCount,
	decrementUnread,
	NOTIFICATIONS_INBOX_POLL_INTERVAL_MS,
	shouldRunNotificationsInboxPoll,
} from "./notifications-inbox-poll";

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

describe("decrementUnread", () => {
	test("decrements by one", () => {
		expect(decrementUnread(3)).toBe(2);
	});

	test("never goes below zero", () => {
		expect(decrementUnread(0)).toBe(0);
	});
});

describe("NOTIFICATIONS_INBOX_POLL_INTERVAL_MS", () => {
	test("is the slow 5-minute safety net (SSE handles freshness)", () => {
		expect(NOTIFICATIONS_INBOX_POLL_INTERVAL_MS).toBe(300_000);
	});
});

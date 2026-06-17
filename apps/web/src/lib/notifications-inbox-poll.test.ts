import { describe, expect, test } from "bun:test";

import {
	decrementUnread,
	NOTIFICATIONS_INBOX_POLL_INTERVAL_MS,
} from "./notifications-inbox-poll";

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

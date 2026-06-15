import { describe, expect, test } from "bun:test";

import {
	isNotificationEnabled,
	type NotificationKind,
	type NotificationPrefs,
	readNotificationPrefs,
} from "./notification-delivery";

describe("notification-delivery", () => {
	test("readNotificationPrefs uses registry defaults", () => {
		const prefs = readNotificationPrefs(null);
		expect(prefs["follow.created"]).toBe(true);
		expect(prefs["review.liked"]).toBe(false);
	});

	test("readNotificationPrefs merges stored overrides", () => {
		const prefs = readNotificationPrefs({
			notifications: {
				"follow.created": false,
				"review.liked": true,
			},
		});
		expect(prefs["follow.created"]).toBe(false);
		expect(prefs["review.liked"]).toBe(true);
		expect(prefs["chat.message"]).toBe(true);
	});

	test("isNotificationEnabled skips self", () => {
		const prefs = readNotificationPrefs(null);
		expect(
			isNotificationEnabled(prefs, "follow.created", "u1", {
				actorUserId: "u1",
			}),
		).toBe(false);
	});

	test("isNotificationEnabled gates review.liked on mutual", () => {
		const prefs: NotificationPrefs = {
			...readNotificationPrefs(null),
			"review.liked": true,
		};
		expect(
			isNotificationEnabled(prefs, "review.liked", "author", {
				actorUserId: "liker",
				isMutual: false,
			}),
		).toBe(false);
		expect(
			isNotificationEnabled(prefs, "review.liked", "author", {
				actorUserId: "liker",
				isMutual: true,
			}),
		).toBe(true);
	});

	test("review.liked stays off by default even without mutual context", () => {
		const prefs = readNotificationPrefs(null);
		expect(
			isNotificationEnabled(prefs, "review.liked", "author", {
				actorUserId: "liker",
			}),
		).toBe(false);
	});

	test("unknown stored keys do not break merge", () => {
		const prefs = readNotificationPrefs({
			notifications: { "not.a.kind": true },
		});
		const kinds: NotificationKind[] = [
			"follow.created",
			"badge.awarded",
			"quote.submission.approved",
			"quote.submission.rejected",
		];
		for (const k of kinds) expect(typeof prefs[k]).toBe("boolean");
	});
});

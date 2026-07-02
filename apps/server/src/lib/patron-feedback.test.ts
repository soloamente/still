import { describe, expect, test } from "bun:test";

import {
	buildFeedbackNotificationHref,
	isFeedbackUnread,
	parsePatronFeedbackInput,
	validateFeedbackMessageBody,
} from "./patron-feedback";

describe("parsePatronFeedbackInput", () => {
	test("accepts valid bug report", () => {
		const out = parsePatronFeedbackInput({
			category: "bug",
			body: "  The slider is broken on mobile  ",
			pageUrl: "/movies/550",
		});
		expect(out.category).toBe("bug");
		expect(out.body).toBe("The slider is broken on mobile");
		expect(out.pageUrl).toBe("/movies/550");
	});

	test("rejects short body", () => {
		expect(() =>
			parsePatronFeedbackInput({ category: "idea", body: "short" }),
		).toThrow(/at least 10/i);
	});

	test("rejects absolute pageUrl", () => {
		expect(() =>
			parsePatronFeedbackInput({
				category: "other",
				body: "Something is wrong here",
				pageUrl: "https://evil.com",
			}),
		).toThrow(/page url/i);
	});

	test("rejects invalid category", () => {
		expect(() =>
			parsePatronFeedbackInput({
				category: "feature" as "bug",
				body: "Valid length message",
			}),
		).toThrow(/category/i);
	});
});

describe("validateFeedbackMessageBody", () => {
	test("trims staff reply bodies", () => {
		expect(validateFeedbackMessageBody("  Thanks for the report  ")).toBe(
			"Thanks for the report",
		);
	});
});

describe("buildFeedbackNotificationHref", () => {
	test("returns home deep link", () => {
		expect(buildFeedbackNotificationHref("fb_abc")).toBe(
			"/home?feedback=fb_abc",
		);
	});
});

describe("isFeedbackUnread", () => {
	test("unread when staff replied after patron read", () => {
		expect(
			isFeedbackUnread({
				lastStaffReplyAt: new Date("2026-01-02T12:00:00Z"),
				patronLastReadAt: new Date("2026-01-01T12:00:00Z"),
			}),
		).toBe(true);
	});

	test("not unread when patron read after staff reply", () => {
		expect(
			isFeedbackUnread({
				lastStaffReplyAt: new Date("2026-01-01T12:00:00Z"),
				patronLastReadAt: new Date("2026-01-02T12:00:00Z"),
			}),
		).toBe(false);
	});

	test("unread when staff replied and patron never opened thread", () => {
		expect(
			isFeedbackUnread({
				lastStaffReplyAt: new Date("2026-01-02T12:00:00Z"),
				patronLastReadAt: null,
			}),
		).toBe(true);
	});

	test("not unread when no staff reply", () => {
		expect(
			isFeedbackUnread({
				lastStaffReplyAt: null,
				patronLastReadAt: null,
			}),
		).toBe(false);
	});
});

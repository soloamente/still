import { describe, expect, test } from "bun:test";

import {
	autologErrorToastCopy,
	readCompanionAutoLogReport,
} from "./autolog-error-notice";

describe("autolog error copy", () => {
	test("early no_match uses Option A warning", () => {
		const copy = autologErrorToastCopy({
			type: "sense-companion:autolog-error",
			title: "Mystery Film",
			titleUrl: null,
			senseHomeUrl: "https://sense.fans/home",
			report: {
				status: "unmatched",
				reason: "no_match",
				timing: "early",
			},
		});
		expect(copy?.headline).toBe("Couldn’t match this to Sense");
		expect(copy?.actionLabel).toBe("Log it yourself");
	});

	test("late no_match uses Option A error", () => {
		const copy = autologErrorToastCopy({
			type: "sense-companion:autolog-error",
			title: "Mystery Film",
			titleUrl: null,
			senseHomeUrl: "https://sense.fans/home",
			report: {
				status: "unmatched",
				reason: "no_match",
				timing: "late",
			},
		});
		expect(copy?.headline).toBe("Didn’t auto-log — title not found");
	});

	test("parses autoLog from the heartbeat payload", () => {
		expect(
			readCompanionAutoLogReport({
				status: "failed",
				reason: "write",
				timing: "late",
			}),
		).toEqual({
			status: "failed",
			reason: "write",
			timing: "late",
		});
	});
});

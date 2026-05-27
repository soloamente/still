import { describe, expect, test } from "bun:test";

import {
	quickLogSheetHeading,
	quickLogSubmitLabel,
} from "@/lib/quick-log-copy";

describe("quickLogSubmitLabel", () => {
	test("movie first watch", () => {
		expect(
			quickLogSubmitLabel({
				isSeries: false,
				rewatch: false,
				logScope: "show",
			}),
		).toBe("Add movie");
	});

	test("movie rewatch", () => {
		expect(
			quickLogSubmitLabel({
				isSeries: false,
				rewatch: true,
				logScope: "show",
			}),
		).toBe("Log rewatch");
	});

	test("TV season rewatch", () => {
		expect(
			quickLogSubmitLabel({
				isSeries: true,
				rewatch: true,
				logScope: "season",
			}),
		).toBe("Log season again");
	});
});

describe("quickLogSheetHeading", () => {
	test("episode rewatch", () => {
		expect(
			quickLogSheetHeading({
				isSeries: true,
				rewatch: true,
				logScope: "episode",
			}),
		).toBe("How was this episode rewatch?");
	});
});

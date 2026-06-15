import { describe, expect, test } from "bun:test";

import {
	formatQuoteTimestampMs,
	parseQuoteTimestampInput,
} from "./quote-timestamp";

describe("formatQuoteTimestampMs", () => {
	test("formats sub-hour runtime", () => {
		expect(formatQuoteTimestampMs(834_000)).toBe("00:13:54");
	});

	test("formats hour-plus runtime", () => {
		expect(formatQuoteTimestampMs(3_723_000)).toBe("01:02:03");
	});
});

describe("parseQuoteTimestampInput", () => {
	test("parses H:MM:SS", () => {
		expect(parseQuoteTimestampInput("1:02:03")).toBe(3_723_000);
	});

	test("parses MM:SS", () => {
		expect(parseQuoteTimestampInput("13:54")).toBe(834_000);
	});

	test("returns null for empty input", () => {
		expect(parseQuoteTimestampInput("")).toBeNull();
	});

	test("throws on invalid segments", () => {
		expect(() => parseQuoteTimestampInput("abc")).toThrow();
		expect(() => parseQuoteTimestampInput("1:99:00")).toThrow();
	});
});

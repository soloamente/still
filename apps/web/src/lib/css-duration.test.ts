import { describe, expect, test } from "bun:test";
import { parseCssDurationMs } from "./css-duration";

describe("parseCssDurationMs", () => {
	test("parses ms values", () => {
		expect(parseCssDurationMs("200ms")).toBe(200);
		expect(parseCssDurationMs(" 380ms ")).toBe(380);
	});

	test("parses s values including leading-dot forms browsers serialize", () => {
		expect(parseCssDurationMs(".2s")).toBe(200);
		expect(parseCssDurationMs("0.2s")).toBe(200);
		expect(parseCssDurationMs("1s")).toBe(1000);
	});

	test("falls back on empty, invalid, or non-positive", () => {
		expect(parseCssDurationMs("", 180)).toBe(180);
		expect(parseCssDurationMs("nope", 180)).toBe(180);
		expect(parseCssDurationMs("0s", 180)).toBe(180);
		expect(parseCssDurationMs("-1ms", 180)).toBe(180);
	});
});

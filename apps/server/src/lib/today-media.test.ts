import { describe, expect, test } from "bun:test";

import { parseTodayMediaParam } from "./today-media";

describe("parseTodayMediaParam", () => {
	test("omitted media is the current mixed movie path", () => {
		expect(parseTodayMediaParam(undefined)).toBe("all");
		expect(parseTodayMediaParam("")).toBe("all");
	});

	test("tv is the only accepted filter", () => {
		expect(parseTodayMediaParam("tv")).toBe("tv");
	});

	test("movie and any other value are invalid", () => {
		expect(parseTodayMediaParam("movie")).toBe("invalid");
		expect(parseTodayMediaParam("shows")).toBe("invalid");
	});
});

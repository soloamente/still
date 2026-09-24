import { describe, expect, test } from "bun:test";

import { todaySlideExitEnabled, todaySlidePage } from "./home-today-slide";

describe("todaySlidePage", () => {
	test("movies is page 1 and tv is page 2", () => {
		expect(todaySlidePage("movies")).toBe("1");
		expect(todaySlidePage("tv")).toBe("2");
	});
});

describe("todaySlideExitEnabled", () => {
	test("first paint does not slide in from an empty side", () => {
		expect(todaySlideExitEnabled(false)).toBe("0");
		expect(todaySlideExitEnabled(true)).toBe("1");
	});
});

import { describe, expect, test } from "bun:test";

import {
	AUTH_BACKGROUND_INTERVAL_MS,
	AUTH_PAGE_BACKDROP_PATHS,
	AUTH_PAGE_BACKDROPS,
} from "./auth-page-backgrounds";

describe("auth page backdrops", () => {
	test("pool is unique and credited", () => {
		const paths = AUTH_PAGE_BACKDROPS.map((slide) => slide.path);
		const titles = AUTH_PAGE_BACKDROPS.map((slide) => slide.title);
		expect(paths.length).toBeGreaterThan(50);
		expect(new Set(paths).size).toBe(paths.length);
		expect(titles.every((title) => title.trim().length > 0)).toBe(true);
		expect(AUTH_PAGE_BACKDROP_PATHS).toEqual(paths);
	});

	test("hold is short enough to rotate within a sitting", () => {
		expect(AUTH_BACKGROUND_INTERVAL_MS).toBeLessThanOrEqual(20_000);
	});
});

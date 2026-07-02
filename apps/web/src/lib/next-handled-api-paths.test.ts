import { describe, expect, test } from "bun:test";

import { isNextHandledApiPath } from "./next-handled-api-paths";

describe("isNextHandledApiPath", () => {
	test("taste hero media routes stay on Next", () => {
		expect(isNextHandledApiPath("/api/movies/76/title-logo")).toBe(true);
		expect(isNextHandledApiPath("/api/movies/402900/trailer")).toBe(true);
	});

	test("generic movie API paths proxy to Elysia", () => {
		expect(isNextHandledApiPath("/api/movies/76")).toBe(false);
		expect(isNextHandledApiPath("/api/movies/popular")).toBe(false);
	});
});
